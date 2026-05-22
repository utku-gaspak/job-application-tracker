using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace api.Models;

public class ScrapeJob
{
    [Key]
    public string JobId { get; set; } = string.Empty;

    [Required]
    public string SourceUrl { get; set; } = string.Empty;

    [Column(TypeName = "text")]
    public string? UserId { get; set; }

    public bool IncludeSeen { get; set; } = false;

    [Required]
    public string Status { get; set; } = string.Empty;

    [Column(TypeName = "text")]
    public string? Message { get; set; }

    [Column(TypeName = "text")]
    public string? Error { get; set; }

    [Column(TypeName = "text")]
    public string? VerificationUrl { get; set; }

    [Required]
    [Column(TypeName = "text")]
    public string RunDirectory { get; set; } = string.Empty;

    [Required]
    [Column(TypeName = "text")]
    public string ProfileDirectory { get; set; } = string.Empty;

    [Column(TypeName = "text")]
    public string? JsonOutputPath { get; set; }

    [Column(TypeName = "text")]
    public string? MarkdownOutputPath { get; set; }

    [Column(TypeName = "text")]
    public string? StdoutLogPath { get; set; }

    [Column(TypeName = "text")]
    public string? StderrLogPath { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? StartedAt { get; set; }

    public DateTime? FinishedAt { get; set; }
}
