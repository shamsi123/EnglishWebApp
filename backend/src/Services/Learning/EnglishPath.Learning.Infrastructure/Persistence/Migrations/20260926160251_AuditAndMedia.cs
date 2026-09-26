using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EnglishPath.Learning.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AuditAndMedia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditEntries",
                schema: "learning",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    At = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ActorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Target = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditEntries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MediaAssets",
                schema: "learning",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Path = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Bytes = table.Column<long>(type: "bigint", nullable: false),
                    Width = table.Column<int>(type: "int", nullable: true),
                    Height = table.Column<int>(type: "int", nullable: true),
                    OriginalFileName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    UploadedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UploadedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MediaAssets", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditEntries_At",
                schema: "learning",
                table: "AuditEntries",
                column: "At");

            migrationBuilder.CreateIndex(
                name: "IX_AuditEntries_Target",
                schema: "learning",
                table: "AuditEntries",
                column: "Target");

            migrationBuilder.CreateIndex(
                name: "IX_MediaAssets_Path",
                schema: "learning",
                table: "MediaAssets",
                column: "Path",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MediaAssets_UploadedAt",
                schema: "learning",
                table: "MediaAssets",
                column: "UploadedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditEntries",
                schema: "learning");

            migrationBuilder.DropTable(
                name: "MediaAssets",
                schema: "learning");
        }
    }
}
