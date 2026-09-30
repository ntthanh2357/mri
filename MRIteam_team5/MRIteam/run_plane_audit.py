"""
run_plane_audit.py — One-shot Privacy Guard audit
==================================================
Walks archive_v2/Testing, runs should_call_gemini() on every image,
and writes plane_audit_log.csv + prints a summary table.

Usage:
    python run_plane_audit.py

Outputs:
    plane_audit_log.csv  — per-image detail (filepath, plane, blocked)
    Console              — total / blocked / allowed counts + percentages
"""

import os
import csv
from localization import should_call_gemini

TEST_DIR = "archive_v2/Testing"
OUTPUT_CSV = "plane_audit_log.csv"

# ── Collect results ────────────────────────────────────────────────────────
results: list[tuple[str, str, bool]] = []

for root, _, files in os.walk(TEST_DIR):
    for fname in files:
        if fname.lower().endswith((".jpg", ".jpeg", ".png")):
            path = os.path.join(root, fname)
            allowed, plane = should_call_gemini(path)
            results.append((path, plane, not allowed))  # blocked = not allowed

# ── Write CSV ──────────────────────────────────────────────────────────────
with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["filepath", "inferred_plane", "gemini_blocked"])
    writer.writerows(results)

# ── Summary ────────────────────────────────────────────────────────────────
total   = len(results)
blocked = sum(1 for _, _, b in results if b)
called  = total - blocked

# Plane breakdown
from collections import Counter
plane_counts = Counter(plane for _, plane, _ in results)

print("=" * 55)
print("  Privacy Guard — Plane Audit Report")
print("=" * 55)
print(f"  Test directory : {TEST_DIR}")
print(f"  CSV output     : {OUTPUT_CSV}")
print("-" * 55)
print(f"  Tổng ảnh       : {total:,}")
print(f"  Bị chặn (no Gemini) : {blocked:,}  ({blocked/total*100:.1f}%)")
print(f"  Được gọi Gemini     : {called:,}  ({called/total*100:.1f}%)")
print("-" * 55)
print("  Phân bố mặt phẳng:")
for plane, count in sorted(plane_counts.items()):
    pct = count / total * 100
    tag = " ← BLOCKED" if plane != "axial" else ""
    print(f"    {plane:<12}: {count:,}  ({pct:.1f}%){tag}")
print("=" * 55)
