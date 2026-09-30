import pandas as pd

df = pd.read_csv("MRIteam/benchmark_guard_ON_detail.csv")
gemini_rows = df[df["gemini_used"] == True]
print("Total gemini called:", len(gemini_rows))
print("Gemini correct:", gemini_rows["correct"].sum(), f"{gemini_rows['correct'].mean()*100:.2f}%")

df_off = pd.read_csv("MRIteam/benchmark_guard_OFF_detail.csv")
gemini_off = df_off[df_off["gemini_used"] == True]
print("Total gemini called (OFF):", len(gemini_off))
print("Gemini correct (OFF):", gemini_off["correct"].sum(), f"{gemini_off['correct'].mean()*100:.2f}%")
