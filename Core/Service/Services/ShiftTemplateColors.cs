using System.Text.RegularExpressions;
using DomainLayer.Exceptions;

namespace Service.Services
{
    /// <summary>
    /// Shift-template colors: managers pick one base hex value; the API derives
    /// the light badge background and dark readable text from it. Keeping the
    /// derivation server-side means every schedule surface renders the same
    /// palette without shipping color math to the SPA.
    /// </summary>
    public static class ShiftTemplateColors
    {
        public const string DefaultColor = "#0ea5e9";

        private static readonly string[] Palette =
        [
            "#0ea5e9",
            "#6366f1",
            "#22c55e",
            "#f59e0b",
            "#f43f5e",
            "#a855f7",
            "#14b8a6",
            "#64748b",
        ];

        private static readonly Regex HexPattern = new("^#[0-9a-fA-F]{6}$", RegexOptions.Compiled);

        /// <summary>Validates a manager-supplied color, or returns the default when omitted.</summary>
        public static string NormalizeOrThrow(string? color)
        {
            if (string.IsNullOrWhiteSpace(color))
            {
                return DefaultColor;
            }

            var value = color.Trim();
            if (!HexPattern.IsMatch(value))
            {
                throw new BadRequestException("Shift color must be a hex value like #0ea5e9.");
            }

            return value.ToLowerInvariant();
        }

        /// <summary>Safe normalization for persisted/legacy values; never throws.</summary>
        public static string NormalizeOrDefault(string? color)
        {
            if (string.IsNullOrWhiteSpace(color))
            {
                return DefaultColor;
            }

            var value = color.Trim();
            return HexPattern.IsMatch(value) ? value.ToLowerInvariant() : DefaultColor;
        }

        /// <summary>Stable palette entry for a new template when the caller omits a color.</summary>
        public static string Pick(int index)
        {
            var normalized = ((index % Palette.Length) + Palette.Length) % Palette.Length;
            return Palette[normalized];
        }

        /// <summary>Returns the base color plus the light background and dark text used by badges.</summary>
        public static (string Color, string BgColor, string TextColor) Derive(string? color)
        {
            var baseColor = NormalizeOrDefault(color);
            var rgb = Parse(baseColor);

            // 12% of the base over white keeps the badge airy; mixing the base
            // with the charcoal ink keeps the label readable on that background.
            var background = Blend(rgb, (255, 255, 255), 0.88);
            var text = Blend(rgb, (15, 23, 42), 0.55);

            return (baseColor, ToHex(background), ToHex(text));
        }

        private static (int R, int G, int B) Parse(string hex) =>
            (Convert.ToInt32(hex[1..3], 16), Convert.ToInt32(hex[3..5], 16), Convert.ToInt32(hex[5..7], 16));

        private static (int R, int G, int B) Blend((int R, int G, int B) from, (int R, int G, int B) to, double toWeight) =>
            (
                (int)Math.Round(from.R + (to.R - from.R) * toWeight),
                (int)Math.Round(from.G + (to.G - from.G) * toWeight),
                (int)Math.Round(from.B + (to.B - from.B) * toWeight)
            );

        private static string ToHex((int R, int G, int B) rgb) =>
            $"#{rgb.R:x2}{rgb.G:x2}{rgb.B:x2}";
    }
}
