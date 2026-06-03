using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace JobTracker.Tests.Services;

public class DemoSessionServiceTests
{
    [Fact]
    public async Task CreateSessionAsync_CopiesCanonicalDemoDataToTemporaryUser()
    {
        var dbContextFactory = new TestAppDbContextFactory();
        await using var dbContext = dbContextFactory.CreateContext();
        var templateUser = new AppUser
        {
            Id = "demo-template",
            UserName = "demo",
            Email = "demo@traxr.xyz",
        };
        dbContext.Users.Add(templateUser);
        dbContext.JobApplications.AddRange(DemoDataSeeder.CreateDemoJobApplications(templateUser.Id).Take(2));
        dbContext.ScoutJobs.AddRange(DemoDataSeeder.CreateDemoScoutJobs(templateUser.Id).Take(3));
        await dbContext.SaveChangesAsync();

        var userManagerMock = CreateUserManager(dbContext, templateUser);
        var service = CreateService(dbContext, userManagerMock.Object);

        var sessionUser = await service.CreateSessionAsync();

        sessionUser.IsDemoSession.Should().BeTrue();
        sessionUser.UserName.Should().StartWith("demo-session-");
        sessionUser.DemoSessionExpiresAt.Should().NotBeNull();

        var sessionApplications = await dbContext
            .JobApplications.Where(application => application.UserId == sessionUser.Id)
            .ToListAsync();
        var sessionScoutJobs = await dbContext
            .ScoutJobs.Where(job => job.UserId == sessionUser.Id)
            .ToListAsync();

        sessionApplications.Should().HaveCount(2);
        sessionApplications.Should().OnlyContain(application => application.Id != "demo-template");
        sessionScoutJobs.Should().HaveCount(3);
        sessionScoutJobs.Should().OnlyContain(job => job.UserId == sessionUser.Id);

        (await dbContext.JobApplications.CountAsync(application => application.UserId == templateUser.Id))
            .Should().Be(2);
        (await dbContext.ScoutJobs.CountAsync(job => job.UserId == templateUser.Id))
            .Should().Be(3);
    }

    [Fact]
    public async Task DeleteExpiredSessionsAsync_RemovesOnlyExpiredDemoSessions()
    {
        var dbContextFactory = new TestAppDbContextFactory();
        await using var dbContext = dbContextFactory.CreateContext();
        var expiredDemo = new AppUser
        {
            Id = "expired-demo",
            UserName = "demo-session-expired",
            IsDemoSession = true,
            DemoSessionExpiresAt = DateTime.UtcNow.AddMinutes(-1),
        };
        var activeDemo = new AppUser
        {
            Id = "active-demo",
            UserName = "demo-session-active",
            IsDemoSession = true,
            DemoSessionExpiresAt = DateTime.UtcNow.AddHours(1),
        };
        var normalUser = new AppUser
        {
            Id = "normal-user",
            UserName = "utku",
            IsDemoSession = false,
        };

        dbContext.Users.AddRange(expiredDemo, activeDemo, normalUser);
        dbContext.JobApplications.AddRange(
            CreateApplication("expired-job", expiredDemo.Id),
            CreateApplication("active-job", activeDemo.Id),
            CreateApplication("normal-job", normalUser.Id));
        dbContext.ScoutJobs.Add(new ScoutJob
        {
            Id = Guid.NewGuid(),
            Title = "Expired Scout",
            Company = "Expired Co",
            UserId = expiredDemo.Id,
        });
        dbContext.ScrapePresets.Add(new ScrapePreset
        {
            Id = "expired-preset",
            Name = "Expired",
            SourceUrl = "https://hiring.cafe/?searchState=test",
            UserId = expiredDemo.Id,
        });
        dbContext.ScrapeJobs.Add(new ScrapeJob
        {
            JobId = "expired-scrape",
            SourceUrl = "https://hiring.cafe/?searchState=test",
            UserId = expiredDemo.Id,
            Status = "done",
            RunDirectory = "/tmp/non-existent-demo-run",
            ProfileDirectory = "/tmp/non-existent-demo-profile",
        });
        await dbContext.SaveChangesAsync();

        var userManagerMock = CreateUserManager(dbContext, templateUser: null);
        var service = CreateService(dbContext, userManagerMock.Object);

        var deletedCount = await service.DeleteExpiredSessionsAsync();

        deletedCount.Should().Be(1);
        (await dbContext.Users.FindAsync(expiredDemo.Id)).Should().BeNull();
        (await dbContext.Users.FindAsync(activeDemo.Id)).Should().NotBeNull();
        (await dbContext.Users.FindAsync(normalUser.Id)).Should().NotBeNull();
        (await dbContext.JobApplications.FindAsync("expired-job")).Should().BeNull();
        (await dbContext.JobApplications.FindAsync("active-job")).Should().NotBeNull();
        (await dbContext.JobApplications.FindAsync("normal-job")).Should().NotBeNull();
        (await dbContext.ScoutJobs.AnyAsync(job => job.UserId == expiredDemo.Id)).Should().BeFalse();
        (await dbContext.ScrapePresets.AnyAsync(preset => preset.UserId == expiredDemo.Id)).Should().BeFalse();
        (await dbContext.ScrapeJobs.AnyAsync(job => job.UserId == expiredDemo.Id)).Should().BeFalse();
    }

    private static DemoSessionService CreateService(
        AppDbContext dbContext,
        UserManager<AppUser> userManager)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Demo:SessionLifetimeHours"] = "24",
            })
            .Build();

        return new DemoSessionService(
            dbContext,
            userManager,
            configuration,
            NullLogger<DemoSessionService>.Instance);
    }

    private static Mock<UserManager<AppUser>> CreateUserManager(
        AppDbContext dbContext,
        AppUser? templateUser)
    {
        var userManagerMock = IdentityManagerMocks.CreateUserManager();
        userManagerMock
            .Setup(manager => manager.CreateAsync(It.IsAny<AppUser>()))
            .Callback<AppUser>(user =>
            {
                dbContext.Users.Add(user);
                dbContext.SaveChanges();
            })
            .ReturnsAsync(IdentityResult.Success);
        userManagerMock
            .Setup(manager => manager.FindByNameAsync(DemoDataSeeder.DemoUsername))
            .ReturnsAsync(templateUser);
        return userManagerMock;
    }

    private static JobApplication CreateApplication(string id, string userId) =>
        new()
        {
            Id = id,
            CompanyName = "Acme",
            Position = "Engineer",
            Status = JobApplicationStatus.Applied,
            DateApplied = DateTime.UtcNow,
            UserId = userId,
        };
}
