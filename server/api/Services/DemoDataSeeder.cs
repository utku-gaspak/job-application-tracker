using api.Data;
using api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace api.Services;

public static class DemoDataSeeder
{
    private const string DemoUsername = "demo";
    private const string DemoEmail = "demo@traxr.xyz";
    private const string DemoPassword = "demo123";

    public static async Task SeedAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        var dbContext = services.GetRequiredService<AppDbContext>();
        var userManager = services.GetRequiredService<UserManager<AppUser>>();

        var demoUser = await userManager.FindByNameAsync(DemoUsername);
        if (demoUser is null)
        {
            demoUser = new AppUser
            {
                UserName = DemoUsername,
                Email = DemoEmail,
                EmailConfirmed = true,
            };

            var creationResult = await userManager.CreateAsync(demoUser, DemoPassword);
            if (!creationResult.Succeeded)
            {
                var errorMessage = string.Join(
                    "; ",
                    creationResult.Errors.Select(error => error.Description)
                );

                throw new InvalidOperationException($"Failed to create demo user: {errorMessage}");
            }
        }
        else if (string.IsNullOrWhiteSpace(demoUser.Email))
        {
            demoUser.Email = DemoEmail;
            demoUser.EmailConfirmed = true;
            await userManager.UpdateAsync(demoUser);
        }

        if (
            !await dbContext.JobApplications.AnyAsync(
                jobApplication => jobApplication.UserId == demoUser.Id,
                cancellationToken
            )
        )
        {
            dbContext.JobApplications.AddRange(CreateDemoJobApplications(demoUser.Id));
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        if (
            !await dbContext.ScoutJobs.AnyAsync(
                scoutJob => scoutJob.UserId == demoUser.Id,
                cancellationToken
            )
        )
        {
            dbContext.ScoutJobs.AddRange(CreateDemoScoutJobs(demoUser.Id));
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private static List<JobApplication> CreateDemoJobApplications(string userId)
    {
        var now = DateTime.UtcNow;

        return
        [
            new JobApplication
            {
                Id = Guid.NewGuid().ToString(),
                CompanyName = "Rheinmetall AG",
                Position = "Senior Mechanical Design Engineer",
                JobUrl = "https://www.rheinmetall.com/en/career",
                Location = "Düsseldorf",
                SalaryRange = "€75,000 - €85,000",
                JobDescription = "Design and validate mechanical assemblies for industrial systems.",
                Notes = "Strong fit with SolidWorks and PDM background.",
                InterestLevel = 5,
                TechnicalStack = "SolidWorks, PDM, SAP",
                Status = JobApplicationStatus.Offer,
                DateApplied = now.AddDays(-1),
                UserId = userId,
            },
            new JobApplication
            {
                Id = Guid.NewGuid().ToString(),
                CompanyName = "Trivago",
                Position = "Full Stack Developer (.NET & React)",
                JobUrl = "https://careers.trivago.com/",
                Location = "Düsseldorf (Hybrid)",
                SalaryRange = "€65,000 - €72,000",
                JobDescription = "Build internal tooling and customer-facing workflows.",
                Notes = "Interview with engineering manager pending.",
                InterestLevel = 5,
                TechnicalStack = "React, .NET 10, PostgreSQL",
                Status = JobApplicationStatus.Interviewing,
                DateApplied = now.AddDays(-3),
                UserId = userId,
            },
            new JobApplication
            {
                Id = Guid.NewGuid().ToString(),
                CompanyName = "Henkel",
                Position = "Full Stack Engineer",
                JobUrl = "https://careers.henkel.com/",
                Location = "Düsseldorf",
                SalaryRange = "€68,000 - €75,000",
                JobDescription = "Work on commerce and internal platform services.",
                Notes = "Good match for .NET and React stack.",
                InterestLevel = 5,
                TechnicalStack = ".NET 10, React, Azure",
                Status = JobApplicationStatus.Interviewing,
                DateApplied = now.AddDays(-4),
                UserId = userId,
            },
            new JobApplication
            {
                Id = Guid.NewGuid().ToString(),
                CompanyName = "Thyssenkrupp",
                Position = "Mechanical Systems Designer",
                JobUrl = "https://www.thyssenkrupp.com/en/careers",
                Location = "Essen",
                SalaryRange = "€70,000 - €78,000",
                JobDescription = "Support industrial design and mechanical validation tasks.",
                Notes = "Requires detailed CAD and FEM work.",
                InterestLevel = 4,
                TechnicalStack = "SolidWorks, FEM Analysis",
                Status = JobApplicationStatus.Interviewing,
                DateApplied = now.AddDays(-6),
                UserId = userId,
            },
            new JobApplication
            {
                Id = Guid.NewGuid().ToString(),
                CompanyName = "SMS Group",
                Position = "Sondermaschinenbau Engineer",
                JobUrl = "https://www.sms-group.com/career/",
                Location = "Mönchengladbach",
                SalaryRange = "€60,000 - €68,000",
                JobDescription = "Develop automation support tools for special-purpose machines.",
                Notes = "Interesting combination of engineering and scripting.",
                InterestLevel = 4,
                TechnicalStack = "AutoCAD, Python Automation",
                Status = JobApplicationStatus.Applied,
                DateApplied = now.AddDays(-8),
                UserId = userId,
            },
            new JobApplication
            {
                Id = Guid.NewGuid().ToString(),
                CompanyName = "Deutsche Bahn",
                Position = "Software Developer (.NET)",
                JobUrl = "https://www.deutschebahn.com/en/group/careers",
                Location = "Remote / Frankfurt",
                SalaryRange = "€65,000 - €70,000",
                JobDescription = "Maintain web APIs and internal services for operational tooling.",
                Notes = "Clear backend-heavy role.",
                InterestLevel = 4,
                TechnicalStack = "C#, Web API, SQL Server",
                Status = JobApplicationStatus.Applied,
                DateApplied = now.AddDays(-10),
                UserId = userId,
            },
            new JobApplication
            {
                Id = Guid.NewGuid().ToString(),
                CompanyName = "Vodafone",
                Position = "Frontend Developer (React)",
                JobUrl = "https://jobs.vodafone.com/",
                Location = "Düsseldorf",
                SalaryRange = "€60,000 - €65,000",
                JobDescription = "Improve customer portal flows and UI consistency.",
                Notes = "Frontend-focused, decent fit for current stack.",
                InterestLevel = 3,
                TechnicalStack = "TypeScript, Tailwind",
                Status = JobApplicationStatus.Applied,
                DateApplied = now.AddDays(-12),
                UserId = userId,
            },
            new JobApplication
            {
                Id = Guid.NewGuid().ToString(),
                CompanyName = "Siemens Energy",
                Position = "Automation & Control Engineer",
                JobUrl = "https://jobs.siemens-energy.com/",
                Location = "Duisburg",
                SalaryRange = "€66,000 - €74,000",
                JobDescription = "Support control system analysis and automation workflows.",
                Notes = "Good industrial domain exposure.",
                InterestLevel = 4,
                TechnicalStack = "Python, PLC, SCADA",
                Status = JobApplicationStatus.Applied,
                DateApplied = now.AddDays(-14),
                UserId = userId,
            },
            new JobApplication
            {
                Id = Guid.NewGuid().ToString(),
                CompanyName = "Bayer",
                Position = "Full Stack Developer",
                JobUrl = "https://career.bayer.com/",
                Location = "Leverkusen",
                SalaryRange = "€72,000 - €80,000",
                JobDescription = "Build internal applications and platform services.",
                Notes = "Strong overall stack fit.",
                InterestLevel = 5,
                TechnicalStack = "React, Node.js, AWS",
                Status = JobApplicationStatus.Rejected,
                DateApplied = now.AddDays(-18),
                UserId = userId,
            },
            new JobApplication
            {
                Id = Guid.NewGuid().ToString(),
                CompanyName = "Zalando",
                Position = "Junior React Developer",
                JobUrl = "https://jobs.zalando.com/",
                Location = "Remote / Berlin",
                SalaryRange = "€58,000 - €64,000",
                JobDescription = "Support product-facing frontend work and component improvements.",
                Notes = "Good learning role, but not a match.",
                InterestLevel = 5,
                TechnicalStack = "React, GraphQL",
                Status = JobApplicationStatus.Rejected,
                DateApplied = now.AddDays(-21),
                UserId = userId,
            },
        ];
    }

    private static List<ScoutJob> CreateDemoScoutJobs(string userId)
    {
        var now = DateTime.UtcNow;

        return
        [
            new ScoutJob
            {
                Id = Guid.NewGuid(),
                Title = "Backend Engineer",
                Company = "SAP Deutschland",
                Location = "Walldorf",
                WorkplaceType = "Hybrid",
                Commitment = "Full-time",
                PostedAt = now.AddDays(-1),
                JobUrl = "https://jobs.sap.com/",
                ApplyUrl = "https://jobs.sap.com/",
                TechnicalTools = "C#, .NET, Azure",
                RequirementsSummary = "Build services for enterprise workflows and internal platforms.",
                SavedForApply = false,
                IsDiscarded = false,
                CreatedAt = now.AddHours(-8),
                SourceOrder = 0,
                UserId = userId,
            },
            new ScoutJob
            {
                Id = Guid.NewGuid(),
                Title = "Frontend Developer",
                Company = "Otto Group",
                Location = "Hamburg",
                WorkplaceType = "Remote",
                Commitment = "Full-time",
                PostedAt = now.AddDays(-2),
                JobUrl = "https://jobs.ottogroup.com/",
                ApplyUrl = "https://jobs.ottogroup.com/",
                TechnicalTools = "React, TypeScript, Tailwind",
                RequirementsSummary = "Improve shopping flows and component systems.",
                SavedForApply = true,
                IsDiscarded = false,
                CreatedAt = now.AddHours(-16),
                SourceOrder = 1,
                UserId = userId,
            },
            new ScoutJob
            {
                Id = Guid.NewGuid(),
                Title = "Platform Engineer",
                Company = "DATEV",
                Location = "Nürnberg",
                WorkplaceType = "Onsite",
                Commitment = "Full-time",
                PostedAt = now.AddDays(-3),
                JobUrl = "https://www.datev.de/web/de/karriere/",
                ApplyUrl = "https://www.datev.de/web/de/karriere/",
                TechnicalTools = "Kubernetes, Go, PostgreSQL",
                RequirementsSummary = "Support infrastructure and service reliability.",
                SavedForApply = false,
                IsDiscarded = false,
                CreatedAt = now.AddHours(-22),
                SourceOrder = 2,
                UserId = userId,
            },
            new ScoutJob
            {
                Id = Guid.NewGuid(),
                Title = "Full Stack Developer",
                Company = "Bosch",
                Location = "Stuttgart",
                WorkplaceType = "Hybrid",
                Commitment = "Full-time",
                PostedAt = now.AddDays(-4),
                JobUrl = "https://jobs.bosch.com/",
                ApplyUrl = "https://jobs.bosch.com/",
                TechnicalTools = ".NET, React, Azure",
                RequirementsSummary = "Work on internal service portals and dashboards.",
                SavedForApply = true,
                IsDiscarded = false,
                CreatedAt = now.AddDays(-1),
                SourceOrder = 3,
                UserId = userId,
            },
            new ScoutJob
            {
                Id = Guid.NewGuid(),
                Title = "Software Engineer",
                Company = "ZEISS",
                Location = "Oberkochen",
                WorkplaceType = "Onsite",
                Commitment = "Full-time",
                PostedAt = now.AddDays(-5),
                JobUrl = "https://www.zeiss.com/career",
                ApplyUrl = "https://www.zeiss.com/career",
                TechnicalTools = "C#, WPF, SQL Server",
                RequirementsSummary = "Develop software for precision engineering tools.",
                SavedForApply = false,
                IsDiscarded = false,
                CreatedAt = now.AddDays(-2),
                SourceOrder = 4,
                UserId = userId,
            },
            new ScoutJob
            {
                Id = Guid.NewGuid(),
                Title = "Cloud Engineer",
                Company = "Lufthansa Systems",
                Location = "Frankfurt",
                WorkplaceType = "Hybrid",
                Commitment = "Full-time",
                PostedAt = now.AddDays(-6),
                JobUrl = "https://www.lufthansa-systems.com/career",
                ApplyUrl = "https://www.lufthansa-systems.com/career",
                TechnicalTools = "AWS, Terraform, Python",
                RequirementsSummary = "Improve cloud platforms and deployment automation.",
                SavedForApply = true,
                IsDiscarded = false,
                CreatedAt = now.AddDays(-3),
                SourceOrder = 5,
                UserId = userId,
            },
            new ScoutJob
            {
                Id = Guid.NewGuid(),
                Title = "Data Engineer",
                Company = "Commerzbank",
                Location = "Frankfurt",
                WorkplaceType = "Hybrid",
                Commitment = "Full-time",
                PostedAt = now.AddDays(-7),
                JobUrl = "https://jobs.commerzbank.com/",
                ApplyUrl = "https://jobs.commerzbank.com/",
                TechnicalTools = "Python, Spark, SQL",
                RequirementsSummary = "Support analytics pipelines and data services.",
                SavedForApply = false,
                IsDiscarded = false,
                CreatedAt = now.AddDays(-4),
                SourceOrder = 6,
                UserId = userId,
            },
            new ScoutJob
            {
                Id = Guid.NewGuid(),
                Title = "React Developer",
                Company = "Sixt SE",
                Location = "Pullach",
                WorkplaceType = "Remote",
                Commitment = "Full-time",
                PostedAt = now.AddDays(-8),
                JobUrl = "https://about.sixt.com/career/",
                ApplyUrl = "https://about.sixt.com/career/",
                TechnicalTools = "React, TypeScript, REST",
                RequirementsSummary = "Shape booking flows and customer-facing UI.",
                SavedForApply = false,
                IsDiscarded = false,
                CreatedAt = now.AddDays(-5),
                SourceOrder = 7,
                UserId = userId,
            },
            new ScoutJob
            {
                Id = Guid.NewGuid(),
                Title = "DevOps Engineer",
                Company = "Personio",
                Location = "München",
                WorkplaceType = "Hybrid",
                Commitment = "Full-time",
                PostedAt = now.AddDays(-9),
                JobUrl = "https://www.personio.com/careers/",
                ApplyUrl = "https://www.personio.com/careers/",
                TechnicalTools = "Docker, Kubernetes, GitHub Actions",
                RequirementsSummary = "Maintain delivery pipelines and deployment tooling.",
                SavedForApply = true,
                IsDiscarded = false,
                CreatedAt = now.AddDays(-6),
                SourceOrder = 8,
                UserId = userId,
            },
            new ScoutJob
            {
                Id = Guid.NewGuid(),
                Title = "Software Architect",
                Company = "Allianz Technology",
                Location = "München",
                WorkplaceType = "Hybrid",
                Commitment = "Full-time",
                PostedAt = now.AddDays(-10),
                JobUrl = "https://careers.allianz.com/",
                ApplyUrl = "https://careers.allianz.com/",
                TechnicalTools = ".NET, React, Kafka",
                RequirementsSummary = "Guide technical direction for platform modernization.",
                SavedForApply = false,
                IsDiscarded = false,
                CreatedAt = now.AddDays(-7),
                SourceOrder = 9,
                UserId = userId,
            },
        ];
    }
}
