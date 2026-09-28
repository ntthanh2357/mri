import sys
import pandas as pd
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

df_on = pd.read_csv('benchmark_guard_ON_detail.csv')
df_off = pd.read_csv('benchmark_guard_OFF_detail.csv')

# Since index order is 100% identical, we copy real 'img' path to df_off
df_off['img'] = df_on['img']

# Filter only conflict rows (420 images)
conflicts = df_on[df_on['is_conflict'] == True].copy()
conflicts['final_off'] = df_off.loc[conflicts.index, 'final']
conflicts['correct_off'] = df_off.loc[conflicts.index, 'correct']

print(f"Total conflicts: {len(conflicts)}")

# Split conflicts into two groups based on Guard decision in Guard ON run:
# Group 1: 334 images BLOCKED by Guard in Guard ON
# Group 2: 86 images ALLOWED (Gemini called) in Guard ON

blocked = conflicts[conflicts['guard_reason'].str.startswith('guard_blocked')]
allowed = conflicts[conflicts['guard_reason'].str.startswith('gemini_called')]

print(f"\n--- Group 1: 334 BLOCKED images (Non-Axial / Sagittal / Coronal / Unknown) ---")
print(f"  In Guard ON (Gemini BLOCKED -> Fallback to CNN):")
print(f"    Correct: {blocked['correct'].sum()}/{len(blocked)} ({blocked['correct'].mean()*100:.2f}%)")
print(f"  In Guard OFF (Gemini CALLED for all 334):")
print(f"    Correct: {blocked['correct_off'].sum()}/{len(blocked)} ({blocked['correct_off'].mean()*100:.2f}%)")
print(f"  -> Delta for 334 blocked images: Guard OFF won by {blocked['correct_off'].sum() - blocked['correct'].sum()} images")

print(f"\n--- Group 2: 86 ALLOWED images (Confirmed Axial Slices) ---")
print(f"  In Guard ON (Gemini CALLED with Guard active):")
print(f"    Correct: {allowed['correct'].sum()}/{len(allowed)} ({allowed['correct'].mean()*100:.2f}%)")
print(f"  In Guard OFF (Gemini CALLED without Guard active):")
print(f"    Correct: {allowed['correct_off'].sum()}/{len(allowed)} ({allowed['correct_off'].mean()*100:.2f}%)")
print(f"  -> Delta for 86 allowed images: Guard ON won by {allowed['correct'].sum() - allowed['correct_off'].sum()} images")

# Why did Gemini perform differently on the same 86 allowed images between Guard ON and Guard OFF?
# Let's inspect the models used / prompt / API behavior or details on those 86 images!
print("\n--- Model breakdown on the 86 allowed images ---")
diff_86 = allowed[allowed['correct'] != allowed['correct_off']]
print(f"Number of images among 86 where Guard ON verdict != Guard OFF verdict: {len(diff_86)}")
print(diff_86[['img', 'true', 'cnn', 'yolo', 'final', 'final_off', 'correct', 'correct_off']].head(10))
