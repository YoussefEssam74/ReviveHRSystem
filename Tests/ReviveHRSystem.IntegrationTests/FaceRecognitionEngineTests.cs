using System.Collections;
using System.Reflection;
using Biometrics;
using Microsoft.Extensions.Options;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>Guards the ONNX output contract consumed by <see cref="FaceRecognitionEngine"/>.</summary>
    public class FaceRecognitionEngineTests
    {
        [Fact]
        public void PackagedYuNet_ExposesTheExpectedTwelveOutputTensors()
        {
            using var engine = new FaceRecognitionEngine(Options.Create(new BiometricsOptions()));
            var detector = typeof(FaceRecognitionEngine)
                .GetField("_detector", BindingFlags.Instance | BindingFlags.NonPublic)
                ?.GetValue(engine)
                ?? throw new InvalidOperationException("YuNet detector session was not created.");

            var outputMetadata = detector.GetType().GetProperty("OutputMetadata")?.GetValue(detector)
                ?? throw new InvalidOperationException("YuNet detector metadata is unavailable.");
            var keys = ((IEnumerable?)outputMetadata.GetType().GetProperty("Keys")?.GetValue(outputMetadata))
                ?.Cast<object>()
                .Select(key => key.ToString())
                .ToHashSet(StringComparer.Ordinal)
                ?? throw new InvalidOperationException("YuNet detector exposes no output names.");

            var expected = new[]
            {
                "cls_8", "cls_16", "cls_32",
                "obj_8", "obj_16", "obj_32",
                "bbox_8", "bbox_16", "bbox_32",
                "kps_8", "kps_16", "kps_32",
            };

            Assert.All(expected, name => Assert.Contains(name, keys));
        }
    }
}
