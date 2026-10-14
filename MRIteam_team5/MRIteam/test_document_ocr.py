"""
Test cho document_ocr.py (phần không cần Gemini): dò mép giấy, nắn thẳng, kiểm ảnh, làm sạch kết quả AI.
Chạy:  cd MRIteam_team5/MRIteam && ./venv/Scripts/python.exe -m unittest test_document_ocr -v
"""
import base64
import io
import time
import unittest

import cv2
import numpy as np
from PIL import Image

import document_ocr as ocr


def make_page(width=600, height=850, paper=(250, 249, 244)):
    """Tờ giấy trắng có các dòng 'chữ' màu tối."""
    page = np.full((height, width, 3), paper, np.uint8)
    for y in range(70, height - 60, 34):
        cv2.line(page, (50, y), (width - 50 - (y * 7) % 180, y), (40, 40, 40), 5)
    return page


def place_on_background(page, bg_color=(70, 78, 90), canvas=(1200, 1000), corners=None):
    """Đặt tờ giấy lên nền, méo phối cảnh như ảnh chụp tay. Trả (ảnh, 4 góc tờ giấy)."""
    ch, cw = canvas
    h, w = page.shape[:2]
    corners = np.float32(corners if corners is not None else [[230, 110], [760, 170], [800, 1000], [150, 960]])
    src = np.float32([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]])
    matrix = cv2.getPerspectiveTransform(src, corners)
    bg = np.full((ch, cw, 3), bg_color, np.uint8)
    noise = np.random.default_rng(7).integers(-8, 8, bg.shape, dtype=np.int16)
    bg = np.clip(bg.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    warped = cv2.warpPerspective(page, matrix, (cw, ch))
    mask = cv2.warpPerspective(np.full((h, w), 255, np.uint8), matrix, (cw, ch))
    bg[mask > 0] = warped[mask > 0]
    return bg, corners


def to_jpeg(bgr, **save):
    buf = io.BytesIO()
    Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)).save(buf, format="JPEG", quality=90, **save)
    return buf.getvalue()


class FindDocumentTest(unittest.TestCase):
    def test_skewed_paper_on_dark_background_is_cropped_and_straightened(self):
        photo, corners = place_on_background(make_page())
        quad = ocr.find_document_quad(photo)
        self.assertIsNotNone(quad)
        # 4 góc tìm được lệch không quá 15 px so với góc thật
        self.assertLess(float(np.abs(quad - ocr._order_corners(corners)).max()), 15.0)
        out, cropped = ocr.rectify_document(photo)
        self.assertTrue(cropped)
        h, w = out.shape[:2]
        self.assertAlmostEqual(w / h, 600 / 850, delta=0.08)  # về lại đúng tỉ lệ tờ giấy
        # nền tối đã bị cắt hết: 4 góc ảnh kết quả đều là màu giấy
        for patch in (out[:12, :12], out[:12, -12:], out[-12:, :12], out[-12:, -12:]):
            self.assertGreater(float(patch.mean()), 200.0)

    def test_beige_paper_on_wooden_table_with_shadow(self):
        page = make_page(paper=(205, 215, 225))  # giấy ngả vàng (BGR)
        photo, _ = place_on_background(page, bg_color=(45, 75, 120), corners=[[180, 140], [820, 120], [860, 1010], [140, 1030]])
        shadow = np.linspace(1.0, 0.8, photo.shape[1], dtype=np.float32)[None, :, None]  # tối dần sang phải
        photo = np.clip(photo.astype(np.float32) * shadow, 0, 255).astype(np.uint8)
        out, cropped = ocr.rectify_document(photo)
        self.assertTrue(cropped)
        self.assertGreater(float(out[:12, :12].mean()), 150.0)

    def test_page_filling_the_frame_is_left_alone(self):
        page = make_page()
        out, cropped = ocr.rectify_document(page)
        self.assertFalse(cropped)
        self.assertEqual(out.shape, page.shape)

    def test_table_box_inside_a_full_page_is_not_mistaken_for_the_paper(self):
        # Giấy kín khung hình, bên trong có 1 ô bảng lớn viền đậm: cắt theo ô này sẽ mất chữ bên ngoài
        page = make_page(width=900, height=1200)
        cv2.rectangle(page, (120, 300), (780, 950), (30, 30, 30), 6)
        out, cropped = ocr.rectify_document(page)
        self.assertFalse(cropped)
        self.assertEqual(out.shape, page.shape)

    def test_photo_without_any_paper_is_left_alone(self):
        rng = np.random.default_rng(3)
        photo = cv2.GaussianBlur(rng.integers(0, 255, (900, 1200, 3), dtype=np.uint8), (31, 31), 0)
        _, cropped = ocr.rectify_document(photo)
        self.assertFalse(cropped)


class NormalizeTest(unittest.TestCase):
    def test_output_is_jpeg_without_exif_and_autocrop_can_be_turned_off(self):
        photo, _ = place_on_background(make_page())
        exif = Image.Exif()
        exif[0x010F] = "TestPhone"
        exif.get_ifd(0x8825)[1] = "N"
        raw = to_jpeg(photo, exif=exif)
        self.assertIn(b"TestPhone", raw)

        img, cropped = ocr.normalize(raw, autocrop=True)
        self.assertTrue(cropped)
        saved = base64.b64decode(ocr.to_jpeg_base64(img))
        self.assertEqual(saved[:3], b"\xff\xd8\xff")
        self.assertNotIn(b"Exif", saved)
        self.assertNotIn(b"TestPhone", saved)

        full, cropped_off = ocr.normalize(raw, autocrop=False)
        self.assertFalse(cropped_off)
        self.assertEqual(full.size, (photo.shape[1], photo.shape[0]))

    def test_jpeg_comment_is_not_carried_into_the_stored_image(self):
        raw = to_jpeg(make_page(), comment=b"ghi chu bi mat cua may anh")
        self.assertIn(b"ghi chu bi mat", raw)
        img, _ = ocr.normalize(raw, autocrop=False)
        self.assertNotIn(b"ghi chu bi mat", base64.b64decode(ocr.to_jpeg_base64(img)))

    def test_very_thin_or_tiny_images_do_not_crash_the_paper_detection(self):
        for size in ((1, 3000), (3000, 1), (1, 1), (2, 2), (40, 1700)):
            img, cropped = ocr.normalize(to_jpeg(np.full((size[1], size[0], 3), 200, np.uint8)), autocrop=True)
            self.assertFalse(cropped, size)
            self.assertEqual(img.size, size if max(size) <= ocr.MAX_SIDE else img.size)

    def test_large_photo_is_downscaled(self):
        big = cv2.resize(make_page(), (2400, 3400))
        img, _ = ocr.normalize(to_jpeg(big), autocrop=False)
        self.assertLessEqual(max(img.size), ocr.MAX_SIDE)

    def test_pixel_bomb_and_non_images_are_rejected(self):
        buf = io.BytesIO()
        Image.new("RGB", (9000, 9000), (250, 250, 250)).save(buf, format="PNG")
        self.assertLess(len(buf.getvalue()), 1024 * 1024)  # file nhỏ nhưng 81 triệu điểm ảnh
        with self.assertRaises(Exception):
            ocr.normalize(buf.getvalue())
        with self.assertRaises(Exception):
            ocr.normalize(b"%PDF-1.7 not an image")
        gif = io.BytesIO()
        Image.new("RGB", (50, 50)).save(gif, format="GIF")
        with self.assertRaises(Exception):
            ocr.normalize(gif.getvalue())  # chỉ nhận JPEG/PNG/WEBP


class CleanFieldsTest(unittest.TestCase):
    def test_keeps_valid_fields_and_caps_lengths(self):
        out = ocr.clean_fields({
            "docType": "prescription", "date": "10/10/2026", "facility": "PK An Bình", "doctor": "BS. Mẫu", "diagnosis": "Tăng huyết áp",
            "medications": [{"name": "Amlodipin 5mg", "quantity": "30 viên", "usage": "Sáng 1 viên"}, {"name": "", "quantity": "5"}, "rác"],
        })
        self.assertEqual(out["docType"], "prescription")
        self.assertEqual(out["medications"], [{"name": "Amlodipin 5mg", "quantity": "30 viên", "usage": "Sáng 1 viên"}])
        long = ocr.clean_fields({"facility": "x" * 999, "medications": [{"name": f"t{i}"} for i in range(100)]})
        self.assertEqual(len(long["facility"]), 200)
        self.assertEqual(len(long["medications"]), ocr.MAX_MEDICATIONS)

    def test_wrong_shapes_from_the_model_never_crash(self):
        empty = {"docType": "other", "date": "", "facility": "", "doctor": "", "diagnosis": "", "medications": []}
        for bad in (None, "text", 5, [], {"docType": "virus", "date": {"a": 1}, "medications": "none", "doctor": ["x"], "diagnosis": True}):
            self.assertEqual(ocr.clean_fields(bad), empty)


class ReadDocumentTest(unittest.TestCase):
    """Đọc chữ phải chịu được lỗi tạm thời của Gemini và giấy tờ không khớp mẫu: cùng lắm thì chỉ lấy phần chữ."""

    GOOD = '{"title": "Đơn thuốc", "text": "Amlodipin 5mg", "fields": {"docType": "prescription"}}'

    def run_with(self, script, models=("chinh", "du-phong-1", "du-phong-2"), seconds_per_call=1.0):
        """script: danh sách kết quả lần lượt (chuỗi = model trả về, Exception = model lỗi)."""
        calls, pauses, now = [], [], [0.0]

        def generate(model, structured, timeout_ms):
            calls.append((model, structured, timeout_ms))
            now[0] += seconds_per_call
            step = script[len(calls) - 1] if len(calls) <= len(script) else RuntimeError("hết kịch bản")
            if isinstance(step, Exception):
                raise step
            return step

        def sleep(seconds):
            pauses.append(seconds)
            now[0] += seconds

        try:
            result = ocr.read_document(generate, list(models), clock=lambda: now[0], sleep=sleep)
        except Exception as e:  # noqa: BLE001 - test cần cả trường hợp thất bại
            result = e
        self.pauses = pauses
        return result, calls

    def test_first_try_succeeds_with_structured_info(self):
        result, calls = self.run_with([self.GOOD])
        self.assertEqual(result["text"], "Amlodipin 5mg")
        self.assertEqual(result["fields"]["docType"], "prescription")
        self.assertFalse(result["text_only"])
        self.assertEqual(calls, [("chinh", True, 13000)])
        self.assertEqual(self.pauses, [])

    def test_temporary_server_error_retries_the_main_model_after_a_short_pause(self):
        # Model chính là model duy nhất đọc tốt mẫu có dòng chấm: lỗi tạm thời (503) thì thử lại CHÍNH NÓ, không đổi model ngay
        result, calls = self.run_with([RuntimeError("503 UNAVAILABLE"), self.GOOD])
        self.assertFalse(result["text_only"])
        self.assertEqual([(c[0], c[1]) for c in calls], [("chinh", True), ("chinh", True)])
        self.assertEqual(self.pauses, [1.5])

    def test_document_that_does_not_fit_the_form_is_still_saved_as_plain_text(self):
        # JSON hỏng / bị cắt giữa chừng -> bỏ phần cấu trúc, chỉ chép chữ
        # (gọi lại y hệt với temperature=0 sẽ hỏng y hệt, nên KHÔNG thử lại bản có cấu trúc: đỡ tốn 1 lượt AI)
        result, calls = self.run_with(['{"title": "Bệnh án", "text": "I. HÀNH CHÍ', "I. HÀNH CHÍNH\no Họ và tên: ...................."])
        self.assertTrue(result["text_only"])
        self.assertEqual(result["text"], "I. HÀNH CHÍNH\no Họ và tên: ......")
        self.assertEqual(result["fields"]["docType"], "other")
        self.assertEqual(result["fields"]["medications"], [])
        self.assertEqual([(c[0], c[1]) for c in calls], [("chinh", True), ("chinh", False)])

    def test_runaway_dots_from_a_weaker_model_are_rejected_not_saved_as_a_half_document(self):
        # Model dự phòng mắc kẹt lặp dấu chấm tới hết giới hạn (thực tế: 130.000 ký tự) -> coi là hỏng, thử model kế tiếp
        runaway = "BỆNH ÁN NGOẠI KHOA\nSố lưu trữ: " + "." * 60000
        result, calls = self.run_with([RuntimeError("503")] * 3 + [runaway, "BỆNH ÁN NGOẠI KHOA\nI. HÀNH CHÍNH\nVII. HƯỚNG ĐIỀU TRỊ"])
        self.assertTrue(result["text_only"])
        self.assertIn("VII. HƯỚNG ĐIỀU TRỊ", result["text"])
        self.assertEqual([(c[0], c[1]) for c in calls][3:], [("du-phong-1", False), ("du-phong-2", False)])
        self.assertTrue(ocr.is_runaway(runaway))
        self.assertTrue(ocr.is_runaway('{"title": "x", "text": "Số: ' + "." * 60000))
        self.assertFalse(ocr.is_runaway("Họ tên: " + "." * 80 + "\nTuổi: " + "." * 30))  # mẫu có dòng chấm bình thường
        self.assertFalse(ocr.is_runaway("a" * 15000))  # giấy tờ dài thật

    def test_everything_failing_raises_so_the_patient_can_type_by_hand(self):
        result, calls = self.run_with([RuntimeError("x")] * 9)
        self.assertIsInstance(result, Exception)
        self.assertEqual([(c[0], c[1]) for c in calls], [("chinh", True), ("chinh", True), ("chinh", False), ("du-phong-1", False), ("du-phong-2", False)])

    def test_total_time_stays_inside_the_backend_timeout_and_leaves_time_for_plain_text(self):
        # mọi lần gọi đều treo tới hết thời gian chờ: tổng không vượt 38 giây (backend chờ tối đa 45 giây),
        # và lần "chỉ lấy chữ" vẫn còn hơn 10 giây chứ không bị 2 lần đầu ăn hết
        calls, now = [], [0.0]

        def hang(model, structured, timeout_ms):
            calls.append((model, structured, timeout_ms))
            now[0] += timeout_ms / 1000
            raise RuntimeError("timeout")

        with self.assertRaises(RuntimeError):
            ocr.read_document(hang, ["chinh", "du-phong-1"], clock=lambda: now[0], sleep=lambda s: now.__setitem__(0, now[0] + s))
        self.assertEqual([(c[0], c[1]) for c in calls], [("chinh", True), ("chinh", True), ("chinh", False)])
        self.assertEqual([c[2] for c in calls], [13000, 11000, 10500])
        self.assertLessEqual(now[0], ocr.TOTAL_BUDGET_S)

    def test_tidy_text_shortens_fill_in_dots(self):
        self.assertEqual(ocr.tidy_text("Họ tên: " + "." * 80 + "  \nTuổi: " + "…" * 12 + " Giới: " + "_" * 40), "Họ tên: ......\nTuổi: ...... Giới: ______")
        self.assertEqual(ocr.tidy_text("Liều: 0.5 mg... xem tiếp"), "Liều: 0.5 mg... xem tiếp")  # dấu chấm bình thường giữ nguyên
        self.assertEqual(ocr.tidy_text("a\n\n\n\n\nb"), "a\n\nb")
        self.assertEqual(ocr.tidy_text(None), "")

    def test_tidy_text_stays_fast_on_huge_runs_of_spaces(self):
        # Model sinh dãy khoảng trắng rất dài không có xuống dòng: trước đây regex chạy bậc hai (80.000 ký tự mất ~14 giây,
        # giữ GIL nên cả AI service đứng im). Phải xong gần như tức thì.
        started = time.perf_counter()
        out = ocr.tidy_text("Họ tên: A" + " " * 80000 + "\tB  \t \nTuổi: 46 \t")
        self.assertLess(time.perf_counter() - started, 1.0)
        self.assertTrue(out.startswith("Họ tên: A"))
        self.assertLessEqual(len(out), 20000)
        self.assertEqual(ocr.tidy_text("a \t\nb\t \r\nc  "), "a\nb\nc")  # vẫn bỏ khoảng trắng cuối dòng như trước


class CompareReadingsTest(unittest.TestCase):
    """So 2 lần đọc độc lập: chỗ nào khác nhau là chỗ bệnh nhân cần nhìn lại ảnh."""

    A = "ĐƠN THUỐC\nHọ tên: TRẦN VĂN MẪU  Tuổi: 46\n1. Amlodipin 5mg — 30 viên\nUống sáng 1 viên sau ăn"

    def test_identical_readings_have_nothing_to_check(self):
        r = ocr.compare_readings(self.A, self.A)
        self.assertEqual(r["checks"], [])
        self.assertFalse(r["too_many"])

    def test_layout_only_differences_are_ignored(self):
        # xuống dòng khác, thừa khoảng trắng, dãy chấm dài ngắn khác nhau, dấu câu cuối từ: không phải khác biệt về nội dung
        other = "ĐƠN THUỐC Họ tên: TRẦN VĂN MẪU Tuổi: 46 ............\n\n1. Amlodipin 5mg — 30 viên.\nUống sáng 1 viên sau ăn"
        self.assertEqual(ocr.compare_readings(self.A, other)["checks"], [])

    def test_a_different_dose_is_flagged_at_its_exact_position(self):
        other = self.A.replace("5mg", "50mg")
        r = ocr.compare_readings(self.A, other)
        self.assertEqual(len(r["checks"]), 1)
        c = r["checks"][0]
        self.assertEqual((c["primary"], c["other"]), ("5mg", "50mg"))
        self.assertEqual(self.A[c["start"]:c["end"]], "5mg")  # vị trí để giao diện bôi chọn đúng chỗ trong ô chữ

    def test_decimal_and_number_changes_are_never_treated_as_punctuation(self):
        r = ocr.compare_readings("Glucose 5,6 mmol/L", "Glucose 5.6 mmol/L")
        self.assertEqual([(c["primary"], c["other"]) for c in r["checks"]], [("5,6", "5.6")])
        r = ocr.compare_readings("Huyết áp 120/80", "Huyết áp 130/80")
        self.assertEqual([(c["primary"], c["other"]) for c in r["checks"]], [("120/80", "130/80")])

    def test_words_only_one_reading_saw_are_flagged(self):
        r = ocr.compare_readings("Uống sáng 1 viên", "Uống sáng 1 viên sau ăn")
        self.assertEqual([(c["primary"], c["other"]) for c in r["checks"]], [("", "sau ăn")])
        self.assertEqual(r["checks"][0]["start"], r["checks"][0]["end"])  # điểm chèn ở cuối
        r = ocr.compare_readings("Uống sáng 1 viên sau ăn no", "Uống sáng 1 viên")
        self.assertEqual([(c["primary"], c["other"]) for c in r["checks"]], [("sau ăn no", "")])

    def test_several_differences_keep_document_order_and_valid_positions(self):
        a = "Paracetamol 500mg 20 viên\nAmlodipin 5mg 30 viên\nMagnesi B6 60 viên"
        b = "Paracetamol 500mg 20 viên\nAmlodipin 10mg 30 viên\nMagnesi B6 80 viên"
        r = ocr.compare_readings(a, b)
        self.assertEqual([(c["primary"], c["other"]) for c in r["checks"]], [("5mg", "10mg"), ("60", "80")])
        for c in r["checks"]:
            self.assertEqual(a[c["start"]:c["end"]], c["primary"])
        self.assertLess(r["checks"][0]["start"], r["checks"][1]["start"])

    def test_readings_that_disagree_almost_everywhere_are_reported_as_a_whole(self):
        # 2 bản khác nhau quá nhiều (đọc sai thứ tự cột, ảnh quá mờ...): liệt kê từng chỗ vô nghĩa -> báo kiểm tra toàn bộ
        a = " ".join(f"từ{i}" for i in range(200))
        b = " ".join(f"chữ{i}" for i in range(200))
        r = ocr.compare_readings(a, b)
        self.assertTrue(r["too_many"])
        self.assertEqual(r["checks"], [])
        many = ocr.compare_readings(" ".join(f"a{i} giống" for i in range(60)), " ".join(f"b{i} giống" for i in range(60)))
        self.assertTrue(many["too_many"])  # hơn 30 chỗ lẻ tẻ cũng vậy

    def test_repeated_words_cannot_make_the_comparison_run_for_minutes(self):
        # Chữ lặp + 1 loại từ chỉ 1 lần đọc thấy: thuật toán cũ (difflib) chạy bậc ba, 1000 cặp mất hơn 1 phút và giữ GIL.
        started = time.perf_counter()
        r = ocr.compare_readings("x y " * 1900, "x " * 1900)
        self.assertLess(time.perf_counter() - started, 3.0)
        self.assertTrue(r["too_many"])
        started = time.perf_counter()
        r = ocr.compare_readings(" ".join(["a"] * 3900), " ".join(["a"] * 3700 + ["b"] * 200))
        self.assertLess(time.perf_counter() - started, 3.0)
        self.assertIn("too_many", r)

    def test_long_document_with_a_few_differences_still_lists_each_one(self):
        words = [f"từ{i % 97}" for i in range(3000)]  # dài, nhiều từ lặp như giấy tờ thật
        other = list(words)
        other[10], other[1500], other[2990] = "6,8", "58", "0,46"
        a, b = " ".join(words), " ".join(other)
        started = time.perf_counter()
        r = ocr.compare_readings(a, b)
        self.assertLess(time.perf_counter() - started, 3.0)
        self.assertFalse(r["too_many"])
        self.assertEqual([c["other"] for c in r["checks"]], ["6,8", "58", "0,46"])
        for c, i in zip(r["checks"], (10, 1500, 2990)):
            self.assertEqual(a[c["start"]:c["end"]], words[i])

    def test_every_difference_found_turns_one_reading_into_the_other(self):
        # Kiểm tra tính đúng của phép so trên 300 cặp ngẫu nhiên (seed cố định): thay các đoạn khác nhau vào bản A phải ra đúng bản B
        import random

        rng = random.Random(20261013)
        vocab = ["Glucose", "6,8", "mmol/L", "viên", "sáng", "5mg", "10mg", "x", "x", "x", "ALT", "58", "U/L"]
        for _ in range(300):
            a = [rng.choice(vocab) for _ in range(rng.randint(0, 60))]
            b = list(a)
            for _ in range(rng.randint(0, 6)):
                at = rng.randint(0, len(b))
                kind = rng.choice("thay thêm bớt".split())
                if kind == "thêm":
                    b.insert(at, rng.choice(vocab))
                elif b and at < len(b):
                    if kind == "bớt":
                        del b[at]
                    else:
                        b[at] = rng.choice(vocab)
            runs, edits = ocr._diff_runs(a, b, ocr.MAX_EDIT_WORDS)
            rebuilt, pos = [], 0
            for i1, i2, j1, j2 in runs:
                self.assertTrue(i2 > i1 or j2 > j1)
                self.assertGreaterEqual(i1, pos)  # theo thứ tự, không chồng nhau
                rebuilt += a[pos:i1] + b[j1:j2]
                pos = i2
            self.assertEqual(rebuilt + a[pos:], b)
            self.assertEqual(edits, sum((i2 - i1) + (j2 - j1) for i1, i2, j1, j2 in runs))
        self.assertIsNone(ocr._diff_runs(["a"] * 10, ["b"] * 10, 5))  # vượt trần thì dừng, không so tiếp

    def test_long_fragments_are_shortened_and_empty_inputs_do_not_crash(self):
        r = ocr.compare_readings("đầu " + "x" * 400 + " cuối", "đầu " + "y" * 400 + " cuối")
        self.assertLessEqual(len(r["checks"][0]["primary"]), 120)
        self.assertLessEqual(len(r["checks"][0]["other"]), 120)
        for a, b in (("", ""), ("abc", ""), ("", "abc"), (None, "x")):
            self.assertIn("checks", ocr.compare_readings(a, b))


class VerifyReadingTest(unittest.TestCase):
    def run_check(self, script, primary="Amlodipin 5mg 30 viên"):
        calls, pauses = [], []

        def generate_check(timeout_ms):
            calls.append(timeout_ms)
            step = script[len(calls) - 1]
            if isinstance(step, Exception):
                raise step
            return step

        review = ocr.verify_reading(primary, generate_check, sleep=pauses.append)
        return review, calls, pauses

    def test_second_reading_that_agrees_marks_the_text_as_cross_checked(self):
        review, calls, _ = self.run_check(["Amlodipin 5mg\n30 viên"])
        self.assertEqual(review, {"verified": True, "too_many": False, "checks": []})
        self.assertEqual(len(calls), 1)

    def test_second_reading_that_differs_returns_the_spots_to_check(self):
        review, _, _ = self.run_check(["Amlodipin 50mg 30 viên"])
        self.assertTrue(review["verified"])
        self.assertEqual([(c["primary"], c["other"]) for c in review["checks"]], [("5mg", "50mg")])

    def test_failed_second_reading_is_retried_once_then_reported_as_not_cross_checked(self):
        review, calls, pauses = self.run_check([RuntimeError("503"), "Amlodipin 5mg 30 viên"])
        self.assertTrue(review["verified"])
        self.assertEqual((len(calls), pauses), (2, [1.5]))
        review, calls, _ = self.run_check([RuntimeError("503"), RuntimeError("503")])
        self.assertEqual(review, {"verified": False, "too_many": False, "checks": []})  # không chặn việc lưu, chỉ báo chưa kiểm tra chéo
        self.assertEqual(len(calls), 2)

    def test_runaway_or_empty_second_reading_is_not_trusted(self):
        review, _, _ = self.run_check(["Số: " + "." * 60000, ""])
        self.assertFalse(review["verified"])


class EnhanceTest(unittest.TestCase):
    def test_second_view_is_a_different_rendering_of_the_same_page(self):
        img = Image.fromarray(cv2.cvtColor(make_page(), cv2.COLOR_BGR2RGB))
        view = ocr.enhance_for_reading(img)
        self.assertEqual(view.size, img.size)
        self.assertEqual(view.mode, "RGB")
        self.assertFalse(np.array_equal(np.asarray(view), np.asarray(img)))  # thật sự là 1 góc nhìn khác, không phải bản sao


class QualityTest(unittest.TestCase):
    """Ảnh quá mờ / quá nhỏ / quá tối: model không ghi [không đọc được] mà BỊA ra chữ và số nghe hợp lý
    (đã đo thật: Glucose 6,8 thành 8.8, tên bệnh viện khác hẳn). Phải chặn từ trước khi đọc."""

    @staticmethod
    def pil(bgr):
        return Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))

    def test_clear_page_is_good(self):
        q = ocr.assess_quality(self.pil(cv2.resize(make_page(), (1000, 1400))))
        self.assertEqual((q["level"], q["reasons"]), ("good", []))

    def test_heavy_blur_is_poor(self):
        q = ocr.assess_quality(self.pil(cv2.GaussianBlur(cv2.resize(make_page(), (1000, 1400)), (31, 31), 0)))
        self.assertEqual(q["level"], "poor")
        self.assertIn("blurry", q["reasons"])

    def test_tiny_photo_is_poor(self):
        q = ocr.assess_quality(self.pil(cv2.resize(make_page(), (300, 420))))
        self.assertEqual(q["level"], "poor")
        self.assertIn("small", q["reasons"])

    def test_dark_photo_is_poor(self):
        dark = (cv2.resize(make_page(), (1000, 1400)).astype(np.float32) * 0.4).astype(np.uint8)
        q = ocr.assess_quality(self.pil(dark))
        self.assertEqual(q["level"], "poor")
        self.assertIn("dark", q["reasons"])

    def test_slightly_soft_or_smallish_photo_is_only_a_caution(self):
        q = ocr.assess_quality(self.pil(cv2.resize(make_page(), (480, 660))))  # đọc được nhưng nên kiểm tra kỹ số
        self.assertEqual(q["level"], "fair")
        self.assertEqual(q["reasons"], ["small"])

    def test_very_narrow_image_is_not_blown_up_to_measure_sharpness(self):
        # Ảnh 50x2000 (2,5 KB) từng bị kéo thành 1000x40000 để đo độ nét: ~680 MB bộ nhớ cho mỗi yêu cầu
        for w, h in ((50, 2000), (100, 2000), (2000, 50), (1400, 2000), (4000, 3000)):
            sw, sh = ocr.quality_view_size(w, h)
            self.assertLessEqual(sw, 1000)
            self.assertLessEqual(sh, 3000)
            self.assertLessEqual(sw * sh, 3_000_000)
        self.assertEqual(ocr.quality_view_size(1400, 2000), (1000, 1429))  # ảnh thường: vẫn chuẩn hoá về bề ngang 1000 như trước
        self.assertEqual(ocr.assess_quality(Image.new("RGB", (50, 2000), (0, 0, 0)))["level"], "poor")

    def test_degenerate_images_never_crash(self):
        for size in ((1, 1), (3, 2000), (2000, 3)):
            q = ocr.assess_quality(Image.new("RGB", size, (200, 200, 200)))
            self.assertEqual(q["level"], "poor")


class PromptTest(unittest.TestCase):
    def test_both_prompts_forbid_changing_number_formats_and_guessing(self):
        for prompt in (ocr.SYSTEM_PROMPT, ocr.TEXT_PROMPT):
            self.assertIn("6,8", prompt)  # ví dụ cụ thể: không đổi 6,8 thành 6.8
            self.assertIn("[không đọc được]", prompt)
            self.assertIn(" | ", prompt)  # bảng: giữ theo hàng


if __name__ == "__main__":
    unittest.main()
