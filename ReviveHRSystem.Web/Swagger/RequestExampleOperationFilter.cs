using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace ReviveHRSystem.Web.Swagger
{
    /// <summary>
    /// Pre-fills every request body in Swagger UI with a paste-ready example so the
    /// API can be exercised manually without hand-writing payloads. Values are
    /// derived from the schema (enums → first member, dates → ISO today, email-like
    /// properties → the seeded dev accounts); <see cref="Overrides"/> replaces the
    /// derivation for the DTOs where a realistic seed value matters (login, request
    /// decisions, manual attendance, ...).
    /// </summary>
    public sealed class RequestExampleOperationFilter : IOperationFilter
    {
        /// <summary>Realistic bodies for the highest-traffic request DTOs, keyed by CLR type name.</summary>
        private static readonly Dictionary<string, object> Overrides = new()
        {
            ["LoginRequest"] = new { email = "hrmanager@revive.hr", password = "Revive!2026" },
            ["SelectGymRequest"] = new { gymId = 1, tempSessionToken = "<tempSessionToken from POST /api/auth/login>" },
            ["SwitchGymRequest"] = new { gymId = 1 },
            ["ChangePasswordRequestDto"] = new { currentPassword = "Revive!2026", newPassword = "NewPass!2026" },
            ["CreateRequestRequest"] = new
            {
                employee = "Karim Hassan",
                type = "Annual Leave",
                requestedDate = DateTime.Today.AddDays(7).ToString("yyyy-MM-dd"),
                reason = "Family event",
            },
            ["DecideRequestRequest"] = new { stage = "HR", decision = "Approved", comment = "No scheduling conflict.", payment = "paid" },
            ["UndoDecisionRequest"] = new { comment = "Reopening for correction." },
            ["BulkDecideRequest"] = new { decision = "Approved", comment = "Bulk approval." },
            ["CreateRequestCommentDto"] = new { comment = "Please attach the medical report." },
            ["ManualAttendanceRequest"] = new
            {
                employeeId = 1,
                date = DateTime.Today.ToString("yyyy-MM-dd"),
                checkIn = "08:00",
                checkOut = "16:00",
                notes = "Face ID failed — manual entry by HR.",
            },
            ["CreateEmployeeRequest"] = new
            {
                fullName = "Test Employee",
                email = "test.employee@revive.hr",
                phone = "01000000000",
                gymId = 1,
                positionId = 1,
                hireDate = DateTime.Today.ToString("yyyy-MM-dd"),
                employmentType = "FullTime",
                baseSalary = 8000,
            },
            ["ChangeEmployeeStatusRequest"] = new { status = "OnLeave", reason = "Medical leave.", effectiveDate = DateTime.Today.ToString("yyyy-MM-dd") },
            ["TransferEmployeeRequest"] = new { targetGymId = 2, reason = "Branch coverage.", effectiveDate = DateTime.Today.ToString("yyyy-MM-dd") },
            ["PositionChangeRequest"] = new { positionId = 2, reason = "Promotion.", effectiveDate = DateTime.Today.ToString("yyyy-MM-dd") },
            ["CompensationRequest"] = new { baseSalary = 9500m, reason = "Annual raise.", effectiveDate = DateTime.Today.ToString("yyyy-MM-dd") },
            ["ContractChangeRequest"] = new { contractType = "FullTime", startDate = DateTime.Today.ToString("yyyy-MM-dd"), endDate = DateTime.Today.AddYears(1).ToString("yyyy-MM-dd") },
            ["RoleChangeRequest"] = new { roleInGym = "Branch Manager" },
            ["UpdateLeaveBalanceRequest"] = new { leaveType = "Annual", total = 21, used = 4 },
            ["CreateVacancyRequestDto"] = new { positionId = 1, headcount = 2, justification = "Peak season coverage." },
            ["VacancyRequestDto"] = new { positionId = 1, headcount = 1, justification = "Replacement hire." },
        };

        public void Apply(OpenApiOperation operation, OperationFilterContext context)
        {
            var body = operation.RequestBody;
            if (body?.Content is null || body.Content.Count == 0)
            {
                return;
            }

            // The request DTO's CLR type, used to look up curated overrides.
            var bodyType = context.ApiDescription.ParameterDescriptions
                .FirstOrDefault(p => p.Source == BindingSource.Body)
                ?.ModelMetadata?.ModelType;

            object? over = null;
            if (bodyType is not null)
            {
                var namedType = Nullable.GetUnderlyingType(bodyType) ?? bodyType;
                Overrides.TryGetValue(namedType.Name, out over);
            }

            foreach (var media in body.Content.Values)
            {
                if (media.Schema is null)
                {
                    continue;
                }

                var example = BuildExample(context.SchemaRepository, media.Schema, over);
                if (example is not null)
                {
                    media.Example = example;
                }
            }
        }

        private static IOpenApiAny? BuildExample(SchemaRepository repository, OpenApiSchema schema, object? overrideValue)
        {
            if (overrideValue is not null)
            {
                return ToOpenApiAny(JsonSerializer.SerializeToNode(overrideValue));
            }

            if (!string.IsNullOrEmpty(schema.Reference?.Id))
            {
                schema = repository.Schemas.TryGetValue(schema.Reference.Id, out var resolved) ? resolved : schema;
            }

            if (schema.Enum is { Count: > 0 } && schema.Enum[0] is OpenApiString first)
            {
                return new OpenApiString(first.Value);
            }

            // In Microsoft.OpenApi 1.x, Type is the OpenAPI primitive name ("object", "array", ...).
            if (schema.Type == "object" || schema.Properties is { Count: > 0 })
            {
                var obj = new OpenApiObject();
                foreach (var (name, property) in schema.Properties)
                {
                    // Include optional fields too — Swagger users delete what they do not need.
                    obj[name] = BuildExample(repository, property, null) ?? new OpenApiNull();
                }

                return obj;
            }

            if (schema.Type == "array")
            {
                var array = new OpenApiArray();
                if (schema.Items is not null)
                {
                    var item = BuildExample(repository, schema.Items, null);
                    if (item is not null)
                    {
                        array.Add(item);
                    }
                }

                return array;
            }

            return BuildScalar(schema);
        }

        private static IOpenApiAny? BuildScalar(OpenApiSchema schema) => schema.Format switch
        {
            "date-time" => new OpenApiString(DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")),
            "date" => new OpenApiString(DateTime.Today.ToString("yyyy-MM-dd")),
            "uuid" => new OpenApiString(Guid.NewGuid().ToString()),
            "int32" or "int64" => new OpenApiInteger(1),
            "double" or "float" or "decimal" => new OpenApiDouble(1),
            _ => schema.Type switch
            {
                "integer" => new OpenApiInteger(1),
                "number" => new OpenApiDouble(1),
                "boolean" => new OpenApiBoolean(true),
                _ => new OpenApiString("string"),
            },
        };

        /// <summary>Converts a JSON tree into the OpenAPI any-tree the SwaggerGen pipeline expects.</summary>
        private static IOpenApiAny? ToOpenApiAny(JsonNode? node) => node switch
        {
            null => null,
            JsonObject obj => ToObject(obj),
            JsonArray arr => ToArray(arr),
            JsonValue value => ToValue(value),
            _ => null,
        };

        private static IOpenApiAny ToObject(JsonObject obj)
        {
            var result = new OpenApiObject();
            foreach (var (key, value) in obj)
            {
                result[key] = ToOpenApiAny(value) ?? new OpenApiNull();
            }

            return result;
        }

        private static IOpenApiAny ToArray(JsonArray arr)
        {
            var result = new OpenApiArray();
            foreach (var item in arr)
            {
                result.Add(ToOpenApiAny(item) ?? new OpenApiNull());
            }

            return result;
        }

        private static IOpenApiAny ToValue(JsonValue value)
        {
            if (value.TryGetValue(out bool b))
            {
                return new OpenApiBoolean(b);
            }

            if (value.TryGetValue(out int i))
            {
                return new OpenApiInteger(i);
            }

            if (value.TryGetValue(out double d))
            {
                return new OpenApiDouble(d);
            }

            if (value.TryGetValue(out JsonElement raw))
            {
                return raw.ValueKind switch
                {
                    JsonValueKind.Number => raw.TryGetInt32(out var ri)
                        ? new OpenApiInteger(ri)
                        : new OpenApiDouble(raw.GetDouble()),
                    JsonValueKind.True => new OpenApiBoolean(true),
                    JsonValueKind.False => new OpenApiBoolean(false),
                    JsonValueKind.String => new OpenApiString(raw.GetString()),
                    _ => new OpenApiString(raw.ToString()),
                };
            }

            return new OpenApiString(value.ToString());
        }
    }
}
