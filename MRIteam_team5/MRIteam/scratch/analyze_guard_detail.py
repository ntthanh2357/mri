import pandas as pd

df_on = pd.read_csv('benchmark_guard_ON_detail.csv')
df_off = pd.read_csv('benchmark_guard_OFF_detail.csv')
df_off['img'] = df_on['img']

print('Columns:', df_on.columns.tolist())
print('Total rows:', len(df_on))

# Tong the
print()
print('=== TONG QUAN ===')
print('Guard-ON  correct:', df_on['correct'].sum(), '/', len(df_on), '=', round(df_on['correct'].mean()*100,2), '%')
print('Guard-OFF correct:', df_off['correct'].sum(), '/', len(df_off), '=', round(df_off['correct'].mean()*100,2), '%')

# Non-conflict group
no_conflict = df_on[df_on['is_conflict'] == False]
print()
print('=== NHOM KHONG XUNG DOT:', len(no_conflict), 'anh ===')
print('Accuracy:', round(no_conflict['correct'].mean()*100,2), '%')
print('(Xu ly GIONG NHAU ca 2 Guard-ON va OFF)')

# Conflict group
conflicts = df_on[df_on['is_conflict'] == True].copy()
conflicts['final_off'] = df_off.loc[conflicts.index, 'final']
conflicts['correct_off'] = df_off.loc[conflicts.index, 'correct']

print()
print('=== NHOM XUNG DOT: 420 anh ===')
print('Guard-ON  (VLM chi 86 ca):', conflicts['correct'].sum(), '/', len(conflicts), '=', round(conflicts['correct'].mean()*100,2), '%')
print('Guard-OFF (VLM tat ca 420):', conflicts['correct_off'].sum(), '/', len(conflicts), '=', round(conflicts['correct_off'].mean()*100,2), '%')

# 334 blocked
blocked = conflicts[conflicts['guard_reason'].str.startswith('guard_blocked', na=False)]
print()
print('=== NHOM 334 BI BLOCK (non-axial) ===')
print('Guard-ON  (dung CNN):   correct =', blocked['correct'].sum(), '/', len(blocked), '=', round(blocked['correct'].mean()*100,2), '%')
print('Guard-OFF (ep VLM):     correct =', blocked['correct_off'].sum(), '/', len(blocked), '=', round(blocked['correct_off'].mean()*100,2), '%')
print('Chenh lech:', blocked['correct_off'].sum() - blocked['correct'].sum(), 'anh')

blocked_glioma = blocked[blocked['true'] == 'glioma']
print('Glioma trong 334 blocked:', len(blocked_glioma), 'ca')
fn_guard_on = blocked_glioma[blocked_glioma['final'] == 'notumor']
fn_guard_off = blocked_glioma[blocked_glioma['final_off'] == 'notumor']
print('  Fatal FN Guard-ON  (CNN fallback):', len(fn_guard_on), 'ca Glioma -> notumor')
print('  Fatal FN Guard-OFF (VLM):         ', len(fn_guard_off), 'ca Glioma -> notumor')

# 86 allowed
allowed = conflicts[conflicts['guard_reason'].str.startswith('gemini_called', na=False)]
print()
print('=== NHOM 86 DUOC ALLOW (axial - goi VLM) ===')
print('Guard-ON  (VLM + Safety Guardrails):', allowed['correct'].sum(), '/', len(allowed), '=', round(allowed['correct'].mean()*100,2), '%')
print('Guard-OFF (VLM tu do):              ', allowed['correct_off'].sum(), '/', len(allowed), '=', round(allowed['correct_off'].mean()*100,2), '%')

allowed_glioma = allowed[allowed['true'] == 'glioma']
print('Glioma trong 86 allowed:', len(allowed_glioma), 'ca')
fn_guard_on_86 = allowed_glioma[allowed_glioma['final'] == 'notumor']
fn_guard_off_86 = allowed_glioma[allowed_glioma['final_off'] == 'notumor']
print('  Fatal FN Guard-ON  (VLM+Guard-1/2):', len(fn_guard_on_86), 'ca Glioma -> notumor')
print('  Fatal FN Guard-OFF (VLM tu do):    ', len(fn_guard_off_86), 'ca Glioma -> notumor')

print()
print('=== TONG FATAL FN toan bo tap test ===')
fn_on_all = df_on[(df_on['true'] == 'glioma') & (df_on['final'] == 'notumor')]
fn_off_all = df_off[(df_off['true'] == 'glioma') & (df_off['final'] == 'notumor')]
print('Guard-ON  Fatal FN:', len(fn_on_all), 'ca =', round(len(fn_on_all)/3461*100,2), '%')
print('Guard-OFF Fatal FN:', len(fn_off_all), 'ca =', round(len(fn_off_all)/3461*100,2), '%')
