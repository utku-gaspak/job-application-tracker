using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers;

public abstract class BaseApiController : ControllerBase
{
    protected string? GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);
}
