using EnglishPath.Contracts;
using EnglishPath.Progress.Application;
using MassTransit;
using MediatR;

namespace EnglishPath.Progress.Infrastructure;

internal sealed class UserDeletedConsumer(ISender sender) : IConsumer<UserDeleted>
{
    public Task Consume(ConsumeContext<UserDeleted> context) =>
        sender.Send(new EraseLearnerDataCommand(context.Message.UserId), context.CancellationToken);
}

internal sealed class OnboardingCompletedConsumer(ISender sender) : IConsumer<OnboardingCompleted>
{
    public async Task Consume(ConsumeContext<OnboardingCompleted> context)
    {
        var result = await sender.Send(new ApplyOnboardingCommand(context.Message.UserId, context.Message.DailyMinutes), context.CancellationToken);
        if (!result.IsSuccess)
        {
            throw new InvalidOperationException($"Could not apply onboarding for {context.Message.UserId}: {result.Error!.Code}");
        }
    }
}
