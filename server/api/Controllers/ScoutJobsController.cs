using api.Dto;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers;

[ApiController]
[Authorize]
[Route("api/scout")]
public class ScoutJobsController(IScoutJobService service) : BaseApiController
{
    [HttpPatch("jobs/{id:guid}")]
    public async Task<ActionResult<ScoutJob>> UpdateState(
        [FromRoute] Guid id,
        [FromBody] ScoutJobStateUpdateDto dto,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Ok(await service.UpdateStateAsync(id, dto, userId, cancellationToken));
    }

    [HttpPost("jobs")]
    public async Task<ActionResult<ScoutJob>> Create(
        [FromBody] ScoutJobCreateDto dto,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Ok(await service.CreateAsync(dto, userId, cancellationToken));
    }

    [HttpPost("jobs/{id:guid}/apply")]
    public async Task<ActionResult<JobApplication>> MoveToTracker(
        [FromRoute] Guid id,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Ok(await service.MoveToTrackerAsync(id, userId, cancellationToken));
    }

    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<ScoutUploadResultDto>> Upload(
        [FromForm] IFormFile? file,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        if (file is null || file.Length == 0)
            return BadRequest("Upload a non-empty jobs.json file.");

        await using var stream = file.OpenReadStream();
        return Ok(await service.UploadAsync(stream, userId, cancellationToken));
    }

    [HttpGet("jobs")]
    public async Task<ActionResult<List<ScoutJob>>> GetJobs(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Ok(await service.GetJobsAsync(userId, cancellationToken));
    }

    [HttpGet("jobs/export")]
    public async Task<IActionResult> ExportJobs(
        [FromQuery] string format = "json",
        CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var (content, contentType, fileName) =
            await service.ExportJobsAsync(userId, format, cancellationToken);

        return File(content, contentType, fileName);
    }

    [HttpDelete("jobs/{id:guid}")]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        await service.DeleteAsync(id, userId, cancellationToken);
        return NoContent();
    }

    [HttpDelete("jobs")]
    public async Task<IActionResult> DeleteAll(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        await service.DeleteAllAsync(userId, cancellationToken);
        return NoContent();
    }

}
