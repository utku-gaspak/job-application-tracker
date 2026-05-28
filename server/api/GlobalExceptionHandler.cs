using System.ComponentModel.DataAnnotations;
using System.Net;
using api.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace api;

public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (statusCode, title, detail) = exception switch
        {
            ValidationException validationException => (
                (int)HttpStatusCode.BadRequest,
                "Bad Request",
                validationException.Message
            ),
            NotFoundException notFoundException => (
                (int)HttpStatusCode.NotFound,
                "Not Found",
                notFoundException.Message
            ),
            UnauthorizedAccessException unauthorizedAccessException => (
                (int)HttpStatusCode.Unauthorized,
                "Unauthorized",
                unauthorizedAccessException.Message
            ),
            _ => (
                (int)HttpStatusCode.InternalServerError,
                "Internal Server Error",
                "An unexpected error occurred."
            ),
        };

        if (exception is ValidationException)
            logger.LogWarning(
                exception,
                "Client error {StatusCode} for {Method} {Path}: {Detail}",
                statusCode,
                httpContext.Request.Method,
                httpContext.Request.Path,
                detail
            );
        else
            logger.LogError(
                exception,
                "Request failed with status code {StatusCode} for {Method} {Path}",
                statusCode,
                httpContext.Request.Method,
                httpContext.Request.Path
            );

        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = detail,
            Instance = httpContext.Request.Path,
        };

        httpContext.Response.StatusCode = problemDetails.Status.Value;
        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);

        return true;
    }
}
