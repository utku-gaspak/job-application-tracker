using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace JobTracker.Tests.Infrastructure;

public class ApiApplicationFactory : WebApplicationFactory<Program>
{
    public const string SigningKey =
        "this-test-signing-key-is-longer-than-sixty-four-bytes-for-hmac-sha512";

    private readonly Dictionary<string, string?> _configuration = new()
    {
        ["ConnectionStrings:DefaultConnection"] = "Host=localhost;Database=job-tracker-tests",
        ["JWT:Issuer"] = "job-tracker-tests",
        ["JWT:Audience"] = "job-tracker-client-tests",
        ["JWT:SigningKey"] = SigningKey,
    };

    public ApiApplicationFactory WithConfiguration(string key, string? value)
    {
        var factory = new ApiApplicationFactory();
        factory._configuration[key] = value;
        return factory;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");

        builder.ConfigureAppConfiguration(configuration =>
        {
            configuration.Sources.Clear();
            configuration.AddInMemoryCollection(_configuration);
        });

        builder.ConfigureTestServices(services =>
        {
            // These tests exercise auth/startup behavior, so swap out the data-backed service to avoid DB/provider coupling.
            services.RemoveAll<IJobApplicationService>();
            services.AddScoped<IJobApplicationService, EmptyJobApplicationService>();
        });
    }

    private sealed class EmptyJobApplicationService : IJobApplicationService
    {
        public Task<JobApplication> CreateAsync(JobApplicationCreateDto dto, string userId, CancellationToken cancellationToken = default)
        {
            throw new NotSupportedException();
        }

        public Task<List<JobApplication>> GetAllAsync(string userId, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new List<JobApplication>());
        }

        public Task<JobApplication> GetByIdAsync(string id, string userId, CancellationToken cancellationToken = default)
        {
            throw new NotSupportedException();
        }

        public Task UpdateAsync(string id, JobApplicationUpdateDto dto, string userId, CancellationToken cancellationToken = default)
        {
            throw new NotSupportedException();
        }

        public Task<bool> DeleteAsync(string id, string userId, CancellationToken cancellationToken = default)
        {
            throw new NotSupportedException();
        }
    }
}
