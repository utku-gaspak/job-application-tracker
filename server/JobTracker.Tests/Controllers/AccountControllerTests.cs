using Moq;

namespace JobTracker.Tests.Controllers;

public class AccountControllerTests
{
    [Fact]
    public async Task Register_ValidRequest_ShouldReturnNewUserWithToken()
    {
        var registerDto = new RegisterDto
        {
            Username = "utku",
            Email = "utku@example.com",
            Password = "Password1!",
        };

        var userManagerMock = IdentityManagerMocks.CreateUserManager();
        userManagerMock
            .Setup(manager => manager.CreateAsync(
                It.Is<AppUser>(user =>
                    user.UserName == registerDto.Username && user.Email == registerDto.Email),
                registerDto.Password))
            .ReturnsAsync(IdentityResult.Success);

        var tokenServiceMock = new Mock<ITokenService>(MockBehavior.Strict);
        tokenServiceMock
            .Setup(service => service.CreateToken(It.Is<AppUser>(user =>
                user.UserName == registerDto.Username && user.Email == registerDto.Email)))
            .Returns("jwt-token");

        var signInManagerMock = IdentityManagerMocks.CreateSignInManager(userManagerMock.Object);
        var controller = new AccountController(
            userManagerMock.Object,
            tokenServiceMock.Object,
            signInManagerMock.Object,
            Mock.Of<IDemoSessionService>()
        );

        var result = await controller.Register(registerDto);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<NewUserDto>().Subject;
        response.UserName.Should().Be(registerDto.Username);
        response.Email.Should().Be(registerDto.Email);
        response.Token.Should().Be("jwt-token");
        userManagerMock.VerifyAll();
        tokenServiceMock.VerifyAll();
    }

    [Fact]
    public async Task Register_InvalidModelState_ShouldReturnBadRequest()
    {
        var userManagerMock = IdentityManagerMocks.CreateUserManager();
        var tokenServiceMock = new Mock<ITokenService>(MockBehavior.Strict);
        var signInManagerMock = IdentityManagerMocks.CreateSignInManager(userManagerMock.Object);
        var controller = new AccountController(
            userManagerMock.Object,
            tokenServiceMock.Object,
            signInManagerMock.Object,
            Mock.Of<IDemoSessionService>()
        );
        controller.ModelState.AddModelError(nameof(RegisterDto.Email), "Email is required.");

        var result = await controller.Register(new RegisterDto());

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.Value.Should().BeAssignableTo<SerializableError>();
        userManagerMock.Verify(
            manager => manager.CreateAsync(It.IsAny<AppUser>(), It.IsAny<string>()),
            Times.Never
        );
        tokenServiceMock.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Register_IdentityCreationFails_ShouldReturnIdentityErrors()
    {
        var registerDto = new RegisterDto
        {
            Username = "utku",
            Email = "utku@example.com",
            Password = "Password1!",
        };
        var identityErrors = new[]
        {
            new IdentityError { Code = "DuplicateUserName", Description = "Username exists." },
        };

        var userManagerMock = IdentityManagerMocks.CreateUserManager();
        userManagerMock
            .Setup(manager => manager.CreateAsync(It.IsAny<AppUser>(), registerDto.Password))
            .ReturnsAsync(IdentityResult.Failed(identityErrors));

        var tokenServiceMock = new Mock<ITokenService>(MockBehavior.Strict);
        var signInManagerMock = IdentityManagerMocks.CreateSignInManager(userManagerMock.Object);
        var controller = new AccountController(
            userManagerMock.Object,
            tokenServiceMock.Object,
            signInManagerMock.Object,
            Mock.Of<IDemoSessionService>()
        );

        var result = await controller.Register(registerDto);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.Value.Should().BeEquivalentTo(identityErrors);
        userManagerMock.Verify(manager => manager.CreateAsync(It.IsAny<AppUser>(), registerDto.Password), Times.Once);
        tokenServiceMock.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Login_UnknownUsername_ShouldReturnUnauthorized()
    {
        var dbContextFactory = new TestAppDbContextFactory();
        await using var dbContext = dbContextFactory.CreateContext();
        var userManagerMock = IdentityManagerMocks.CreateUserManager();
        userManagerMock.SetupGet(manager => manager.Users).Returns(dbContext.Users);

        var tokenServiceMock = new Mock<ITokenService>(MockBehavior.Strict);
        var signInManagerMock = IdentityManagerMocks.CreateSignInManager(userManagerMock.Object);
        var controller = new AccountController(
            userManagerMock.Object,
            tokenServiceMock.Object,
            signInManagerMock.Object,
            Mock.Of<IDemoSessionService>()
        );

        var result = await controller.Login(new LoginDto { Username = "missing", Password = "Password1!" });

        var unauthorized = result.Should().BeOfType<UnauthorizedObjectResult>().Subject;
        unauthorized.Value.Should().Be("Invalid username or password.");
        tokenServiceMock.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Login_InvalidPassword_ShouldReturnUnauthorized()
    {
        var appUser = new AppUser
        {
            Id = "user-1",
            UserName = "utku",
            Email = "utku@example.com",
        };
        var dbContextFactory = new TestAppDbContextFactory();
        await using var dbContext = dbContextFactory.CreateContext();
        dbContext.Users.Add(appUser);
        await dbContext.SaveChangesAsync();

        var userManagerMock = IdentityManagerMocks.CreateUserManager();
        userManagerMock.SetupGet(manager => manager.Users).Returns(dbContext.Users);

        var tokenServiceMock = new Mock<ITokenService>(MockBehavior.Strict);
        var signInManagerMock = IdentityManagerMocks.CreateSignInManager(userManagerMock.Object);
        signInManagerMock
            .Setup(manager => manager.CheckPasswordSignInAsync(appUser, "wrong-password", false))
            .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.Failed);

        var controller = new AccountController(
            userManagerMock.Object,
            tokenServiceMock.Object,
            signInManagerMock.Object,
            Mock.Of<IDemoSessionService>()
        );

        var result = await controller.Login(new LoginDto { Username = appUser.UserName, Password = "wrong-password" });

        var unauthorized = result.Should().BeOfType<UnauthorizedObjectResult>().Subject;
        unauthorized.Value.Should().Be("Invalid username or password.");
        signInManagerMock.Verify(
            manager => manager.CheckPasswordSignInAsync(appUser, "wrong-password", false),
            Times.Once
        );
        tokenServiceMock.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Login_ValidCredentials_ShouldReturnNewUserWithToken()
    {
        var appUser = new AppUser
        {
            Id = "user-1",
            UserName = "utku",
            Email = "utku@example.com",
        };
        var dbContextFactory = new TestAppDbContextFactory();
        await using var dbContext = dbContextFactory.CreateContext();
        dbContext.Users.Add(appUser);
        await dbContext.SaveChangesAsync();

        var userManagerMock = IdentityManagerMocks.CreateUserManager();
        userManagerMock.SetupGet(manager => manager.Users).Returns(dbContext.Users);

        var tokenServiceMock = new Mock<ITokenService>(MockBehavior.Strict);
        tokenServiceMock.Setup(service => service.CreateToken(appUser)).Returns("jwt-token");

        var signInManagerMock = IdentityManagerMocks.CreateSignInManager(userManagerMock.Object);
        signInManagerMock
            .Setup(manager => manager.CheckPasswordSignInAsync(appUser, "Password1!", false))
            .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.Success);

        var controller = new AccountController(
            userManagerMock.Object,
            tokenServiceMock.Object,
            signInManagerMock.Object,
            Mock.Of<IDemoSessionService>()
        );

        var result = await controller.Login(new LoginDto { Username = appUser.UserName, Password = "Password1!" });

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<NewUserDto>().Subject;
        response.UserName.Should().Be(appUser.UserName);
        response.Email.Should().Be(appUser.Email);
        response.Token.Should().Be("jwt-token");
        signInManagerMock.Verify(
            manager => manager.CheckPasswordSignInAsync(appUser, "Password1!", false),
            Times.Once
        );
        tokenServiceMock.Verify(service => service.CreateToken(appUser), Times.Once);
    }

    [Fact]
    public async Task Login_DemoCredentials_ShouldCreateTemporaryDemoSession()
    {
        var demoUser = new AppUser
        {
            Id = "demo-template",
            UserName = "demo",
            Email = "demo@traxr.xyz",
        };
        var demoSessionUser = new AppUser
        {
            Id = "demo-session-1",
            UserName = "demo-session-1",
            Email = "demo-session-1@traxr.local",
            IsDemoSession = true,
        };
        var dbContextFactory = new TestAppDbContextFactory();
        await using var dbContext = dbContextFactory.CreateContext();
        dbContext.Users.Add(demoUser);
        await dbContext.SaveChangesAsync();

        var userManagerMock = IdentityManagerMocks.CreateUserManager();
        userManagerMock.SetupGet(manager => manager.Users).Returns(dbContext.Users);

        var tokenServiceMock = new Mock<ITokenService>(MockBehavior.Strict);
        tokenServiceMock
            .Setup(service => service.CreateToken(demoSessionUser, "demo", true))
            .Returns("demo-session-token");

        var signInManagerMock = IdentityManagerMocks.CreateSignInManager(userManagerMock.Object);
        signInManagerMock
            .Setup(manager => manager.CheckPasswordSignInAsync(demoUser, "demo123", false))
            .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.Success);

        var demoSessionServiceMock = new Mock<IDemoSessionService>(MockBehavior.Strict);
        demoSessionServiceMock
            .Setup(service => service.CreateSessionAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(demoSessionUser);

        var controller = new AccountController(
            userManagerMock.Object,
            tokenServiceMock.Object,
            signInManagerMock.Object,
            demoSessionServiceMock.Object
        );

        var result = await controller.Login(new LoginDto { Username = "demo", Password = "demo123" });

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<NewUserDto>().Subject;
        response.UserName.Should().Be("demo");
        response.Email.Should().Be(demoUser.Email);
        response.Token.Should().Be("demo-session-token");
        demoSessionServiceMock.Verify(service => service.CreateSessionAsync(It.IsAny<CancellationToken>()), Times.Once);
        tokenServiceMock.Verify(service => service.CreateToken(demoSessionUser, "demo", true), Times.Once);
    }

    [Fact]
    public async Task Logout_DemoSession_ShouldDeleteTemporaryDemoSession()
    {
        var userManagerMock = IdentityManagerMocks.CreateUserManager();
        var tokenServiceMock = new Mock<ITokenService>(MockBehavior.Strict);
        var signInManagerMock = IdentityManagerMocks.CreateSignInManager(userManagerMock.Object);
        var demoSessionServiceMock = new Mock<IDemoSessionService>(MockBehavior.Strict);
        demoSessionServiceMock
            .Setup(service => service.IsDemoSession(It.IsAny<ClaimsPrincipal>()))
            .Returns(true);
        demoSessionServiceMock
            .Setup(service => service.DeleteSessionAsync("demo-session-1", It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var controller = new AccountController(
            userManagerMock.Object,
            tokenServiceMock.Object,
            signInManagerMock.Object,
            demoSessionServiceMock.Object
        )
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(
                        new ClaimsIdentity(
                            [new Claim(ClaimTypes.NameIdentifier, "demo-session-1")],
                            authenticationType: "TestAuthentication"))
                }
            }
        };

        var result = await controller.Logout();

        result.Should().BeOfType<NoContentResult>();
        demoSessionServiceMock.Verify(service => service.DeleteSessionAsync("demo-session-1", It.IsAny<CancellationToken>()), Times.Once);
    }
}
