with open("scratch/extracted_pdf_text.txt", encoding="utf-8") as f:
    pdf = f.read()

checks = [
    "Multimodal AI Consensus System (MAICS)",
    "Anatomical Privacy Guard",
    "Bayesian Test-Time Augmentation",
    "YOLOv8",
    "Gemini",
    "3,461",
    "1,861",
    "91.01%",
    "92.04%",
    "0.43%",
    "0.85%",
    "79.5%",
    "2.48%",
    "12.14%",
    "0.000009",
    "0.091",
    "86.57%",
    "64.39%",
    "96.17%",
    "96.19%",
    "0.13%",
    "0.991",
    "0.003",
    "Tam Tri Danang Hospital",
    "Table 1",
    "Table 2",
    "Table 3",
    "Table 4",
    "Fig. 1",
    "Fig. 2",
    "Fig. 3",
]

for c in checks:
    status = "FOUND" if c in pdf else "NOT FOUND"
    print(f"{c:<40} : {status}")
