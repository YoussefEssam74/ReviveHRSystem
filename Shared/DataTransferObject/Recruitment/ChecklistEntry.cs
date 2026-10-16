using System.Text.Json;
using System.Text.Json.Serialization;

namespace Shared.DataTransferObject.Recruitment
{
    /// <summary>
    /// One onboarding-checklist row of the New Comers tab, serialized as the UI's
    /// positional pair <c>["ID &amp; contract signed", false]</c> (C# value tuples are
    /// not supported by System.Text.Json, so the array shape is explicit here).
    /// </summary>
    [JsonConverter(typeof(ChecklistEntryJsonConverter))]
    public sealed record ChecklistEntry(string Label, bool Done);

    /// <summary>Reads/writes <c>[label, done]</c> pairs.</summary>
    public sealed class ChecklistEntryJsonConverter : JsonConverter<ChecklistEntry>
    {
        public override ChecklistEntry Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType != JsonTokenType.StartArray)
            {
                throw new JsonException("A checklist entry must be a [label, done] array.");
            }

            reader.Read();
            if (reader.TokenType != JsonTokenType.String)
            {
                throw new JsonException("A checklist entry's first element must be the item label.");
            }

            var label = reader.GetString() ?? string.Empty;

            reader.Read();
            if (reader.TokenType is not (JsonTokenType.True or JsonTokenType.False))
            {
                throw new JsonException("A checklist entry's second element must be a boolean.");
            }

            var done = reader.GetBoolean();

            reader.Read();
            if (reader.TokenType != JsonTokenType.EndArray)
            {
                throw new JsonException("A checklist entry must contain exactly [label, done].");
            }

            return new ChecklistEntry(label, done);
        }

        public override void Write(Utf8JsonWriter writer, ChecklistEntry value, JsonSerializerOptions options)
        {
            writer.WriteStartArray();
            writer.WriteStringValue(value.Label);
            writer.WriteBooleanValue(value.Done);
            writer.WriteEndArray();
        }
    }
}
