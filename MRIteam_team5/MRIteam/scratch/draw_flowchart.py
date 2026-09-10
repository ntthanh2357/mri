import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Setup figure with high resolution
fig, ax = plt.subplots(figsize=(19, 7.5), dpi=300)
ax.set_xlim(0, 19)
ax.set_ylim(0, 7.5)
ax.axis('off')

# Color palette (Modern Academic / Springer style)
COLOR_INPUT = "#0288D1"       # Ocean Blue
COLOR_PREP  = "#7B1FA2"       # Royal Purple
COLOR_TIER  = "#E65100"       # Deep Amber/Orange
COLOR_DIAMOND = "#D32F2F"     # Ruby Red
COLOR_VLM   = "#2E7D32"       # Forest Green
COLOR_GUARD = "#388E3C"       # Mint Green
COLOR_OUTPUT = "#37474F"      # Slate Dark Grey

def draw_box(ax, x, y, w, h, title, text_lines, color, shape="rect"):
    """Draw a styled box or diamond with crisp text"""
    if shape == "rect":
        rect = patches.FancyBboxPatch((x, y), w, h,
                                       boxstyle="round,pad=0.1,rounding_size=0.15",
                                       linewidth=1.8, edgecolor=color,
                                       facecolor=color, alpha=0.08)
        ax.add_patch(rect)
        rect_border = patches.FancyBboxPatch((x, y), w, h,
                                              boxstyle="round,pad=0.1,rounding_size=0.15",
                                              linewidth=1.8, edgecolor=color,
                                              facecolor="none")
        ax.add_patch(rect_border)
        
        # Header text
        ax.text(x + w/2, y + h - 0.35, title, horizontalalignment='center',
                verticalalignment='center', fontsize=10, fontweight='bold', color=color)
        
        # Body text
        if text_lines:
            body_text = "\n".join(text_lines)
            ax.text(x + w/2, y + (h - 0.45)/2, body_text, horizontalalignment='center',
                    verticalalignment='center', fontsize=8.2, color="#212121", linespacing=1.35)
            
    elif shape == "diamond":
        diamond = patches.Polygon([
            (x + w/2, y + h),
            (x + w, y + h/2),
            (x + w/2, y),
            (x, y + h/2)
        ], linewidth=1.8, edgecolor=color, facecolor=color, alpha=0.08)
        ax.add_patch(diamond)
        
        diamond_border = patches.Polygon([
            (x + w/2, y + h),
            (x + w, y + h/2),
            (x + w/2, y),
            (x, y + h/2)
        ], linewidth=1.8, edgecolor=color, facecolor="none")
        ax.add_patch(diamond_border)
        
        full_text = f"{title}\n" + "\n".join(text_lines) if text_lines else title
        ax.text(x + w/2, y + h/2, full_text, horizontalalignment='center',
                verticalalignment='center', fontsize=8.8, fontweight='bold', color=color, linespacing=1.25)

def draw_arrow(ax, start, end, label=None, label_offset=(0, 0.15), color="#424242", style="straight", rad=0.0):
    """Draw a clean arrow with text label"""
    if style == "straight":
        ax.annotate("", xy=end, xytext=start,
                    arrowprops=dict(arrowstyle="-|>", color=color, lw=1.5, mutation_scale=14))
    elif style == "curved":
        ax.annotate("", xy=end, xytext=start,
                    arrowprops=dict(arrowstyle="-|>", color=color, lw=1.5, mutation_scale=14,
                                    connectionstyle=f"arc3,rad={rad}"))
        
    if label:
        lx = (start[0] + end[0]) / 2 + label_offset[0]
        ly = (start[1] + end[1]) / 2 + label_offset[1]
        ax.text(lx, ly, label, fontsize=8, fontweight='bold',
                color=color, horizontalalignment='center', verticalalignment='center',
                bbox=dict(boxstyle='round,pad=0.2', facecolor='white', edgecolor='none', alpha=0.9))

# ── 1. Input Box ─────────────────────────────────────────────────────────────
draw_box(ax, 0.4, 2.75, 1.8, 2.0, "Raw Brain\nMRI Image", ["• DICOM / JPG", "• T1-CE / T2 / FLAIR"], COLOR_INPUT)

# ── 2. Preprocessing Box ──────────────────────────────────────────────────────
draw_box(ax, 2.6, 2.5, 2.3, 2.5, "Image Preprocessing", 
         ["• Contour Crop (Otsu)", "• CLAHE Equalization", "• Gaussian Filtering", "• Resize 224×224×3"], COLOR_PREP)

draw_arrow(ax, (2.2, 3.75), (2.6, 3.75))

# ── 3. Parallel Tiers (Tier 1 & Tier 2) ──────────────────────────────────────
draw_box(ax, 5.4, 4.3, 2.5, 2.4, "Tier 1: Risk-Calibrated\nCNN Ensemble", 
         ["• ResNet50 (Risk-Loss)", "• EfficientNetV2", "• DenseNet121", "• BayTTA Integration"], COLOR_TIER)

draw_box(ax, 5.4, 0.8, 2.5, 2.4, "Tier 2: YOLOv8\nSpatial Localization", 
         ["• Tumor Bounding Box", "• Localized ROI Crop", "• Confidence Score", "• Class Prediction"], COLOR_TIER)

# Arrows Preprocessing -> Tiers
draw_arrow(ax, (4.9, 3.75), (5.4, 5.5), style="straight")
draw_arrow(ax, (4.9, 3.75), (5.4, 2.0), style="straight")

# ── 4. Decision Diamond 1 (Consensus Check) ──────────────────────────────────
draw_box(ax, 8.4, 2.65, 2.0, 2.2, "Do Tier 1 & 2\nAgree?", [], COLOR_DIAMOND, shape="diamond")

# Arrows Tiers -> Decision 1
draw_arrow(ax, (7.9, 5.5), (9.4, 4.85), style="straight")
draw_arrow(ax, (7.9, 2.0), (9.4, 2.65), style="straight")

# ── 5. Tier 3 VLM Box ────────────────────────────────────────────────────────
draw_box(ax, 11.0, 2.5, 2.4, 2.5, "Tier 3: Gemini 3.1\nFlash-Lite Arbitration", 
         ["• Anatomical Reasoning", "• ROI Crop Analysis", "• Clinical Prompt Constraint", "• Confidence Scoring"], COLOR_VLM)

# Arrow Decision 1 -> Tier 3 (NO Branch)
draw_arrow(ax, (10.4, 3.75), (11.0, 3.75), label="NO (Conflict)", label_offset=(0, 0.18))

# ── 6. Safety Guardrails Diamond ──────────────────────────────────────────────
draw_box(ax, 13.9, 2.65, 2.0, 2.2, "Are Safety Guardrails\nTriggered?", [], COLOR_DIAMOND, shape="diamond")

draw_arrow(ax, (13.4, 3.75), (13.9, 3.75))

# ── 7. Decision Outcomes ────────────────(Guard-1, Guard-2, Fallback)
draw_box(ax, 13.8, 5.5, 2.2, 1.4, "Override VLM", ["Fallback to Tier 1\n(c_BayTTA)"], COLOR_GUARD)
draw_arrow(ax, (14.9, 4.85), (14.9, 5.5), label="YES", label_offset=(0.25, 0), color="#D32F2F")

draw_box(ax, 13.8, 0.6, 2.2, 1.4, "Trust VLM", ["Output VLM Verdict\n(c_VLM)"], COLOR_GUARD)
draw_arrow(ax, (14.9, 2.65), (14.9, 2.0), label="NO", label_offset=(0.25, 0), color="#2E7D32")

# ── 8. Fast Path (Bypass Tier 3) ──────────────────────────────────────────────
draw_arrow(ax, (9.4, 4.85), (16.5, 4.2), label="YES (Consensus ~75ms)", label_offset=(-0.8, 0.5), 
           style="curved", rad=-0.35, color="#0288D1")

# ── 9. Final Output & Clinical Verdict ────────────────────────────────────────
draw_box(ax, 16.5, 3.0, 1.8, 2.2, "Final Consensus\nVerdict", 
         ["• Glioma", "• Meningioma", "• Pituitary", "• No Tumor"], COLOR_OUTPUT)

draw_box(ax, 16.5, 0.6, 1.8, 1.8, "Clinical Output", 
         ["• Annotated Image", "• Bounding Box ROI", "• Grad-CAM Heatmap", "• Reasoning Report"], COLOR_OUTPUT)

# Arrows Outcome -> Final Output
draw_arrow(ax, (16.0, 6.2), (17.4, 5.2), style="straight")
draw_arrow(ax, (16.0, 1.3), (17.4, 3.0), style="straight")
draw_arrow(ax, (17.4, 3.0), (17.4, 2.4), style="straight")

# Title banner
plt.suptitle("Multimodal AI Consensus System (MAICS): Three-Tier Architecture & Decision Flow", 
             fontsize=13, fontweight='bold', color="#1A237E", y=0.98)

# Save figure
os.makedirs("models", exist_ok=True)
output_path = "models/maics_architecture_flowchart.png"
plt.savefig(output_path, bbox_inches='tight', dpi=300)
plt.close()

print(f"Successfully generated ultra-high-res architecture flowchart at: {output_path}")
