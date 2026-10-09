using Biometrics;
using Microsoft.Extensions.Options;
using SkiaSharp;
using Xunit;
using ReviveHRSystem.IntegrationTests.Fixtures.Data;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Golden end-to-end test for the in-process face pipeline: a real enrolled face
    /// (EMP-1042) must be detected, pass liveness, and produce an embedding that
    /// matches the OpenCV reference pipeline's stored feature. Guards the full chain —
    /// YuNet raw 0-255 BGR input, BGRA→RGBA pixel normalization, SFace RGB input and
    /// normalization — against regressions that a structural test cannot see.
    /// </summary>
    public class FacePipelineGoldenTests
    {
        // Observed 0.944 at time of writing; system match threshold is 0.50. The bar
        // sits high enough that channel-order or /255-normalization regressions
        // (which collapse cosine to ~0.17) fail immediately.
        private const double MinCosine = 0.85;

        [Fact]
        public void ProcessFrame_RealEnrolledFace_DetectsPassesLiveness_AndMatchesGroundTruthEmbedding()
        {
            using var engine = new FaceRecognitionEngine(Options.Create(new BiometricsOptions()));
            using var frame = ComposeSampleFrame();

            using var jpeg = new MemoryStream();
            frame.Encode(jpeg, SKEncodedImageFormat.Jpeg, 95);
            var outcome = engine.ProcessFrame(jpeg.ToArray());

            Assert.True(outcome.FaceDetected, $"face not detected: {outcome.Debug}");
            Assert.True(outcome.IsLive, $"liveness rejected the real enrolled face (score {outcome.LivenessScore:0.000})");
            Assert.NotNull(outcome.Feature);
            Assert.Equal(EnrolledFaceFeature.Values.Length, outcome.Feature!.Length);

            var cosine = Cosine(outcome.Feature, EnrolledFaceFeature.Values);
            Assert.True(cosine >= MinCosine,
                $"embedding drifted from the OpenCV reference: cosine {cosine:0.0000} < {MinCosine:0.00}");
        }

        [Fact]
        public void ProcessFrame_BlackFrame_ReportsNoFace()
        {
            using var engine = new FaceRecognitionEngine(Options.Create(new BiometricsOptions()));

            var black = new byte[640 * 480 * 3];
            using var bitmap = new SKBitmap(new SKImageInfo(640, 480, SKColorType.Bgra8888, SKAlphaType.Opaque));
            using var jpeg = new MemoryStream();
            bitmap.Encode(jpeg, SKEncodedImageFormat.Jpeg, 95);

            var outcome = engine.ProcessFrame(jpeg.ToArray());

            Assert.False(outcome.FaceDetected);
            Assert.Null(outcome.Feature);
        }

        /// <summary>
        /// The fixture is the 112x112 aligned crop; YuNet scores tight crops below the
        /// detection threshold, so paste it centered on a 448x448 canvas to recreate
        /// the margins a camera frame naturally has.
        /// </summary>
        private static SKBitmap ComposeSampleFrame()
        {
            var cropBytes = File.ReadAllBytes(
                Path.Combine(AppContext.BaseDirectory, "Fixtures", "Data", "enrolled_face_sample.jpg"));
            using var crop = SKBitmap.Decode(cropBytes)
                ?? throw new InvalidOperationException("enrolled_face_sample.jpg could not be decoded.");

            const int size = 448;
            var canvas = new SKBitmap(new SKImageInfo(size, size, SKColorType.Bgra8888, SKAlphaType.Opaque));
            using var surface = new SKCanvas(canvas);
            using var paint = new SKPaint { Color = new SKColor(128, 128, 128) };
            surface.DrawRect(0, 0, size, size, paint);
            surface.DrawBitmap(crop, (size - crop.Width) / 2, (size - crop.Height) / 2);
            return canvas;
        }

        private static double Cosine(float[] a, float[] b)
        {
            double dot = 0, normA = 0, normB = 0;
            for (var i = 0; i < a.Length; i++)
            {
                dot += (double)a[i] * b[i];
                normA += (double)a[i] * a[i];
                normB += (double)b[i] * b[i];
            }
            return dot / (Math.Sqrt(normA) * Math.Sqrt(normB));
        }
    }
}
