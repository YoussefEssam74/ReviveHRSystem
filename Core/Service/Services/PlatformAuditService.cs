using System.Globalization;
using System.Text;
using System.Text.Json;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AuditModule;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.PlatformModule;
using DomainLayer.Models.UserModule;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Platform;

namespace Service.Services
{
    /// <summary>
    /// The platform-wide audit trail.
    ///
    /// The trail is append-only: <see cref="ReviewAsync"/> stamps <c>ReviewedAt</c> and is the
    /// only mutation any row ever accepts. Exports are stored snapshots rather than re-run
    /// queries, so a package handed to an auditor cannot change under them.
    /// </summary>
    public sealed class PlatformAuditService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IPlatformReadRepository _readModel) : IPlatformAuditService
    {
        /// <summary>Salary/hard cap on one export, so a runaway request cannot pin the server.</summary>
        private const int MaxExportRows = 50_000;

        /// <summary>Advisory-lock key guarding the export-number sequence.</summary>
        private const int ExportSequenceLockKey = 7_412_002;

        private static readonly JsonSerializerOptions JsonStore = new(JsonSerializerDefaults.Web);

        // ------------------------------------------------------------------
        // Trail
        // ------------------------------------------------------------------

        public async Task<PlatformAuditListResponse> GetAuditAsync(int? actorUserId, PlatformAuditQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.audit.view", cancellationToken);

            var rows = await LoadRowsAsync(cancellationToken);
            var context = await BuildContextAsync(cancellationToken);

            var filtered = FilterRows(rows, query)
                .OrderByDescending(r => r.Timestamp)
                .ToList();

            var page = Math.Max(1, query.PageNumber);
            var pageSize = Math.Clamp(query.PageSize, 1, 100);
            var total = filtered.Count;

            return new PlatformAuditListResponse
            {
                Items = filtered
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(r => MapRow(r, context))
                    .ToList(),
                Counts = PlatformAuditFilter.Counts(rows),
                Page = page,
                PageSize = pageSize,
                TotalCount = total,
                TotalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize)),
            };
        }

        public async Task<PlatformAuditDetailResponse> GetEventAsync(int? actorUserId, int auditId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.audit.view", cancellationToken);

            var row = await _unitOfWork.GetRepository<AuditLog, int>()
                .GetByIdAsync(auditId, cancellationToken)
                ?? throw new NotFoundException("Audit event not found.");

            var context = await BuildContextAsync(cancellationToken);

            return new PlatformAuditDetailResponse
            {
                Id = row.Id,
                OccurredAt = row.Timestamp,
                Actor = MapActor(row, context),
                Company = row.CompanyId is int companyId && context.Companies.TryGetValue(companyId, out var company)
                    ? new PlatformAuditCompanyRef { Id = companyId, Name = company.Name, City = company.City }
                    : null,
                BranchId = row.GymId,
                Category = row.Category,
                Severity = row.Severity,
                Action = row.ActionLabel ?? row.Action,
                Target = row.Target,
                Detail = row.Detail,
                OldValues = row.OldValues,
                NewValues = row.NewValues,
                Reviewed = row.ReviewedAt is not null,
                ReviewedAt = row.ReviewedAt,
                ReviewedBy = row.ReviewedByUserId is int reviewerId && context.UserNames.TryGetValue(reviewerId, out var reviewerName)
                    ? new PlatformAuditActor
                    {
                        UserId = reviewerId,
                        Name = reviewerName,
                        Initials = PlatformHelpers.InitialsOf(reviewerName),
                        Role = context.Roles.TryGetValue(reviewerId, out var role) ? role : null,
                    }
                    : null,
                Immutable = true,
            };
        }

        public async Task<ReviewAuditEventResponse> ReviewAsync(int? actorUserId, int auditId, ReviewAuditEventRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.audit.review", cancellationToken);

            var repository = _unitOfWork.GetRepository<AuditLog, int>();
            var row = await repository.GetByIdAsync(new AuditLogTrackedByIdSpec(auditId), cancellationToken)
                      ?? throw new NotFoundException("Audit event not found.");

            if (row.ReviewedAt is not null)
            {
                throw new BadRequestException("This event has already been reviewed.");
            }

            var reviewedAt = DateTime.UtcNow;
            row.ReviewedAt = reviewedAt;
            row.ReviewedByUserId = actor.Id;
            repository.Update(row);

            // The trail is append-only, so the acknowledgement is recorded as its own event
            // rather than by editing the original row's narrative.
            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Reviewed audit event",
                category: "Settings",
                severity: "info",
                entityType: "AuditLog",
                entityId: row.Id,
                companyId: row.CompanyId,
                gymId: row.GymId,
                target: row.ActionLabel ?? row.Action,
                detail: string.IsNullOrWhiteSpace(request.Note)
                    ? $"Event #{row.Id} acknowledged."
                    : $"Event #{row.Id} acknowledged: {request.Note.Trim()}",
                values: new { ReviewedEventId = row.Id, request.Note },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new ReviewAuditEventResponse
            {
                Id = row.Id,
                Reviewed = true,
                ReviewedAt = reviewedAt,
                ReviewedBy = new PlatformAuditActor
                {
                    UserId = actor.Id,
                    Name = actor.UserName,
                    Initials = PlatformHelpers.InitialsOf(actor.UserName),
                    Role = PlatformHelpers.RoleLabel(actor, null),
                },
            };
        }

        public async Task<PlatformAuditReviewQueueResponse> GetReviewQueueAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.audit.view", cancellationToken);

            var rows = await LoadRowsAsync(cancellationToken);
            var context = await BuildContextAsync(cancellationToken);

            // Only exceptions need a decision; info rows are context, not work.
            var queue = rows
                .Where(r => r.ReviewedAt is null
                            && !string.Equals(r.Severity, "info", StringComparison.OrdinalIgnoreCase))
                .OrderBy(r => SeverityRank(r.Severity))
                .ThenByDescending(r => r.Timestamp)
                .Select(r => MapRow(r, context))
                .ToList();

            return new PlatformAuditReviewQueueResponse { Items = queue, Total = queue.Count };
        }

        public async Task<PlatformAuditSummaryResponse> GetSummaryAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.audit.view", cancellationToken);

            var rows = await LoadRowsAsync(cancellationToken);
            var sessions = await _unitOfWork.GetRepository<ImpersonationSession, int>()
                .GetAllAsync(new ImpersonationSessionsSpec(), cancellationToken);

            var unreviewed = rows
                .Where(r => r.ReviewedAt is null
                            && !string.Equals(r.Severity, "info", StringComparison.OrdinalIgnoreCase))
                .ToList();

            return new PlatformAuditSummaryResponse
            {
                AwaitingReview = unreviewed.Count,
                CriticalTotal = rows.Count(r => string.Equals(r.Severity, "critical", StringComparison.OrdinalIgnoreCase)),
                ImpersonationSessions = sessions.Count(),
                FailedSignIns = rows.Count(r =>
                    string.Equals(r.Category, "Security", StringComparison.OrdinalIgnoreCase)
                    && (r.ActionLabel ?? r.Action).Contains("sign-in", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(r.Severity, "info", StringComparison.OrdinalIgnoreCase)),
                DataExports = rows.Count(r =>
                    string.Equals(r.Category, "Data", StringComparison.OrdinalIgnoreCase)
                    && (r.ActionLabel ?? r.Action).Contains("export", StringComparison.OrdinalIgnoreCase)),
                TotalEvents = rows.Count,
                OldestUnreviewedAt = unreviewed.Count > 0 ? unreviewed.Min(r => r.Timestamp) : null,
            };
        }

        public async Task<ImpersonationSessionsResponse> GetImpersonationSessionsAsync(int? actorUserId, ImpersonationSessionsQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.audit.view", cancellationToken);

            var sessions = (await _unitOfWork.GetRepository<ImpersonationSession, int>()
                .GetAllAsync(new ImpersonationSessionsSpec(), cancellationToken)).ToList();

            var filtered = sessions.Where(s =>
                (query.From is null || s.StartedAt >= query.From)
                && (query.To is null || s.StartedAt <= query.To)
                && (query.ActorId is null || s.ActorUserId == query.ActorId))
                .ToList();

            var page = Math.Max(1, query.PageNumber);
            var pageSize = Math.Clamp(query.PageSize, 1, 100);

            var branchNames = await LoadBranchNamesAsync(cancellationToken);

            return new ImpersonationSessionsResponse
            {
                Items = filtered
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(s => new ImpersonationSessionRow
                    {
                        SessionId = s.Id,
                        ActorUserId = s.ActorUserId,
                        ActorName = s.ActorUser?.UserName ?? $"#{s.ActorUserId}",
                        CompanyId = s.CompanyId,
                        CompanyName = s.Company?.Name ?? $"#{s.CompanyId}",
                        BranchName = s.BranchId is int branchId && branchNames.TryGetValue(branchId, out var branch) ? branch : null,
                        EffectiveRole = s.EffectiveRole?.Name,
                        StartedAt = s.StartedAt,
                        EndedAt = s.EndedAt,
                        DurationMinutes = s.EndedAt is DateTime ended
                            ? Math.Max(0, (int)Math.Round((ended - s.StartedAt).TotalMinutes))
                            : null,
                        IpAddress = s.IpAddress,
                        Reason = s.Reason,
                    })
                    .ToList(),
                Page = page,
                PageSize = pageSize,
                TotalCount = filtered.Count,
                TotalPages = Math.Max(1, (int)Math.Ceiling(filtered.Count / (double)pageSize)),
            };
        }

        // ------------------------------------------------------------------
        // Export
        // ------------------------------------------------------------------

        public async Task<CreateAuditExportResponse> CreateExportAsync(int? actorUserId, CreateAuditExportRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.audit.export", cancellationToken);

            var format = request.Format?.Trim().ToLowerInvariant() switch
            {
                null or "" or "csv" => "Csv",
                "json" => "Json",
                _ => throw new BadRequestException("Export format must be Csv or Json."),
            };

            if (request.From is DateTime from && request.To is DateTime to && to < from)
            {
                throw new BadRequestException("The export range ends before it starts.");
            }

            var rows = await LoadRowsAsync(cancellationToken);
            var context = await BuildContextAsync(cancellationToken);
            var policy = await ReadRetentionPolicyAsync(cancellationToken);

            var selected = rows
                .Where(r => request.From is null || r.Timestamp >= request.From)
                .Where(r => request.To is null || r.Timestamp <= request.To)
                .Where(r => string.IsNullOrWhiteSpace(request.Severity)
                            || string.Equals(r.Severity, request.Severity.Trim(), StringComparison.OrdinalIgnoreCase))
                .Where(r => string.IsNullOrWhiteSpace(request.Category)
                            || string.Equals(r.Category, request.Category.Trim(), StringComparison.OrdinalIgnoreCase))
                .Where(r => request.CompanyId is null || r.CompanyId == request.CompanyId)
                .OrderByDescending(r => r.Timestamp)
                .Take(MaxExportRows)
                .ToList();

            var (content, contentType, extension) = format == "Json"
                ? (BuildJson(selected, context), "application/json", "json")
                : (BuildCsv(selected, context), "text/csv", "csv");

            var expiresAt = DateTime.UtcNow.AddDays(Math.Max(1, policy.ExportRetentionDays));
            var fileName = $"revivehr-audit-{DateTime.UtcNow:yyyyMMdd-HHmmss}.{extension}";

            AuditExportPackage? package = null;

            await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                await _unitOfWork.AcquireTransactionLockAsync(ExportSequenceLockKey, cancellationToken);

                package = new AuditExportPackage
                {
                    ExportId = await NextExportIdAsync(cancellationToken),
                    Format = format,
                    // Rendered eagerly: the snapshot is what was delivered, and re-running the
                    // query later would silently return a different answer.
                    Status = "Ready",
                    FilterJson = JsonSerializer.Serialize(new
                    {
                        request.From,
                        request.To,
                        request.Severity,
                        request.Category,
                        request.CompanyId,
                    }, JsonStore),
                    RowCount = selected.Count,
                    Content = content,
                    ContentType = contentType,
                    FileName = fileName,
                    RequestedByUserId = actor.Id,
                    CompletedAt = DateTime.UtcNow,
                    ExpiresAt = expiresAt,
                };

                await _unitOfWork.GetRepository<AuditExportPackage, int>().AddAsync(package, cancellationToken);

                await PlatformHelpers.WriteAuditAsync(
                    _unitOfWork, actor,
                    action: "Exported audit data",
                    category: "Data",
                    severity: "warning",
                    entityType: "AuditExportPackage",
                    entityId: 0,
                    companyId: request.CompanyId,
                    gymId: null,
                    target: $"{package.ExportId} · {selected.Count} event(s) · {format}",
                    detail: $"Audit export package generated; retained until {expiresAt:yyyy-MM-dd}.",
                    values: new { package.ExportId, selected.Count, format },
                    cancellationToken);

                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }, cancellationToken);

            return new CreateAuditExportResponse
            {
                ExportId = package!.ExportId,
                Status = package.Status,
                Format = package.Format,
                EstimatedRows = selected.Count,
                ExpiresAt = expiresAt,
            };
        }

        public async Task<AuditExportStatusResponse> GetExportAsync(int? actorUserId, string exportId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.audit.export", cancellationToken);

            var package = await LoadPackageAsync(exportId, cancellationToken);

            return new AuditExportStatusResponse
            {
                ExportId = package.ExportId,
                Status = package.Status,
                DownloadUrl = package.Status == "Ready"
                    ? $"/api/platform/audit/exports/{package.ExportId}/download"
                    : null,
                ExpiresAt = package.ExpiresAt,
            };
        }

        public async Task<(string FileName, byte[] Content, string ContentType)> DownloadExportAsync(int? actorUserId, string exportId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.audit.export", cancellationToken);

            var package = await LoadPackageAsync(exportId, cancellationToken);

            if (package.Status != "Ready" || package.Content is null)
            {
                throw new BadRequestException("This export package is not ready.");
            }

            if (package.ExpiresAt < DateTime.UtcNow)
            {
                throw new BadRequestException("This export package has expired. Generate a new one.");
            }

            return (package.FileName, Encoding.UTF8.GetBytes(package.Content), package.ContentType ?? "text/csv");
        }

        // ------------------------------------------------------------------
        // Retention policy
        // ------------------------------------------------------------------

        public async Task<AuditRetentionPolicyDto> GetRetentionPolicyAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.settings.manage", cancellationToken);

            return await ReadRetentionPolicyAsync(cancellationToken);
        }

        public async Task<AuditRetentionPolicyDto> UpdateRetentionPolicyAsync(int? actorUserId, UpdateAuditRetentionPolicyRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.settings.manage", cancellationToken);

            if (request.PlatformEventsYears is < 1 or > 50)
            {
                throw new BadRequestException("Platform event retention must be between 1 and 50 years.");
            }

            if (request.CompanyEventsYears is < 1 or > 50)
            {
                throw new BadRequestException("Company event retention must be between 1 and 50 years.");
            }

            if (request.ImpersonationYears is < 1 or > 50)
            {
                throw new BadRequestException("Impersonation retention must be between 1 and 50 years.");
            }

            if (request.ExportRetentionDays is < 1 or > 3650)
            {
                throw new BadRequestException("Export retention must be between 1 and 3650 days.");
            }

            var before = await ReadRetentionPolicyAsync(cancellationToken);

            await PlatformSettingsStore.WriteAsync(_unitOfWork, actor.Id, new Dictionary<string, string>
            {
                [PlatformSettingsKeys.AuditPlatformEventsYears] = request.PlatformEventsYears.ToString(CultureInfo.InvariantCulture),
                [PlatformSettingsKeys.AuditCompanyEventsYears] = request.CompanyEventsYears.ToString(CultureInfo.InvariantCulture),
                [PlatformSettingsKeys.AuditImpersonationYears] = request.ImpersonationYears.ToString(CultureInfo.InvariantCulture),
                [PlatformSettingsKeys.AuditExportRetentionDays] = request.ExportRetentionDays.ToString(CultureInfo.InvariantCulture),
            }, cancellationToken);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Updated audit retention policy",
                category: "Settings",
                severity: "info",
                entityType: "PlatformSetting",
                entityId: 0,
                companyId: null,
                gymId: null,
                target: "Audit retention policy",
                detail: "Retention windows changed. The trail itself remains append-only.",
                values: new
                {
                    Before = new { before.PlatformEventsYears, before.CompanyEventsYears, before.ImpersonationYears, before.ExportRetentionDays },
                    After = new { request.PlatformEventsYears, request.CompanyEventsYears, request.ImpersonationYears, request.ExportRetentionDays },
                },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return await ReadRetentionPolicyAsync(cancellationToken);
        }

        // ------------------------------------------------------------------
        // Internals
        // ------------------------------------------------------------------

        private async Task<List<AuditLog>> LoadRowsAsync(CancellationToken cancellationToken) =>
            (await _unitOfWork.GetRepository<AuditLog, int>()
                .GetAllAsync(new AllAuditLogsSpec(), cancellationToken)).ToList();

        private async Task<AuditExportPackage> LoadPackageAsync(string exportId, CancellationToken cancellationToken) =>
            await _unitOfWork.GetRepository<AuditExportPackage, int>()
                .GetByIdAsync(new AuditExportByPublicIdSpec(exportId), cancellationToken)
            ?? throw new NotFoundException("Export package not found.");

        /// <summary>Labels resolved once per request: user names, roles, company details.</summary>
        private sealed class AuditContext
        {
            public required IReadOnlyDictionary<int, string> UserNames { get; init; }
            public required IReadOnlyDictionary<int, string> Roles { get; init; }
            public required IReadOnlyDictionary<int, Company> Companies { get; init; }
        }

        private async Task<AuditContext> BuildContextAsync(CancellationToken cancellationToken)
        {
            var users = (await _unitOfWork.GetRepository<User, int>().GetAllAsync(cancellationToken)).ToList();
            var companies = (await _unitOfWork.GetRepository<Company, int>().GetAllAsync(cancellationToken)).ToList();
            var roleByUser = await _readModel.GetUserRoleLabelsAsync(cancellationToken);

            return new AuditContext
            {
                UserNames = users.ToDictionary(u => u.Id, u => u.UserName),
                Roles = roleByUser,
                Companies = companies.ToDictionary(c => c.Id, c => c),
            };
        }

        private static IEnumerable<AuditLog> FilterRows(IEnumerable<AuditLog> rows, PlatformAuditQuery query)
        {
            var companyFilter = query.CompanyId?.Trim();
            var platformOnly = string.Equals(companyFilter, "platform", StringComparison.OrdinalIgnoreCase);
            int? companyId = int.TryParse(companyFilter, out var parsed) ? parsed : null;
            var term = string.IsNullOrWhiteSpace(query.Search) ? null : query.Search.Trim().ToLowerInvariant();

            return rows
                .Where(r => platformOnly
                    ? r.CompanyId is null
                    : companyId is null || r.CompanyId == companyId)
                .Where(r => query.From is null || r.Timestamp >= query.From)
                .Where(r => query.To is null || r.Timestamp <= query.To)
                .Where(r => term is null
                            || $"{r.ActionLabel} {r.Action} {r.Target} {r.IpAddress} {r.Detail}".ToLowerInvariant().Contains(term));
        }

        private static PlatformAuditItem MapRow(AuditLog row, AuditContext context) => new()
        {
            Id = row.Id,
            OccurredAt = row.Timestamp,
            Actor = MapActor(row, context),
            Company = row.CompanyId is int companyId && context.Companies.TryGetValue(companyId, out var company)
                ? new PlatformAuditCompanyRef { Id = companyId, Name = company.Name, City = company.City }
                : null,
            Category = row.Category,
            Severity = row.Severity,
            Action = row.ActionLabel ?? row.Action,
            Target = row.Target,
            IpAddress = row.IpAddress,
            Reviewed = row.ReviewedAt is not null,
        };

        private static PlatformAuditActor MapActor(AuditLog row, AuditContext context)
        {
            var name = row.UserId is int id && context.UserNames.TryGetValue(id, out var resolved) ? resolved : "System";

            return new PlatformAuditActor
            {
                UserId = row.UserId,
                Name = name,
                Initials = PlatformHelpers.InitialsOf(name),
                Role = row.UserId is int userId && context.Roles.TryGetValue(userId, out var role) ? role : null,
                IpAddress = row.IpAddress,
            };
        }

        private static int SeverityRank(string? severity) => severity?.ToLowerInvariant() switch
        {
            "critical" => 0,
            "warning" => 1,
            _ => 2,
        };

        private async Task<Dictionary<int, string>> LoadBranchNamesAsync(CancellationToken cancellationToken)
        {
            var branches = await _unitOfWork.GetRepository<Gym, int>().GetAllAsync(cancellationToken);
            return branches.ToDictionary(b => b.Id, b => b.Name);
        }

        private async Task<string> NextExportIdAsync(CancellationToken cancellationToken)
        {
            var year = DateTime.UtcNow.Year;
            var existing = await _unitOfWork.GetRepository<AuditExportPackage, int>()
                .GetAllAsync(new AuditExportsByYearSpec(year), cancellationToken);

            var prefix = $"EXP-{year}-";
            var max = 0;
            foreach (var id in existing.Select(p => p.ExportId))
            {
                if (id.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                    && int.TryParse(id[prefix.Length..], out var sequence)
                    && sequence > max)
                {
                    max = sequence;
                }
            }

            return $"{prefix}{max + 1:D4}";
        }

        private static string BuildCsv(IReadOnlyList<AuditLog> rows, AuditContext context)
        {
            var sb = new StringBuilder();
            sb.AppendLine("Id,OccurredAt,Category,Severity,Action,Actor,ActorRole,Company,Target,IpAddress,Reviewed,Detail");

            foreach (var row in rows)
            {
                var actorName = row.UserId is int id && context.UserNames.TryGetValue(id, out var name) ? name : "System";
                var role = row.UserId is int userId && context.Roles.TryGetValue(userId, out var resolvedRole) ? resolvedRole : string.Empty;
                var company = row.CompanyId is int companyId && context.Companies.TryGetValue(companyId, out var c) ? c.Name : "Platform";

                sb.AppendLine(string.Join(',',
                    row.Id,
                    row.Timestamp.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
                    Csv(row.Category),
                    Csv(row.Severity),
                    Csv(row.ActionLabel ?? row.Action),
                    Csv(actorName),
                    Csv(role),
                    Csv(company),
                    Csv(row.Target),
                    Csv(row.IpAddress),
                    row.ReviewedAt is null ? "no" : "yes",
                    Csv(row.Detail)));
            }

            return sb.ToString();
        }

        private static string BuildJson(IReadOnlyList<AuditLog> rows, AuditContext context) =>
            JsonSerializer.Serialize(
                rows.Select(row => new
                {
                    row.Id,
                    OccurredAt = row.Timestamp,
                    row.Category,
                    row.Severity,
                    Action = row.ActionLabel ?? row.Action,
                    Actor = row.UserId is int id && context.UserNames.TryGetValue(id, out var name) ? name : "System",
                    ActorRole = row.UserId is int userId && context.Roles.TryGetValue(userId, out var role) ? role : null,
                    Company = row.CompanyId is int companyId && context.Companies.TryGetValue(companyId, out var c) ? c.Name : "Platform",
                    row.Target,
                    row.IpAddress,
                    Reviewed = row.ReviewedAt is not null,
                    ReviewedAt = row.ReviewedAt,
                    row.Detail,
                }),
                new JsonSerializerOptions(JsonStore) { WriteIndented = true });

        private static string Csv(string? value)
        {
            if (string.IsNullOrEmpty(value))
            {
                return string.Empty;
            }

            return value.Contains(',') || value.Contains('"') || value.Contains('\n')
                ? $"\"{value.Replace("\"", "\"\"")}\""
                : value;
        }

        private async Task<AuditRetentionPolicyDto> ReadRetentionPolicyAsync(CancellationToken cancellationToken)
        {
            var settings = await PlatformSettingsStore.ReadAsync(_unitOfWork, cancellationToken);

            return new AuditRetentionPolicyDto
            {
                PlatformEventsYears = PlatformSettingsStore.ReadInt(settings, PlatformSettingsKeys.AuditPlatformEventsYears, 7),
                CompanyEventsYears = PlatformSettingsStore.ReadInt(settings, PlatformSettingsKeys.AuditCompanyEventsYears, 3),
                ImpersonationYears = PlatformSettingsStore.ReadInt(settings, PlatformSettingsKeys.AuditImpersonationYears, 7),
                ExportRetentionDays = PlatformSettingsStore.ReadInt(settings, PlatformSettingsKeys.AuditExportRetentionDays, 90),
                Deletable = false,
                UpdatedAt = PlatformSettingsStore.ReadUpdatedAt(settings, PlatformSettingsKeys.AuditPlatformEventsYears),
            };
        }
    }
}
