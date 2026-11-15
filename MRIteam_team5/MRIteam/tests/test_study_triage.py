import io
import os
import sys
import tempfile
import unittest
import zipfile
from unittest import mock

import cv2
import numpy as np

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(CURRENT_DIR)
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

import localization  # noqa: E402
import study_triage  # noqa: E402


def _make_mri_phantom_image(path: str, size: int = 256, blank: bool = False, rim_only: bool = False) -> None:
    img = np.zeros((size, size, 3), dtype=np.uint8)
    if not blank:
        if rim_only:
            # Tiny 16x16 spot -> brain_ratio ~ 0.004 (< 0.05 threshold)
            cv2.circle(img, (size // 2, size // 2), 8, (180, 180, 180), -1)
        else:
            # Synthetic intracranial ellipse covering ~38% of frame with internal structure
            cv2.ellipse(img, (size // 2, size // 2), (75, 92), 0, 0, 360, (140, 140, 140), -1)
            cv2.ellipse(img, (size // 2 + 18, size // 2 - 12), (20, 16), 0, 0, 360, (230, 230, 230), -1)
    cv2.imwrite(path, img)


class StudyTriageTests(unittest.TestCase):
    def test_classify_sequence_hospital_folders(self):
        cases = [
            ("Localizers_1/IM0001.jpg", "IGNORED"),
            ("Sag_T1_FLAIR_7/IM0012.jpg", "T1_FLAIR", "sagittal"),
            ("Ax_T2_FLAIR_FS_3/IM0018.jpg", "T2_FLAIR", "axial"),
            ("COR_T2_6/IM0010.jpg", "T2_CORONAL", "coronal"),
            ("3D_Ax_TOF_SPGR_FS_8/IM0022.jpg", "TOF_MRA", "axial"),
            ("ADC_(10_6_mm2_s)_550/IM0009.jpg", "ADC", "unknown"),
            ("Ax_DWI_ALL_b1000_5/IM0015.jpg", "DWI", "axial"),
            ("Ax_T2_FGRE_4/IM0011.jpg", "T2W", "axial"),
        ]
        for rel_path, *expected in cases:
            seq_type, plane, reason = study_triage.classify_sequence(rel_path)
            self.assertEqual(seq_type, expected[0], msg=f"{rel_path} got {seq_type}/{plane}")
            if len(expected) > 1:
                self.assertEqual(plane, expected[1], msg=f"{rel_path} plane got {plane}")
            if expected[0] == "IGNORED":
                self.assertTrue(bool(reason))

    def test_assess_slice_quality_filters_blank_and_rim(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            blank_path = os.path.join(tmpdir, "blank.jpg")
            rim_path = os.path.join(tmpdir, "rim.jpg")
            good_path = os.path.join(tmpdir, "good.jpg")

            _make_mri_phantom_image(blank_path, blank=True)
            _make_mri_phantom_image(rim_path, rim_only=True)
            _make_mri_phantom_image(good_path)

            ok_blank, _, reason_blank = study_triage.assess_slice_quality(cv2.imread(blank_path))
            self.assertFalse(ok_blank)
            self.assertIsNotNone(reason_blank)

            ok_rim, _, reason_rim = study_triage.assess_slice_quality(cv2.imread(rim_path))
            self.assertFalse(ok_rim)
            self.assertIsNotNone(reason_rim)

            ok_good, ratio_good, reason_good = study_triage.assess_slice_quality(cv2.imread(good_path))
            self.assertTrue(ok_good, msg=f"unexpected reject: {reason_good}")
            self.assertGreater(ratio_good, 0.20)

    def test_extract_zip_safely_sanitizes_zip_slip_and_enforces_limits(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            zip_path = os.path.join(tmpdir, "study.zip")
            dest_dir = os.path.join(tmpdir, "out")

            img_src = os.path.join(tmpdir, "src.jpg")
            _make_mri_phantom_image(img_src)
            with open(img_src, "rb") as f:
                jpg_bytes = f.read()

            with zipfile.ZipFile(zip_path, "w") as zf:
                zf.writestr("../../etc/Ax_T2_FLAIR_FS_3/IM0001.jpg", jpg_bytes)
                zf.writestr("Sag_T1_FLAIR_7/IM0002.jpg", jpg_bytes)
                zf.writestr("notes/readme.txt", b"non-image text")

            extracted = study_triage.extract_zip_safely(zip_path, dest_dir)
            self.assertEqual(len(extracted), 2)
            dest_abs = os.path.abspath(dest_dir)
            for abs_path, rel_path in extracted:
                self.assertTrue(os.path.abspath(abs_path).startswith(dest_abs + os.sep))
                self.assertNotIn("..", rel_path)

            with self.assertRaises(ValueError):
                study_triage.extract_zip_safely(zip_path, dest_dir, max_files=1)

    def test_triage_study_slices_funnel_and_diverse_top_k(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            entries = []
            # 2 ignored localizer slices
            for i in range(2):
                p = os.path.join(tmpdir, f"loc_{i}.jpg")
                _make_mri_phantom_image(p)
                entries.append({"absPath": p, "relativePath": f"Localizers_1/IM000{i+1}.jpg"})

            # 2 empty/blank slices in diagnostic series
            for i in range(2):
                p = os.path.join(tmpdir, f"empty_{i}.jpg")
                _make_mri_phantom_image(p, blank=True)
                entries.append({"absPath": p, "relativePath": f"Ax_T2_FLAIR_FS_3/IM009{i+1}.jpg"})

            # Valid slices spread across 3 diagnostic series (6 each = 18 valid)
            for series in ["Ax_T2_FLAIR_FS_3", "Sag_T1_FLAIR_7", "COR_T2_6"]:
                for i in range(6):
                    p = os.path.join(tmpdir, f"{series}_{i}.jpg")
                    _make_mri_phantom_image(p)
                    entries.append({"absPath": p, "relativePath": f"{series}/IM000{i+1}.jpg"})

            result = study_triage.triage_study_slices(
                entries,
                resnet_model=None,
                yolo_model=None,
                protocol_code="BRAIN_ROUTINE",
                top_k=6,
                candidate_limit=15,
            )

            summary = result["summary"]
            self.assertEqual(summary["totalFiles"], 22)
            self.assertEqual(summary["ignoredSequenceCount"], 2)
            self.assertEqual(summary["invalidSliceCount"], 2)
            self.assertEqual(summary["analyzedCount"], 18)

            candidates = result["candidates"]
            self.assertEqual(len(candidates), 15)
            self.assertEqual(summary["candidateCount"], 15)
            self.assertEqual(summary["preselectedCount"], 6)
            preselected = [c for c in candidates if c.get("preselected")]
            self.assertEqual(len(preselected), 6)
            preselected_series = {c["seriesName"] for c in preselected}
            self.assertGreaterEqual(len(preselected_series), 2)

    def test_gradcam_privacy_guard_honors_plane_hint_path(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            uuid_img = os.path.join(tmpdir, "9c3a7d1e8b24.jpg")
            _make_mri_phantom_image(uuid_img)
            img_arr = np.zeros((1, 224, 224, 3), dtype=np.float32)
            fake_heatmap = np.ones((224, 224), dtype=np.float32) * 0.8

            gemini_spy = mock.MagicMock()
            gemini_spy.models = mock.MagicMock()
            gemini_spy.models.generate_content.side_effect = RuntimeError("mock-gemini-invoked")

            with mock.patch.object(localization, "_compute_heatmap", return_value=fake_heatmap):
                # 1. Sagittal hint MUST block Gemini Privacy Guard even when uuid filename has no plane hint
                localization.generate_gradcam_localization(
                    model=object(),
                    img_array=img_arr,
                    file_path=uuid_img,
                    predicted_class="glioma",
                    class_idx=0,
                    confidence=95.0,
                    gemini_client=gemini_spy,
                    plane_hint_path="Sag_T1_FLAIR_7/IM0012.jpg",
                )
                self.assertEqual(gemini_spy.models.generate_content.call_count, 0)

                # 2. Axial hint MUST allow Gemini call to be attempted
                localization.generate_gradcam_localization(
                    model=object(),
                    img_array=img_arr,
                    file_path=uuid_img,
                    predicted_class="glioma",
                    class_idx=0,
                    confidence=95.0,
                    gemini_client=gemini_spy,
                    plane_hint_path="Ax_T2_FLAIR_FS_3/IM0012.jpg",
                )
                self.assertEqual(gemini_spy.models.generate_content.call_count, 1)


class StudyTriageAiRegressionTests(unittest.TestCase):
    def test_yolo_ignores_no_tumor_and_resnet_scales_to_minus_one_one(self):
        import os
        import tempfile
        import cv2
        import numpy as np
        import torch
        from study_triage import triage_study_slices

        class DummyBox:
            def __init__(self, cls_id, conf):
                self.cls = [torch.tensor(cls_id)]
                self.conf = [torch.tensor(conf)]
                self.xywh = [torch.tensor([112.0, 112.0, 200.0, 200.0])]

        class DummyRes:
            def __init__(self, cls_id, conf):
                self.names = {0: "glioma", 1: "meningioma", 2: "no tumor", 3: "pituitary"}
                self.boxes = [DummyBox(cls_id, conf)]

        class DummyYolo:
            def __call__(self, paths, conf=0.14, verbose=False):
                return [DummyRes(2 if "notumor" in p else 0, 0.92) for p in paths]

        seen_ranges = []

        class DummyResnet:
            def predict(self, batch_arr, verbose=0):
                seen_ranges.append((float(batch_arr.min()), float(batch_arr.max())))
                return np.array([[0.90, 0.05, 0.03, 0.02] for _ in range(len(batch_arr))], dtype=np.float32)

        with tempfile.TemporaryDirectory() as d:
            img = np.zeros((224, 224, 3), dtype=np.uint8)
            cv2.circle(img, (112, 112), 70, (180, 180, 180), -1)
            p_no = os.path.join(d, "notumor_01.jpg")
            p_gl = os.path.join(d, "glioma_01.jpg")
            cv2.imwrite(p_no, img)
            cv2.imwrite(p_gl, img)

            report = triage_study_slices(
                [
                    {"absPath": p_no, "relativePath": "T2/notumor_01.jpg", "sliceKey": "k_no"},
                    {"absPath": p_gl, "relativePath": "T2/glioma_01.jpg", "sliceKey": "k_gl"},
                ],
                resnet_model=DummyResnet(),
                yolo_model=DummyYolo(),
                categories=["glioma", "meningioma", "notumor", "pituitary"],
            )

        self.assertTrue(len(seen_ranges) >= 1)
        for lo, hi in seen_ranges:
            self.assertGreaterEqual(lo, -1.01)
            self.assertLessEqual(hi, 1.01)

        by_key = {item["sliceKey"]: item for item in report["candidates"]}
        self.assertFalse(by_key["k_no"]["yoloDetected"])
        self.assertIsNone(by_key["k_no"]["boundingBox"])
        self.assertTrue(by_key["k_gl"]["yoloDetected"])
        self.assertEqual(by_key["k_gl"]["yoloClass"], "glioma")

    def test_study_diagnosis_summary_majority_and_bounded_gemini(self):
        """60 slices with 50 glioma + 10 notumor -> full-folder dominantClass is glioma (50/60 = 83.3%) and Gemini is bounded."""
        from study_triage import triage_study_slices

        def fake_preprocess(path: str) -> np.ndarray:
            if "glioma_" in path:
                return np.full((224, 224, 3), 240.0, dtype=np.float32)
            if "conflict_" in path:
                return np.full((224, 224, 3), 150.0, dtype=np.float32)
            return np.full((224, 224, 3), 40.0, dtype=np.float32)

        class DummyCNN:
            def predict(self, batch_arr, verbose=0):
                out = []
                for arr in batch_arr:
                    val = float(arr.mean())
                    if val >= 200.0:
                        # High-confidence glioma (no conflict with YOLO glioma)
                        out.append([0.92, 0.03, 0.03, 0.02])
                    elif val >= 100.0:
                        # Moderate-confidence glioma (<0.80) so YOLO meningioma triggers conflict
                        out.append([0.72, 0.14, 0.07, 0.07])
                    else:
                        out.append([0.03, 0.03, 0.91, 0.03])
                return np.array(out, dtype=np.float32)

        class DummyYoloConflict:
            def __call__(self, paths, conf=0.14, verbose=False):
                import torch

                class Box:
                    def __init__(self, c_id, cf):
                        self.cls = [torch.tensor(c_id)]
                        self.conf = [torch.tensor(cf)]
                        self.xywh = [torch.tensor([112.0, 112.0, 90.0, 90.0])]

                class Res:
                    def __init__(self, boxes):
                        self.names = {0: "glioma", 1: "meningioma", 2: "no tumor", 3: "pituitary"}
                        self.boxes = boxes

                res = []
                for p in paths:
                    # For 12 axial glioma slices, make YOLO disagree ("meningioma") so Gemini triggers,
                    # and verify gemini_conflict_limit=5 caps calls cleanly!
                    if "conflict_" in p:
                        res.append(Res([Box(1, 0.72)]))
                    elif "glioma_" in p:
                        res.append(Res([Box(0, 0.91)]))
                    else:
                        res.append(Res([]))
                return res

        gemini_calls = []

        def fake_gemini(item):
            gemini_calls.append(item["relativePath"])
            return {
                "predictedClass": "glioma",
                "confidence": 93.0,
                "consensusMessage": "Gemini VLM xác nhận glioma",
            }

        with tempfile.TemporaryDirectory() as d:
            entries = []
            # 38 clear axial glioma + 12 conflict axial glioma = 50 glioma total
            for i in range(38):
                p = os.path.join(d, f"glioma_{i:02d}.jpg")
                img = np.zeros((224, 224, 3), dtype=np.uint8)
                cv2.circle(img, (112, 112), 95, (235, 235, 235), -1)
                cv2.imwrite(p, img)
                entries.append({"absPath": p, "relativePath": f"Ax_T2_FLAIR_3/IM{i:03d}.jpg", "sliceKey": f"g_{i}"})

            for i in range(12):
                p = os.path.join(d, f"conflict_{i:02d}.jpg")
                img = np.zeros((224, 224, 3), dtype=np.uint8)
                cv2.circle(img, (112, 112), 95, (235, 235, 235), -1)
                cv2.imwrite(p, img)
                entries.append({"absPath": p, "relativePath": f"Ax_T2_FLAIR_3/IM{100+i:03d}.jpg", "sliceKey": f"c_{i}"})

            # 10 notumor slices (smaller skull ring, lower intensity but valid brain_ratio)
            for i in range(10):
                p = os.path.join(d, f"notumor_{i:02d}.jpg")
                img = np.zeros((224, 224, 3), dtype=np.uint8)
                cv2.circle(img, (112, 112), 70, (65, 65, 65), -1)
                cv2.imwrite(p, img)
                entries.append({"absPath": p, "relativePath": f"Ax_T2_FLAIR_3/IM{200+i:03d}.jpg", "sliceKey": f"n_{i}"})

            report = triage_study_slices(
                entries,
                resnet_model=DummyCNN(),
                efficientnet_model=DummyCNN(),
                densenet_model=DummyCNN(),
                yolo_model=DummyYoloConflict(),
                categories=["glioma", "meningioma", "notumor", "pituitary"],
                preprocess_fn=fake_preprocess,
                resnet_input_fn=lambda x: x,
                efficientnet_input_fn=lambda x: x,
                densenet_input_fn=lambda x: x,
                top_k=10,
                candidate_limit=120,
                gemini_arbitrate_fn=fake_gemini,
                gemini_conflict_limit=5,
            )

        self.assertEqual(len(gemini_calls), 5)
        diag = report["studyDiagnosisSummary"]
        self.assertEqual(diag["totalAnalyzed"], 60)
        self.assertEqual(diag["dominantClass"], "glioma")
        self.assertEqual(diag["dominantCount"], 50)
        self.assertAlmostEqual(diag["dominantPctOfTotal"], 83.3, places=1)
        self.assertEqual(diag["classCounts"]["glioma"], 50)
        self.assertEqual(diag["classCounts"]["notumor"], 10)
        self.assertEqual(diag["conflictSlicesCount"], 12)
        self.assertEqual(diag["geminiArbitratedCount"], 5)
        # Sagittal conflicts must NOT invoke Gemini
        sag_calls = []
        with tempfile.TemporaryDirectory() as d2:
            p = os.path.join(d2, "conflict_sag.jpg")
            img = np.zeros((224, 224, 3), dtype=np.uint8)
            cv2.circle(img, (112, 112), 95, (235, 235, 235), -1)
            cv2.imwrite(p, img)
            triage_study_slices(
                [{"absPath": p, "relativePath": "Sag_T1_7/IM0001.jpg", "sliceKey": "sag_1"}],
                resnet_model=DummyCNN(),
                yolo_model=DummyYoloConflict(),
                categories=["glioma", "meningioma", "notumor", "pituitary"],
                preprocess_fn=fake_preprocess,
                resnet_input_fn=lambda x: x,
                gemini_arbitrate_fn=lambda it: sag_calls.append(it) or {"predictedClass": "glioma", "confidence": 95.0},
                gemini_conflict_limit=5,
            )
        self.assertEqual(len(sag_calls), 0)


if __name__ == "__main__":
    unittest.main()
