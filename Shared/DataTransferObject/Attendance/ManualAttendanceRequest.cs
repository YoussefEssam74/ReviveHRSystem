using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Shared.DataTransferObject.Attendance;

/// <summary>
/// Manual attendance request accepted by POST /api/attendance/manual. Two shapes share the route:
/// the station punch form (EmployeeId + Type + Timestamp + Reason — station-session or gym-token
/// authenticated) and the HR-portal day-write form (EmployeeId + Date + CheckIn + CheckOut +
/// Status + Reason — user-token authenticated, guarded by attendance.manual_entry). IsHrForm
/// tells the controller which one arrived; Type is required for the station form and validated
/// in the service layer.
/// </summary>
public sealed class ManualAttendanceRequest
{
    /// <summary>Employee id or EMP-number. Accepts a JSON string or number (the HR portal sends a number).</summary>
    [Required, StringLength(50, MinimumLength = 1)]
    [JsonConverter(typeof(NumberOrStringConverter))]
    public string EmployeeId { get; init; } = string.Empty;

    /// <summary>Station form only: IN / OUT / AUTO.</summary>
    [StringLength(10)]
    public string? Type { get; init; }

    /// <summary>Station form: event time as ISO 8601. An omitted offset is interpreted as UTC.</summary>
    public DateTime? Timestamp { get; init; }

    /// <summary>Required explanation for the manual entry; stored in the audit log / record notes.</summary>
    [Required, StringLength(500, MinimumLength = 3)]
    public string Reason { get; init; } = string.Empty;

    // ---- HR-portal day-write form (A3/A5) ----

    /// <summary>HR form: the day being written, 'yyyy-MM-dd'.</summary>
    [StringLength(10)]
    public string? Date { get; init; }

    /// <summary>HR form: check-in clock time 'HH:mm'.</summary>
    [StringLength(8)]
    public string? CheckIn { get; init; }

    /// <summary>HR form: check-out clock time 'HH:mm'.</summary>
    [StringLength(8)]
    public string? CheckOut { get; init; }

    /// <summary>HR form: On Time / Late / Absent / Early Checkout / Off.</summary>
    [StringLength(24)]
    public string? Status { get; init; }

    /// <summary>True when the HR-portal day-write form was sent instead of the station punch form.</summary>
    public bool IsHrForm => Date is not null || Status is not null || CheckIn is not null || CheckOut is not null;

    /// <summary>Maps the HR form onto the management-service request (validation happens in the service).</summary>
    public HrManualAttendanceRequest ToHrRequest() => new()
    {
        EmployeeId = EmployeeId,
        Date = Date ?? string.Empty,
        CheckIn = CheckIn,
        CheckOut = CheckOut,
        Status = Status ?? string.Empty,
        Reason = Reason,
    };
}

/// <summary>Binds a string property from either a JSON string or number (the HR portal sends numeric ids).</summary>
public sealed class NumberOrStringConverter : JsonConverter<string>
{
    public override string Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.TokenType switch
        {
            JsonTokenType.String => reader.GetString() ?? string.Empty,
            JsonTokenType.Number => reader.GetDecimal().ToString(CultureInfo.InvariantCulture),
            _ => throw new JsonException("Expected a string or number value."),
        };

    public override void Write(Utf8JsonWriter writer, string value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value);
}
