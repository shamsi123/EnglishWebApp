namespace EnglishPath.BuildingBlocks.Application;

/// <summary>The authenticated learner or admin making the request (from the JWT <c>sub</c> claim).</summary>
public interface ICurrentUser
{
    Guid UserId { get; }

    bool IsInRole(string role);
}

/// <summary>Admin roles (FR-91).</summary>
public static class Roles
{
    public const string SuperAdmin = "SuperAdmin";
    public const string ContentAuthor = "ContentAuthor";
    public const string Reviewer = "Reviewer";
    public const string Support = "Support";
}
