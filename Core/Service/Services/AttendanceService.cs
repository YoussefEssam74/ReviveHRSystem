using System.Globalization;
using System.Text.Json;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.AuditModule;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using DomainLayer.Models.SchedulingModule;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Attendance;
using Shared.DataTransferObject.Kiosk;

namespace Service.Services
{
    /// <summary>
    /// Attendance station API. Callers redeem a short-lived 6-digit enrollment code at
    /// kiosk login, which creates a DB-backed station session and returns its opaque
    /// token; every event must present that token (X-Station-Token) or a gym-scoped
    /// user token. The GymId always comes from the validated session (or the user
    /// token's claim) — never from the request body — and no deviceId is involved, so
    /// replacing broken station hardware never breaks the integration.
    ///
    /// ADR-004 cross-gym validation on every event:
    ///   1. employee has UserGymAccess to the session's gym
    ///   2. employee has a ShiftAssignment (with a real shift, not a day off) at THAT gym —
    ///      normally today's, or the previous day's overnight shift for events after midnight
    /// Failures reject the event without creating any AttendanceRecord. Each record
    /// stores both GymId and the StationSessionId that issued it.
    /// </summary>
    public class AttendanceService(IUnitOfWork unitOfWork, IUserAccessRepository userAccess, IStationSessionService stationSessions, TimeZoneInfo? attendanceTimeZone = null, AttendanceOptions? attendanceOptions = null) : IAttendanceService
    {
        private const double MinimumLivenessScore = 0.70;
        private static readonly TimeSpan MaxFutureSkew = TimeSpan.FromMinutes(10);

        /// <summary>Request label stored on the Early Leave submission rows.</summary>
        private static readonly string EarlyLeaveRequestType =
            RequestTypeCatalog.Find(RequestTypeCatalog.EarlyLeaveId)?.Label ?? "Early Leave";

        private const string EarlyLeaveWarningTitle = "Early Leaving Warning";

        /// <summary>Auto-drafts a WarningNotice once this many unexcused early departures land in one month.</summary>
        private const int RepeatedEarlyLeavingThreshold = 3;
        private const string RepeatedEarlyLeavingReason = "Repeated early leaving";

        // An AUTO scan shortly after an overnight shift ends should close that
        // shift's still-open record instead of opening a new check-in for today.
        private static readonly TimeSpan OvernightAutoCheckoutGrace = TimeSpan.FromHours(6);

        // Anonymous station callers may backdate within a bounded window (device clock
        // drift, buffered offline events, same-day manual entry) but never pick an
        // arbitrary past instant.
        private static readonly TimeSpan MaxPastSkew = TimeSpan.FromHours(24);

        // Primary-constructor optional parameter: resolve the fallback once at construction.
        private readonly TimeZoneInfo _attendanceTimeZone = attendanceTimeZone ?? TimeZoneInfo.Local;

        // Minutes a check-out may run before the shift end without being an early leave.
        private readonly int _earlyLeaveGraceMinutes = (attendanceOptions ?? new AttendanceOptions()).EarlyLeaveGraceMinutes;

        public async Task<StationLoginResponse> StationLoginAsync(StationLoginRequest request, CancellationToken cancellationToken = default)
        {
            var stationCode = await ResolveStationCodeAsync(request.Code, cancellationToken)
                ?? throw new UnAuthorizedException("Invalid or expired station code.");

            var token = await stationSessions.CreateSessionAsync(
                stationCode.GymId, stationCode.Id, cancellationToken);

            return new StationLoginResponse
            {
                GymId = stationCode.GymId,
                GymName = stationCode.Gym.Name,
                Token = token,
                SessionExpiresAtUtc = DateTime.UtcNow.Add(stationSessions.SessionLifetime)
            };
        }

        public async Task<AttendanceResponse?> RecordBiometricEventAsync(
            AttendanceEventRequest request,
            int? authorizedGymId = null,
            int? stationSessionId = null,
            string? ipAddress = null,
            bool confirmCheckout = true,
            CancellationToken cancellationToken = default)
        {
            if (request.LivenessScore is null || request.LivenessScore < MinimumLivenessScore)
            {
                throw new BadRequestException($"Liveness score must be at least {MinimumLivenessScore:P0}.");
            }

            return await RecordAsync(
                employeeReference: request.EmployeeId,
                eventType: request.Type,
                method: AttendanceMethod.Biometric,
                timestamp: request.Timestamp ?? DateTime.UtcNow,
                reason: null,
                authorizedGymId: authorizedGymId,
                stationSessionId: stationSessionId,
                ipAddress: ipAddress,
                biometricCheckoutConfirmed: confirmCheckout,
                cancellationToken: cancellationToken);
        }

        public async Task<AttendanceResponse> RecordManualEntryAsync(
            ManualAttendanceRequest request,
            int? authorizedGymId = null,
            int? stationSessionId = null,
            string? ipAddress = null,
            CancellationToken cancellationToken = default)
        {
            // Validate the audited reason up front: the check must not depend on
            // whether the punch happened to be an IN or an OUT.
            if (string.IsNullOrWhiteSpace(request.Reason))
            {
                throw new BadRequestException("A reason is required for manual attendance.");
            }

            // The DTO's Type became optional when the HR-portal day-write form was
            // added to this route (S4, A3); the station punch form still requires it.
            if (string.IsNullOrWhiteSpace(request.Type))
            {
                throw new BadRequestException("A type (IN/OUT) is required for a manual station punch.");
            }

            return await RecordAsync(
                employeeReference: request.EmployeeId,
                eventType: request.Type,
                method: AttendanceMethod.Manual,
                timestamp: request.Timestamp ?? DateTime.UtcNow,
                reason: request.Reason.Trim(),
                authorizedGymId: authorizedGymId,
                stationSessionId: stationSessionId,
                ipAddress: ipAddress,
                biometricCheckoutConfirmed: null, // manual punches are explicit IN/OUT decisions
                cancellationToken: cancellationToken);
        }

        /// <summary>
        /// Today's view of a gym for the kiosk dashboard: present/scheduled counters
        /// and the full roster of employees scheduled today — shift, punches, and how
        /// late they checked in / how early they left. Read-only, station-session scoped.
        /// </summary>
        public async Task<StationSummaryResponse> GetStationSummaryAsync(int gymId, CancellationToken cancellationToken = default)
        {
            if (gymId <= 0)
            {
                throw new UnAuthorizedException("Attendance requests require a station session token.");
            }

            var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _attendanceTimeZone);
            var today = DateOnly.FromDateTime(localNow);

            // Sequential: these share one scoped DbContext, and EF Core does not
            // allow concurrent operations on a single context (the previous
            // Task.WhenAll version threw InvalidOperationException under load).
            var roster = await unitOfWork.GetRepository<ShiftAssignment, int>()
                .GetAllAsync(new StationRosterByGymDateSpec(gymId, today), cancellationToken);
            var records = await unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceRecordsByGymDateSpec(gymId, today), cancellationToken);

            var recordByEmployee = records
                .GroupBy(r => r.EmployeeId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(r => r.CheckInTime ?? DateTime.MinValue).First());

            var rows = roster
                .OrderBy(a => a.ShiftTemplate!.StartTime)
                .ThenBy(a => a.Employee.FullName, StringComparer.OrdinalIgnoreCase)
                .Select(a =>
                {
                    var template = a.ShiftTemplate!;
                    var shiftStartsAt = ShiftWindowStartsAt(a.Date, template);
                    var shiftEndsAt = ShiftWindowEndsAt(a.Date, template);
                    recordByEmployee.TryGetValue(a.EmployeeId, out var record);

                    var checkIn = record?.CheckInTime is { } checkInUtc
                        ? TimeZoneInfo.ConvertTimeFromUtc(checkInUtc, _attendanceTimeZone)
                        : (DateTime?)null;
                    var checkOut = record?.CheckOutTime is { } checkOutUtc
                        ? TimeZoneInfo.ConvertTimeFromUtc(checkOutUtc, _attendanceTimeZone)
                        : (DateTime?)null;

                    // No punch yet: still due before the shift ends, absent after it.
                    var status = record?.CheckInTime is null
                        ? localNow > shiftEndsAt ? "ABSENT" : "SCHEDULED"
                        : record.CheckOutTime is null ? "PRESENT" : "LEFT";

                    var method = record is null
                        ? null
                        : (record.CheckOutTime is not null ? record.CheckOutMethod : record.CheckInMethod)?.ToString();

                    return new StationSummaryRecord
                    {
                        RecordId = record is null ? null : $"ATT-{record.Id}",
                        EmployeeId = a.Employee.EmployeeNumber,
                        EmployeeName = a.Employee.FullName,
                        Status = status,
                        ShiftName = template.Name,
                        ShiftStart = template.StartTime.ToString("HH:mm", CultureInfo.InvariantCulture),
                        ShiftEnd = template.EndTime.ToString("HH:mm", CultureInfo.InvariantCulture),
                        CheckIn = checkIn?.ToString("HH:mm", CultureInfo.InvariantCulture),
                        CheckOut = checkOut?.ToString("HH:mm", CultureInfo.InvariantCulture),
                        LateMinutes = checkIn is { } inAt && inAt > shiftStartsAt
                            ? (int)Math.Ceiling((inAt - shiftStartsAt).TotalMinutes)
                            : 0,
                        EarlyLeaveMinutes = checkOut is { } outAt && outAt < shiftEndsAt
                            ? (int)Math.Ceiling((shiftEndsAt - outAt).TotalMinutes)
                            : 0,
                        Method = method,
                    };
                })
                .ToArray();

            var rosterEmployeeIds = roster.Select(a => a.EmployeeId).ToHashSet();
            var extraRows = records
                .Where(r => !rosterEmployeeIds.Contains(r.EmployeeId) && r.CheckInTime is not null)
                .OrderBy(r => r.Employee?.FullName ?? string.Empty, StringComparer.OrdinalIgnoreCase)
                .Select(r =>
                {
                    var checkIn = r.CheckInTime is { } inUtc
                        ? TimeZoneInfo.ConvertTimeFromUtc(inUtc, _attendanceTimeZone)
                        : (DateTime?)null;
                    var checkOut = r.CheckOutTime is { } outUtc
                        ? TimeZoneInfo.ConvertTimeFromUtc(outUtc, _attendanceTimeZone)
                        : (DateTime?)null;
                    var status = r.CheckOutTime is null ? "PRESENT" : "LEFT";
                    var method = (r.CheckOutTime is not null ? r.CheckOutMethod : r.CheckInMethod)?.ToString();

                    return new StationSummaryRecord
                    {
                        RecordId = $"ATT-{r.Id}",
                        EmployeeId = r.Employee?.EmployeeNumber ?? r.EmployeeId.ToString(),
                        EmployeeName = r.Employee?.FullName ?? $"Employee #{r.EmployeeId}",
                        Status = status,
                        ShiftName = AttendanceManagementService.CoverDayStatus,
                        ShiftStart = "—",
                        ShiftEnd = "—",
                        CheckIn = checkIn?.ToString("HH:mm", CultureInfo.InvariantCulture),
                        CheckOut = checkOut?.ToString("HH:mm", CultureInfo.InvariantCulture),
                        LateMinutes = 0,
                        EarlyLeaveMinutes = 0,
                        Method = method,
                    };
                })
                .ToArray();

            var allRows = rows.Concat(extraRows).ToArray();

            return new StationSummaryResponse
            {
                PresentCount = records.Count(r => r.CheckInTime is not null && r.CheckOutTime is null),
                ScheduledTodayCount = rows.Length,
                Records = allRows,
            };
        }

        private async Task<AttendanceResponse?> RecordAsync(
            string employeeReference,
            string eventType,
            AttendanceMethod method,
            DateTime timestamp,
            string? reason,
            int? authorizedGymId,
            int? stationSessionId,
            string? ipAddress,
            bool? biometricCheckoutConfirmed,
            CancellationToken cancellationToken)
        {
            // The gym comes from the validated station session (or a gym-scoped user
            // token) — it is never read from the request body.
            if (authorizedGymId is null)
            {
                throw new UnAuthorizedException("Attendance requests require a station session token.");
            }

            var gym = await unitOfWork.GetRepository<DomainLayer.Models.OrganizationModule.Gym, int>()
                .GetByIdAsync(authorizedGymId.Value, cancellationToken)
                ?? throw new UnAuthorizedException("This gym is inactive.");

            if (gym.Status != GymStatus.Active)
            {
                throw new UnAuthorizedException("This gym is inactive.");
            }

            var gymId = gym.Id;
            var gymName = gym.Name;
            var type = NormalizeType(eventType);
            var utcTimestamp = ToUtc(timestamp);
            if (utcTimestamp > DateTime.UtcNow.Add(MaxFutureSkew))
            {
                throw new BadRequestException("Event timestamp cannot be in the future.");
            }

            if (utcTimestamp < DateTime.UtcNow.Subtract(MaxPastSkew))
            {
                throw new BadRequestException("Event timestamp cannot be more than 24 hours in the past.");
            }

            // Schedule comparisons use the configured organization timezone; the stored
            // instant and response timestamp are UTC.
            var localEvent = TimeZoneInfo.ConvertTimeFromUtc(utcTimestamp, _attendanceTimeZone);
            var eventDate = DateOnly.FromDateTime(localEvent);

            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeLookupSpec(employeeReference), cancellationToken);
            if (employee is null)
            {
                throw new NotFoundException("Employee not found.");
            }

            // ADR-004 check #1 — gym access.
            var hasGymAccess = await userAccess.HasGymAccessAsync(employee.UserId, gymId, cancellationToken);
            if (!hasGymAccess)
            {
                throw new UnAuthorizedException("You are not assigned to this gym.");
            }

            // Resolve which shift this event belongs to. A shift's window can span
            // midnight (overnight templates such as 22:00 → 05:00 end the next day), so
            // events after midnight may still belong to the previous day's shift: an IN
            // while the event is inside that shift's window, an OUT when that shift has
            // a record to close.
            var assignments = await unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>()
                .GetAllAsync(new ShiftAssignmentsForAttendanceSpec(employee.Id, eventDate), cancellationToken);
            var attendanceRepository = unitOfWork.GetRepository<AttendanceRecord, int>();
            var possibleRecords = await attendanceRepository.GetAllAsync(
                new AttendanceRecordByEmployeeDatesSpec(employee.Id, eventDate), cancellationToken);

            var previousDayAtGym = assignments
                .Where(a => a.Date == eventDate.AddDays(-1) && a.ShiftCycle.GymId == gymId && a.ShiftTemplate is not null)
                .ToArray();

            // Today's records win whenever they exist so repeat events keep hitting the
            // same-day conflicts (ALREADY_CHECKED_IN / ALREADY_CHECKED_OUT).
            var todayHasCheckIn = possibleRecords.Any(r =>
                r.Date == eventDate && r.GymId == gymId && r.CheckInTime is not null);
            var todayHasOpenRecord = possibleRecords.Any(r =>
                r.Date == eventDate && r.GymId == gymId && r.CheckInTime is not null && r.CheckOutTime is null);

            // A kiosk scan after midnight can belong to yesterday's overnight shift.
            // Only an overnight template (end earlier than start) with an open record
            // and a scan shortly after its end is treated as that shift's checkout;
            // otherwise the scan opens today's shift as usual.
            var previousDayOvernightOpen = previousDayAtGym
                .FirstOrDefault(a =>
                    a.ShiftTemplate!.EndTime < a.ShiftTemplate.StartTime
                    && localEvent <= ShiftWindowEndsAt(a.Date, a.ShiftTemplate!).Add(OvernightAutoCheckoutGrace)
                    && possibleRecords.Any(r =>
                        r.Date == a.Date && r.GymId == gymId
                        && r.CheckInTime is not null && r.CheckOutTime is null));

            // The always-on kiosk camera sends AUTO: resolve the direction from the
            // employee's own state — an open record today or yesterday's open
            // overnight shift closes (OUT), anything else opens (IN) — so the
            // station never has to guess what the employee did.
            var requestedAuto = type == "AUTO";
            if (type == "AUTO")
            {
                type = todayHasOpenRecord || previousDayOvernightOpen is not null ? "OUT" : "IN";
            }

            // Kiosk confirmation gate: an AUTO scan that would close today's open record
            // returns "pending" (null, nothing written) unless the employee confirmed
            // "check out now" on the terminal. Explicit IN/OUT punches and the /events
            // integration endpoint (confirmCheckout defaults to true) are unaffected.
            if (requestedAuto && type == "OUT" && biometricCheckoutConfirmed == false)
            {
                return null;
            }

            ShiftAssignment? carriedOverAssignment = null;
            if (type == "IN")
            {
                // After midnight an IN still belongs to the previous day's overnight
                // shift while the event falls inside that shift's window.
                if (!todayHasCheckIn)
                {
                    carriedOverAssignment = previousDayAtGym
                        .FirstOrDefault(a => localEvent <= ShiftWindowEndsAt(a.Date, a.ShiftTemplate!));
                }
            }
            else if (!todayHasOpenRecord)
            {
                // OUT after midnight closes the previous day's record — a late checkout
                // or an overnight shift finishing in the early hours. Prefer the
                // overnight shift AUTO already identified.
                carriedOverAssignment = previousDayOvernightOpen
                    ?? previousDayAtGym.FirstOrDefault(a => possibleRecords.Any(r => r.Date == a.Date && r.GymId == gymId));
            }

            var shiftAtThisGym = carriedOverAssignment
                ?? assignments.FirstOrDefault(a => a.Date == eventDate && a.ShiftCycle.GymId == gymId && a.ShiftTemplateId.HasValue);

            var isUnscheduledAttendance = false;
            if (shiftAtThisGym is null)
            {
                var todayAssignments = assignments.Where(a => a.Date == eventDate).ToArray();
                var dayOffAtThisGym = todayAssignments.Any(a => a.ShiftCycle.GymId == gymId);
                if (dayOffAtThisGym || todayAssignments.Length == 0)
                {
                    isUnscheduledAttendance = true;
                }
                else
                {
                    throw new UnAuthorizedException("This employee is scheduled at a different branch today.");
                }
            }

            var template = shiftAtThisGym?.ShiftTemplate;
            var attendanceDate = shiftAtThisGym?.Date ?? eventDate;

            // The shift as a full wall-clock window on its scheduled date (attendance
            // timezone). Overnight templates — EndTime at or before StartTime, e.g.
            // 22:00 → 05:00 — end the following day, so every comparison below uses
            // these instants instead of bare clock times that break across midnight.
            var shiftStartsAt = template is not null ? ShiftWindowStartsAt(attendanceDate, template) : DateTime.MinValue;
            var shiftEndsAt = template is not null ? ShiftWindowEndsAt(attendanceDate, template) : DateTime.MaxValue;

            var record = possibleRecords.FirstOrDefault(r => r.Date == attendanceDate);

            if (record is not null && record.GymId != gymId)
            {
                throw new UnAuthorizedException(
                    "This employee already has an attendance record at another gym for this shift.");
            }

            EarlyLeaveAssessment? earlyLeave = null;

            if (type == "IN")
            {
                if (record?.CheckInTime is not null && record.CheckOutTime is null)
                {
                    throw new BadRequestException("This employee is already checked in today.");
                }

                record ??= new AttendanceRecord
                {
                    EmployeeId = employee.Id,
                    GymId = gymId,
                    Date = attendanceDate,
                    ScheduledShiftTemplateId = template?.Id
                };
                if (record.Id == 0)
                {
                    await attendanceRepository.AddAsync(record, cancellationToken);
                }

                if (record.CheckInTime is null)
                {
                    record.CheckInTime = utcTimestamp;
                    record.CheckInMethod = method;
                    record.Status = template is not null && localEvent > shiftStartsAt ? AttendanceStatus.Late : AttendanceStatus.OnTime;
                    if (isUnscheduledAttendance)
                    {
                        record.Notes = "Unscheduled / Off-day check-in (pending approval)";
                    }
                }
                else
                {
                    // Multiple check-ins in the same day:
                    // Keep the first CheckInTime, clear CheckOutTime to reopen the day's record
                    record.CheckOutTime = null;
                    if (record.Status == AttendanceStatus.EarlyCheckout && template is not null)
                    {
                        record.Status = AttendanceStatus.OnTime;
                    }
                }

                if (isUnscheduledAttendance)
                {
                    await EnsureUnscheduledRequestAndNotificationsAsync(gymId, employee, attendanceDate, localEvent, cancellationToken);
                }
            }
            else
            {
                if (record is null || record.CheckInTime is null)
                {
                    throw new BadRequestException("No check-in found for today. Check in first.");
                }

                if (record.CheckOutTime is not null)
                {
                    if (utcTimestamp <= record.CheckOutTime.Value)
                    {
                        throw new BadRequestException("This employee is already checked out today.");
                    }
                }
                else if (utcTimestamp <= record.CheckInTime.Value)
                {
                    throw new BadRequestException("Checkout time must be after check-in time.");
                }

                record.CheckOutTime = utcTimestamp;
                record.CheckOutMethod = method;

                // Lateness outranks early checkout. Leaving beyond the configured grace
                // window is an early leave: an active Early Leave request covers it only
                // when the departure is not before the time the employee asked for;
                // otherwise the punch raises a Branch Manager + HR warning.
                if (template is not null)
                {
                    var minutesEarly = (int)Math.Ceiling((shiftEndsAt - localEvent).TotalMinutes);
                    if (minutesEarly > _earlyLeaveGraceMinutes)
                    {
                        earlyLeave = await AssessEarlyLeaveAsync(
                            employee.Id, attendanceDate, localEvent, minutesEarly, shiftEndsAt, template, cancellationToken);
                        if (record.Status != AttendanceStatus.Late)
                        {
                            record.Status = AttendanceStatus.EarlyCheckout;
                        }
                    }
                    else if (record.Status == AttendanceStatus.EarlyCheckout)
                    {
                        record.Status = AttendanceStatus.OnTime;
                    }
                }
                else if (record.Status == AttendanceStatus.EarlyCheckout)
                {
                    record.Status = AttendanceStatus.OnTime;
                }
            }

            // Save the punch and required audit event in one transaction. The first
            // save obtains the generated attendance ID; both writes commit or roll back together.

            // Audit: remember which station session issued this punch (when one did).
            if (stationSessionId is not null)
            {
                record.StationSessionId = stationSessionId;
            }

            if (method == AttendanceMethod.Manual)
            {
                await unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    await unitOfWork.SaveChangesAsync(cancellationToken);
                    await unitOfWork.GetRepository<AuditLog, int>().AddAsync(new AuditLog
                    {
                        UserId = null,
                        Action = "AttendanceManualEntry",
                        EntityType = "AttendanceRecord",
                        EntityId = record.Id,
                        NewValues = JsonSerializer.Serialize(new
                        {
                            employeeId = employee.EmployeeNumber,
                            gymId,
                            type,
                            timestamp = utcTimestamp,
                            reason,
                            stationSessionId
                        }),
                        Timestamp = DateTime.UtcNow,
                        IpAddress = ipAddress
                    }, cancellationToken);
                    await unitOfWork.SaveChangesAsync(cancellationToken);
                }, cancellationToken);
            }
            else
            {
                // Unique-index races become a stable 400 bad request.
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }

            if (earlyLeave is { Covered: false })
            {
                try
                {
                    await DispatchEarlyLeaveWarningAsync(gymId, employee, record, attendanceDate, earlyLeave.Value, cancellationToken);
                }
                catch
                {
                    // Notification/escalation failure must not block the attendance punch.
                }
            }

            return new AttendanceResponse
            {
                RecordId = $"ATT-{record.Id}",
                EmployeeId = employee.EmployeeNumber,
                EmployeeName = employee.FullName,
                GymId = gymId,
                GymName = gymName,
                Type = type,
                Method = method.ToString(),
                Timestamp = utcTimestamp,
                AttendanceStatus = record.Status.ToString().ToUpperInvariant(),
                EarlyLeaveMinutes = earlyLeave?.MinutesEarly ?? 0,
                EarlyLeaveWarning = earlyLeave is { Covered: false },
                ShiftComparison = isUnscheduledAttendance
                    ? "UNSCHEDULED"
                    : (type == "IN"
                        ? (localEvent > shiftStartsAt ? "LATE" : "ON_SCHEDULE")
                        : earlyLeave is { } leave
                            ? (leave.Covered ? "EARLY_LEAVE_COVERED" : "EARLY_LEAVE")
                            : "ON_SCHEDULE")
            };
        }

        /// <summary>
        /// Evaluates a check-out that ran past the early-leave grace: the day's latest
        /// Early Leave request (any status) explains the departure, while only a
        /// pending/approved one — and only when the employee did not leave before the
        /// time he asked for — covers it. A rejected or earlier-than-requested
        /// departure is the warning BM and HR must adjudicate.
        /// </summary>
        private async Task<EarlyLeaveAssessment> AssessEarlyLeaveAsync(
            int employeeId,
            DateOnly date,
            DateTime localEvent,
            int minutesEarly,
            DateTime shiftEndsAt,
            ShiftTemplate template,
            CancellationToken cancellationToken)
        {
            var requests = await unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetAllAsync(new EmployeeRequestsByDateAndTypeSpec(employeeId, date, EarlyLeaveRequestType), cancellationToken);

            var latest = requests.FirstOrDefault();
            var active = requests.FirstOrDefault(r =>
                r.Status is RequestStatus.Pending or RequestStatus.PendingHRReview or RequestStatus.Approved);

            var checkOutLocal = TimeOnly.FromDateTime(localEvent);
            var leftBeforeRequested = active?.TargetTime is { } requested
                && localEvent < ResolveRequestedDeparture(date, template, requested);

            return new EarlyLeaveAssessment(
                minutesEarly,
                checkOutLocal,
                TimeOnly.FromDateTime(shiftEndsAt),
                latest,
                active is not null && !leftBeforeRequested,
                leftBeforeRequested,
                active?.TargetTime);
        }

        /// <summary>
        /// Anchors a requested wall-clock departure to the shift's calendar window:
        /// on an overnight shift a time before the start (e.g. 00:34) is the next
        /// morning, so comparing bare clock times cannot misfile it as the previous day.
        /// </summary>
        private static DateTime ResolveRequestedDeparture(DateOnly shiftDate, ShiftTemplate template, TimeOnly requested)
        {
            var at = shiftDate.ToDateTime(requested);
            return template.EndTime <= template.StartTime && requested < template.StartTime
                ? at.AddDays(1)
                : at;
        }

        /// <summary>
        /// Fans one low-noise warning out to the gym's Branch Managers and HR (deduped
        /// per attendance record) and, once a month reaches the repeat threshold, drafts
        /// the formal warning notice for them to review.
        /// </summary>
        private async Task DispatchEarlyLeaveWarningAsync(
            int gymId,
            Employee employee,
            AttendanceRecord record,
            DateOnly date,
            EarlyLeaveAssessment assessment,
            CancellationToken cancellationToken)
        {
            var management = (await unitOfWork.GetRepository<User, int>()
                .GetAllAsync(new BranchManagersAndHrForGymSpec(gymId), cancellationToken))
                .ToList();
            if (management.Count == 0)
            {
                return;
            }

            var token = $"[ATT-{record.Id}]";
            var alreadySent = await unitOfWork.GetRepository<Notification, int>()
                .GetAllAsync(new NotificationsByMessageTokenSpec(token), cancellationToken);
            var notified = alreadySent.Select(n => n.UserId).ToHashSet();

            var detail = assessment.LatestRequest switch
            {
                null => "No early leave request was filed.",
                { Status: RequestStatus.Rejected } => "The early leave request was rejected.",
                _ when assessment.LeftBeforeRequested && assessment.RequestedTime is { } requested =>
                    $"Left at {assessment.CheckOutLocal:HH:mm}, before the requested {requested:HH:mm}.",
                _ => string.Empty,
            };

            var message = $"{employee.FullName} checked out {assessment.MinutesEarly} min before shift end "
                + $"({assessment.ShiftEndLocal:HH:mm}) on {date:yyyy-MM-dd} at {assessment.CheckOutLocal:HH:mm}. "
                + $"{detail} {token}".Trim();

            var notificationRepository = unitOfWork.GetRepository<Notification, int>();
            var added = false;
            foreach (var user in management.Where(u => !notified.Contains(u.Id)))
            {
                await notificationRepository.AddAsync(new Notification
                {
                    UserId = user.Id,
                    Title = EarlyLeaveWarningTitle,
                    Message = message,
                    Type = NotificationType.AttendanceIssue,
                    IsRead = false,
                    LinkTo = "payroll",
                    CreatedAt = DateTime.UtcNow
                }, cancellationToken);
                added = true;
            }

            if (added)
            {
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }

            await EnsureRepeatedEarlyLeavingNoticeAsync(employee, management, date, cancellationToken);
        }

        /// <summary>
        /// Third unexcused early departure of the month drafts a Pending warning notice
        /// (Attendance / "Repeated early leaving") for BM-HR review. Days covered by an
        /// active Early Leave request never count, and one draft per month is enough.
        /// </summary>
        private async Task EnsureRepeatedEarlyLeavingNoticeAsync(
            Employee employee,
            IReadOnlyCollection<User> management,
            DateOnly date,
            CancellationToken cancellationToken)
        {
            var monthStart = new DateOnly(date.Year, date.Month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);

            var records = await unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceByEmployeesRangeSpec([employee.Id], monthStart, monthEnd), cancellationToken);
            var earlyDepartures = records
                .Where(r => r.CheckOutTime is not null && r.ScheduledShiftTemplate is not null)
                .ToList();
            if (earlyDepartures.Count < RepeatedEarlyLeavingThreshold)
            {
                return;
            }

            var requests = (await unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetAllAsync(new RequestsByEmployeesSpec([employee.Id], null, EarlyLeaveRequestType, monthStart, monthEnd), cancellationToken))
                .ToList();

            var warningDays = earlyDepartures
                .Where(r => IsUnexcusedEarlyLeaving(r, requests))
                .ToList();
            if (warningDays.Count < RepeatedEarlyLeavingThreshold)
            {
                return;
            }

            var notices = await unitOfWork.GetRepository<WarningNotice, int>()
                .GetAllAsync(new WarningNoticesByEmployeesSpec([employee.Id]), cancellationToken);
            if (notices.Any(n => n.Reason == RepeatedEarlyLeavingReason
                && n.IssuedAt.Year == date.Year && n.IssuedAt.Month == date.Month))
            {
                return;
            }

            // The notice is auto-drafted on the branch's behalf: the gym's HR owner is
            // preferred (the spec's role rows are not loaded with their Role), and any
            // management recipient the spec returned is a safe fallback.
            var issuer = management.FirstOrDefault(u => u.UserType == UserType.HR) ?? management.First();

            var days = string.Join(", ", warningDays
                .OrderBy(r => r.Date)
                .Select(r => $"{r.Date:yyyy-MM-dd} ({r.CheckOutTime:HH\\:mm} UTC)"));

            await unitOfWork.GetRepository<WarningNotice, int>().AddAsync(new WarningNotice
            {
                EmployeeId = employee.Id,
                Type = "Attendance",
                Reason = RepeatedEarlyLeavingReason,
                Note = $"Auto-drafted after {warningDays.Count} unexcused early departures in "
                    + $"{monthStart:MMMM yyyy}: {days}. Review and file or decline.",
                IssuedBy = issuer.Id,
                IssuedAt = DateTime.UtcNow,
                Status = ProposalStatus.Pending
            }, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        /// <summary>True when the day ended past the grace window and no active request covers it.</summary>
        private bool IsUnexcusedEarlyLeaving(AttendanceRecord record, IReadOnlyCollection<EmployeeRequest> requests)
        {
            if (record.CheckOutTime is not { } checkOutUtc || record.ScheduledShiftTemplate is not { } template)
            {
                return false;
            }

            var checkOutLocal = TimeZoneInfo.ConvertTimeFromUtc(checkOutUtc, _attendanceTimeZone);
            var shiftEndsAt = ShiftWindowEndsAt(record.Date, template);
            var minutesEarly = (int)Math.Ceiling((shiftEndsAt - checkOutLocal).TotalMinutes);
            if (minutesEarly <= _earlyLeaveGraceMinutes)
            {
                return false;
            }

            var active = requests
                .Where(r => r.RequestDate == record.Date
                    && r.Status is RequestStatus.Pending or RequestStatus.PendingHRReview or RequestStatus.Approved)
                .OrderByDescending(r => r.CreatedAt)
                .FirstOrDefault();
            if (active is null)
            {
                return true;
            }

            return active.TargetTime is { } requested
                && checkOutLocal < ResolveRequestedDeparture(record.Date, template, requested);
        }

        /// <summary>Outcome of comparing one check-out against the shift end and the day's request.</summary>
        private readonly record struct EarlyLeaveAssessment(
            int MinutesEarly,
            TimeOnly CheckOutLocal,
            TimeOnly ShiftEndLocal,
            EmployeeRequest? LatestRequest,
            bool Covered,
            bool LeftBeforeRequested,
            TimeOnly? RequestedTime);

        private async Task EnsureUnscheduledRequestAndNotificationsAsync(
            int gymId, Employee employee, DateOnly date, DateTime localEvent, CancellationToken cancellationToken)
        {
            var requestRepo = unitOfWork.GetRepository<EmployeeRequest, int>();
            var existing = await requestRepo.GetAllAsync(
                new EmployeeRequestsByDateAndTypeSpec(employee.Id, date, RequestTypeCatalog.UnscheduledAttendanceLabel),
                cancellationToken);

            if (!existing.Any())
            {
                var request = new EmployeeRequest
                {
                    EmployeeId = employee.Id,
                    Type = RequestTypeCatalog.UnscheduledAttendanceLabel,
                    RequestDate = date,
                                    TargetTime = TimeOnly.FromDateTime(localEvent),
                                    SubmittedAt = DateTime.UtcNow,
                                    CreatedAt = DateTime.UtcNow,
                                    Status = RequestStatus.Pending,
                                    Details = $"{employee.FullName} checked in on an unscheduled day ({date:yyyy-MM-dd}) at {localEvent:HH:mm}. Awaiting BM/HR decision for extra/cover day calculation.",
                                };
                await requestRepo.AddAsync(request, cancellationToken);
                await unitOfWork.SaveChangesAsync(cancellationToken);

                try
                {
                    var users = await unitOfWork.GetRepository<User, int>()
                        .GetAllAsync(new BranchManagersAndHrForGymSpec(gymId), cancellationToken);

                    var notificationRepo = unitOfWork.GetRepository<Notification, int>();
                    var title = "Unscheduled Attendance";
                    var message = $"{employee.FullName} checked in on an unscheduled day ({date:yyyy-MM-dd}). Awaiting approval.";

                    foreach (var user in users)
                    {
                        await notificationRepo.AddAsync(new Notification
                        {
                            UserId = user.Id,
                            Title = title,
                            Message = message,
                            Type = NotificationType.AttendanceIssue,
                            IsRead = false,
                            LinkTo = "team-requests",
                            CreatedAt = DateTime.UtcNow
                        }, cancellationToken);
                    }

                    await unitOfWork.SaveChangesAsync(cancellationToken);
                }
                catch
                {
                    // Notification dispatch failure should not block attendance punch
                }
            }
        }

        /// <summary>
        /// Resolves the active, unexpired station enrollment code behind a 6-digit
        /// value, including its gym, or null when the code is unknown/malformed.
        /// </summary>
        private async Task<StationCode?> ResolveStationCodeAsync(string code, CancellationToken cancellationToken)
        {
            var normalized = code?.Trim() ?? string.Empty;
            if (normalized.Length != 6 || !normalized.All(char.IsDigit))
            {
                return null;
            }

            var stationCode = await unitOfWork.GetRepository<StationCode, int>()
                .GetByIdAsync(new StationCodeByCodeSpec(normalized), cancellationToken);

            if (stationCode is null)
            {
                return null;
            }

            // A rotated code is inactive; a live code still stops being accepted once
            // its short lifetime elapses.
            if (stationCode.ExpiresAtUtc is { } expiresAtUtc && expiresAtUtc <= DateTime.UtcNow)
            {
                return null;
            }

            return stationCode;
        }

        private static string NormalizeType(string eventType)
        {
            var normalized = eventType?.Trim().ToUpperInvariant();
            return normalized switch
            {
                "IN" or "CHECKIN" or "CHECK_IN" => "IN",
                "OUT" or "CHECKOUT" or "CHECK_OUT" => "OUT",
                "AUTO" => "AUTO", // resolved from the employee's current state
                _ => throw new BadRequestException("Type must be \"IN\" or \"OUT\".")
            };
        }

        /// <summary>Wall-clock start of the shift on its scheduled date, in the attendance timezone.</summary>
        private static DateTime ShiftWindowStartsAt(DateOnly date, ShiftTemplate template) =>
            date.ToDateTime(template.StartTime);

        /// <summary>
        /// Wall-clock end of the shift on its scheduled date. Overnight templates
        /// (EndTime at or before StartTime, e.g. 22:00 → 05:00) end on the following day.
        /// </summary>
        private static DateTime ShiftWindowEndsAt(DateOnly date, ShiftTemplate template) =>
            template.EndTime > template.StartTime
                ? date.ToDateTime(template.EndTime)
                : date.AddDays(1).ToDateTime(template.EndTime);

        private static DateTime ToUtc(DateTime timestamp) => timestamp.Kind switch
        {
            DateTimeKind.Utc => timestamp,
            DateTimeKind.Local => timestamp.ToUniversalTime(),
            _ => DateTime.SpecifyKind(timestamp, DateTimeKind.Utc) // no offset sent → assumed UTC
        };
    }
}
