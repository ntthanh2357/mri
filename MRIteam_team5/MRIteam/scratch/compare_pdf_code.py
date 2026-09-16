import pypdf
import json
import os
import re

pdf_path = r"..\Multimodal AI Consensus System (MAICS) with Risk-Calibrated Decision Support and Spatial Localization for Brain Tumor Classification (2).pdf"
reader = pypdf.PdfReader(pdf_path)

pdf_text_by_page = []
full_pdf_text = ""

for i, page in enumerate(reader.pages):
    text = page.extract_text() or ""
    pdf_text_by_page.append(text)
    full_pdf_text += f"\n=== PAGE {i+1} ===\n" + text

with open("scratch/extracted_pdf_text.txt", "w", encoding="utf-8") as f:
    f.write(full_pdf_text)

print(f"Total pages extracted: {len(reader.pages)}")
print(f"Total characters: {len(full_pdf_text)}")

# Let's inspect key numbers and claims in the PDF
print("\n--- Key Claims in PDF ---")
keywords = [
    "3,461", "1,861", "1,600", "9,309", "7,200", "5,000", "18,048", "22,785", "4,737",
    "91.01", "92.04", "0.43", "0.85", "90.31", "0.68", "79.5", "2.48", "12.14",
    "0.000009", "0.091", "86.57", "64.39", "96.17", "96.19", "0.13", "0.991", "0.003",
    "76.81", "100.0", "148.24", "75", "1.16", "23.5M", "85M", "67.44", "25.25"
]

found = {}
for kw in keywords:
    count = full_pdf_text.count(kw)
    found[kw] = count
    print(f"Keyword '{kw}': {count} occurrences")

