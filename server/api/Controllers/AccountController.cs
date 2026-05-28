using api.Dtos.Account;
using api.Services;
using api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers;

[Route("api/account")]
[ApiController]
public class AccountController(
    UserManager<AppUser> userManager,
    ITokenService tokenService,
    SignInManager<AppUser> signInManager
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
    public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
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

        return Ok(
            new NewUserDto
            {
                UserName = user.UserName,
                Email = user.Email,
                Token = tokenService.CreateToken(user),
            }
        );
    }
}
