using System.Security.Claims;
using api.Models;

namespace api.Services;

public interface IDemoSessionService
{
    TimeSpan SessionLifetime { get; }

    Task<AppUser> CreateSessionAsync(CancellationToken cancellationToken = default);

    Task DeleteSessionAsync(string userId, CancellationToken cancellationToken = default);

    Task<int> DeleteExpiredSessionsAsync(CancellationToken cancellationToken = default);

    bool IsDemoSession(ClaimsPrincipal user);
}
