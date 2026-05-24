using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace api.Models;

public class ScoutJob
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Company { get; set; } = string.Empty;

    public string? Location { get; set; }

    public string? WorkplaceType { get; set; }

    public string? Commitment { get; set; }

    public DateTime? PostedAt { get; set; }

    public string? JobUrl { get; set; }

    public string? ApplyUrl { get; set; }

    public string? TechnicalTools { get; set; }

    [Column(TypeName = "text")]
    public string? RequirementsSummary { get; set; }

    public bool SavedForApply { get; set; } = false;

    public bool IsDiscarded { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string? UserId { get; set; }

    public AppUser? User { get; set; }
}
