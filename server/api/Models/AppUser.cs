using Microsoft.AspNetCore.Identity;

namespace api.Models;

public class AppUser : IdentityUser
{
    public bool IsDemoSession { get; set; }

    public DateTime? DemoSessionCreatedAt { get; set; }

    public DateTime? DemoSessionExpiresAt { get; set; }

    public List<JobApplication> JobApplications { get; set; } = new();

    public List<ScoutJob> ScoutJobs { get; set; } = new();
}
