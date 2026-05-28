using System.Text;
using System.IdentityModel.Tokens.Jwt;
using api;
using api.Data;
using api.Etc;
using api.Interface;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using NSwag;
using NSwag.Generation.Processors.Security;

var builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsDevelopment())
    Microsoft.IdentityModel.Logging.IdentityModelEventSource.ShowPII = true;

// Keep JWT claim types unchanged so NameIdentifier round-trips between token creation and auth.
JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

var defaultConnection = RequiredConfiguration.GetDefaultConnection(builder.Configuration);
var allowedOrigins =
    builder.Configuration
        .GetSection("Cors:AllowedOrigins")
        .Get<string[]>()
    ?? [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://traxr.xyz",
        "https://www.traxr.xyz",
    ];

builder.Services.AddCors(options =>
{
    options.AddPolicy(
        "AllowReactApp",
        policy =>
        {
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
        }
    );
});

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(defaultConnection);
});

builder.Services.AddControllers();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IJobApplicationService, JobApplicationService>();
builder.Services.AddSingleton<ScrapeJobQueue>();
builder.Services.AddSingleton<IScrapeJobQueue>(provider => provider.GetRequiredService<ScrapeJobQueue>());
builder.Services.AddHostedService<ScrapeJobWorker>();

builder.Services.AddOpenApiDocument(config =>
{
    config.PostProcess = document =>
    {
        document.Info.Title = "Job Application Tracker API";
        document.Info.Description = "JWT-protected API for tracking job applications.";
    };

    config.AddSecurity(
        "JWT",
        Enumerable.Empty<string>(),
        new OpenApiSecurityScheme
        {
            Type = OpenApiSecuritySchemeType.ApiKey,
            Name = "Authorization",
            In = OpenApiSecurityApiKeyLocation.Header,
            Description = "Use: Bearer {your-jwt-token}",
        }
    );

    config.OperationProcessors.Add(new AspNetCoreOperationSecurityScopeProcessor("JWT"));
});

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

builder
    .Services.AddIdentityCore<AppUser>(options =>
    {
        options.Password.RequireDigit = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireUppercase = false;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequiredLength = 6;
    })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();

builder
    .Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["JWT:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["JWT:Audience"],
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["JWT:SigningKey"]!)
            ),
            NameClaimType = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                // Normalize bearer tokens because copied/generated headers may contain embedded whitespace.
                var authHeader = context.Request.Headers.Authorization.ToString();

                if (
                    !string.IsNullOrWhiteSpace(authHeader)
                    && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
                )
                {
                    var token = authHeader["Bearer ".Length..].Trim();
                    context.Token = string.Concat(token.Where(c => !char.IsWhiteSpace(c)));
                }

                return Task.CompletedTask;
            },
            OnAuthenticationFailed = context =>
            {
                Console.WriteLine("--- JWT AUTHENTICATION FAILED ---");
                Console.WriteLine(context.Exception.Message);
                return Task.CompletedTask;
            },
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

// Keep schema aligned with the running model so new optional fields persist in every environment.
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();
    await DemoDataSeeder.SeedAsync(scope.ServiceProvider);
}

app.UseExceptionHandler();
app.UseCors("AllowReactApp");

if (app.Environment.IsDevelopment())
{
    app.UseOpenApi();
    app.UseSwaggerUi();
    await app.GenerateApiClientsFromOpenApi("/../../client/src/generate-ts-client.ts");
}

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

public partial class Program;
