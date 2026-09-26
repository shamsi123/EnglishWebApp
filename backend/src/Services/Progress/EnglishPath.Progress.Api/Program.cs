using EnglishPath.BuildingBlocks.Web;
using EnglishPath.Progress.Api;
using EnglishPath.Progress.Application;
using EnglishPath.Progress.Infrastructure;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults("Progress");
builder.Services.AddProgressApplication();
builder.Services.AddProgressInfrastructure(builder.Configuration);

var app = builder.Build();

if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<ProgressDbContext>().Database.MigrateAsync();
}

app.UseServiceDefaults();
app.MapProgressEndpoints();

app.Run();

public partial class Program;
