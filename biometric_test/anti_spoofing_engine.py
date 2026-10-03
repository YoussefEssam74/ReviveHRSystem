"""
Silent-Face-Anti-Spoofing Inference Engine for Revive HR System
Uses MiniVision MiniFASNet dual-scale ensemble (Scale 2.7 + Scale 4.0)
Distinguishes real living faces from presentation attacks (phone screens, paper photos, video replays).
"""

import os
import sys
import torch
import torch.nn.functional as F
import numpy as np
import cv2
from collections import OrderedDict

# Add Silent_Face_Anti_Spoofing to sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SILENT_DIR = os.path.join(SCRIPT_DIR, "Silent_Face_Anti_Spoofing")
if SILENT_DIR not in sys.path:
    sys.path.append(SILENT_DIR)

from src.model_lib.MiniFASNet import MiniFASNetV1SE, MiniFASNetV2
from src.generate_patches import CropImage
from src.utility import get_kernel, parse_model_name

class AntiSpoofingEngine:
    def __init__(self, device=None):
        if device is None:
            self.device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)

        self.cropper = CropImage()
        self.models = []

        models_dir = os.path.join(SILENT_DIR, "resources", "anti_spoof_models")
        model_files = [
            "2.7_80x80_MiniFASNetV2.pth",
            "4_0_0_80x80_MiniFASNetV1SE.pth"
        ]

        for m_file in model_files:
            m_path = os.path.join(models_dir, m_file)
            if not os.path.exists(m_path):
                print(f"Warning: Model file not found: {m_path}")
                continue

            h, w, m_type, scale = parse_model_name(m_file)
            kernel = get_kernel(h, w)
            if m_type == "MiniFASNetV1SE":
                net = MiniFASNetV1SE(conv6_kernel=kernel)
            else:
                net = MiniFASNetV2(conv6_kernel=kernel)

            state_dict = torch.load(m_path, map_location=self.device, weights_only=False)
            new_sd = OrderedDict({k[7:] if k.startswith('module.') else k: v for k, v in state_dict.items()})
            net.load_state_dict(new_sd)
            net.to(self.device)
            net.eval()

            self.models.append({
                "name": m_file,
                "net": net,
                "h": h,
                "w": w,
                "scale": scale
            })

        print(f"[*] Anti-Spoofing Engine initialized on {self.device} with {len(self.models)} models.")

    def check_liveness(self, img_bgr, bbox):
        """
        Runs dual-scale anti-spoofing check.
        bbox format: [x, y, w, h]
        Returns:
            is_real (bool): True if live person, False if fake/spoof (screen/photo)
            score (float): Real face confidence score (0.0 to 1.0)
            pred_class (int): 1 = Real, 0 or 2 = Spoof
        """
        if len(self.models) == 0:
            return True, 1.0, 1

        total_prediction = np.zeros((1, 3))

        for m in self.models:
            crop = self.cropper.crop(
                org_img=img_bgr,
                bbox=bbox,
                scale=m["scale"],
                out_w=m["w"],
                out_h=m["h"],
                crop=True
            )

            # Convert BGR (H, W, C) to Tensor (1, C, H, W) normalized to [0, 1]
            tensor = torch.from_numpy(crop.transpose((2, 0, 1))).float()
            tensor = tensor.unsqueeze(0).to(self.device)

            with torch.no_grad():
                out = m["net"](tensor)
                prob = F.softmax(out, dim=1).cpu().numpy()
                total_prediction += prob

        # In Silent-Face-Anti-Spoofing:
        # Index 1 = Real Living Face
        # Index 0 / 2 = Presentation Attack (Screen, Printed photo, Mask)
        pred_label = int(np.argmax(total_prediction))
        real_score = float(total_prediction[0][1] / len(self.models))
        is_real = (pred_label == 1)

        return is_real, real_score, pred_label

if __name__ == "__main__":
    engine = AntiSpoofingEngine()
    test_img = np.zeros((480, 640, 3), dtype=np.uint8)
    bbox = [100, 100, 200, 200]
    is_live, score, label = engine.check_liveness(test_img, bbox)
    print(f"Self-check result: is_live={is_live}, score={score:.2f}, label={label}")
