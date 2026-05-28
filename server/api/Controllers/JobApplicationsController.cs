using api.Dto;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class JobApplicationsController(IJobApplicationService service) : BaseApiController
{
    [HttpGet]
    public async Task<ActionResult<List<JobApplication>>> GetAll(CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var jobApplications = await service.GetAllAsync(userId, cancellationToken);
        return Ok(jobApplications);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<JobApplication>> GetById(
        [FromRoute] string id,
        CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var jobApplication = await service.GetByIdAsync(id, userId, cancellationToken);
        return Ok(jobApplication);
    }

    [HttpPost]
    public async Task<ActionResult<JobApplication>> Create(
        [FromBody] JobApplicationCreateDto dto,
        CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var jobApplication = await service.CreateAsync(dto, userId, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = jobApplication.Id }, jobApplication);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(
        [FromRoute] string id,
        [FromBody] JobApplicationUpdateDto dto,
        CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        await service.UpdateAsync(id, dto, userId, cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(
        [FromRoute] string id,
        CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var deleted = await service.DeleteAsync(id, userId, cancellationToken);
        if (!deleted) return NotFound();

        return NoContent();
    }
}
