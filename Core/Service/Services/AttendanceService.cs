using System.Text.Json;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.AuditModule;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.SchedulingModule;
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
    /// token's claim) â€” never from the request body â€” and no deviceId is involved, so
    /// replacing broken station hardware never breaks the integration.
    ///
    /// ADR-004 cross-gym validation on every event:
    ///   1. employee has UserGymAccess to the session's gym
    ///   2. employee has a ShiftAssignment (with a real shift, not a day off) at THAT gym â€”
    ///      normally today's, or the previous day's overnight shift for events after midnight
    /// Failures reject the event without creating any AttendanceRecord. Each record
    /// stores both GymId and the StationSessionId that issued it.
    /// </summary>
    public class AttendanceService(IUnitOfWork unitOfWork, IUserAccessRepository userAccess, IStationSessionService stationSessions, TimeZoneInfo? attendanceTimeZone = null) : IAttendanceService
    {
        private const double MinimumLivenessScore = 0.70;
        private static readonly TimeSpan MaxFutureSkew = TimeSpan.FromMinutes(10);

        // Anonymous station callers may backdate within a bounded window (device clock
        // drift, buffered offline events, same-day manual entry) but never pick an
        // arbitrary past instant.
        private static readonly TimeSpan MaxPastSkew = TimeSpan.FromHours(24);

        // Primary-constructor optional parameter: resolve the fallback once at construction.
        private readonly TimeZoneInfo _attendanceTimeZone = attendanceTimeZone ?? TimeZoneInfo.Local;

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
        /// Today's view of a gym for the kiosk dashboard: present count, scheduled
        /// count, and the most recent events. Read-only, station-session scoped.
        /// </summary>
        public async Task<StationSummaryResponse> GetStationSummaryAsync(int gymId, CancellationToken cancellationToken = default)
        {
            if (gymId <= 0)
            {
                throw new UnAuthorizedException("Attendance requests require a station session token.");
            }

            var today = DateOnly.FromDateTime(
                TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _attendanceTimeZone));

            var records = await unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceRecordsByGymDateSpec(gymId, today), cancellationToken);

            var scheduledToday = await unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>()
                .CountAsync(new ShiftAssignmentsByGymDateSpec(gymId, today), cancellationToken);

            var recent = records
                .OrderByDescending(r => r.CheckOutTime ?? r.CheckInTime ?? DateTime.MinValue)
                .Take(10)
                .Select(r => new StationSummaryRecord
                {
                    RecordId = $"ATT-{r.Id}",
                    EmployeeId = r.Employee.EmployeeNumber,
                    EmployeeName = r.Employee.FullName,
                    Status = r.CheckInTime is null
                        ? "DAY_OFF"
                        : r.CheckOutTime is null ? "PRESENT" : "LEFT",
                    LastEventType = r.CheckOutTime is not null ? "OUT" : r.CheckInTime is not null ? "IN" : null,
                    LastEventTime = r.CheckOutTime ?? r.CheckInTime,
                    AttendanceStatus = r.Status.ToString().ToUpperInvariant(),
                    Method = (r.CheckOutTime is not null ? r.CheckOutMethod : r.CheckInMethod)?.ToString(),
                })
                .ToArray();

            return new StationSummaryResponse
            {
                PresentCount = records.Count(r => r.CheckInTime is not null),
                ScheduledTodayCount = scheduledToday,
                Records = recent,
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
            // token) â€” it is never read from the request body.
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

            // ADR-004 check #1 â€” gym access.
            var hasGymAccess = await userAccess.HasGymAccessAsync(employee.UserId, gymId, cancellationToken);
            if (!hasGymAccess)
            {
                throw new UnAuthorizedException("You are not assigned to this gym.");
            }

            // Resolve which shift this event belongs to. A shift's window can span
            // midnight (overnight templates such as 22:00 â†’ 05:00 end the next day), so
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

            // The always-on kiosk camera sends AUTO: resolve the direction from the
            // employee's own state â€” an open record today closes (OUT), anything else
            // opens (IN) â€” so the station never has to guess what the employee did.
            var requestedAuto = type == "AUTO";
            if (type == "AUTO")
            {
                if (todayHasCheckIn && !todayHasOpenRecord)
                {
                    // Typed so the face pipeline can report a silent "already complete"
                    // scan outcome; HTTP callers of /events still get a 400 (the
                    // exception middleware matches BadRequestException by base type).
                    throw new AttendanceAlreadyCompleteException("This employee has already completed attendance for today.");
                }

                type = todayHasOpenRecord ? "OUT" : "IN";
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
                // OUT after midnight closes the previous day's record â€” a late checkout
                // or an overnight shift finishing in the early hours.
                carriedOverAssignment = previousDayAtGym
                    .FirstOrDefault(a => possibleRecords.Any(r => r.Date == a.Date && r.GymId == gymId));
            }

            var shiftAtThisGym = carriedOverAssignment
                ?? assignments.FirstOrDefault(a => a.Date == eventDate && a.ShiftCycle.GymId == gymId && a.ShiftTemplateId.HasValue);

            if (shiftAtThisGym is null)
            {
                var todayAssignments = assignments.Where(a => a.Date == eventDate).ToArray();
                var dayOffAtThisGym = todayAssignments.Any(a => a.ShiftCycle.GymId == gymId);
                if (dayOffAtThisGym || todayAssignments.Length == 0)
                {
                    throw new NotFoundException("No shift is scheduled for this employee today.");
                }

                throw new UnAuthorizedException("This employee is scheduled at a different branch today.");
            }

            var template = shiftAtThisGym.ShiftTemplate!;
            var attendanceDate = shiftAtThisGym.Date;

            // The shift as a full wall-clock window on its scheduled date (attendance
            // timezone). Overnight templates â€” EndTime at or before StartTime, e.g.
            // 22:00 â†’ 05:00 â€” end the following day, so every comparison below uses
            // these instants instead of bare clock times that break across midnight.
            var shiftStartsAt = ShiftWindowStartsAt(attendanceDate, template);
            var shiftEndsAt = ShiftWindowEndsAt(attendanceDate, template);

            var record = possibleRecords.FirstOrDefault(r => r.Date == attendanceDate);

            if (record is not null && record.GymId != gymId)
            {
                throw new UnAuthorizedException(
                    "This employee already has an attendance record at another gym for this shift.");
            }

            if (type == "IN")
            {
                if (record?.CheckInTime is not null)
                {
                    throw new BadRequestException("This employee is already checked in today.");
                }

                record ??= new AttendanceRecord
                {
                    EmployeeId = employee.Id,
                    GymId = gymId,
                    Date = attendanceDate,
                    ScheduledShiftTemplateId = template.Id
                };
                if (record.Id == 0)
                {
                    await attendanceRepository.AddAsync(record, cancellationToken);
                }

                record.CheckInTime = utcTimestamp;
                record.CheckInMethod = method;
                record.Status = localEvent > shiftStartsAt ? AttendanceStatus.Late : AttendanceStatus.OnTime;
            }
            else
            {
                if (record is null || record.CheckInTime is null)
                {
                    throw new BadRequestException("No check-in found for today. Check in first.");
                }

                if (record.CheckOutTime is not null)
                {
                    throw new BadRequestException("This employee is already checked out today.");
                }

                if (utcTimestamp <= record.CheckInTime.Value)
                {
                    throw new BadRequestException("Checkout time must be after check-in time.");
                }

                record.CheckOutTime = utcTimestamp;
                record.CheckOutMethod = method;

                // Lateness outranks early checkout; otherwise leaving before the shift's
                // end (the next day for overnight shifts) marks the record as EarlyCheckout.
                if (record.Status != AttendanceStatus.Late && localEvent < shiftEndsAt)
                {
                    record.Status = AttendanceStatus.EarlyCheckout;
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
                ShiftComparison = type == "IN"
                    ? (localEvent > shiftStartsAt ? "LATE" : "ON_SCHEDULE")
                    : (localEvent < shiftEndsAt ? "EARLY_CHECKOUT" : "ON_SCHEDULE")
            };
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
        /// (EndTime at or before StartTime, e.g. 22:00 â†’ 05:00) end on the following day.
        /// </summary>
        private static DateTime ShiftWindowEndsAt(DateOnly date, ShiftTemplate template) =>
            template.EndTime > template.StartTime
                ? date.ToDateTime(template.EndTime)
                : date.AddDays(1).ToDateTime(template.EndTime);

        private static DateTime ToUtc(DateTime timestamp) => timestamp.Kind switch
        {
            DateTimeKind.Utc => timestamp,
            DateTimeKind.Local => timestamp.ToUniversalTime(),
            _ => DateTime.SpecifyKind(timestamp, DateTimeKind.Utc) // no offset sent â†’ assumed UTC
        };
    }
}
