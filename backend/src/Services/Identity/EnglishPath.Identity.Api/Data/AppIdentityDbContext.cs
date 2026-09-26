using MassTransit;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Identity.Api.Data;

public sealed class AppIdentityDbContext(DbContextOptions<AppIdentityDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    public const string Schema = "identity";

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.HasDefaultSchema(Schema);

        builder.Entity<ApplicationUser>(b =>
        {
            b.Property(u => u.GuardianEmail).HasMaxLength(256);
            b.Property(u => u.GuardianConsent).HasConversion<string>().HasMaxLength(16);
            b.Property(u => u.Goal).HasConversion<string>().HasMaxLength(16);
            b.Property(u => u.NativeLanguage).HasMaxLength(3);
        });

        // OpenIddict applications, authorizations, scopes and tokens.
        builder.UseOpenIddict<Guid>();

        builder.AddInboxStateEntity();
        builder.AddOutboxMessageEntity();
        builder.AddOutboxStateEntity();
    }
}
