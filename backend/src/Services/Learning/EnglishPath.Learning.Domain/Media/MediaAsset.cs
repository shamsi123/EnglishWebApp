using EnglishPath.BuildingBlocks.Domain;

namespace EnglishPath.Learning.Domain.Media;

public enum MediaKind
{
    Image = 0,
    Audio = 1,
}

/// <summary>An uploaded image or audio file served from the CDN (FR-81). Files are immutable.</summary>
public sealed class MediaAsset : Entity<Guid>
{
    private MediaAsset()
    {
    }

    public MediaKind Kind { get; private set; }

    public string ContentType { get; private set; } = string.Empty;

    /// <summary>Storage path, also the CDN path. Content-addressed, so it never changes.</summary>
    public string Path { get; private set; } = string.Empty;

    public string Url { get; private set; } = string.Empty;

    public long Bytes { get; private set; }

    public int? Width { get; private set; }

    public int? Height { get; private set; }

    public string OriginalFileName { get; private set; } = string.Empty;

    public Guid UploadedBy { get; private set; }

    public DateTimeOffset UploadedAt { get; private set; }

    public static MediaAsset Create(
        MediaKind kind,
        string contentType,
        string path,
        string url,
        long bytes,
        int? width,
        int? height,
        string originalFileName,
        Guid uploadedBy,
        DateTimeOffset uploadedAt) => new()
        {
            Id = Guid.NewGuid(),
            Kind = kind,
            ContentType = contentType,
            Path = path,
            Url = url,
            Bytes = bytes,
            Width = width,
            Height = height,
            OriginalFileName = originalFileName.Length > 200 ? originalFileName[..200] : originalFileName,
            UploadedBy = uploadedBy,
            UploadedAt = uploadedAt,
        };
}

/// <summary>Recognises audio formats by their leading bytes rather than trusting the declared type.</summary>
public static class AudioSignature
{
    /// <returns>The canonical content type and file extension, or null if not a supported audio file.</returns>
    public static (string ContentType, string Extension)? Detect(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 12 && header[4..8].SequenceEqual("ftyp"u8))
        {
            return ("audio/mp4", "m4a"); // AAC in MP4/M4A (BRD NFR-14)
        }

        if (header.StartsWith("OggS"u8))
        {
            return ("audio/ogg", "ogg"); // Opus or Vorbis in Ogg
        }

        if (header.StartsWith(new byte[] { 0x1A, 0x45, 0xDF, 0xA3 }))
        {
            return ("audio/webm", "webm"); // Opus in WebM
        }

        if (header.StartsWith("ID3"u8) || (header.Length >= 2 && header[0] == 0xFF && (header[1] & 0xE0) == 0xE0))
        {
            return ("audio/mpeg", "mp3");
        }

        return null;
    }
}
