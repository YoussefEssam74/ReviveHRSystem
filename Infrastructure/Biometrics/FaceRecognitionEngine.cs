using System.Runtime.InteropServices;
using Microsoft.Extensions.Options;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using SkiaSharp;

namespace Biometrics
{
    /// <summary>Outcome of running one camera frame through the face pipeline.</summary>
    public sealed class FaceProcessOutcome
    {
        public bool FaceDetected { get; init; }
        public bool IsLive { get; init; }
        public double LivenessScore { get; init; }
        public float[]? Feature { get; init; }

        /// <summary>Diagnostic detail when no face could be extracted (surfaced for support).</summary>
        public string? Debug { get; init; }
    }

    /// <summary>
    /// In-process face pipeline, a 1:1 port of biometric_test/app.py with identical
    /// models and thresholds: YuNet detection (ONNX) -&gt; Silent-Face anti-spoofing
    /// ensemble (ONNX, scales 2.7 + 4.0) -&gt; SFace 128-d embedding (ONNX).
    /// Pure ONNX Runtime + SkiaSharp: no OpenCV, no Python. Thread-safe; concurrent
    /// inferences are capped by MaxConcurrentScans.
    /// </summary>
    public sealed class FaceRecognitionEngine : IDisposable
    {
        private const int AntiSpoofSize = 80;
        private const int AlignSize = 112;
        private const float DetectionScoreThreshold = 0.75f;
        private const float DetectionNmsThreshold = 0.3f;

        // Landmark template the recognizer aligns to (OpenCV FaceRecognizerSF, 112x112).
        private static readonly (float X, float Y)[] AlignReference =
        {
            (38.2946f, 51.6963f), (73.5318f, 51.5014f), (56.0252f, 71.7366f),
            (41.5493f, 92.3655f), (70.7299f, 92.2041f),
        };

        private readonly InferenceSession _detector;
        private readonly InferenceSession _recognizer;
        private readonly (InferenceSession Session, double Scale)[] _antiSpoof;
        private readonly SemaphoreSlim _gate;
        private readonly bool _detectorIsLive;
        private bool _disposed;

        public FaceRecognitionEngine(IOptions<BiometricsOptions> options)
        {
            var settings = options.Value;
            _gate = new SemaphoreSlim(Math.Max(1, settings.MaxConcurrentScans));

            var modelsDir = Path.Combine(AppContext.BaseDirectory, "Models");
            var detectorPath = Path.Combine(modelsDir, "face_detection_yunet.onnx");
            var recognizerPath = Path.Combine(modelsDir, "face_recognition_sface.onnx");
            var antiSpoofPaths = new (string Path, double Scale)[]
            {
                (Path.Combine(modelsDir, "anti_spoof_2.7_80x80.onnx"), 2.7),
                (Path.Combine(modelsDir, "anti_spoof_4.0_80x80.onnx"), 4.0),
            };

            foreach (var path in new[] { detectorPath, recognizerPath }.Concat(antiSpoofPaths.Select(a => a.Path)))
            {
                if (!File.Exists(path))
                    throw new InvalidOperationException($"Biometric model file is missing: {path}");
            }

            var sessionOptions = new SessionOptions();
            _detector = new InferenceSession(detectorPath, sessionOptions);
            _recognizer = new InferenceSession(recognizerPath, sessionOptions);
            _antiSpoof = antiSpoofPaths
                .Select(a => (new InferenceSession(a.Path, sessionOptions), a.Scale))
                .ToArray();

            // Startup diagnostics: the model interface, straight from the graph.
            foreach (var input in _detector.InputMetadata)
                Console.WriteLine($"[biometrics] YuNet input '{input.Key}' dims=[{string.Join("x", input.Value.Dimensions)}]");
            foreach (var output in _detector.OutputMetadata)
                Console.WriteLine($"[biometrics] YuNet output '{output.Key}' dims=[{string.Join("x", output.Value.Dimensions)}]");

            // Self-check: score two contrasted raw 0-255 frames (the scale YuNet is fed)
            // and record whether they differ. Reported rather than thrown — a failed
            // check logs a warning but detection still runs (a false negative here must
            // never disable a working camera pipeline).
            _detectorIsLive = ProbeDetectorRespondsToInput();
            Console.WriteLine(_detectorIsLive
                ? "[biometrics] YuNet detector responds to input."
                : "[biometrics] WARNING: YuNet detector self-check could not confirm that the " +
                  "model responds to different inputs (raw 0-255 probe). Detection will still " +
                  "be attempted; check the startup log if face detection misbehaves.");
        }

        /// <summary>
        /// Verifies the detector responds to its input by running two contrasting
        /// raw 0-255 frames (black vs vertical gradient — the scale the model is fed,
        /// matching OpenCV blobFromImage with scalefactor 1.0) and comparing the cls
        /// scores. A healthy YuNet produces clearly different distributions; feeding
        /// [0,1]-range values instead makes every input look black and yields a false
        /// negative, so the input scale matters here.
        /// </summary>
        private bool ProbeDetectorRespondsToInput()
        {
            try
            {
                var dims = _detector.InputMetadata[_detector.InputNames[0]].Dimensions;
                if (dims.Length != 4 || dims[2] <= 0 || dims[3] <= 0)
                {
                    return false;
                }

                var height = dims[2];
                var width = dims[3];
                var black = DetectorScoresFor(new float[3 * height * width]);
                var gradient = DetectorScoresFor(VerticalGradient(height, width));
                var delta = Math.Abs(Sum(black) - Sum(gradient)) / black.Length;
                Console.WriteLine($"[biometrics] YuNet self-check: mean cls delta (black vs 0-255 gradient) = {delta:0.0000}");
                return delta >= 0.01;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[biometrics] detector self-check failed: {ex.Message}");
                return false;
            }
        }

        private static float Sum(float[] values)
        {
            var sum = 0f;
            for (var i = 0; i < values.Length; i++) sum += values[i];
            return sum;
        }

        private float[] DetectorScoresFor(float[] blob)
        {
            var dims = _detector.InputMetadata[_detector.InputNames[0]].Dimensions;
            using var results = _detector.Run(new List<NamedOnnxValue>
            {
                NamedOnnxValue.CreateFromTensor(_detector.InputNames[0],
                    new DenseTensor<float>(blob, new[] { 1, 3, dims[2], dims[3] })),
            });
            return results.First(r => r.Name.StartsWith("cls", StringComparison.Ordinal))
                .AsEnumerable<float>()
                .ToArray();
        }

        private static float[] VerticalGradient(int height, int width)
        {
            // Raw 0-255, the scale YuNet actually receives (OpenCV blobFromImage
            // scalefactor 1.0). [0,1] values read as near-black to this model.
            var blob = new float[3 * height * width];
            for (var y = 0; y < height; y++)
            {
                var value = y * 255f / (height - 1);
                for (var x = 0; x < width; x++)
                {
                    var i = y * width + x;
                    blob[i] = value;
                    blob[height * width + i] = value;
                    blob[2 * height * width + i] = value;
                }
            }
            return blob;
        }

        /// <summary>Runs detect -&gt; liveness -&gt; embedding for one frame (queued when saturated).</summary>
        public FaceProcessOutcome ProcessFrame(byte[] imageBytes)
        {
            ObjectDisposedException.ThrowIf(_disposed, this);
            _gate.Wait();
            try
            {
                return ProcessCore(imageBytes);
            }
            finally
            {
                _gate.Release();
            }
        }

        private FaceProcessOutcome ProcessCore(byte[] imageBytes)
        {
            using var bitmap = SKBitmap.Decode(imageBytes);
            if (bitmap is null || bitmap.Width < 16 || bitmap.Height < 16)
                return new FaceProcessOutcome { FaceDetected = false };

            var frame = FrameRgba.From(bitmap);

            // --- 1) YuNet detection (letterboxed to the model input).
            if (!TryDetect(frame, out var box, out var landmarks, out var detectDebug))
            {
                // Attach the self-check result so support can tell an empty camera
                // frame from a detector that never confirmed it responds to input.
                var debug = !_detectorIsLive && detectDebug is not null
                    ? detectDebug + " (startup self-check also failed to confirm the detector responds to input)"
                    : detectDebug;
                return new FaceProcessOutcome { FaceDetected = false, Debug = debug };
            }

            // --- 2) Silent-Face anti-spoofing ensemble (same math as anti_spoofing_engine.py).
            var (isReal, livenessScore) = CheckLiveness(frame, box);
            if (!isReal)
                return new FaceProcessOutcome { FaceDetected = true, IsLive = false, LivenessScore = livenessScore };

            // --- 3) SFace embedding on the aligned face.
            var aligned = AlignFace(frame, landmarks);
            var feature = ExtractFeature(aligned);
            return new FaceProcessOutcome { FaceDetected = true, IsLive = true, LivenessScore = livenessScore, Feature = feature };
        }

        // ---------------------------------------------------------------- detection

        private sealed record DetectedBox(float X, float Y, float W, float H);
        private sealed record Detection(DetectedBox Box, (float X, float Y)[] Landmarks, float Score);

        private bool TryDetect(FrameRgba frame, out DetectedBox best, out (float X, float Y)[] bestLandmarks, out string? debug)
        {
            best = null!;
            bestLandmarks = null!;
            debug = null;

            // YuNet operates on the source frame padded on the right/bottom to a
            // multiple of 32. The bundled model supports dynamic dimensions; retain a
            // proportional fixed-size fallback for a future fixed-shape replacement.
            var dims = _detector.InputMetadata[_detector.InputNames[0]].Dimensions;
            if (dims.Length != 4) return false;

            var hasFixedInputShape = dims[2] > 0 && dims[3] > 0;
            var workH = hasFixedInputShape ? dims[2] : RoundUp(frame.Height, 32);
            var workW = hasFixedInputShape ? dims[3] : RoundUp(frame.Width, 32);
            var scale = Math.Min(workW / (double)frame.Width, workH / (double)frame.Height);
            if (!hasFixedInputShape) scale = 1;
            var scaledW = Math.Min(workW, Math.Max(1, (int)Math.Round(frame.Width * scale)));
            var scaledH = Math.Min(workH, Math.Max(1, (int)Math.Round(frame.Height * scale)));

            var inputMeta = _detector.InputMetadata[_detector.InputNames[0]];
            _ = inputMeta; // dims already captured above

            List<Detection>? candidates = null;
            var normalizationDebug = new List<string>();

            // YuNet expects raw 0-255 BGR pixels (OpenCV feeds blobFromImage with
            // scalefactor 1.0, swapRB=false), which scores far above the threshold on
            // real frames — verified: 0.92 raw vs 0.05 with /255. Some exports of the
            // same graph instead expect [0,1]-normalized pixels, so when the raw pass
            // finds nothing the normalized one is tried before giving up.
            foreach (var divisor in new[] { 1f, 255f })
            {
                var blob = new float[3 * workH * workW];
                for (var y = 0; y < scaledH; y++)
                {
                    var srcY = Math.Min(frame.Height - 1, (int)(y / scale));
                    for (var x = 0; x < scaledW; x++)
                    {
                        var srcX = Math.Min(frame.Width - 1, (int)(x / scale));
                        var (r, g, b) = frame.Pixel(srcX, srcY);
                        var i = y * workW + x;
                        blob[i] = b / divisor;                       // YuNet expects BGR.
                        blob[workH * workW + i] = g / divisor;
                        blob[2 * workH * workW + i] = r / divisor;
                    }
                }

                var input = new List<NamedOnnxValue>
                {
                    NamedOnnxValue.CreateFromTensor(_detector.InputNames[0],
                        new DenseTensor<float>(blob, new[] { 1, 3, workH, workW })),
                };
                using var results = _detector.Run(input);
                var tensors = results.ToDictionary(
                    result => result.Name,
                    result => result.AsEnumerable<float>().ToArray(),
                    StringComparer.Ordinal);
                var passCandidates = new List<Detection>();

                // YuNet produces one tensor per stride and prediction type. This is the
                // same output contract and decoding used by OpenCV FaceDetectorYN:
                // cls_*, obj_*, bbox_* and kps_* at strides 8, 16, and 32.
                foreach (var stride in new[] { 8, 16, 32 })
                {
                    if (!tensors.TryGetValue($"cls_{stride}", out var classes) ||
                        !tensors.TryGetValue($"obj_{stride}", out var objects) ||
                        !tensors.TryGetValue($"bbox_{stride}", out var boxes) ||
                        !tensors.TryGetValue($"kps_{stride}", out var keypoints))
                    {
                        debug = $"missing detector tensors for stride {stride}";
                        return false;
                    }

                    var rows = workH / stride;
                    var columns = workW / stride;
                    var anchors = rows * columns;
                    if (classes.Length != anchors || objects.Length != anchors ||
                        boxes.Length != anchors * 4 || keypoints.Length != anchors * 10)
                    {
                        debug = $"detector tensor shape mismatch at stride {stride}";
                        return false;
                    }

                    for (var row = 0; row < rows; row++)
                    {
                        for (var column = 0; column < columns; column++)
                        {
                            var index = row * columns + column;
                            var classScore = ToProbability(classes[index]);
                            var objectScore = ToProbability(objects[index]);
                            var score = MathF.Sqrt(classScore * objectScore);
                            if (score < DetectionScoreThreshold) continue;

                            var boxOffset = index * 4;
                            var width = MathF.Exp(boxes[boxOffset + 2]) * stride;
                            var height = MathF.Exp(boxes[boxOffset + 3]) * stride;
                            if (!float.IsFinite(width) || !float.IsFinite(height) || width <= 0 || height <= 0) continue;

                            var centerX = (column + boxes[boxOffset]) * stride;
                            var centerY = (row + boxes[boxOffset + 1]) * stride;
                            var faceLandmarks = new (float X, float Y)[5];
                            var landmarkOffset = index * 10;
                            for (var point = 0; point < faceLandmarks.Length; point++)
                            {
                                faceLandmarks[point] = (
                                    (keypoints[landmarkOffset + point * 2] + column) * stride,
                                    (keypoints[landmarkOffset + point * 2 + 1] + row) * stride);
                            }

                            passCandidates.Add(new Detection(
                                new DetectedBox(centerX - width / 2, centerY - height / 2, width, height),
                                faceLandmarks,
                                score));
                        }
                    }
                }

                if (passCandidates.Count > 0)
                {
                    candidates = passCandidates;
                    break;
                }

                var topScores = tensors
                    .Where(t => t.Key.StartsWith("cls_", StringComparison.Ordinal))
                    .SelectMany(t => t.Value)
                    .OrderDescending()
                    .Take(2)
                    .Select(s => s.ToString("0.00"))
                    .ToArray();
                normalizationDebug.Add($"/{divisor:0}: {string.Join(", ", topScores)}");
            }

            if (candidates is null || candidates.Count == 0)
            {
                debug = $"no anchor above {DetectionScoreThreshold:0.00} — top class scores [raw, /255]: {string.Join("; ", normalizationDebug)}";
                return false;
            }
            candidates.Sort((a, b) => b.Score.CompareTo(a.Score));

            var kept = new List<Detection>();
            foreach (var candidate in candidates.Take(5000))
            {
                var suppressed = kept.Any(existing => IoU(existing.Box, candidate.Box) >= DetectionNmsThreshold);
                if (!suppressed) kept.Add(candidate);
            }
            if (kept.Count == 0) return false;

            var winner = kept[0];
            best = new DetectedBox(
                X: (float)(winner.Box.X / scale),
                Y: (float)(winner.Box.Y / scale),
                W: (float)(winner.Box.W / scale),
                H: (float)(winner.Box.H / scale));

            var lm = new (float X, float Y)[5];
            for (var p = 0; p < 5; p++)
            {
                lm[p] = ((float)(winner.Landmarks[p].X / scale),
                         (float)(winner.Landmarks[p].Y / scale));
            }
            bestLandmarks = lm;
            return true;
        }

        private static int RoundUp(int value, int divisor) => ((value + divisor - 1) / divisor) * divisor;

        /// <summary>
        /// Head outputs are either probabilities in [0,1] (sigmoid baked into the graph)
        /// or raw logits — exports differ. Values outside [0,1] are sigmoid-ed so both
        /// conventions decode correctly instead of clamping to zero.
        /// </summary>
        private static float ToProbability(float value) =>
            value is >= 0f and <= 1f ? value : 1f / (1f + MathF.Exp(-value));

        private static float IoU(DetectedBox a, DetectedBox b)
        {
            var ax1 = a.X; var ay1 = a.Y;
            var ax2 = ax1 + a.W; var ay2 = ay1 + a.H;
            var bx1 = b.X; var by1 = b.Y;
            var bx2 = bx1 + b.W; var by2 = by1 + b.H;

            var ix1 = Math.Max(ax1, bx1); var iy1 = Math.Max(ay1, by1);
            var ix2 = Math.Min(ax2, bx2); var iy2 = Math.Min(ay2, by2);
            var iw = Math.Max(0, ix2 - ix1); var ih = Math.Max(0, iy2 - iy1);
            var inter = iw * ih;
            var union = a.W * a.H + b.W * b.H - inter;
            return union <= 0 ? 0 : inter / union;
        }

        // ----------------------------------------------------------------- liveness

        /// <summary>Dual-scale Silent-Face ensemble (same math as anti_spoofing_engine.py).</summary>
        private (bool IsReal, double Score) CheckLiveness(FrameRgba frame, DetectedBox box)
        {
            var total = new double[3];
            foreach (var (session, scale) in _antiSpoof)
            {
                var patch = CropPatch(frame, box, scale, AntiSpoofSize, AntiSpoofSize);
                var tensor = new DenseTensor<float>(RgbaToBgrChw(patch), new[] { 1, 3, AntiSpoofSize, AntiSpoofSize });
                var inputs = new List<NamedOnnxValue>
                {
                    NamedOnnxValue.CreateFromTensor(session.InputNames[0], tensor),
                };
                using var results = session.Run(inputs);
                var logits = results.First().AsEnumerable<float>().ToArray();
                var probabilities = Softmax3(logits);
                for (var i = 0; i < 3; i++) total[i] += probabilities[i];
            }

            // Index 1 = real living face; 0/2 = presentation attack (screen, photo, mask).
            var label = 0;
            for (var i = 1; i < 3; i++) if (total[i] > total[label]) label = i;
            return (label == 1, total[1] / _antiSpoof.Length);
        }

        /// <summary>Port of Silent-Face CropImage.crop (bbox expanded by the model scale).</summary>
        private static FrameRgba CropPatch(FrameRgba frame, DetectedBox box, double scale, int outWidth, int outHeight)
        {
            var srcW = (double)frame.Width;
            var srcH = (double)frame.Height;

            var s = Math.Min(Math.Min((srcH - 1) / box.H, (srcW - 1) / box.W), scale);
            var newW = box.W * s;
            var newH = box.H * s;
            var cx = box.X + box.W / 2;
            var cy = box.Y + box.H / 2;

            var leftTopX = cx - newW / 2;
            var leftTopY = cy - newH / 2;
            var rightBottomX = cx + newW / 2;
            var rightBottomY = cy + newH / 2;

            if (leftTopX < 0) { rightBottomX -= leftTopX; leftTopX = 0; }
            if (leftTopY < 0) { rightBottomY -= leftTopY; leftTopY = 0; }
            if (rightBottomX > srcW - 1) { leftTopX -= rightBottomX - srcW + 1; rightBottomX = srcW - 1; }
            if (rightBottomY > srcH - 1) { leftTopY -= rightBottomY - srcH + 1; rightBottomY = srcH - 1; }

            var x1 = Math.Max(0, (int)leftTopX);
            var y1 = Math.Max(0, (int)leftTopY);
            var x2 = Math.Min(frame.Width - 1, (int)rightBottomX);
            var y2 = Math.Min(frame.Height - 1, (int)rightBottomY);
            return frame.ResizeRegion(x1, y1, Math.Max(1, x2 - x1 + 1), Math.Max(1, y2 - y1 + 1), outWidth, outHeight);
        }

        // --------------------------------------------------------------- alignment

        /// <summary>
        /// Similarity-transform alignment of the 5 landmarks onto the 112x112
        /// reference grid (same transform class as OpenCV alignCrop), then an
        /// inverse bilinear warp of the original frame.
        /// </summary>
        private static FrameRgba AlignFace(FrameRgba frame, (float X, float Y)[] landmarks)
        {
            var n = (double)landmarks.Length;
            double sx = 0, sy = 0, dx = 0, dy = 0, sxx = 0, syy = 0, mxx = 0, mxy = 0, myx = 0, myy = 0;
            for (var i = 0; i < landmarks.Length; i++)
            {
                var (x, y) = landmarks[i];
                var (rx, ry) = AlignReference[i];
                sx += x; sy += y; dx += rx; dy += ry;
                sxx += x * x; syy += y * y;
                mxx += x * rx; mxy += x * ry;
                myx += y * rx; myy += y * ry;
            }

            var den = n * (sxx + syy) - sx * sx - sy * sy;
            if (Math.Abs(den) < 1e-6) den = 1e-6;
            var a = (n * (mxx + myy) - sx * dx - sy * dy) / den;
            var b = (n * (mxy - myx) - sx * dy + sy * dx) / den;
            var tx = (dx - a * sx + b * sy) / n;
            var ty = (dy - b * sx - a * sy) / n;

            var det = a * a + b * b;
            if (Math.Abs(det) < 1e-9) det = 1e-9;
            var ia = a / det;
            var ib = b / det;

            var output = new byte[AlignSize * AlignSize * 4];
            for (var v = 0; v < AlignSize; v++)
            {
                for (var u = 0; u < AlignSize; u++)
                {
                    var du = u - tx;
                    var dv = v - ty;
                    var su = ia * du + ib * dv;
                    var sv = -ib * du + ia * dv;

                    var o = (v * AlignSize + u) * 4;
                    if (su < 0 || sv < 0 || su >= frame.Width - 1 || sv >= frame.Height - 1)
                    {
                        // Out of frame: black border, like cv2.warpAffine defaults.
                        continue;
                    }
                    SampleBilinear(frame, su, sv, output, o);
                }
            }

            return new FrameRgba(output, AlignSize, AlignSize, AlignSize * 4);
        }

        private static void SampleBilinear(FrameRgba frame, double su, double sv, byte[] output, int o)
        {
            var x0 = (int)su;
            var y0 = (int)sv;
            var fx = su - x0;
            var fy = sv - y0;
            // Clamp the far sample to the last valid pixel: crops are allowed to
            // touch the frame border (anti-spoof patches expand to the edge).
            var x1 = Math.Min(x0 + 1, frame.Width - 1);
            var y1 = Math.Min(y0 + 1, frame.Height - 1);

            var (r00, g00, b00) = frame.Pixel(x0, y0);
            var (r10, g10, b10) = frame.Pixel(x1, y0);
            var (r01, g01, b01) = frame.Pixel(x0, y1);
            var (r11, g11, b11) = frame.Pixel(x1, y1);

            output[o + 0] = Lerp(Lerp(r00, r10, fx), Lerp(r01, r11, fx), fy);
            output[o + 1] = Lerp(Lerp(g00, g10, fx), Lerp(g01, g11, fx), fy);
            output[o + 2] = Lerp(Lerp(b00, b10, fx), Lerp(b01, b11, fx), fy);
            output[o + 3] = 255;
        }

        private static byte Lerp(byte start, byte end, double t) => (byte)Math.Clamp(start + (end - start) * t, 0, 255);

        /// <summary>
        /// SFace input: the aligned 112x112 crop in **RGB order, raw 0-255 scale**.
        /// The ONNX graph normalizes internally (it came from the same export as the
        /// reference pipeline), so dividing by 255 here double-normalizes and destroys
        /// every embedding. Verified against a reference feature produced by the
        /// original OpenCV pipeline: cosine 0.993 correct vs 0.171 with /255.
        /// </summary>
        private float[] ExtractFeature(FrameRgba aligned)
        {
            var blob = new float[3 * AlignSize * AlignSize];
            for (var y = 0; y < AlignSize; y++)
            {
                for (var x = 0; x < AlignSize; x++)
                {
                    var (r, g, b) = aligned.Pixel(x, y);
                    var i = y * AlignSize + x;
                    blob[i] = r;
                    blob[AlignSize * AlignSize + i] = g;
                    blob[2 * AlignSize * AlignSize + i] = b;
                }
            }

            var inputs = new List<NamedOnnxValue>
            {
                NamedOnnxValue.CreateFromTensor(_recognizer.InputNames[0],
                    new DenseTensor<float>(blob, new[] { 1, 3, AlignSize, AlignSize })),
            };
            using var results = _recognizer.Run(inputs);
            return results.First().AsEnumerable<float>().ToArray();
        }

        // ------------------------------------------------------------------ helpers

        /// <summary>
        /// Anti-spoof input: BGR CHW in raw 0-255 scale, matching the reference PyTorch
        /// engine (`crop.transpose((2,0,1))` with no normalization).
        /// </summary>
        private static float[] RgbaToBgrChw(FrameRgba image)
        {
            var height = image.Height;
            var width = image.Width;
            var data = new float[3 * height * width];
            for (var y = 0; y < height; y++)
            {
                for (var x = 0; x < width; x++)
                {
                    var (r, g, bl) = image.Pixel(x, y);
                    var i = y * width + x;
                    data[i] = bl;
                    data[height * width + i] = g;
                    data[2 * height * width + i] = r;
                }
            }
            return data;
        }

        private static double[] Softmax3(float[] logits)
        {
            var max = Math.Max(logits[0], Math.Max(logits[1], logits[2]));
            var exp0 = Math.Exp(logits[0] - max);
            var exp1 = Math.Exp(logits[1] - max);
            var exp2 = Math.Exp(logits[2] - max);
            var sum = exp0 + exp1 + exp2;
            return new[] { exp0 / sum, exp1 / sum, exp2 / sum };
        }

        /// <summary>Immutable RGBA frame with fast pixel access.</summary>
        internal sealed class FrameRgba
        {
            private readonly byte[] _data;
            public int Width { get; }
            public int Height { get; }
            public int Stride { get; }

            public FrameRgba(byte[] data, int width, int height, int stride)
            {
                _data = data; Width = width; Height = height; Stride = stride;
            }

            public static FrameRgba From(SKBitmap bitmap)
            {
                var data = new byte[bitmap.ByteCount];
                Marshal.Copy(bitmap.GetPixels(), data, 0, data.Length);

                // SkiaSharp decodes JPEG/PNG to Bgra8888 on this platform. Normalize
                // to RGBA here so Pixel() and every buffer writer (SampleBilinear)
                // agree on byte order — getting this backwards silently feeds YuNet
                // RGB instead of BGR and SFace BGR instead of RGB.
                if (bitmap.ColorType == SKColorType.Bgra8888)
                {
                    for (var y = 0; y < bitmap.Height; y++)
                    {
                        var row = y * bitmap.RowBytes;
                        for (var x = 0; x < bitmap.Width; x++)
                        {
                            var o = row + x * 4;
                            (data[o], data[o + 2]) = (data[o + 2], data[o]);
                        }
                    }
                }
                else if (bitmap.ColorType != SKColorType.Rgba8888)
                {
                    // Exotic source format (e.g. gray-scale): rebuild via GetPixel,
                    // which always reports true channels. Slow path, rarely hit.
                    data = new byte[bitmap.Width * bitmap.Height * 4];
                    for (var y = 0; y < bitmap.Height; y++)
                    {
                        for (var x = 0; x < bitmap.Width; x++)
                        {
                            var c = bitmap.GetPixel(x, y);
                            var o = (y * bitmap.Width + x) * 4;
                            data[o] = c.Red;
                            data[o + 1] = c.Green;
                            data[o + 2] = c.Blue;
                            data[o + 3] = c.Alpha;
                        }
                    }
                    return new FrameRgba(data, bitmap.Width, bitmap.Height, bitmap.Width * 4);
                }

                return new FrameRgba(data, bitmap.Width, bitmap.Height, bitmap.RowBytes);
            }

            /// <summary>True (R, G, B) channels — buffers are RGBA-normalized by <see cref="From"/>.</summary>
            public (byte R, byte G, byte B) Pixel(int x, int y)
            {
                var o = y * Stride + x * 4;
                return (_data[o], _data[o + 1], _data[o + 2]);
            }

            /// <summary>Crops a region and resizes it (bilinear) to the requested output.</summary>
            public FrameRgba ResizeRegion(int x, int y, int width, int height, int outWidth, int outHeight)
            {
                var output = new byte[outWidth * outHeight * 4];
                for (var v = 0; v < outHeight; v++)
                {
                    var sy = (v + 0.5) * height / outHeight - 0.5;
                    for (var u = 0; u < outWidth; u++)
                    {
                        var sx = (u + 0.5) * width / outWidth - 0.5;
                        var gx = Math.Clamp(x + sx, x, x + width - 1);
                        var gy = Math.Clamp(y + sy, y, y + height - 1);
                        SampleBilinear(this, gx, gy, output, (v * outWidth + u) * 4);
                    }
                }
                return new FrameRgba(output, outWidth, outHeight, outWidth * 4);
            }
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            _detector.Dispose();
            _recognizer.Dispose();
            foreach (var (session, _) in _antiSpoof) session.Dispose();
            _gate.Dispose();
        }
    }
}
