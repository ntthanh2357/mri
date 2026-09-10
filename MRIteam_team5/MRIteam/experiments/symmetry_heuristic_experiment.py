"""
experiments/symmetry_heuristic_experiment.py
============================================
EXPERIMENT: bilateral L-R symmetry as a proxy for MRI acquisition plane.
STATUS: Not used in production pipeline.

WHY IT FAILED on Kaggle "Brain Tumor MRI Dataset" (Nickparvar):
  The dataset pre-processes all images to 512x512 squares with black
  background padding.  The black background is perfectly symmetric, and
  it dominates the pixel-level symmetry score regardless of the actual
  brain content orientation.

  Measured scores on 21 Kaggle images (glioma/meningioma/pituitary):
    Min:  0.933
    Max:  0.990
    Mean: 0.962
    ALL ratio = 1.00 (square crop)
    0 images below threshold=0.90

  Conclusion: background padding masks the brain signal, making the
  symmetry score uninformative for this specific dataset.

FUTURE DIRECTION (if needed):
  1. Use Otsu thresholding to detect the bounding box of the brain region.
  2. Crop to brain-only ROI before computing L-R symmetry.
  3. Re-evaluate the score on the cropped region.
  This would isolate the true anatomical signal from padding artifacts.
  Not implemented in the current paper submission.

REFERENCE:
  Rationale why symmetry SHOULD work (in theory):
  - Axial slices (top-down) have near-perfect bilateral L-R symmetry
    because brain anatomy is left-right symmetric.
  - Sagittal slices (side view) are strongly asymmetric: anterior
    (face/nose/frontal lobe) vs posterior (cerebellum/occipital) differ.
  - Coronal slices (front-facing) are also symmetric — a known limitation
    even if the preprocessing issue were resolved.
"""

import cv2
import numpy as np
import os


def classify_plane_by_symmetry(file_path: str, threshold: float = 0.75) -> str:
    """
    Experimental: classify MRI acquisition plane by bilateral L-R symmetry.

    NOT USED IN PRODUCTION. See module docstring for why this failed.

    Args:
        file_path : path to the image file.
        threshold : symmetry score above which the image is deemed axial.

    Returns:
        'axial'   if symmetry >= threshold and ratio is not portrait.
        'unknown' otherwise (fail-safe).
    """
    try:
        img = cv2.imread(file_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return "unknown"

        img = cv2.resize(img, (256, 256))
        h, w = img.shape[:2]

        if h / w > 1.20:
            return "unknown"

        mirrored = cv2.flip(img, 1)
        diff_mean = float(np.mean(np.abs(img.astype(np.float32) - mirrored.astype(np.float32))))
        symmetry = 1.0 - (diff_mean / 255.0)

        if symmetry >= threshold:
            return "axial"
        return "unknown"

    except Exception:
        return "unknown"


# ── Quick benchmark if run directly ───────────────────────────────────────────
if __name__ == "__main__":
    import sys, csv
    test_dirs = [
        ("archive_v2/Testing/glioma",      "kaggle_glioma"),
        ("archive_v2/Testing/meningioma",  "kaggle_meningioma"),
        ("archive_v2/Testing/pituitary",   "kaggle_pituitary"),
    ]
    rows = []
    for folder, source in test_dirs:
        if not os.path.exists(folder):
            continue
        for fname in sorted(os.listdir(folder))[:50]:
            if not fname.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            path = os.path.join(folder, fname)
            img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
            if img is None:
                continue
            img_r = cv2.resize(img, (256, 256))
            mirrored = cv2.flip(img_r, 1)
            diff = float(np.mean(np.abs(img_r.astype(np.float32) - mirrored.astype(np.float32))))
            sym = 1.0 - diff / 255.0
            ratio = img.shape[0] / img.shape[1]
            rows.append({"source": source, "file": fname,
                         "symmetry": round(sym, 4), "ratio": round(ratio, 3)})

    print(f"{'source':<22} {'file':<30} {'symmetry':>10} {'ratio':>8}")
    print("-" * 75)
    for r in rows:
        print(f"{r['source']:<22} {r['file']:<30} {r['symmetry']:>10.4f} {r['ratio']:>8.3f}")

    syms: list[float] = [float(r["symmetry"]) for r in rows]
    print(f"\nMin={min(syms):.4f}  Max={max(syms):.4f}  Mean={sum(syms)/len(syms):.4f}")
    for t in [0.75, 0.85, 0.90, 0.95]:
        below = sum(1 for s in syms if s < t)
        print(f"Below {t}: {below}/{len(syms)}")
