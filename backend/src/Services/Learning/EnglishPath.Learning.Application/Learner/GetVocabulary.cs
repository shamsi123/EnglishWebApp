using System.Text.Json;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Learning.Application.Abstractions;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.Application.Learner;

/// <summary>Word cards for review (FR-32): word, IPA, example, translation, audio and image.</summary>
public sealed record GetVocabularyQuery(IReadOnlyList<string> Ids) : IRequest<Result<IReadOnlyList<JsonElement>>>;

internal sealed class GetVocabularyValidator : AbstractValidator<GetVocabularyQuery>
{
    public GetVocabularyValidator() => RuleFor(q => q.Ids).NotEmpty().Must(ids => ids.Count <= 100).WithMessage("At most 100 ids.");
}

internal sealed class GetVocabularyHandler(ILearningDbContext db) : IRequestHandler<GetVocabularyQuery, Result<IReadOnlyList<JsonElement>>>
{
    public async Task<Result<IReadOnlyList<JsonElement>>> Handle(GetVocabularyQuery request, CancellationToken cancellationToken)
    {
        var ids = request.Ids.Distinct().ToList();
        var entries = await db.Vocabulary.AsNoTracking()
            .Where(v => ids.Contains(v.Id))
            .Select(v => v.Entry)
            .ToListAsync(cancellationToken);
        return entries.Select(e =>
        {
            using var doc = JsonDocument.Parse(e);
            return doc.RootElement.Clone();
        }).ToList();
    }
}
