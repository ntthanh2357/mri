import pandas as pd
from scipy.stats import binom

# Doc du lieu
on_df = pd.read_csv("benchmark_guard_ON_detail.csv")
off_df = pd.read_csv("benchmark_guard_OFF_detail.csv")

# Chắc chắn rằng hai file có cùng số dòng
assert len(on_df) == len(off_df), "Hai file khong cung so luong dong!"

# Gộp dữ liệu theo index dòng (row index) để bắt cặp 1-đối-1 chính xác
merged = pd.DataFrame({
    "on_correct": on_df["correct"],
    "off_correct": off_df["correct"],
    "is_conflict": on_df["is_conflict"]  # Ca nao conflict thi xet
})

# Chi xet tren cac ca conflict (cac ca khong conflict thi ca 2 deu dung/sai giong nhau)
merged_conflict = merged[merged["is_conflict"]].dropna()

print(f"Total matched conflict cases: {len(merged_conflict)}")

# Tinh toan cac o trong bang cheo
# b: ON sai (False), OFF dung (True)
# c: ON dung (True), OFF sai (False)
# a: ca 2 cung sai
# d: ca 2 cung dung
b = len(merged_conflict[(merged_conflict["on_correct"] == False) & (merged_conflict["off_correct"] == True)])
c = len(merged_conflict[(merged_conflict["on_correct"] == True) & (merged_conflict["off_correct"] == False)])
a = len(merged_conflict[(merged_conflict["on_correct"] == False) & (merged_conflict["off_correct"] == False)])
d = len(merged_conflict[(merged_conflict["on_correct"] == True) & (merged_conflict["off_correct"] == True)])

print("\nContingency Table:")
print(f"               OFF=False   OFF=True")
print(f"ON=False (Sai)   {a:<10}  {b:<10}")
print(f"ON=True  (Dung)  {c:<10}  {d:<10}")

n_disagree = b + c
if n_disagree > 0:
    k = min(b, c)
    p_val = 2 * binom.cdf(k, n_disagree, 0.5)
    p_val = min(1.0, p_val)
else:
    p_val = 1.0

print(f"\np-value (Exact McNemar): {p_val:.6f}")

if p_val < 0.05:
    print("Conclusion: Difference is STATISTICALLY SIGNIFICANT (p < 0.05).")
else:
    print("Conclusion: Difference is NOT statistically significant (p >= 0.05).")
