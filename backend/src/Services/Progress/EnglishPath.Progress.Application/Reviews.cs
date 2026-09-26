using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Progress.Application;

public sealed record DueCardDto(string VocabularyId, DateTimeOffset DueAt, int Repetitions);

/// <summary>Words due for review now, oldest first (FR-31).</summary>
public sealed record GetDueReviewsQuery(int Limit = 20) : IRequest<Result<IReadOnlyList<DueCardDto>>>;

/// <summary>Records a learner's self-grade (0–5) for a word and reschedules it with SM-2.</summary>
public sealed record ReviewWordCommand(string VocabularyId, int Grade) : IRequest<Result<DueCardDto>>;

/// <summary>Onboarding daily time target (FR-02) → daily XP goal.</summary>
public sealed record SetDailyGoalCommand(int Minutes) : IRequest<Result>;

internal sealed class GetDueReviewsValidator : AbstractValidator<GetDueReviewsQuery>
{
    public GetDueReviewsValidator() => RuleFor(q => q.Limit).InclusiveBetween(1, 100);
}

internal sealed class ReviewWordValidator : AbstractValidator<ReviewWordCommand>
{
    public ReviewWordValidator()
    {
        RuleFor(c => c.VocabularyId).NotEmpty();
        RuleFor(c => c.Grade).InclusiveBetween(0, 5);
    }
}

internal sealed class SetDailyGoalValidator : AbstractValidator<SetDailyGoalCommand>
{
    public SetDailyGoalValidator() =>
        RuleFor(c => c.Minutes).Must(DailyGoals.XpByMinutes.ContainsKey).WithMessage("Daily goal must be 5, 10, 15 or 20 minutes.");
}

public static class DailyGoals
{
    /// <summary>Mirrors <c>DAILY_GOAL_XP</c> in packages/core.</summary>
    public static readonly IReadOnlyDictionary<int, int> XpByMinutes = new Dictionary<int, int> { [5] = 10, [10] = 20, [15] = 30, [20] = 40 };
}

internal sealed class ReviewHandlers(IProgressDbContext db, ICurrentUser user, IClock clock, ISender sender) :
    IRequestHandler<GetDueReviewsQuery, Result<IReadOnlyList<DueCardDto>>>,
    IRequestHandler<ReviewWordCommand, Result<DueCardDto>>,
    IRequestHandler<SetDailyGoalCommand, Result>
{
    public async Task<Result<IReadOnlyList<DueCardDto>>> Handle(GetDueReviewsQuery request, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var due = await db.ReviewCards.AsNoTracking()
            .Where(c => c.UserId == user.UserId && c.DueAt <= now)
            .OrderBy(c => c.DueAt)
            .Take(request.Limit)
            .Select(c => new DueCardDto(c.VocabularyId, c.DueAt, c.Repetitions))
            .ToListAsync(cancellationToken);
        return due;
    }

    public async Task<Result<DueCardDto>> Handle(ReviewWordCommand request, CancellationToken cancellationToken)
    {
        var card = await db.ReviewCards
            .SingleOrDefaultAsync(c => c.UserId == user.UserId && c.VocabularyId == request.VocabularyId, cancellationToken);
        if (card is null)
        {
            return Error.NotFound("review.card_not_found", "This word is not in your word bank.");
        }

        card.Review(request.Grade, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken);
        return new DueCardDto(card.VocabularyId, card.DueAt, card.Repetitions);
    }

    public Task<Result> Handle(SetDailyGoalCommand request, CancellationToken cancellationToken) =>
        sender.Send(new ApplyOnboardingCommand(user.UserId, request.Minutes), cancellationToken);
}
