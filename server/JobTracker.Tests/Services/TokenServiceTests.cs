using System.IdentityModel.Tokens.Jwt;
using Microsoft.Extensions.Configuration;

namespace JobTracker.Tests.Services;

public class TokenServiceTests
{
    private const string SigningKey =
        "this-test-signing-key-is-longer-than-sixty-four-bytes-for-hmac-sha512";

    [Fact]
    public void CreateToken_ShouldIncludeExpectedUserClaims()
    {
        var service = new TokenService(CreateConfiguration());
        var user = new AppUser
        {
            Id = "user-1",
            UserName = "utku",
            Email = "utku@example.com",
        };

        var token = ReadToken(service.CreateToken(user));

        token.Claims.Should().Contain(claim => claim.Type == JwtRegisteredClaimNames.Email && claim.Value == user.Email);
        token.Claims.Should().Contain(claim => claim.Type == JwtRegisteredClaimNames.GivenName && claim.Value == user.UserName);
        token.Claims.Should().Contain(claim => claim.Type == ClaimTypes.NameIdentifier && claim.Value == user.Id);
    }

    [Fact]
    public void CreateToken_ShouldUseConfiguredIssuerAndAudience()
    {
        var service = new TokenService(CreateConfiguration());

        var token = ReadToken(service.CreateToken(CreateUser()));

        token.Issuer.Should().Be("job-tracker-tests");
        token.Audiences.Should().ContainSingle().Which.Should().Be("job-tracker-client-tests");
    }

    [Fact]
    public void CreateToken_DemoSession_ShouldUseDisplayUsernameAndIncludeDemoClaim()
    {
        var service = new TokenService(CreateConfiguration());
        var user = new AppUser
        {
            Id = "demo-session-1",
            UserName = "demo-session-1",
            Email = "demo-session-1@traxr.local",
            IsDemoSession = true,
        };

        var token = ReadToken(service.CreateToken(user, "demo", isDemoSession: true));

        token.Claims.Should().Contain(claim => claim.Type == JwtRegisteredClaimNames.GivenName && claim.Value == "demo");
        token.Claims.Should().Contain(claim => claim.Type == ClaimTypes.NameIdentifier && claim.Value == user.Id);
        token.Claims.Should().Contain(claim => claim.Type == DemoSessionClaims.IsDemoSession && claim.Value == "true");
    }

    [Fact]
    public void CreateToken_ShouldExpireInAboutSevenDays()
    {
        var beforeCreate = DateTime.UtcNow;
        var service = new TokenService(CreateConfiguration());

        var token = ReadToken(service.CreateToken(CreateUser()));

        var expectedExpiry = beforeCreate.AddDays(7);
        token.ValidTo.Should().BeCloseTo(expectedExpiry, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Constructor_MissingSigningKey_ShouldThrowInvalidOperationException()
    {
        var config = CreateConfiguration(signingKey: null);

        var act = () => new TokenService(config);

        act.Should()
            .Throw<InvalidOperationException>()
            .WithMessage("JWT:SigningKey is not configured.");
    }

    [Fact]
    public void Constructor_TooShortSigningKey_ShouldThrowInvalidOperationException()
    {
        var config = CreateConfiguration(signingKey: "short-key");

        var act = () => new TokenService(config);

        act.Should()
            .Throw<InvalidOperationException>()
            .WithMessage("JWT:SigningKey must be longer than 64 bytes for HmacSha512Signature.");
    }

    private static JwtSecurityToken ReadToken(string token)
    {
        return new JwtSecurityTokenHandler().ReadJwtToken(token);
    }

    private static AppUser CreateUser()
    {
        return new AppUser
        {
            Id = "user-1",
            UserName = "utku",
            Email = "utku@example.com",
        };
    }

    private static IConfiguration CreateConfiguration(string? signingKey = SigningKey)
    {
        var values = new Dictionary<string, string?>
        {
            ["JWT:SigningKey"] = signingKey,
            ["JWT:Issuer"] = "job-tracker-tests",
            ["JWT:Audience"] = "job-tracker-client-tests",
        };

        return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
    }
}
