using System.Security.Cryptography;
using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Learning.Application.Abstractions;
using EnglishPath.Learning.Domain.Media;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.Application.Media;

/// <summary>Blob storage behind the CDN (Azure Blob + Front Door in production, Azurite locally).</summary>
public interface IMediaStorage
{
    /// <summary>Stores an immutable file and returns its public (CDN) URL.</summary>
    Task<string> SaveAsync(string path, byte[] content, string contentType, CancellationToken cancellationToken);
}

public sealed record ProcessedImage(byte[] Content, int Width, int Height);

/// <summary>Automatic image compression (FR-81).</summary>
public interface IImageProcessor
{
    /// <returns>The image resized and re-encoded as WebP, or null if the bytes aren't a supported image.</returns>
    ProcessedImage? ToWebP(byte[] original, int maxSide);
}

public sealed record MediaAssetDto(Guid Id, string Kind, string Url, string ContentType, long Bytes, int? Width, int? Height, string OriginalFileName, DateTimeOffset UploadedAt);

public sealed record UploadMediaCommand(string FileName, byte[] Content) : IRequest<Result<MediaAssetDto>>, IAuditedCommand
{
    public string AuditAction => "media.uploaded";

    public string? AuditTarget => FileName;
}

public sealed record ListMediaQuery(MediaKind? Kind) : IRequest<Result<IReadOnlyList<MediaAssetDto>>>;

internal sealed class MediaHandlers(
    ILearningDbContext db,
    IMediaStorage storage,
    IImageProcessor images,
    ICurrentUser user,
    IClock clock) :
    IRequestHandler<UploadMediaCommand, Result<MediaAssetDto>>,
    IRequestHandler<ListMediaQuery, Result<IReadOnlyList<MediaAssetDto>>>
{
    public const int MaxBytes = 10 * 1024 * 1024;

    /// <summary>Longest side for lesson images; plenty for a 480 px player column at 2× density.</summary>
    public const int MaxImageSide = 1024;

    public async Task<Result<MediaAssetDto>> Handle(UploadMediaCommand request, CancellationToken cancellationToken)
    {
        if (request.Content.Length == 0 || request.Content.Length > MaxBytes)
        {
            return new Error("media.size", "Files must be between 1 byte and 10 MB.");
        }

        MediaKind kind;
        byte[] content;
        string contentType, extension;
        int? width = null, height = null;

        if (AudioSignature.Detect(request.Content.AsSpan(0, Math.Min(16, request.Content.Length))) is { } audio)
        {
            // Stored as uploaded; neural TTS (FR-83) will produce AAC/Opus directly (NFR-14).
            (kind, content, contentType, extension) = (MediaKind.Audio, request.Content, audio.ContentType, audio.Extension);
        }
        else if (images.ToWebP(request.Content, MaxImageSide) is { } image)
        {
            (kind, content, contentType, extension) = (MediaKind.Image, image.Content, "image/webp", "webp");
            (width, height) = (image.Width, image.Height);
        }
        else
        {
            return new Error("media.type", "Upload a JPEG, PNG, WebP or GIF image, or MP3, M4A/AAC, Ogg/Opus or WebM audio.");
        }

        // Content-addressed: the same file uploaded twice gets the same URL, and URLs never change.
        var hash = Convert.ToHexString(SHA256.HashData(content)).ToLowerInvariant();
        var path = $"{(kind == MediaKind.Image ? "images" : "audio")}/{hash[..2]}/{hash}.{extension}";
        var existing = await db.Media.AsNoTracking().FirstOrDefaultAsync(m => m.Path == path, cancellationToken);
        if (existing is not null)
        {
            return ToDto(existing);
        }

        var url = await storage.SaveAsync(path, content, contentType, cancellationToken);
        var asset = MediaAsset.Create(kind, contentType, path, url, content.Length, width, height, request.FileName, user.UserId, clock.UtcNow);
        db.Media.Add(asset);
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(asset);
    }

    public async Task<Result<IReadOnlyList<MediaAssetDto>>> Handle(ListMediaQuery request, CancellationToken cancellationToken)
    {
        var assets = await db.Media.AsNoTracking()
            .Where(m => request.Kind == null || m.Kind == request.Kind)
            .OrderByDescending(m => m.UploadedAt)
            .Take(200)
            .ToListAsync(cancellationToken);
        return assets.Select(ToDto).ToList();
    }

    private static MediaAssetDto ToDto(MediaAsset m) =>
        new(m.Id, m.Kind.ToString().ToLowerInvariant(), m.Url, m.ContentType, m.Bytes, m.Width, m.Height, m.OriginalFileName, m.UploadedAt);
}
