namespace KidsLang.Application.Contracts;

public sealed record RegisterRequest(string Email, string Password, bool ConsentGiven, string? Locale);
public sealed record LoginRequest(string Email, string Password);
public sealed record RefreshRequest(string RefreshToken);
public sealed record AuthResponse(string AccessToken, string RefreshToken, Guid ParentId);

public sealed record AvatarDto(string Animal, string Color, string Item);
/// <summary>
/// Id is optional and client-generated (like ActivityAttempt.Id): the same profile the child plays with
/// offline becomes this row when the parent is online, and creating it twice is a no-op (idempotent).
/// </summary>
public sealed record CreateChildRequest(string Nickname, string AgeBand, AvatarDto Avatar, string? PicturePinHash, Guid? Id = null);
public sealed record UpdateChildRequest(string? Nickname, string? AgeBand, AvatarDto? Avatar, int? DailyLimitMinutes);
public sealed record ChildDto(Guid Id, string Nickname, string AgeBand, AvatarDto Avatar, bool HasPin, int DailyLimitMinutes);

public sealed record AttemptDto(Guid Id, Guid ChildId, string ActivityId, string LessonId, string ItemId, bool IsCorrect, double? Score, DateTime CreatedAtUtc);
public sealed record AttemptBatchRequest(IReadOnlyList<AttemptDto> Attempts);
public sealed record AttemptBatchResponse(IReadOnlyList<Guid> AcceptedIds);

public sealed record QuizItemResultDto(string ItemId, bool Correct);
public sealed record QuizSubmitRequest(Guid ChildId, IReadOnlyList<QuizItemResultDto> Results, double? TraceAccuracy);
public sealed record QuizSubmitResponse(bool Mastered, double Score, int Stars, IReadOnlyList<string> MissedItems, string? NextNodeId, IReadOnlyList<string> NewRewards);

public sealed record JourneyNodeDto(string Id, string Kind, string Title, string Status, int Stars);
public sealed record JourneyResponse(string CourseId, IReadOnlyList<JourneyNodeDto> Nodes);

public sealed record ReviewItemDto(string ItemId, int Box, DateTime NextReviewAtUtc);
public sealed record ChildReportResponse(int LessonsMastered, int TotalLessons, int Stars, string? CurrentNodeId, IReadOnlyList<string> WeakItems, IReadOnlyList<string> Stickers);
