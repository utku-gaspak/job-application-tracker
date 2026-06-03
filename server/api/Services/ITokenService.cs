using api.Models;

namespace api.Services;

public interface ITokenService
{
    string CreateToken(AppUser user);
    string CreateToken(AppUser user, string displayUsername, bool isDemoSession);
}
