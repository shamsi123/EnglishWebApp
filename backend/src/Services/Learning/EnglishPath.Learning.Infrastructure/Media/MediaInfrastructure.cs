using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using EnglishPath.Learning.Application.Media;
using Microsoft.Extensions.Configuration;
using SkiaSharp;

namespace EnglishPath.Learning.Infrastructure.Media;

/// <summary>
/// Azure Blob Storage (Azurite locally). Files are served through the CDN at <c>Media:PublicBaseUrl</c>
/// and marked immutable, since their names are content hashes.
/// </summary>
internal sealed class BlobMediaStorage : IMediaStorage
{
    private readonly BlobContainerClient _container;
    private readonly string _publicBaseUrl;
    private readonly SemaphoreSlim _init = new(1, 1);
    private bool _initialised;

    public BlobMediaStorage(IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Media")
            ?? throw new InvalidOperationException("Connection string 'Media' is missing.");
        _container = new BlobContainerClient(connectionString, configuration["Media:Container"] ?? "media");
        _publicBaseUrl = (configuration["Media:PublicBaseUrl"] ?? _container.Uri.ToString()).TrimEnd('/');
    }

    public async Task<string> SaveAsync(string path, byte[] content, string contentType, CancellationToken cancellationToken)
    {
        await EnsureContainerAsync(cancellationToken);
        await _container.GetBlobClient(path).UploadAsync(
            new BinaryData(content),
            new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders { ContentType = contentType, CacheControl = "public, max-age=31536000, immutable" },
            },
            cancellationToken);
        return $"{_publicBaseUrl}/{path}";
    }

    private async Task EnsureContainerAsync(CancellationToken cancellationToken)
    {
        if (_initialised)
        {
            return;
        }

        await _init.WaitAsync(cancellationToken);
        try
        {
            // Public read for blobs only; listing stays private. Production serves through the CDN.
            await _container.CreateIfNotExistsAsync(PublicAccessType.Blob, cancellationToken: cancellationToken);
            _initialised = true;
        }
        finally
        {
            _init.Release();
        }
    }
}

internal sealed class SkiaImageProcessor : IImageProcessor
{
    private const int WebPQuality = 80;

    public ProcessedImage? ToWebP(byte[] original, int maxSide)
    {
        using var codec = SKCodec.Create(new SKMemoryStream(original));
        if (codec is null || codec.EncodedFormat is not (SKEncodedImageFormat.Jpeg or SKEncodedImageFormat.Png or SKEncodedImageFormat.Webp or SKEncodedImageFormat.Gif))
        {
            return null;
        }

        using var decoded = SKBitmap.Decode(codec);
        if (decoded is null)
        {
            return null;
        }

        // Apply EXIF orientation from phone cameras before resizing.
        using var oriented = Orient(decoded, codec.EncodedOrigin);
        var scale = Math.Min(1.0, (double)maxSide / Math.Max(oriented.Width, oriented.Height));
        var width = Math.Max(1, (int)Math.Round(oriented.Width * scale));
        var height = Math.Max(1, (int)Math.Round(oriented.Height * scale));

        using var resized = scale < 1.0 ? oriented.Resize(new SKImageInfo(width, height), SKFilterQuality.High) : oriented.Copy();
        using var image = SKImage.FromBitmap(resized);
        using var data = image.Encode(SKEncodedImageFormat.Webp, WebPQuality);
        return new ProcessedImage(data.ToArray(), width, height);
    }

    private static SKBitmap Orient(SKBitmap bitmap, SKEncodedOrigin origin)
    {
        var (rotate, swap) = origin switch
        {
            SKEncodedOrigin.RightTop => (90f, true),
            SKEncodedOrigin.BottomRight => (180f, false),
            SKEncodedOrigin.LeftBottom => (270f, true),
            _ => (0f, false),
        };
        if (rotate == 0)
        {
            return bitmap.Copy();
        }

        var result = new SKBitmap(swap ? bitmap.Height : bitmap.Width, swap ? bitmap.Width : bitmap.Height);
        using var canvas = new SKCanvas(result);
        canvas.Translate(result.Width / 2f, result.Height / 2f);
        canvas.RotateDegrees(rotate);
        canvas.Translate(-bitmap.Width / 2f, -bitmap.Height / 2f);
        canvas.DrawBitmap(bitmap, 0, 0);
        return result;
    }
}
