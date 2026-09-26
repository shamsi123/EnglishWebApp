using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using KidsLang.Application.Abstractions;
using KidsLang.Domain;
using Microsoft.IdentityModel.Tokens;

namespace KidsLang.Api;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "kidslang";
    public string Audience { get; set; } = "kidslang-app";
    /// <summary>Signing key (≥ 32 bytes). Must come from a secret store outside development.</summary>
    public string SigningKey { get; set; } = "";
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 30;
}

/// <summary>Short-lived JWT access tokens + opaque, hashed, rotating refresh tokens.</summary>
public sealed class TokenService(JwtOptions options) : ITokenService
{
    public TimeSpan RefreshLifetime => TimeSpan.FromDays(options.RefreshTokenDays);

    public string CreateAccessToken(Parent parent)
    {
        var creds = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.SigningKey)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            options.Issuer,
            options.Audience,
            [new Claim(JwtRegisteredClaimNames.Sub, parent.Id.ToString()), new Claim("role", "parent")],
            expires: DateTime.UtcNow.AddMinutes(options.AccessTokenMinutes),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public (string Token, string Hash) CreateRefreshToken()
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        return (token, HashRefreshToken(token));
    }

    public string HashRefreshToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
