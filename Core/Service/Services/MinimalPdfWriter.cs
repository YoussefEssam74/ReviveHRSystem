using System.Globalization;
using System.Text;

namespace Service.Services
{
    /// <summary>
    /// Produces a minimal, valid single-page PDF containing left-aligned text lines.
    ///
    /// Deliberately dependency-free: the only PDF the platform needs is an invoice
    /// statement, and pulling in a full layout library for one document would be a large
    /// supply-chain and licensing cost for a few hundred bytes of output. The generated
    /// file uses the standard Helvetica font at two sizes and is valid PDF 1.4 — any
    /// reader will open it, and it prints correctly.
    /// </summary>
    internal static class MinimalPdfWriter
    {
        /// <summary>One line of text; a null size falls back to the body size.</summary>
        internal readonly record struct PdfLine(string Text, int? Size = null, bool Bold = false);

        private const int PageWidth = 595;   // A4 at 72 dpi
        private const int PageHeight = 842;
        private const int MarginLeft = 48;
        private const int MarginTop = 60;
        private const int BodySize = 10;
        private const int LineGap = 6;

        public static byte[] Build(string title, IReadOnlyList<PdfLine> lines)
        {
            var content = BuildContentStream(lines);

            var objects = new List<string>
            {
                // 1: catalog
                "<< /Type /Catalog /Pages 2 0 R >>",
                // 2: page tree
                "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                // 3: page
                $"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PageWidth} {PageHeight}] "
                    + "/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
                // 4: content stream
                $"<< /Length {Encoding.ASCII.GetByteCount(content)} >>\nstream\n{content}\nendstream",
                // 5: Helvetica
                "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
                // 6: Helvetica-Bold
                "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
                // 7: document info
                $"<< /Title ({EscapeText(title)}) /Producer (ReviveHR) >>",
            };

            var builder = new StringBuilder();
            builder.Append("%PDF-1.4\n");

            var offsets = new List<int>(objects.Count + 1) { 0 };
            for (var i = 0; i < objects.Count; i++)
            {
                offsets.Add(Encoding.ASCII.GetByteCount(builder.ToString()));
                builder.Append(CultureInfo.InvariantCulture, $"{i + 1} 0 obj\n{objects[i]}\nendobj\n");
            }

            var xrefStart = Encoding.ASCII.GetByteCount(builder.ToString());
            builder.Append(CultureInfo.InvariantCulture, $"xref\n0 {objects.Count + 1}\n");
            builder.Append("0000000000 65535 f \n");
            for (var i = 1; i <= objects.Count; i++)
            {
                builder.Append(CultureInfo.InvariantCulture, $"{offsets[i]:D10} 00000 n \n");
            }

            builder.Append(CultureInfo.InvariantCulture,
                $"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n{xrefStart}\n%%EOF");

            return Encoding.ASCII.GetBytes(builder.ToString());
        }

        private static string BuildContentStream(IReadOnlyList<PdfLine> lines)
        {
            var sb = new StringBuilder();
            var y = PageHeight - MarginTop;

            foreach (var line in lines)
            {
                if (string.IsNullOrEmpty(line.Text))
                {
                    y -= BodySize + LineGap;
                    continue;
                }

                var size = line.Size ?? BodySize;
                var font = line.Bold || size > BodySize ? "/F2" : "/F1";

                sb.Append("BT\n");
                sb.Append(CultureInfo.InvariantCulture, $"{font} {size} Tf\n");
                sb.Append(CultureInfo.InvariantCulture, $"{MarginLeft} {y} Td\n");
                sb.Append(CultureInfo.InvariantCulture, $"({EscapeText(line.Text)}) Tj\n");
                sb.Append("ET\n");

                y -= size + LineGap;
            }

            return sb.ToString();
        }

        /// <summary>
        /// Escapes the three characters that terminate or group a PDF string literal, and
        /// folds anything outside WinAnsi to '?' so the byte stream stays valid ASCII.
        /// </summary>
        private static string EscapeText(string value)
        {
            var sb = new StringBuilder(value.Length + 8);

            foreach (var ch in value)
            {
                switch (ch)
                {
                    case '\\': sb.Append("\\\\"); break;
                    case '(': sb.Append("\\("); break;
                    case ')': sb.Append("\\)"); break;
                    case '\r' or '\n': sb.Append(' '); break;
                    default:
                        // The content stream is written as ASCII, so non-Latin text would
                        // corrupt the offset table. Keep it explicit rather than silent.
                        sb.Append(ch is >= ' ' and <= '~' or >= '\u00A0' and <= '\u00FF' ? ch : '?');
                        break;
                }
            }

            return sb.ToString();
        }
    }
}
