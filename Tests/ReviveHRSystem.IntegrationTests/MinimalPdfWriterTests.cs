using System.Text;
using Service.Services;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// The invoice PDF is produced by a hand-rolled writer, so its structural invariants are
    /// worth asserting directly: a malformed offset table produces a file that opens in some
    /// readers and not others, which is exactly the kind of defect a smoke test misses.
    /// </summary>
    public class MinimalPdfWriterTests
    {
        private static readonly byte[] Pdf = MinimalPdfWriter.Build("INV-TEST-0001", [
            new MinimalPdfWriter.PdfLine("ReviveHR — Subscription invoice", 16, Bold: true),
            new MinimalPdfWriter.PdfLine(string.Empty),
            new MinimalPdfWriter.PdfLine("Invoice      INV-TEST-0001"),
            new MinimalPdfWriter.PdfLine("Narrative with (parentheses) and a \\ backslash"),
            new MinimalPdfWriter.PdfLine("Arabic marker: مرحبا"),
        ]);

        [Fact]
        public void Build_EmitsAWellFormedPdfEnvelope()
        {
            var text = Encoding.ASCII.GetString(Pdf);

            Assert.StartsWith("%PDF-1.4", text);
            Assert.EndsWith("%%EOF", text.TrimEnd());
            Assert.Contains("1 0 obj", text);
            Assert.Contains("/Type /Catalog", text);
            Assert.Contains("/Type /Page", text);
            Assert.Contains("xref", text);
            Assert.Contains("trailer", text);
        }

        [Fact]
        public void Build_XrefOffsetsPointAtTheirObjects()
        {
            var text = Encoding.ASCII.GetString(Pdf);

            // Anchor on the table header, not "startxref" (which also contains "xref").
            var xrefStart = text.LastIndexOf("\nxref\n", StringComparison.Ordinal);
            Assert.True(xrefStart > 0, "xref table is missing.");

            var xrefBlock = text[xrefStart..];
            var tableEnd = xrefBlock.IndexOf("trailer", StringComparison.Ordinal);
            Assert.True(tableEnd > 0, "xref table is not followed by a trailer.");

            // Each entry is exactly 20 bytes: "nnnnnnnnnn ggggg f \n".
            var entryLines = xrefBlock[..tableEnd]
                .Split('\n')
                .Where(line => line.Length == 19
                               && line[10] == ' '
                               && line[16] == ' '
                               && line[17] is 'f' or 'n')
                .ToList();

            // Entries[0] is the free-list head; the rest each describe one object.
            Assert.True(entryLines.Count >= 2, "xref table has no object entries.");

            for (var i = 1; i < entryLines.Count; i++)
            {
                var offset = int.Parse(entryLines[i][..10]);
                Assert.InRange(offset, 0, text.Length - 1);

                // The bytes at that offset must open the matching object header.
                Assert.StartsWith($"{i} 0 obj", text[offset..]);
            }
        }

        [Fact]
        public void Build_EscapesStringDelimitersAndFoldsNonLatinText()
        {
            var text = Encoding.ASCII.GetString(Pdf);

            // Unescaped parentheses or a lone backslash would terminate the string literal
            // early and corrupt the page content stream.
            Assert.Contains(@"\(parentheses\)", text);
            Assert.Contains(@"\\ backslash", text);

            // Non-WinAnsi characters become '?' rather than emitting bytes that would break
            // the ASCII offset table.
            Assert.Contains("Arabic marker: ?????", text);
            Assert.DoesNotContain("مرحبا", text);
        }

        [Fact]
        public void Build_ContentStreamLengthMatchesItsDeclaredValue()
        {
            var text = Encoding.ASCII.GetString(Pdf);

            var marker = "/Length ";
            var start = text.IndexOf(marker, StringComparison.Ordinal);
            Assert.True(start > 0, "The content stream declares no /Length.");

            start += marker.Length;
            var declared = int.Parse(text[start..text.IndexOf(' ', start)]);

            var streamStart = text.IndexOf("stream\n", StringComparison.Ordinal) + "stream\n".Length;
            var streamEnd = text.IndexOf("\nendstream", StringComparison.Ordinal);

            Assert.Equal(declared, streamEnd - streamStart);
        }
    }
}
