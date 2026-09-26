using KidsLang.Application.Abstractions;
using KidsLang.Domain;
using Microsoft.AspNetCore.Identity;

namespace KidsLang.Infrastructure.Security;

/// <summary>ASP.NET Core Identity's PBKDF2 password hasher.</summary>
public sealed class PasswordService : IPasswordService
{
    private readonly PasswordHasher<Parent> _hasher = new();
    public string Hash(Parent parent, string password) => _hasher.HashPassword(parent, password);
    public bool Verify(Parent parent, string password) =>
        _hasher.VerifyHashedPassword(parent, parent.PasswordHash, password) != PasswordVerificationResult.Failed;
}

public sealed class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}
