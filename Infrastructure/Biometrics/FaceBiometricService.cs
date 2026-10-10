using Biometrics;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.Extensions.Options;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Attendance;
using Shared.DataTransferObject.Face;

namespace Biometrics
{
    /// <summary>
    /// Face-ID attendance: the caller's station session supplies the gym (validated by
    /// the authentication layer) → face pipeline → match within that gym's scope
    /// (ADR-004) → record through the normal events pipeline. Nothing in the request
    /// body is trusted for the gym binding.
    /// </summary>
    public sealed class FaceBiometricService(
        IUnitOfWork unitOfWork,
        IUserAccessRepository userAccess,
        IAttendanceService attendanceService,
        FaceRecognitionEngine engine,
        IOptions<BiometricsOptions> options) : IFaceBiometricService
    {
        public async Task<FaceScanResponse> ScanFaceAsync(FaceScanRequest request, int? authorizedGymId = null, int? stationSessionId = null, string? ipAddress = null, CancellationToken cancellationToken = default)
        {
            // 1) The gym binding comes from the validated station session (or a
            //    gym-scoped user token) — checked before the expensive frame pipeline.
            if (authorizedGymId is null)
            {
                throw new UnAuthorizedException("Attendance requests require a station session token.");
            }

            // 2) Frame → detect → liveness → embedding (CPU-bound, off the request thread).
            //    Frame-level states are outcomes, not errors: the station shows a live
            //    HUD (liveness %, matched name/ID) from the discriminator, so only a
            //    frame that could not even be decoded as an image is a 400.
            var imageBytes = DecodeImage(request.Image);
            var outcome = await Task.Run(() => engine.ProcessFrame(imageBytes), cancellationToken);
            if (!outcome.FaceDetected || outcome.Feature is null)
            {
                Console.WriteLine($"[biometrics] scan: no face in frame — {outcome.Debug ?? "no detail"}");
                return new FaceScanResponse
                {
                    Outcome = FaceScanOutcome.NoFace,
                    Message = "No face was detected in the frame.",
                    LivenessScore = Math.Round(outcome.LivenessScore, 3),
                };
            }

            // The attendance pipeline also enforces a minimum (0.70) on the score it is
            // handed; gating here reports a measured low-liveness outcome with the
            // number attached, and skips the embedding + 1-to-N match on frames that
            // would fail anyway.
            if (!outcome.IsLive || outcome.LivenessScore < options.Value.ScanLivenessThreshold)
            {
                return new FaceScanResponse
                {
                    Outcome = FaceScanOutcome.LowLiveness,
                    Message = $"Liveness {outcome.LivenessScore:P0} — needs {options.Value.ScanLivenessThreshold:P0}. Face the camera directly in good light.",
                    LivenessScore = Math.Round(outcome.LivenessScore, 3),
                };
            }

            // 3) Match against employees with access to THIS gym only.
            var candidates = (await unitOfWork.GetRepository<FaceEmbedding, int>()
                .GetAllAsync(new FaceEmbeddingsForGymSpec(authorizedGymId.Value), cancellationToken)).ToArray();

            FaceEmbedding? bestMatch = null;
            var bestScore = -1d;
            foreach (var candidate in candidates)
            {
                var score = CosineSimilarity(outcome.Feature, candidate.Feature);
                if (score > bestScore)
                {
                    bestScore = score;
                    bestMatch = candidate;
                }
            }

            if (bestMatch is null || bestScore < options.Value.MatchThreshold)
            {
                return new FaceScanResponse
                {
                    Outcome = FaceScanOutcome.Unrecognized,
                    Message = "Face not recognized. Enroll this employee or use their employee number.",
                    Similarity = Math.Round(Math.Max(bestScore, 0d), 3),
                    LivenessScore = Math.Round(outcome.LivenessScore, 3),
                };
            }

            var employeeId = bestMatch.Employee.EmployeeNumber;
            var employeeName = bestMatch.Employee.FullName;
            var similarity = Math.Round(bestScore, 3);
            var liveness = Math.Round(outcome.LivenessScore, 3);

            // 4) Record atomically through the standard events pipeline — every ADR-004
            //    check (gym access, schedule, duplicates) applies exactly as for /events.
            //    Employee-level refusals become outcomes rather than HTTP errors: a
            //    "different branch" refusal used to surface as a 401, which the kiosk
            //    misread as a dead station session and dropped back to the code screen.
            //    The station-level throws still sitting in RecordAsync (missing gym,
            //    inactive gym) are unreachable here — the session validator already
            //    rejects inactive gyms at 401 — so nothing is being masked.
            AttendanceResponse? attendance;
            try
            {
                attendance = await attendanceService.RecordBiometricEventAsync(
                    new AttendanceEventRequest
                    {
                        EmployeeId = employeeId,
                        Type = request.Type,
                        LivenessScore = liveness,
                        Timestamp = request.Timestamp,
                    },
                    authorizedGymId,
                    stationSessionId,
                    ipAddress,
                    confirmCheckout: request.ConfirmCheckout,
                    cancellationToken);
            }
            catch (AttendanceAlreadyCompleteException ex)
            {
                // Recognized, day already closed: the kiosk stays silent (name + ID in
                // the HUD only) instead of nagging with a rejection card.
                return new FaceScanResponse
                {
                    Outcome = FaceScanOutcome.AlreadyComplete,
                    EmployeeId = employeeId,
                    EmployeeName = employeeName,
                    Message = ex.Message,
                    Similarity = similarity,
                    LivenessScore = liveness,
                };
            }
            catch (Exception ex) when (ex is BadRequestException or NotFoundException or UnAuthorizedException)
            {
                return new FaceScanResponse
                {
                    Outcome = FaceScanOutcome.Rejected,
                    EmployeeId = employeeId,
                    EmployeeName = employeeName,
                    Message = ex.Message,
                    Similarity = similarity,
                    LivenessScore = liveness,
                };
            }

            if (attendance is null)
            {
                return new FaceScanResponse
                {
                    Outcome = FaceScanOutcome.PendingCheckout,
                    RequiresCheckoutConfirmation = true,
                    EmployeeId = employeeId,
                    EmployeeName = employeeName,
                    Message = "Confirm the check-out on the station.",
                    Similarity = similarity,
                    LivenessScore = liveness,
                };
            }

            return new FaceScanResponse
            {
                Outcome = FaceScanOutcome.Recorded,
                Attendance = attendance,
                EmployeeId = employeeId,
                EmployeeName = employeeName,
                Similarity = similarity,
                LivenessScore = liveness,
            };
        }

        public async Task<FaceEnrollmentResponse> EnrollFaceAsync(FaceEnrollmentRequest request, int? actorUserId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveFaceManagerAsync(actorUserId, cancellationToken);

            var employee = await unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.Employee, int>()
                .GetByIdAsync(new EmployeeLookupSpec(request.EmployeeNumber), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            await EnsureGymAccessAsync(actor, employee.GymId, cancellationToken);

            var imageBytes = DecodeImage(request.Image);
            var outcome = await Task.Run(() => engine.ProcessFrame(imageBytes), cancellationToken);
            if (!outcome.FaceDetected || outcome.Feature is null)
            {
                Console.WriteLine($"[biometrics] enroll: no face in frame — {outcome.Debug ?? "no detail"}");
                throw new BadRequestException("No face was detected in the frame.");
            }
            if (!outcome.IsLive || outcome.LivenessScore < options.Value.LivenessThreshold)
                throw new BadRequestException("Enrollment rejected — a real face in front of the camera is required (no photos or screens).");

            var embeddingRepository = unitOfWork.GetRepository<FaceEmbedding, int>();
            var existing = await embeddingRepository.GetByIdAsync(new FaceEmbeddingByEmployeeSpec(employee.Id), cancellationToken);
            var enrolledAt = DateTime.UtcNow;

            if (existing is null)
            {
                await embeddingRepository.AddAsync(new FaceEmbedding
                {
                    EmployeeId = employee.Id,
                    Feature = outcome.Feature,
                    EnrolledAt = enrolledAt,
                }, cancellationToken);
            }
            else
            {
                existing.Feature = outcome.Feature;
                existing.EnrolledAt = enrolledAt;
                embeddingRepository.Update(existing);
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new FaceEnrollmentResponse
            {
                EmployeeId = employee.Id,
                EmployeeNumber = employee.EmployeeNumber,
                FullName = employee.FullName,
                EnrolledAt = enrolledAt,
            };
        }

        public async Task RemoveEmployeeFaceAsync(string employeeReference, int? actorUserId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveFaceManagerAsync(actorUserId, cancellationToken);

            var employee = await unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.Employee, int>()
                .GetByIdAsync(new EmployeeLookupSpec(employeeReference), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            await EnsureGymAccessAsync(actor, employee.GymId, cancellationToken);

            var embeddingRepository = unitOfWork.GetRepository<FaceEmbedding, int>();
            var existing = await embeddingRepository.GetByIdAsync(new FaceEmbeddingByEmployeeSpec(employee.Id), cancellationToken)
                ?? throw new NotFoundException("No face is enrolled for this employee.");

            embeddingRepository.Remove(existing);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        /// <summary>
        /// Face management is HR-side administration. The acting principal must be a real,
        /// active user account of an HR-capable type before any employee data is touched —
        /// this rejects station tokens (non-numeric sub claim) and employee sessions up
        /// front, so they cannot probe employee existence through 404-versus-401 differences.
        /// </summary>
        private async Task<User> ResolveFaceManagerAsync(int? actorUserId, CancellationToken cancellationToken)
        {
            if (actorUserId is null)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var actor = await unitOfWork.GetRepository<User, int>()
                .GetByIdAsync(new UserByIdSpec(actorUserId.Value), cancellationToken)
                ?? throw new UnAuthorizedException("Your session is invalid. Please sign in again.");

            if (!actor.IsActive)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            if (actor.UserType == UserType.Employee)
            {
                throw new UnAuthorizedException("You are not allowed to manage face enrollments.");
            }

            return actor;
        }

        /// <summary>
        /// TopManagement may manage faces at any gym; every other type needs
        /// UserGymAccess to the employee's gym, and must be HR to do it at all.
        /// </summary>
        private async Task EnsureGymAccessAsync(User actor, int gymId, CancellationToken cancellationToken)
        {
            if (actor.UserType == UserType.TopManagement)
            {
                return;
            }

            if (!await userAccess.HasGymAccessAsync(actor.Id, gymId, cancellationToken))
            {
                throw new UnAuthorizedException("You do not have access to this gym.");
            }

            if (actor.UserType != UserType.HR)
            {
                throw new UnAuthorizedException("You are not allowed to manage face enrollments.");
            }
        }

        private static byte[] DecodeImage(string image)
        {
            var base64 = image;
            var commaIndex = base64.IndexOf(',');
            if (base64.StartsWith("data:", StringComparison.OrdinalIgnoreCase) && commaIndex > 0)
                base64 = base64[(commaIndex + 1)..];

            try
            {
                return Convert.FromBase64String(base64);
            }
            catch (FormatException)
            {
                throw new BadRequestException("The frame could not be decoded as an image.");
            }
        }

        private static double CosineSimilarity(float[] a, float[] b)
        {
            if (a.Length == 0 || a.Length != b.Length) return -1;
            double dot = 0, normA = 0, normB = 0;
            for (var i = 0; i < a.Length; i++)
            {
                dot += (double)a[i] * b[i];
                normA += (double)a[i] * a[i];
                normB += (double)b[i] * b[i];
            }
            if (normA <= 0 || normB <= 0) return -1;
            return dot / (Math.Sqrt(normA) * Math.Sqrt(normB));
        }
    }
}
