using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using KidsLang.Application.Contracts;
using KidsLang.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace KidsLang.Tests;

/// <summary>
/// Runs the API against SQLite by default, or PostgreSQL when KIDSLANG_TEST_POSTGRES holds a
/// server connection string (CI runs both). Each factory gets its own fresh database.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string _name = $"kidslang_test_{Guid.NewGuid():N}";
    private static readonly string? Postgres = Environment.GetEnvironmentVariable("KIDSLANG_TEST_POSTGRES");
    private string SqlitePath => Path.Combine(Path.GetTempPath(), $"{_name}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        if (string.IsNullOrEmpty(Postgres))
        {
            builder.UseSetting("Database:Provider", "Sqlite");
            builder.UseSetting("ConnectionStrings:Sqlite", $"Data Source={SqlitePath}");
        }
        else
        {
            builder.UseSetting("Database:Provider", "Postgres");
            builder.UseSetting("ConnectionStrings:Postgres", $"{Postgres};Database={_name}");
        }
    }

    public override async ValueTask DisposeAsync()
    {
        // Drop the per-run database while the service provider is still alive.
        if (!string.IsNullOrEmpty(Postgres))
        {
            using var scope = Services.CreateScope();
            await scope.ServiceProvider.GetRequiredService<KidsLangDbContext>().Database.EnsureDeletedAsync();
        }
        await base.DisposeAsync();
        try { File.Delete(SqlitePath); } catch (IOException) { /* best effort */ }
    }
}

public class ApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private async Task<(HttpClient Client, AuthResponse Auth)> SignUp()
    {
        var client = factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest($"Parent{Guid.NewGuid():N}@Example.com", "kidslang-demo", true, "en"));
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var auth = (await res.Content.ReadFromJsonAsync<AuthResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    private static async Task<ChildDto> AddChild(HttpClient client, string name = "Sara")
    {
        var res = await client.PostAsJsonAsync("/api/v1/children", new CreateChildRequest(name, "4-6", new AvatarDto("🦊", "#c4b5fd", "none"), null));
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<ChildDto>())!;
    }

    [Fact]
    public async Task Register_requires_consent_and_a_valid_email()
    {
        var client = factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest("not-an-email", "short", false, null));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Login_is_case_insensitive_on_email_and_refresh_rotates_tokens()
    {
        var client = factory.CreateClient();
        var email = $"Mixed{Guid.NewGuid():N}@Example.com";
        await client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(email, "kidslang-demo", true, null));
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email.ToUpperInvariant(), "kidslang-demo"));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var auth = (await login.Content.ReadFromJsonAsync<AuthResponse>())!;

        var refreshed = await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshRequest(auth.RefreshToken));
        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);
        var reused = await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshRequest(auth.RefreshToken));
        Assert.Equal(HttpStatusCode.Unauthorized, reused.StatusCode);
    }

    [Fact]
    public async Task Endpoints_require_a_token()
    {
        var res = await factory.CreateClient().GetAsync("/api/v1/children");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task A_parent_can_have_at_most_four_children()
    {
        var (client, _) = await SignUp();
        for (var i = 0; i < 4; i++) await AddChild(client, $"Kid{i}");
        var res = await client.PostAsJsonAsync("/api/v1/children", new CreateChildRequest("Five", "4-6", new AvatarDto("🦊", "#fff", "none"), null));
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
    }

    [Fact]
    public async Task Creating_a_child_with_the_same_client_id_twice_is_a_no_op()
    {
        var (client, _) = await SignUp();
        var id = Guid.NewGuid();
        var req = new CreateChildRequest("Sara", "4-6", new AvatarDto("🦊", "#c4b5fd", "none"), null, id);
        var first = await client.PostAsJsonAsync("/api/v1/children", req);
        var second = await client.PostAsJsonAsync("/api/v1/children", req);
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.Equal(id, (await first.Content.ReadFromJsonAsync<ChildDto>())!.Id);
        Assert.Equal(id, (await second.Content.ReadFromJsonAsync<ChildDto>())!.Id);
        Assert.Single(await client.GetFromJsonAsync<List<ChildDto>>("/api/v1/children") ?? []);
    }

    [Fact]
    public async Task A_replayed_child_id_does_not_count_against_the_four_child_limit()
    {
        var (client, _) = await SignUp();
        var id = Guid.NewGuid();
        await AddChild(client, "Sara"); // uses server-generated ids
        var req = new CreateChildRequest("Omar", "7-10", new AvatarDto("🐯", "#fde68a", "none"), null, id);
        for (var i = 0; i < 5; i++)
        {
            var res = await client.PostAsJsonAsync("/api/v1/children", req);
            Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        }
    }

    [Fact]
    public async Task A_client_id_that_belongs_to_another_parent_is_rejected()
    {
        var (a, _) = await SignUp();
        var id = Guid.NewGuid();
        await a.PostAsJsonAsync("/api/v1/children", new CreateChildRequest("Sara", "4-6", new AvatarDto("🦊", "#fff", "none"), null, id));
        var (b, _) = await SignUp();
        var res = await b.PostAsJsonAsync("/api/v1/children", new CreateChildRequest("Sara", "4-6", new AvatarDto("🦊", "#fff", "none"), null, id));
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
    }

    [Fact]
    public async Task Attempt_batch_is_idempotent_on_client_ids()
    {
        var (client, _) = await SignUp();
        var child = await AddChild(client);
        var attempt = new AttemptDto(Guid.NewGuid(), child.Id, "ar-l1-u1-l1-a3", "ar-l1-u1-l1", "ar-letter-alif", true, null, DateTime.UtcNow);
        var first = await client.PostAsJsonAsync("/api/v1/attempts/batch", new AttemptBatchRequest([attempt, attempt]));
        var second = await client.PostAsJsonAsync("/api/v1/attempts/batch", new AttemptBatchRequest([attempt]));
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal([attempt.Id], (await second.Content.ReadFromJsonAsync<AttemptBatchResponse>())!.AcceptedIds);
    }

    [Fact]
    public async Task Server_recomputes_mastery_and_gates_the_next_lesson()
    {
        var (client, _) = await SignUp();
        var child = await AddChild(client);

        var locked = await client.PostAsJsonAsync("/api/v1/quizzes/ar-l1-u1-l2/submit",
            new QuizSubmitRequest(child.Id, [new("ar-letter-ba", true)], 0.9));
        Assert.Equal(HttpStatusCode.Forbidden, locked.StatusCode);

        var failed = await client.PostAsJsonAsync("/api/v1/quizzes/ar-l1-u1-l1/submit",
            new QuizSubmitRequest(child.Id, [new("ar-letter-alif", true), new("ar-letter-alif", false), new("ar-letter-alif", false)], 0.9));
        var failedBody = (await failed.Content.ReadFromJsonAsync<QuizSubmitResponse>())!;
        Assert.False(failedBody.Mastered);
        Assert.Equal(["ar-letter-alif"], failedBody.MissedItems);

        var passed = await client.PostAsJsonAsync("/api/v1/quizzes/ar-l1-u1-l1/submit",
            new QuizSubmitRequest(child.Id, Enumerable.Repeat(new QuizItemResultDto("ar-letter-alif", true), 5).ToList(), 0.9));
        var body = (await passed.Content.ReadFromJsonAsync<QuizSubmitResponse>())!;
        Assert.True(body.Mastered);
        Assert.Equal(3, body.Stars);
        Assert.Equal("ar-l1-u1-l2", body.NextNodeId);

        var journey = (await client.GetFromJsonAsync<JourneyResponse>($"/api/v1/courses/ar/journey?childId={child.Id}"))!;
        Assert.Equal("Mastered", journey.Nodes[0].Status);
        Assert.Equal("Available", journey.Nodes[1].Status);
        Assert.Equal("Locked", journey.Nodes[2].Status);
        Assert.Equal(37, journey.Nodes.Count); // 28 lessons + 8 checkpoints + level test
    }

    [Fact]
    public async Task Parent_override_unlocks_a_lesson()
    {
        var (client, _) = await SignUp();
        var child = await AddChild(client);
        var res = await client.PostAsync($"/api/v1/parent/children/{child.Id}/unlock/ar-l1-u2-l1", null);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var journey = (await client.GetFromJsonAsync<JourneyResponse>($"/api/v1/courses/ar/journey?childId={child.Id}"))!;
        // Same as the web client: an unlocked lesson has a progress row, so it shows as in progress.
        Assert.Equal("InProgress", journey.Nodes.Single(n => n.Id == "ar-l1-u2-l1").Status);
        Assert.Equal("Locked", journey.Nodes.Single(n => n.Id == "ar-l1-u2-l2").Status);
    }

    [Fact]
    public async Task Parents_cannot_see_other_parents_children()
    {
        var (a, _) = await SignUp();
        var child = await AddChild(a);
        var (b, _) = await SignUp();
        var res = await b.GetAsync($"/api/v1/courses/ar/journey?childId={child.Id}");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Deleting_a_child_removes_all_of_its_data()
    {
        var (client, _) = await SignUp();
        var child = await AddChild(client);
        await client.PostAsJsonAsync("/api/v1/quizzes/ar-l1-u1-l1/submit", new QuizSubmitRequest(child.Id, [new("ar-letter-alif", true)], 0.9));
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/v1/children/{child.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/v1/review/today?childId={child.Id}")).StatusCode);
        Assert.Empty((await client.GetFromJsonAsync<List<ChildDto>>("/api/v1/children"))!);
    }
}
