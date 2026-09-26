using EnglishPath.Contracts;
using EnglishPath.Learning.Application.Learner;
using MassTransit;
using MediatR;

namespace EnglishPath.Learning.Infrastructure;

internal sealed class UserDeletedConsumer(ISender sender) : IConsumer<UserDeleted>
{
    public Task Consume(ConsumeContext<UserDeleted> context) =>
        sender.Send(new EraseLearnerDataCommand(context.Message.UserId), context.CancellationToken);
}
