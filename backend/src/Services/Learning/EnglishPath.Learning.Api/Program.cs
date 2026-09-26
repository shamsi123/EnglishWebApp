using System.Text.Json.Serialization;
using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Web;
using EnglishPath.Learning.Api;
using EnglishPath.Learning.Application;
using EnglishPath.Learning.Infrastructure;
using EnglishPath.Learning.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults("Learning");
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddAuthorizationBuilder()
    .AddPolicy(Policies.ContentStaff, p => p.RequireRole(Roles.ContentAuthor, Roles.Reviewer, Roles.SuperAdmin))
    .AddPolicy(Policies.Author, p => p.RequireRole(Roles.ContentAuthor, Roles.SuperAdmin))
    .AddPolicy(Policies.Reviewer, p => p.RequireRole(Roles.Reviewer, Roles.SuperAdmin));
builder.Services.AddLearningApplication();
builder.Services.AddLearningInfrastructure(builder.Configuration);

var app = builder.Build();

if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<LearningDbContext>().Database.MigrateAsync();
}

app.UseServiceDefaults();
app.MapLearnerEndpoints();
app.MapAuthoringEndpoints();

app.Run();

public partial class Program;
