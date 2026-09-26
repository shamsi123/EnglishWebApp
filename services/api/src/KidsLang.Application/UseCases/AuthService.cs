using KidsLang.Application.Abstractions;
using KidsLang.Application.Contracts;
using KidsLang.Domain;
using Microsoft.EntityFrameworkCore;

namespace KidsLang.Application.UseCases;

public sealed class AuthService(IKidsLangDb db, IPasswordService passwords, ITokenService tokens, IClock clock)
{
    public async Task<Result<AuthResponse>> RegisterAsync(RegisterRequest req, CancellationToken ct)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        if (await db.Parents.AnyAsync(p => p.Email == email, ct))
            return Result<AuthResponse>.Fail(ErrorKind.Conflict, "An account with this email already exists.");

        var parent = new Parent { Email = email, ConsentGivenAtUtc = clock.UtcNow, Locale = req.Locale ?? "en", CreatedAtUtc = clock.UtcNow };
        parent.PasswordHash = passwords.Hash(parent, req.Password);
        db.Parents.Add(parent);
        var response = Issue(parent);
        await db.SaveChangesAsync(ct);
        return Result<AuthResponse>.Ok(response);
    }

    public async Task<Result<AuthResponse>> LoginAsync(LoginRequest req, CancellationToken ct)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        var parent = await db.Parents.FirstOrDefaultAsync(p => p.Email == email, ct);
        if (parent is null || !passwords.Verify(parent, req.Password))
            return Result<AuthResponse>.Fail(ErrorKind.Unauthorized, "Email or password is incorrect.");
        var response = Issue(parent);
        await db.SaveChangesAsync(ct);
        return Result<AuthResponse>.Ok(response);
    }

    /// <summary>Rotates the refresh token: the old one is revoked, a new pair is issued.</summary>
    public async Task<Result<AuthResponse>> RefreshAsync(RefreshRequest req, CancellationToken ct)
    {
        var hash = tokens.HashRefreshToken(req.RefreshToken);
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (stored is null || stored.RevokedAtUtc is not null || stored.ExpiresAtUtc <= clock.UtcNow)
            return Result<AuthResponse>.Fail(ErrorKind.Unauthorized, "Refresh token is invalid or expired.");
        var parent = await db.Parents.FirstAsync(p => p.Id == stored.ParentId, ct);
        stored.RevokedAtUtc = clock.UtcNow;
        var response = Issue(parent);
        await db.SaveChangesAsync(ct);
        return Result<AuthResponse>.Ok(response);
    }

    private AuthResponse Issue(Parent parent)
    {
        var (token, hash) = tokens.CreateRefreshToken();
        db.RefreshTokens.Add(new RefreshToken { ParentId = parent.Id, TokenHash = hash, ExpiresAtUtc = clock.UtcNow + tokens.RefreshLifetime });
        return new AuthResponse(tokens.CreateAccessToken(parent), token, parent.Id);
    }
}
