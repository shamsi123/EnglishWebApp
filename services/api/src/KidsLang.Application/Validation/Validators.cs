using FluentValidation;
using KidsLang.Application.Contracts;

namespace KidsLang.Application.Validation;

public sealed class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(254);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8).MaximumLength(128);
        RuleFor(x => x.ConsentGiven).Equal(true).WithMessage("Parental consent is required.");
        RuleFor(x => x.Locale).Must(l => l is null or "en" or "ar" or "hi");
    }
}

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public sealed class RefreshRequestValidator : AbstractValidator<RefreshRequest>
{
    public RefreshRequestValidator() => RuleFor(x => x.RefreshToken).NotEmpty().MaximumLength(200);
}

public sealed class CreateChildRequestValidator : AbstractValidator<CreateChildRequest>
{
    public CreateChildRequestValidator()
    {
        RuleFor(x => x.Nickname).NotEmpty().MaximumLength(20);
        RuleFor(x => x.AgeBand).Must(a => a is "4-6" or "7-10");
        RuleFor(x => x.Avatar).NotNull();
        RuleFor(x => x.PicturePinHash).MaximumLength(128);
    }
}

public sealed class UpdateChildRequestValidator : AbstractValidator<UpdateChildRequest>
{
    public UpdateChildRequestValidator()
    {
        RuleFor(x => x.Nickname).MaximumLength(20).NotEmpty().When(x => x.Nickname is not null);
        RuleFor(x => x.AgeBand).Must(a => a is null or "4-6" or "7-10");
        RuleFor(x => x.DailyLimitMinutes).InclusiveBetween(0, 240).When(x => x.DailyLimitMinutes is not null);
    }
}

public sealed class AttemptBatchRequestValidator : AbstractValidator<AttemptBatchRequest>
{
    public AttemptBatchRequestValidator()
    {
        RuleFor(x => x.Attempts).NotNull().Must(a => a.Count is > 0 and <= 500);
        RuleForEach(x => x.Attempts).ChildRules(a =>
        {
            a.RuleFor(x => x.Id).NotEmpty();
            a.RuleFor(x => x.ChildId).NotEmpty();
            a.RuleFor(x => x.ActivityId).NotEmpty().MaximumLength(64);
            a.RuleFor(x => x.LessonId).NotEmpty().MaximumLength(64);
            a.RuleFor(x => x.ItemId).NotEmpty().MaximumLength(64);
            a.RuleFor(x => x.Score).InclusiveBetween(0, 1).When(x => x.Score is not null);
        });
    }
}

public sealed class QuizSubmitRequestValidator : AbstractValidator<QuizSubmitRequest>
{
    public QuizSubmitRequestValidator()
    {
        RuleFor(x => x.ChildId).NotEmpty();
        RuleFor(x => x.Results).NotNull().Must(r => r.Count is > 0 and <= 50);
        RuleForEach(x => x.Results).ChildRules(r => r.RuleFor(x => x.ItemId).NotEmpty().MaximumLength(64));
        RuleFor(x => x.TraceAccuracy).InclusiveBetween(0, 1).When(x => x.TraceAccuracy is not null);
    }
}
