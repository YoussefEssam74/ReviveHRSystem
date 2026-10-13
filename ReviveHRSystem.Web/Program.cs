using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using AutoMapper;
using Biometrics;
using Storage;
using DomainLayer.Contracts;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Presistence.Data;
using Presistence.Repository;
using ReviveHRSystem.Web.Authentication;
using ReviveHRSystem.Web.CustomMiddleWares;
using ReviveHRSystem.Web.DataSeed;
using ReviveHRSystem.Web.Factories;
using ReviveHRSystem.Web.Middleware;
using Presentation.Authorization;
using Service.Mapping;
using Service.Services;
using ServiceAbstraction.Services;
using Shared.Configuration;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace ReviveHRSystem.Web
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            builder.Services.AddControllers();

            // Configure DbContext with PostgreSQL
            // cspell:disable-next-line
            builder.Services.AddDbContext<ReviveHrDbContext>(options =>
                options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

            // --- JWT authentication (access-token-only, ADR-002 minus refresh tokens) ---
            var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>() ?? new JwtSettings();
            if (string.IsNullOrWhiteSpace(jwtSettings.Key) || jwtSettings.Key.Length < 32)
            {
                throw new InvalidOperationException(
                    "Jwt:Key must be configured with at least 32 characters (see appsettings.Development.json / environment).");
            }

            builder.Services.AddSingleton(jwtSettings);

            // Station (kiosk) credentials are opaque, DB-backed session tokens — not JWTs.
            // Both schemes back the authorization policies below: a request signed in as a
            // web user presents a Bearer JWT, a kiosk presents the X-Station-Token header.
            var stationCodeSettings = builder.Configuration.GetSection(StationCodeOptions.SectionName).Get<StationCodeOptions>()
                ?? new StationCodeOptions();
            var stationSessionSettings = builder.Configuration.GetSection(StationSessionOptions.SectionName).Get<StationSessionOptions>()
                ?? new StationSessionOptions();
            builder.Services.AddSingleton(stationCodeSettings);
            builder.Services.AddSingleton(stationSessionSettings);

            builder.Services
                .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidIssuer = jwtSettings.Issuer,
                        ValidateAudience = true,
                        ValidAudience = jwtSettings.Audience,
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Key)),
                        ValidateLifetime = true,
                        ClockSkew = TimeSpan.FromSeconds(30)
                    };
                })
                .AddScheme<AuthenticationSchemeOptions, StationSessionAuthenticationHandler>(
                    StationSessionAuthentication.SchemeName, _ => { });

            // Fallback policy: every endpoint requires an authenticated principal unless it
            // explicitly opts out with [AllowAnonymous] (only the 3 login endpoints). Either
            // scheme satisfies the policy — web user tokens and station session tokens —
            // and per-endpoint claim checks (GetActorUserId / GetGymIdFromToken) decide what
            // each identity is allowed to do. New controllers are secured by default.
            builder.Services.AddAuthorization(options =>
            {
                var requireAuthenticated = new AuthorizationPolicyBuilder(
                        JwtBearerDefaults.AuthenticationScheme,
                        StationSessionAuthentication.SchemeName)
                    .RequireAuthenticatedUser()
                    .Build();

                options.DefaultPolicy = requireAuthenticated;
                options.FallbackPolicy = requireAuthenticated;

                // Per-gym feature access policies (ADR-003 Amendment 1): one
                // "feature:{code}:{level}" policy per catalog feature at View and Edit.
                AuthorizationPolicies.Register(options);
            });

            // Resolves [HasFeatureAccess] policies against the caller's effective
            // feature levels in the token's gym. Scoped: the permission service is scoped.
            builder.Services.AddScoped<IAuthorizationHandler, FeatureAccessHandler>();

            // --- Rate limiting for the public endpoints (limits configurable per environment;
            //     appsettings.Testing.json raises them so integration tests aren't throttled) ---
            var rateLimitSection = builder.Configuration.GetSection("RateLimiting");
            var authLoginPermits = rateLimitSection.GetValue<int?>("AuthLoginPermits") ?? 10;
            var stationLoginPermits = rateLimitSection.GetValue<int?>("StationLoginPermits") ?? 10;
            var stationAttendancePermits = rateLimitSection.GetValue<int?>("StationAttendancePermits") ?? 120;
            builder.Services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
                options.AddPolicy<string>("station-login", context =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = stationLoginPermits,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0
                        }));
                options.AddPolicy<string>("auth-login", context =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = authLoginPermits,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0
                        }));
                options.AddPolicy<string>("station-attendance", context =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = stationAttendancePermits,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0
                        }));
                options.OnRejected = async (context, cancellationToken) =>
                {
                    context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    await context.HttpContext.Response.WriteAsJsonAsync(new
                    {
                        statusCode = 429,
                        errorMessage = "Too many requests. Please retry later.",
                        errors = Array.Empty<object>(),
                        error = "RATE_LIMITED"
                    }, cancellationToken);
                };
            });

            // Validation errors use the project's envelope instead of ProblemDetails.
            // Behind a TLS-terminating proxy, the external scheme and client IP arrive
            // in X-Forwarded-Proto/-For. Only loopback proxies are trusted by default;
            // extend KnownNetworks/KnownProxies when the proxy runs on another host so
            // clients cannot spoof the rate limiter's remote-IP partition key.
            builder.Services.Configure<ForwardedHeadersOptions>(options =>
            {
                options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            });

            builder.Services.Configure<ApiBehaviorOptions>(options =>
                options.InvalidModelStateResponseFactory = ApiResponseFactory.GenerateApiValidationErrorResponse);

            // CORS is opt-in: an empty Cors:AllowedOrigins list yields a policy that matches
            // nothing, which is exactly the previous behaviour (same-origin deployments and
            // the Vite dev proxy need no headers). Populating the list in production lets a
            // separately-hosted SPA call the API directly.
            var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                ?? Array.Empty<string>();
            builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
                .WithOrigins(allowedOrigins)
                .AllowAnyHeader()
                .AllowCredentials() // the station session travels in an HttpOnly cookie for cross-origin kiosk SPAs
                .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE")));

            // Schedule comparisons use an explicit organization timezone, independent of
            // the host machine's local timezone.
            var attendanceTimeZoneId = builder.Configuration["Attendance:TimeZoneId"];
            if (string.IsNullOrWhiteSpace(attendanceTimeZoneId))
            {
                throw new InvalidOperationException("Attendance:TimeZoneId must be configured explicitly.");
            }

            var attendanceTimeZone = TimeZoneInfo.FindSystemTimeZoneById(attendanceTimeZoneId);
            builder.Services.AddSingleton(attendanceTimeZone);

            // --- Application services ---
            // AutoMapper scans the service assembly for MappingProfile.
            builder.Services.AddAutoMapper(cfg => cfg.AddProfile<MappingProfile>(), typeof(AuthService).Assembly);
            builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
            builder.Services.AddScoped<IUserAccessRepository, UserAccessRepository>();
            builder.Services.AddScoped<IPasswordHasher, PasswordHasher>();
            builder.Services.AddScoped<ITokenService, TokenService>();
            builder.Services.AddScoped<IAuthService, AuthService>();
            builder.Services.AddScoped<IAttendanceService, AttendanceService>();
            builder.Services.AddScoped<IPermissionService, PermissionService>();
            builder.Services.AddScoped<ITeamScopeService, TeamScopeService>();
            builder.Services.AddScoped<IEmployeeAccessService, EmployeeAccessService>();
            builder.Services.AddScoped<IEmployeeProfileService, EmployeeProfileService>();
            builder.Services.AddScoped<IEmployeeDocumentService, EmployeeDocumentService>();
            builder.Services.AddScoped<IAttendanceSelfService, AttendanceSelfService>();
            builder.Services.AddScoped<IScheduleSelfService, ScheduleSelfService>();
            builder.Services.AddScoped<IEmployeeRequestService, EmployeeRequestService>();
            builder.Services.AddScoped<INotificationService, NotificationService>();
            builder.Services.AddScoped<IAccountSettingsService, AccountSettingsService>();
            builder.Services.AddScoped<IEvaluationSelfService, EvaluationSelfService>();
            builder.Services.AddScoped<IEvaluationManagementService, EvaluationManagementService>();
            builder.Services.AddScoped<IEmploymentHistoryService, EmploymentHistoryService>();
            builder.Services.AddScoped<IEmployeeEventService, EmployeeEventService>();
            builder.Services.AddScoped<IPayrollSelfService, PayrollSelfService>();
            builder.Services.AddScoped<IDashboardService, DashboardService>();
            builder.Services.AddScoped<IEmployeeManagementService, EmployeeManagementService>();
            builder.Services.AddScoped<IRequestManagementService, RequestManagementService>();
            builder.Services.AddScoped<IAttendanceManagementService, AttendanceManagementService>();
            builder.Services.AddScoped<ITeamOverviewService, TeamOverviewService>();
            builder.Services.AddScoped<IVacancyRequestService, VacancyRequestService>();
            builder.Services.AddScoped<IOffboardingService, OffboardingService>();
            builder.Services.AddScoped<IShiftManagementService, ShiftManagementService>();
            builder.Services.AddScoped<IBranchActionsService, BranchActionsService>();
            builder.Services.AddScoped<ITeamActionsService, TeamActionsService>();
            builder.Services.AddScoped<ISessionContextService, SessionContextService>();
            builder.Services.AddScoped<IStationCodeService, StationCodeService>();
            builder.Services.AddScoped<IStationSessionService, StationSessionService>();
            builder.Services.AddFaceBiometrics(builder.Configuration);
            builder.Services.AddLocalFileStorage(builder.Configuration);

            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen(options =>
            {
                options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
                {
                    Title = "Revive HR System API",
                    Version = "v1"
                });
                options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
                {
                    Name = "Authorization",
                    In = Microsoft.OpenApi.Models.ParameterLocation.Header,
                    Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT",
                    Description = "Paste the access token returned by POST /api/auth/login."
                });
                // Stations authenticate with the opaque session token from
                // POST /api/kiosk/login instead of a Bearer JWT.
                options.AddSecurityDefinition("StationSession", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
                {
                    Name = StationSessionAuthentication.TokenHeader,
                    In = Microsoft.OpenApi.Models.ParameterLocation.Header,
                    Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
                    Description = "Station session token returned by POST /api/kiosk/login (attendance stations only). The kiosk SPA instead authenticates automatically via the HttpOnly 'StationSession' cookie set by that same login — no header needed."
                });
                options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
                {
                    {
                        new Microsoft.OpenApi.Models.OpenApiSecurityScheme
                        {
                            Reference = new Microsoft.OpenApi.Models.OpenApiReference
                            {
                                Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                                Id = "Bearer"
                            }
                        },
                        Array.Empty<string>()
                    }
                });
                // Standard error responses (400/401/404/500, plus 429 where
                // rate-limited) come from one place instead of per-action attributes.
                options.OperationFilter<Swagger.ErrorResponseOperationFilter>();

                // Controller XML comments (Infrastructure/Presentation) — resolved next to the
                // assembly so paths stay correct under any content root/layout.
                var documentationFile = $"{typeof(Presentation.Controllers.ApiControllerBase).Assembly.GetName().Name}.xml";
                var documentationPath = Path.Combine(AppContext.BaseDirectory, documentationFile);
                if (File.Exists(documentationPath))
                {
                    options.IncludeXmlComments(documentationPath);
                }
            });

            var app = builder.Build();

            // First in the pipeline so Request.IsHttps (the kiosk session cookie's
            // Secure flag) reflects the external scheme behind a TLS-terminating proxy.
            app.UseForwardedHeaders();

            app.UseMiddleware<CustomExceptionMiddleWare>();
            app.UseMiddleware<SecurityHeadersMiddleware>();

            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();

                // Idempotent dev seed: super admin, demo gym, station code, employee + shift.
                await DevelopmentDataSeeder.SeedAsync(app.Services);
            }

            app.UseHttpsRedirection();
            app.UseRateLimiter();
            app.UseCors();
            app.UseAuthentication();
            app.UseAuthorization();

            app.MapControllers();

            app.Run();
        }
    }
}
