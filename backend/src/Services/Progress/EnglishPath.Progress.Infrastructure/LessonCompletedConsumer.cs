using EnglishPath.Contracts;
using EnglishPath.Progress.Application;
using MassTransit;
using MediatR;

namespace EnglishPath.Progress.Infrastructure;

internal sealed class LessonCompletedConsumer(ISender sender) : IConsumer<LessonCompleted>
{
    public async Task Consume(ConsumeContext<LessonCompleted> context)
    {
        var result = await sender.Send(new ApplyLessonCompletionCommand(context.Message), context.CancellationToken);
        if (!result.IsSuccess)
        {
            throw new InvalidOperationException($"Could not apply completion {context.Message.CompletionId}: {result.Error!.Code}");
        }
    }
}
