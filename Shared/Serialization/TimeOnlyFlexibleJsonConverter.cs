using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Shared.Serialization
{
    /// <summary>
    /// System.Text.Json's built-in TimeOnly converter only accepts the round-trip
    /// "HH:mm:ss" form on read, but a browser's &lt;input type="time"&gt; posts
    /// "HH:mm" — shift-template creation (and every other clock-valued DTO) answered
    /// 400 "The JSON value could not be converted to System.TimeOnly" for a perfectly
    /// valid time until this converter was registered. Read accepts "HH:mm",
    /// "HH:mm:ss", and fractional-second variants; write emits the same shape the
    /// framework default produced ("HH:mm:ss", with a trimmed fraction only when the
    /// value actually carries one) so existing clients keep working.
    /// </summary>
    public sealed class TimeOnlyFlexibleJsonConverter : JsonConverter<TimeOnly>
    {
        public override TimeOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType != JsonTokenType.String)
            {
                throw new JsonException("A time value must be a JSON string.");
            }

            var raw = reader.GetString();
            if (raw is not null &&
                TimeOnly.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
            {
                return parsed;
            }

            throw new JsonException($"'{raw}' is not a valid time — expected \"HH:mm\" or \"HH:mm:ss\".");
        }

        public override void Write(Utf8JsonWriter writer, TimeOnly value, JsonSerializerOptions options)
        {
            // Whole seconds keep the exact default shape ("HH:mm:ss"); only values
            // that really carry a fraction fall back to the round-trip format.
            writer.WriteStringValue(
                value.Ticks % TimeSpan.TicksPerSecond == 0
                    ? value.ToString("HH:mm:ss", CultureInfo.InvariantCulture)
                    : value.ToString("O", CultureInfo.InvariantCulture));
        }
    }
}
