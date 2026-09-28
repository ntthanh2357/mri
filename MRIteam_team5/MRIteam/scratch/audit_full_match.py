import os
import json
import pandas as pd
from scipy import stats

def run_audit():
    print("=== STARTING COMPLETE AUDIT OF PAPER VS CODEBASE ===")
    
    # 1. Load detail CSVs
    df_on = pd.read_csv("benchmark_guard_ON_detail.csv")
    df_off = pd.read_csv("benchmark_guard_OFF_detail.csv")
    
    print(f"Loaded benchmark_guard_ON_detail.csv: {len(df_on)} rows")
    print(f"Loaded benchmark_guard_OFF_detail.csv: {len(df_off)} rows")
    
    # 2. Check McNemar between CNN baseline and MAICS (System)
    y_true = df_on["true"]
    y_cnn = df_on["cnn"]
    y_sys = df_on["final"]
    
    n01_cnn_sys = sum((y_sys == y_true) & (y_cnn != y_true))
    n10_cnn_sys = sum((y_sys != y_true) & (y_cnn == y_true))
    n_cnn_sys = n01_cnn_sys + n10_cnn_sys
    p_cnn_sys = stats.chi2.sf((abs(n01_cnn_sys - n10_cnn_sys) - 1)**2 / n_cnn_sys, df=1)
    p_cnn_sys_exact = 2 * stats.binom.cdf(min(n01_cnn_sys, n10_cnn_sys), n_cnn_sys, 0.5)
    print(f"\n[McNemar MAICS vs CNN Baseline (All 3,461 images)]")
    print(f"  n01 (MAICS correct, CNN wrong): {n01_cnn_sys}")
    print(f"  n10 (CNN correct, MAICS wrong): {n10_cnn_sys}")
    print(f"  Total discordances: {n_cnn_sys}")
    print(f"  Chi-squared p-value: {p_cnn_sys:.8f} (Scientific: {p_cnn_sys:.6e})")
    print(f"  Exact binomial p-value: {p_cnn_sys_exact:.8f} (Scientific: {p_cnn_sys_exact:.6e})")
    
    # 3. Check McNemar Guard-ON vs Guard-OFF
    y_off = df_off["final"]
    n01_guard = sum((y_sys == y_true) & (y_off != y_true))
    n10_guard = sum((y_sys != y_true) & (y_off == y_true))
    n_guard = n01_guard + n10_guard
    p_guard = stats.chi2.sf((abs(n01_guard - n10_guard) - 1)**2 / n_guard, df=1) if n_guard >= 25 else 2*stats.binom.cdf(min(n01_guard, n10_guard), n_guard, 0.5)
    p_guard_exact = 2 * stats.binom.cdf(min(n01_guard, n10_guard), n_guard, 0.5)
    print(f"\n[McNemar Guard-ON vs Guard-OFF (All 3,461 images)]")
    print(f"  n01 (Guard-ON correct, OFF wrong): {n01_guard}")
    print(f"  n10 (OFF correct, Guard-ON wrong): {n10_guard}")
    print(f"  Total discordances: {n_guard}")
    print(f"  Chi-squared p-value: {p_guard:.6f}")
    print(f"  Exact binomial p-value: {p_guard_exact:.6f}")
    
    # 4. Check Tam Tri subset McNemar
    mask_tt = df_on["img"].str.contains("_TT_")
    tt_true = df_on.loc[mask_tt, "true"]
    tt_on = df_on.loc[mask_tt, "final"]
    tt_off = df_off.loc[mask_tt, "final"]
    
    n01_tt = sum((tt_on == tt_true) & (tt_off != tt_true))
    n10_tt = sum((tt_on != tt_true) & (tt_off == tt_true))
    n_tt = n01_tt + n10_tt
    p_tt_exact = 2 * stats.binom.cdf(min(n01_tt, n10_tt), n_tt, 0.5)
    p_tt_chi2 = stats.chi2.sf((abs(n01_tt - n10_tt) - 1)**2 / n_tt, df=1)
    print(f"\n[McNemar Guard-ON vs Guard-OFF (Tam Tri cases N=1,861)]")
    print(f"  n01 (ON correct, OFF wrong): {n01_tt}")
    print(f"  n10 (OFF correct, ON wrong): {n10_tt}")
    print(f"  Total: {n_tt}")
    print(f"  Exact p-value: {p_tt_exact:.6f}")
    print(f"  Chi-squared p-value: {p_tt_chi2:.6f}")
    
    # 5. Check Fatal FNR (Glioma as notumor)
    glioma_mask = df_on["true"] == "glioma"
    total_glioma = glioma_mask.sum()
    fatal_on = ((df_on["true"] == "glioma") & (df_on["final"] == "notumor")).sum()
    fatal_off = ((df_off["true"] == "glioma") & (df_off["final"] == "notumor")).sum()
    fatal_cnn = ((df_on["true"] == "glioma") & (df_on["cnn"] == "notumor")).sum()
    print(f"\n[Fatal FNR - Glioma -> notumor]")
    print(f"  Total Glioma cases: {total_glioma}")
    print(f"  CNN baseline fatal errors: {fatal_cnn} ({fatal_cnn/total_glioma*100:.2f}%)")
    print(f"  Guard-OFF fatal errors: {fatal_off} ({fatal_off/total_glioma*100:.2f}%)")
    print(f"  Guard-ON fatal errors: {fatal_on} ({fatal_on/total_glioma*100:.2f}%)")
    
    # McNemar for Glioma fatal FNR
    # Did someone test McNemar on whether Glioma is classified as fatal vs non-fatal?
    fatal_on_vec = (df_on["true"] == "glioma") & (df_on["final"] == "notumor")
    fatal_off_vec = (df_off["true"] == "glioma") & (df_off["final"] == "notumor")
    fatal_cnn_vec = (df_on["true"] == "glioma") & (df_on["cnn"] == "notumor")
    
    # Tam Tri fatal FNR
    tt_glioma_mask = mask_tt & (df_on["true"] == "glioma")
    tt_total_glioma = tt_glioma_mask.sum()
    tt_fatal_on = (tt_glioma_mask & (df_on["final"] == "notumor")).sum()
    print(f"  Tam Tri Glioma total: {tt_total_glioma}")
    print(f"  Tam Tri Guard-ON fatal errors: {tt_fatal_on} ({tt_fatal_on/tt_total_glioma*100:.2f}%)")
    
    # 6. Check conflicts and Gemini calls
    conflicts_on = df_on["is_conflict"].sum()
    gemini_used_count = df_on["gemini_used"].sum()
    print(f"\n[Conflicts & Gemini Calls]")
    print(f"  Total conflicts: {conflicts_on}")
    print(f"  Gemini called with Guard-ON: {gemini_used_count} ({gemini_used_count/len(df_on)*100:.2f}%)")
    gemini_used_off = df_off["gemini_used"].sum()
    print(f"  Gemini called with Guard-OFF: {gemini_used_off} ({gemini_used_off/len(df_off)*100:.2f}%)")
    call_reduction = (1 - gemini_used_count / gemini_used_off) * 100
    print(f"  Gemini call reduction: {call_reduction:.2f}%")

if __name__ == "__main__":
    run_audit()
