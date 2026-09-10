import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import confusion_matrix
import os

# Load details
df_on = pd.read_csv('benchmark_guard_ON_detail.csv')
df_off = pd.read_csv('benchmark_guard_OFF_detail.csv')

labels = ['glioma', 'meningioma', 'notumor', 'pituitary']
display_labels = ['Glioma', 'Meningioma', 'No Tumor', 'Pituitary']

cm_on = confusion_matrix(list(df_on['true']), list(df_on['final']), labels=labels)
cm_off = confusion_matrix(list(df_off['true']), list(df_off['final']), labels=labels)

print("--- GUARD ON (MAICS Proposal) ---")
df_cm_on = pd.DataFrame(cm_on, index=display_labels, columns=display_labels)
print(df_cm_on)

print("\n--- GUARD OFF (Ablation Baseline) ---")
df_cm_off = pd.DataFrame(cm_off, index=display_labels, columns=display_labels)
print(df_cm_off)

# Plotting side by side
fig, axes = plt.subplots(1, 2, figsize=(14, 6), dpi=300)

# Color maps
cmap_on = sns.light_palette("#1b4332", as_cmap=True)
cmap_off = sns.light_palette("#4a154b", as_cmap=True)

# Plot Guard ON
sns.heatmap(cm_on, annot=True, fmt='d', cmap='Blues', cbar=False,
            xticklabels=display_labels, yticklabels=display_labels, ax=axes[0],
            annot_kws={"size": 14, "weight": "bold"})
axes[0].set_title('(a) MAICS Framework (Guard-ON)\nOverall Accuracy: 91.01% | Fatal FNR: 0.43%', fontsize=13, fontweight='bold', pad=12)
axes[0].set_xlabel('Predicted Label', fontsize=11, fontweight='bold')
axes[0].set_ylabel('True Label', fontsize=11, fontweight='bold')

# Plot Guard OFF
sns.heatmap(cm_off, annot=True, fmt='d', cmap='Purples', cbar=False,
            xticklabels=display_labels, yticklabels=display_labels, ax=axes[1],
            annot_kws={"size": 14, "weight": "bold"})
axes[1].set_title('(b) Ablation Baseline (Guard-OFF)\nOverall Accuracy: 91.07% | Fatal FNR: 0.68%', fontsize=13, fontweight='bold', pad=12)
axes[1].set_xlabel('Predicted Label', fontsize=11, fontweight='bold')
axes[1].set_ylabel('True Label', fontsize=11, fontweight='bold')

plt.tight_layout()

os.makedirs('models', exist_ok=True)
output_path = 'models/confusion_matrix_comparison.png'
plt.savefig(output_path, dpi=300, bbox_inches='tight')
print(f"\nSaved confusion matrix plot to {output_path}")
