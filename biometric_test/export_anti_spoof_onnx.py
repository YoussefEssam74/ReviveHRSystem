"""
One-time export of the Silent-Face anti-spoofing .pth models to ONNX so the
.NET API can run them natively (no PyTorch at runtime).

Run with the workout_ml env:
    python export_anti_spoof_onnx.py

Outputs (next to this file, consumed by Infrastructure/Biometrics):
    anti_spoof_2.7_80x80.onnx
    anti_spoof_4.0_80x80.onnx

If onnxruntime is installed in the env, a parity check runs automatically and
prints the max absolute difference between PyTorch and ONNX outputs.
"""
import os
import sys
from collections import OrderedDict

import torch

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SILENT_DIR = os.path.join(SCRIPT_DIR, "Silent_Face_Anti_Spoofing")
if SILENT_DIR not in sys.path:
    sys.path.append(SILENT_DIR)

from src.model_lib.MiniFASNet import MiniFASNetV1SE, MiniFASNetV2
from src.utility import get_kernel, parse_model_name

EXPORTS = [
    ("2.7_80x80_MiniFASNetV2.pth", "anti_spoof_2.7_80x80.onnx"),
    ("4_0_0_80x80_MiniFASNetV1SE.pth", "anti_spoof_4.0_80x80.onnx"),
]


def export_one(model_file: str, out_name: str) -> None:
    src = os.path.join(SILENT_DIR, "resources", "anti_spoof_models", model_file)
    h, w, m_type, _scale = parse_model_name(model_file)
    kernel = get_kernel(h, w)
    net = MiniFASNetV1SE(conv6_kernel=kernel) if m_type == "MiniFASNetV1SE" else MiniFASNetV2(conv6_kernel=kernel)

    state_dict = torch.load(src, map_location="cpu", weights_only=False)
    cleaned = OrderedDict((k[7:] if k.startswith("module.") else k, v) for k, v in state_dict.items())
    net.load_state_dict(cleaned)
    net.eval()

    dummy = torch.randn(1, 3, h, w)
    out_path = os.path.join(SCRIPT_DIR, out_name)
    try:
        torch.onnx.export(
            net, dummy, out_path,
            input_names=["input"], output_names=["output"],
            opset_version=13, dynamo=False,
        )
    except TypeError:
        # Older torch without the dynamo kwarg.
        torch.onnx.export(
            net, dummy, out_path,
            input_names=["input"], output_names=["output"],
            opset_version=13,
        )
    print(f"[ok] exported {model_file} -> {out_name} ({os.path.getsize(out_path) // 1024} KB)")

    try:
        import numpy as np
        import onnxruntime as ort
    except ImportError:
        print("    (onnxruntime not installed - skipping parity check: pip install onnxruntime)")
        return

    sess = ort.InferenceSession(out_path, providers=["CPUExecutionProvider"])
    with torch.no_grad():
        torch_out = net(dummy).numpy()
    ort_out = sess.run(None, {sess.get_inputs()[0].name: dummy.numpy()})[0]
    max_diff = float(np.abs(torch_out - ort_out).max())
    verdict = "PASS" if max_diff < 1e-4 else "FAIL"
    print(f"    parity {verdict}: max abs diff = {max_diff:.8f}")


if __name__ == "__main__":
    for model_file, out_name in EXPORTS:
        export_one(model_file, out_name)
    print("Done.")
