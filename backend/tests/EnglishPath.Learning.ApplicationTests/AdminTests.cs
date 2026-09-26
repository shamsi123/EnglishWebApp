using System.Text.Json;
using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.BuildingBlocks.Persistence;
using EnglishPath.Learning.Application.Authoring;
using EnglishPath.Learning.Application.Media;
using EnglishPath.Learning.Domain.Lessons;
using EnglishPath.Learning.Domain.Units;
using EnglishPath.Learning.Infrastructure.Media;
using EnglishPath.Learning.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using SkiaSharp;

namespace EnglishPath.Learning.ApplicationTests;

public class AuditTests
{
    private sealed record TestCommand(string Id) : IAuditedCommand
    {
        public string AuditAction => "thing.done";

        public string? AuditTarget => Id;
    }

    [Fact]
    public async Task Records_successful_audited_commands_only()
    {
        await using var db = TestDb.Create();
        var actor = Guid.NewGuid();
        var log = new EfAuditLog<LearningDbContext>(db, new FakeUser(actor), new FakeClock());
        var behavior = new AuditBehavior<TestCommand, Result>(log);

        await behavior.Handle(new TestCommand("a"), () => Task.FromResult(Result.Success()), default);
        await behavior.Handle(new TestCommand("b"), () => Task.FromResult(Result.Failure(new Error("x", "failed"))), default);

        var entry = Assert.Single(await log.RecentAsync(10, null, default));
        Assert.Equal(("thing.done", "a", actor), (entry.Action, entry.Target, entry.ActorId));
    }

    [Fact]
    public async Task Uses_the_created_id_when_the_command_has_no_target()
    {
        await using var db = TestDb.Create();
        var log = new EfAuditLog<LearningDbContext>(db, new FakeUser(Guid.NewGuid()), new FakeClock());
        var behavior = new AuditBehavior<CreateUnitCommand, Result<Guid>>(log);
        var id = Guid.NewGuid();

        await behavior.Handle(new CreateUnitCommand(CefrLevel.A1, 0, "x"), () => Task.FromResult<Result<Guid>>(id), default);

        Assert.Equal(id.ToString(), (await log.RecentAsync(1, null, default))[0].Target);
    }
}

public class ImportExportTests
{
    [Fact]
    public async Task Export_then_import_recreates_content_as_drafts()
    {
        await using var source = TestDb.Create();
        var unit = source.AddUnit(CefrLevel.PreA1, 0);
        source.AddPublishedLesson(unit, 0);
        source.AddPublishedLesson(unit, 9, LessonKind.Checkpoint);
        await source.SaveChangesAsync();
        var clock = new FakeClock();

        var package = (await new ImportExportHandlers(source, clock).Handle(new ExportContentQuery(), default)).Value;
        var json = JsonSerializer.Serialize(package);
        var roundTripped = JsonSerializer.Deserialize<ContentPackageDto>(json)!;

        await using var target = TestDb.Create();
        var result = (await new ImportExportHandlers(target, clock).Handle(new ImportContentCommand(roundTripped), default)).Value;

        Assert.Equal(new ImportResultDto(1, 2, 0), result);
        var lessons = await target.Lessons.ToListAsync();
        Assert.All(lessons, l => Assert.Equal(DraftStatus.Draft, l.Status));
        Assert.Contains(lessons, l => l.Kind == LessonKind.Checkpoint);

        // Re-importing reuses the unit and adds the lessons again.
        var again = (await new ImportExportHandlers(target, clock).Handle(new ImportContentCommand(roundTripped), default)).Value;
        Assert.Equal(0, again.UnitsCreated);
    }

    [Fact]
    public async Task A_bad_placement_item_rejects_the_whole_package()
    {
        await using var db = TestDb.Create();
        var bad = JsonDocument.Parse("""{"id":"x","type":"reorderWords","prompt":"p","explanation":"x","skills":["grammar"],"words":["a","b"]}""").RootElement;
        var package = new ContentPackageDto(1, [new ExportUnitDto(CefrLevel.A1, 0, "Unit", [])], [new ExportPlacementItemDto(CefrLevel.A1, bad)]);

        var result = await new ImportExportHandlers(db, new FakeClock()).Handle(new ImportContentCommand(package), default);

        Assert.Equal("import.placement_item", result.Error!.Code);
        Assert.Empty(await db.Units.ToListAsync());
    }
}

public class MediaTests
{
    private sealed class MemoryStorage : IMediaStorage
    {
        public Dictionary<string, (byte[] Content, string Type)> Files { get; } = [];

        public Task<string> SaveAsync(string path, byte[] content, string contentType, CancellationToken cancellationToken)
        {
            Files[path] = (content, contentType);
            return Task.FromResult($"https://cdn.test/{path}");
        }
    }

    private static byte[] Png(int width, int height)
    {
        using var bitmap = new SKBitmap(width, height);
        bitmap.Erase(SKColors.CornflowerBlue);
        using var image = SKImage.FromBitmap(bitmap);
        return image.Encode(SKEncodedImageFormat.Png, 100).ToArray();
    }

    private static (MediaHandlers Handlers, MemoryStorage Storage, LearningDbContext Db) Create()
    {
        var db = TestDb.Create();
        var storage = new MemoryStorage();
        return (new MediaHandlers(db, storage, new SkiaImageProcessor(), new FakeUser(Guid.NewGuid()), new FakeClock()), storage, db);
    }

    [Fact]
    public async Task Images_are_resized_and_converted_to_webp()
    {
        var (handlers, storage, db) = Create();

        var result = (await handlers.Handle(new UploadMediaCommand("photo.png", Png(2048, 1024)), default)).Value;

        Assert.Equal(("image", "image/webp", 1024, 512), (result.Kind, result.ContentType, result.Width!.Value, result.Height!.Value));
        Assert.StartsWith("https://cdn.test/images/", result.Url);
        var stored = Assert.Single(storage.Files).Value;
        Assert.Equal("RIFF", System.Text.Encoding.ASCII.GetString(stored.Content, 0, 4));
        Assert.Equal(1, await db.Media.CountAsync());
    }

    [Fact]
    public async Task Small_images_keep_their_size_and_duplicates_reuse_the_url()
    {
        var (handlers, storage, db) = Create();
        var png = Png(300, 200);

        var first = (await handlers.Handle(new UploadMediaCommand("a.png", png), default)).Value;
        var second = (await handlers.Handle(new UploadMediaCommand("b.png", png), default)).Value;

        Assert.Equal((300, 200), (first.Width!.Value, first.Height!.Value));
        Assert.Equal(first.Url, second.Url);
        Assert.Single(storage.Files);
        Assert.Equal(1, await db.Media.CountAsync());
    }

    [Fact]
    public async Task Audio_is_detected_by_signature_and_stored_unchanged()
    {
        var (handlers, storage, _) = Create();
        var mp3 = new byte[] { 0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0, 1, 2, 3 };

        var result = (await handlers.Handle(new UploadMediaCommand("word.mp3", mp3), default)).Value;

        Assert.Equal(("audio", "audio/mpeg"), (result.Kind, result.ContentType));
        Assert.EndsWith(".mp3", result.Url);
        Assert.Equal(mp3, Assert.Single(storage.Files).Value.Content);
    }

    [Theory]
    [InlineData(new byte[] { 0x3C, 0x73, 0x76, 0x67 })] // "<svg": scripts in SVG are not allowed
    [InlineData(new byte[] { 0x4D, 0x5A, 0x90, 0x00 })] // an executable
    public async Task Other_files_are_rejected(byte[] content)
    {
        var (handlers, storage, _) = Create();
        var result = await handlers.Handle(new UploadMediaCommand("x.png", content), default);
        Assert.Equal("media.type", result.Error!.Code);
        Assert.Empty(storage.Files);
    }
}
