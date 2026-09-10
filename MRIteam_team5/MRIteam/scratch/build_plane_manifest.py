"""
build_plane_manifest.py
────────────────────────────────────────────────────────────────────
Xây dựng plane_manifest.json — file ánh xạ  basename → plane  dựa
trên provenance đã biết của từng nguồn dữ liệu.

Nguồn dữ liệu và plane tương ứng:
  • Te-gl_*.jpg / Te-me_*.jpg / Te-no_*.jpg / Te-pi_*.jpg
      → Kaggle "Brain Tumor MRI Dataset" (Msoud Nickparvar)
      → Nguồn gốc: axial slices only (đã xác nhận trong paper gốc)
      → plane = "axial"

  • glioma_TT_*.jpg / meningioma_TT_*.jpg / notumor_TT_*.jpg / pituitary_TT_*.jpg
      → Bệnh viện Tam Trí
      → Nguồn gốc: multi-plane MRI, đã được export dưới dạng JPEG
        từ DICOM bởi nhóm nghiên cứu.
      → Plane hiện TẠI CHƯA XÁC NHẬN tường minh từ DICOM header.
      → Gán "unknown" (= facial-risk) cho đến khi có xác nhận từ DICOM.

CÁCH SỬ DỤNG:
    python scratch/build_plane_manifest.py

OUTPUT:
    plane_manifest.json  (trong thư mục project root)

QUAN TRỌNG:
    File này phản ánh PROVENANCE, không phải kết quả suy luận pixel.
    Khi có thêm dữ liệu hoặc xác nhận DICOM header cho TT dataset,
    cập nhật SOURCES bên dưới và chạy lại script này.
"""

import os
import json
import glob
from typing import TypedDict

# ── Thư mục gốc project (tự động tính từ vị trí script) ────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_PATH  = os.path.join(PROJECT_ROOT, "plane_manifest.json")

class SourceDict(TypedDict):
    dirs: list[str]
    filename_prefix: list[str]
    plane: str
    note: str

# ── Định nghĩa provenance ────────────────────────────────────────────
# Mỗi entry: (glob_pattern_relative_to_project, plane)
# plane phải là một trong: "axial" | "sagittal" | "coronal" | "unknown"
SOURCES: list[SourceDict] = [
    # ── Kaggle dataset — axial only (đã xác nhận từ paper nguồn) ──────
    # Pattern: Te-{gl/me/no/pi}_{number}.jpg  trong archive_v2/Testing
    {
        "dirs":  [
            "archive_v2/Testing/glioma",
            "archive_v2/Testing/meningioma",
            "archive_v2/Testing/notumor",
            "archive_v2/Testing/pituitary",
            "archive_v2/Training/glioma",
            "archive_v2/Training/meningioma",
            "archive_v2/Training/notumor",
            "archive_v2/Training/pituitary",
        ],
        "filename_prefix": ["Te-", "Tr-"],   # Kaggle naming convention
        "plane": "axial",
        "note":  "Kaggle Brain Tumor MRI Dataset — axial slices confirmed by dataset paper",
    },

    # ── Bệnh viện Tam Trí — plane CHƯA XÁC NHẬN từ DICOM ─────────────
    {
        "dirs":  [
            "archive_v2/Testing/glioma",
            "archive_v2/Testing/meningioma",
            "archive_v2/Testing/notumor",
            "archive_v2/Testing/pituitary",
            "archive_v2/Training/glioma",
            "archive_v2/Training/meningioma",
            "archive_v2/Training/notumor",
            "archive_v2/Training/pituitary",
        ],
        "filename_prefix": ["glioma_TT_", "meningioma_TT_", "notumor_TT_", "pituitary_TT_"],
        "plane": "unknown",     # ← đổi sang "axial" sau khi có xác nhận DICOM
        "note":  "Tam Tri Hospital — plane not confirmed from DICOM; treated as facial-risk",
    },
]

# ────────────────────────────────────────────────────────────────────
def build_manifest() -> tuple[dict[str, str], dict[str, int]]:
    manifest: dict[str, str] = {}
    stats: dict[str, int] = {}

    for source in SOURCES:
        plane   = source["plane"]
        prefixes = source["filename_prefix"]
        dirs    = source["dirs"]

        for rel_dir in dirs:
            abs_dir = os.path.join(PROJECT_ROOT, rel_dir)
            if not os.path.isdir(abs_dir):
                print(f"  [SKIP] dir not found: {rel_dir}")
                continue

            for fname in os.listdir(abs_dir):
                if not fname.lower().endswith((".jpg", ".jpeg", ".png")):
                    continue
                # Chỉ gán plane nếu filename khớp prefix của source này
                if not any(fname.startswith(p) for p in prefixes):
                    continue

                if fname in manifest and manifest[fname] != plane:
                    print(f"  [CONFLICT] {fname}: existing={manifest[fname]}, new={plane} — keeping existing")
                    continue

                manifest[fname] = plane
                stats[plane] = stats.get(plane, 0) + 1

    return manifest, stats


def main():
    print(f"Building plane manifest...")
    print(f"  Project root : {PROJECT_ROOT}")
    print(f"  Output path  : {OUTPUT_PATH}")
    print()

    manifest, stats = build_manifest()

    # Sắp xếp để diff dễ đọc
    manifest_sorted = dict(sorted(manifest.items()))

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest_sorted, f, indent=2, ensure_ascii=False)

    print(f"\n[OK] plane_manifest.json written -- {len(manifest_sorted)} entries")
    print(f"\nBreakdown by plane:")
    for plane, count in sorted(stats.items()):
        in_facial_risk = plane in {"sagittal", "coronal", "unknown"}
        flag = "[BLOCKED - facial-risk]" if in_facial_risk else "[SAFE - VLM allowed]"
        print(f"  {plane:12s}: {count:5d} images  {flag}")

    print(f"\nNote: 'unknown' images will be blocked from Gemini (fail-safe).")
    print(f"      Update SOURCES and re-run after DICOM header confirmation.")


if __name__ == "__main__":
    main()
