using api.Dtos.Account;
using api.Services;
using api.Models;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers;

[Route("api/account")]
[ApiController]
public class AccountController(
    UserManager<AppUser> userManager,
    ITokenService tokenService,
    SignInManager<AppUser> signInManager,
    IDemoSessionService demoSessionService
) : ControllerBase
{
    [HttpPost("register")]
    [ProducesResponseType(typeof(NewUserDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Register([FromBody] RegisterDto registerDto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var appUser = new AppUser
        {
            UserName = registerDto.Username,
            Email = registerDto.Email,
        };
        var createdUser = await userManager.CreateAsync(appUser, registerDto.Password!);

        if (createdUser.Succeeded)
        {
            return Ok(
                new NewUserDto
                {
                    UserName = appUser.UserName,
                    Email = appUser.Email,
                    Token = tokenService.CreateToken(appUser),
                }
            );
        }

        return BadRequest(createdUser.Errors);
    }

    [HttpPost("login")]
    [Produces("application/json")]
    [ProducesResponseType(typeof(NewUserDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Login(
        [FromBody] LoginDto loginDto,
        CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var user = await userManager.Users.FirstOrDefaultAsync(x =>
            x.UserName == loginDto.Username
        );

        if (user == null)
            return Unauthorized("Invalid username or password.");

        var result = await signInManager.CheckPasswordSignInAsync(user, loginDto.Password!, false);

        if (!result.Succeeded)
            return Unauthorized("Invalid username or password.");

        if (string.Equals(user.UserName, DemoDataSeeder.DemoUsername, StringComparison.OrdinalIgnoreCase))
        {
            var demoSessionUser = await demoSessionService.CreateSessionAsync(cancellationToken);

            return Ok(
                new NewUserDto
                {
                    UserName = DemoDataSeeder.DemoUsername,
                    Email = user.Email,
                    Token = tokenService.CreateToken(
                        demoSessionUser,
                        DemoDataSeeder.DemoUsername,
                        isDemoSession: true),
                }
            );
        }

        return Ok(
            new NewUserDto
            {
                UserName = user.UserName,
                Email = user.Email,
                Token = tokenService.CreateToken(user),
            }
        );
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken = default)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized();

        if (demoSessionService.IsDemoSession(User))
            await demoSessionService.DeleteSessionAsync(userId, cancellationToken);

        return NoContent();
    }
}
