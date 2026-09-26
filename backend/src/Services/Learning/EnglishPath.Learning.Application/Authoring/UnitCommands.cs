using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Learning.Application.Abstractions;
using EnglishPath.Learning.Domain.Units;
using FluentValidation;
using MediatR;

namespace EnglishPath.Learning.Application.Authoring;

public sealed record CreateUnitCommand(CefrLevel Level, int Order, string Title) : IRequest<Result<Guid>>, IAuditedCommand
{
    public string AuditAction => "unit.created";

    public string? AuditTarget => null;
}

internal sealed class CreateUnitValidator : AbstractValidator<CreateUnitCommand>
{
    public CreateUnitValidator()
    {
        RuleFor(c => c.Level).IsInEnum();
        RuleFor(c => c.Order).GreaterThanOrEqualTo(0);
        RuleFor(c => c.Title).NotEmpty().MaximumLength(200);
    }
}

internal sealed class CreateUnitHandler(ILearningDbContext db) : IRequestHandler<CreateUnitCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CreateUnitCommand request, CancellationToken cancellationToken)
    {
        var unit = CourseUnit.Create(request.Level, request.Order, request.Title);
        db.Units.Add(unit);
        await db.SaveChangesAsync(cancellationToken);
        return unit.Id;
    }
}
