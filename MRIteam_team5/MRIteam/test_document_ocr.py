"""
Test cho document_ocr.py (phần không cần Gemini): dò mép giấy, nắn thẳng, kiểm ảnh, làm sạch kết quả AI.
Chạy:  cd MRIteam_team5/MRIteam && ./venv/Scripts/python.exe -m unittest test_document_ocr -v
"""
import base64
import io
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


if __name__ == "__main__":
    unittest.main()
