using System.Text.Json;

namespace ReviveHRSystem.SecurityTests.Support
{
    /// <summary>
    /// Loads tests/security/access-matrix.json (copied into the test output directory)
    /// and exposes typed access to its rows and status expectations.
    /// </summary>
    public static class MatrixCatalog
    {
        private static MatrixDocument? _document;

        public static MatrixDocument Load()
        {
            if (_document is not null)
            {
                return _document;
            }

            var path = Path.Combine(AppContext.BaseDirectory, "access-matrix.json");
            if (!File.Exists(path))
            {
                // Fallback for running from the repo root (e.g. external runners).
                var repoCandidate = Path.GetFullPath(Path.Combine(
                    AppContext.BaseDirectory, "..", "..", "..", "..", "..",
                    "tests", "security", "access-matrix.json"));
                if (File.Exists(repoCandidate))
                {
                    path = repoCandidate;
                }
                else
                {
                    throw new FileNotFoundException(
                        "access-matrix.json not found next to the test assembly or in tests/security/. " +
                        $"Looked at: {path}");
                }
            }

            var json = File.ReadAllText(path);
            _document = JsonSerializer.Deserialize<MatrixDocument>(json, Options)
                ?? throw new InvalidOperationException("access-matrix.json parsed to null.");
            return _document;
        }

        internal static readonly JsonSerializerOptions Options = new()
        {
            PropertyNameCaseInsensitive = true,
            ReadCommentHandling = JsonCommentHandling.Skip,
            AllowTrailingCommas = true,
        };
    }

    public sealed class MatrixDocument
    {
        public int Version { get; set; }
        public string Scope { get; set; } = "";
        public MatrixConventions Conventions { get; set; } = new();
        public MatrixDefaultRules DefaultRules { get; set; } = new();
        public List<MatrixConflict> FlaggedConflicts { get; set; } = new();
        public List<MatrixRow> Rows { get; set; } = new();

        /// <summary>Rows that are actually testable (the excluded row is skipped).</summary>
        public IEnumerable<MatrixRow> TestableRows =>
            Rows.Where(r => !string.Equals(r.Expected?.Status, "excluded-from-tests", StringComparison.OrdinalIgnoreCase));
    }

    public sealed class MatrixConventions
    {
        public List<string> WorkingRoles { get; set; } = new();
        public List<string> ReferenceIdentities { get; set; } = new();
    }

    public sealed class MatrixDefaultRules
    {
        public string ApplyTo { get; set; } = "";
        public List<string> Rules { get; set; } = new();
        public string? Note { get; set; }
    }

    public sealed class MatrixConflict
    {
        public string Id { get; set; } = "";
        public string Category { get; set; } = "";
        public string Detail { get; set; } = "";
    }

    public sealed class MatrixRow
    {
        public int Id { get; set; }
        public string Route { get; set; } = "";
        public string Method { get; set; } = "";
        public string Source { get; set; } = "";
        public MatrixExpected? Expected { get; set; }
        public List<string>? Notes { get; set; }

        /// <summary>Normalises the route template: placeholders become {p}.</summary>
        public string RouteTemplate =>
            System.Text.RegularExpressions.Regex.Replace(Route, @"\{[^}]+\}", "{p}");

        /// <summary>Reads this row's expectation for an identity as a status set.</summary>
        public IReadOnlyList<int> StatusSetFor(string identityKey)
        {
            var element = Expected!.ForIdentity(identityKey);
            if (element.ValueKind is System.Text.Json.JsonValueKind.Undefined or System.Text.Json.JsonValueKind.Null)
            {
                throw new InvalidOperationException(
                    $"Matrix row {Id} ({Route} {Method}) has no expectation for identity '{identityKey}'.");
            }

            return element.ValueKind switch
            {
                System.Text.Json.JsonValueKind.Number => [element.GetInt32()],
                System.Text.Json.JsonValueKind.Array => element.EnumerateArray().Select(e => e.GetInt32()).ToArray(),
                _ => throw new InvalidOperationException(
                    $"Matrix expectation for '{identityKey}' is not numeric on row {Id} ({Route} {Method}).")
            };
        }
    }

    public sealed class MatrixExpected
    {
        /// <summary>"status" is present only for excluded rows; the other keys are identity → codes.</summary>
        [System.Text.Json.Serialization.JsonPropertyName("status")]
        public string? Status { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("anonymous")]
        public JsonElement Anonymous { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("employee")]
        public JsonElement Employee { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("employeeSelf")]
        public JsonElement EmployeeSelf { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("employeeOther")]
        public JsonElement EmployeeOther { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("teamLeader")]
        public JsonElement TeamLeader { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("branchManager")]
        public JsonElement BranchManager { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("hr")]
        public JsonElement Hr { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("hrManager")]
        public JsonElement HrManager { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("topManagement")]
        public JsonElement TopManagement { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("crossTenantTwin")]
        public JsonElement CrossTenantTwin { get; set; }

        public JsonElement ForIdentity(string identityKey) => identityKey switch
        {
            "anonymous" => Anonymous,
            "employee" => Employee,
            "employeeSelf" => EmployeeSelf,
            "employeeOther" => EmployeeOther,
            "teamLeader" => TeamLeader,
            "branchManager" => BranchManager,
            "hr" => Hr,
            "hrManager" => HrManager,
            "topManagement" => TopManagement,
            "crossTenantTwin" => CrossTenantTwin,
            _ => throw new ArgumentException($"Unknown matrix identity '{identityKey}'.")
        };
    }
}
