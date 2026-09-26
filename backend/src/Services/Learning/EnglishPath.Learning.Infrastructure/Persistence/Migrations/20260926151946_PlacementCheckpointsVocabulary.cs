using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EnglishPath.Learning.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PlacementCheckpointsVocabulary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Kind",
                schema: "learning",
                table: "Lessons",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: false,
                // Existing lessons are regular lessons, not checkpoints.
                defaultValue: "Lesson");

            migrationBuilder.CreateTable(
                name: "LearnerPlacements",
                schema: "learning",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StartLevel = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    Skipped = table.Column<bool>(type: "bit", nullable: false),
                    PlacedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LearnerPlacements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlacementItems",
                schema: "learning",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Level = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    Skill = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    Content = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlacementItems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlacementSessions",
                schema: "learning",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    MinLevel = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    MaxLevel = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    CurrentLevel = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    Block = table.Column<int>(type: "int", nullable: false),
                    PendingItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    StartLevel = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    HighestPassed = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    StartedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlacementSessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Vocabulary",
                schema: "learning",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Word = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Entry = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LessonId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Vocabulary", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlacementResponses",
                schema: "learning",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Level = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    Block = table.Column<int>(type: "int", nullable: false),
                    Correct = table.Column<bool>(type: "bit", nullable: false),
                    AnsweredAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlacementResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlacementResponses_PlacementSessions_SessionId",
                        column: x => x.SessionId,
                        principalSchema: "learning",
                        principalTable: "PlacementSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlacementItems_Level_IsActive",
                schema: "learning",
                table: "PlacementItems",
                columns: new[] { "Level", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_PlacementResponses_SessionId",
                schema: "learning",
                table: "PlacementResponses",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_PlacementSessions_UserId_Status",
                schema: "learning",
                table: "PlacementSessions",
                columns: new[] { "UserId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LearnerPlacements",
                schema: "learning");

            migrationBuilder.DropTable(
                name: "PlacementItems",
                schema: "learning");

            migrationBuilder.DropTable(
                name: "PlacementResponses",
                schema: "learning");

            migrationBuilder.DropTable(
                name: "Vocabulary",
                schema: "learning");

            migrationBuilder.DropTable(
                name: "PlacementSessions",
                schema: "learning");

            migrationBuilder.DropColumn(
                name: "Kind",
                schema: "learning",
                table: "Lessons");
        }
    }
}
