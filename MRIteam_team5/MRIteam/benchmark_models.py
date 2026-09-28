# -*- coding: utf-8 -*-
import sys
import io
import os
import time
import numpy as np
import tensorflow as tf
from PIL import Image
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, precision_recall_fscore_support
from dotenv import load_dotenv

# Load env variables for Gemini
load_dotenv()

# Inject tf into builtins so Lambda layers can find it globally (same as main.py)
import builtins
builtins.tf = tf # type: ignore

from preprocess import medical_preprocessing_v2
from tensorflow.keras.applications.resnet50 import preprocess_input # type: ignore
from google import genai
from google.genai import types

# =====================================================================
# CONFIGURATION
# =====================================================================
TEST_PATH = "archive_v2/Testing"
MODELS_DIR = "models"
CATEGORIES = ['glioma', 'meningioma', 'notumor', 'pituitary']
IMG_SIZE = (224, 224)
BATCH_SIZE = 32

print("="*60)
print("STARTING COMPREHENSIVE MRI BRAIN TUMOR MODEL BENCHMARK")
print("="*60)

# =====================================================================
# 1. LOAD TEST DATASET
# =====================================================================
def load_test_dataset():
    print(f"\nScanning test dataset from: {TEST_PATH}")
    img_paths = []
    labels = []
    
    for category in CATEGORIES:
        category_dir = os.path.join(TEST_PATH, category)
        if not os.path.isdir(category_dir):
            print(f"  Warning: Directory not found: {category_dir}")
            continue
        
        class_idx = CATEGORIES.index(category)
        files = os.listdir(category_dir)
        count = 0
        for f in files:
            if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                img_paths.append(os.path.join(category_dir, f))
                labels.append(class_idx)
                count += 1
        print(f"  → Found {count} images in class '{category}'")
    
    total_images = len(img_paths)
    print(f"Total test images found: {total_images}")
    
    if total_images == 0:
        raise ValueError("No test images found! Please check the dataset path.")
        
    print("Preprocessing test images...")
    X_processed = []
    y_labels = []
    
    for idx, path in enumerate(img_paths):
        # Apply project's custom preprocessing
        img = medical_preprocessing_v2(path)
        if img is not None:
            X_processed.append(img)
            y_labels.append(labels[idx])
        if (idx + 1) % 100 == 0 or (idx + 1) == total_images:
            print(f"  Processed {idx + 1}/{total_images} images...")
            
    X = np.array(X_processed, dtype=np.float32)
    y = np.array(y_labels, dtype=np.int32)
    
    print(f"Loading completed. Shape of raw data: {X.shape}")
    return X, y

# =====================================================================
# 2. DEFINE HELPER FOR LOADING AND BENCHMARKING MODELS
# =====================================================================
def get_model_size_mb(filepath):
    return os.path.getsize(filepath) / (1024 * 1024)

def benchmark_local_model(model_name, filepath, X_test, y_test):
    print(f"\nBenchmarking local model: {model_name} ({filepath})")
    
    # 1. Measure model loading time
    start_load = time.time()
    custom_objects = {'tf': tf}
    try:
        # Enable unsafe deserialization for Lambda layers
        try:
            tf.keras.config.enable_unsafe_deserialization()
        except AttributeError:
            pass
            
        model = tf.keras.models.load_model(filepath, custom_objects=custom_objects, safe_mode=False, compile=False)
        load_time = time.time() - start_load
        print(f"  → Loaded successfully in {load_time:.2f} seconds.")
    except Exception as e:
        print(f"  → Failed to load model {model_name}: {e}")
        return None
        
    # 2. Get parameters count
    try:
        total_params = model.count_params()
        trainable_params = np.sum([np.prod(v.get_shape()) for v in model.trainable_weights])
    except Exception:
        total_params = "N/A"
        trainable_params = "N/A"
        
    file_size_mb = get_model_size_mb(filepath)
    
    # Tự động chọn hàm tiền xử lý phù hợp với Model
    import tensorflow.keras.applications as keras_apps # type: ignore
    if "densenet" in model_name.lower():
        preprocess_func = keras_apps.densenet.preprocess_input
    elif "efficientnet" in model_name.lower():
        preprocess_func = keras_apps.efficientnet_v2.preprocess_input
    elif "risk" in model_name.lower() or "resnet_v2" in model_name.lower():
        preprocess_func = keras_apps.resnet_v2.preprocess_input
    else:
        preprocess_func = keras_apps.resnet50.preprocess_input
        
    X_model_ready = preprocess_func(X_test.copy())
    
    # 3. Measure inference latency and get predictions
    print(f"  → Running inference on {len(X_model_ready)} images...")
    
    # Warm-up run to exclude compilation overhead
    _ = model.predict(X_model_ready[:5], verbose=0)
    
    start_infer = time.time()
    predictions = model.predict(X_model_ready, batch_size=BATCH_SIZE, verbose=0)
    total_infer_time = time.time() - start_infer
    
    latency_per_img_ms = (total_infer_time / len(X_test)) * 1000
    
    # 4. Calculate metrics
    y_pred = np.argmax(predictions, axis=1)
    accuracy = accuracy_score(y_test, y_pred)
    
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='macro')
    
    print(f"  → Results:")
    print(f"    - Accuracy: {accuracy * 100:.2f}%")
    print(f"    - Macro F1-score: {f1 * 100:.2f}%")
    print(f"    - Avg Latency: {latency_per_img_ms:.2f} ms/image")
    print(f"    - File Size: {file_size_mb:.2f} MB")
    
    # Generate confusion matrix plot
    cm = confusion_matrix(y_test, y_pred)
    plt.figure(figsize=(7, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=CATEGORIES, yticklabels=CATEGORIES)
    plt.title(f'Confusion Matrix - {model_name}')
    plt.ylabel('Actual Label')
    plt.xlabel('Predicted Label')
    plt.tight_layout()
    cm_path = os.path.join(MODELS_DIR, f"confusion_matrix_{model_name.replace(' ', '_').lower()}.png")
    plt.savefig(cm_path, dpi=150)
    plt.close()
    
    # Detailed classification report
    report = classification_report(y_test, y_pred, target_names=CATEGORIES, output_dict=True)
    
    return {
        'model_name': model_name,
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1_score': f1,
        'latency_ms': latency_per_img_ms,
        'file_size_mb': file_size_mb,
        'total_params': total_params,
        'trainable_params': trainable_params,
        'load_time_sec': load_time,
        'report': report
    }

# =====================================================================
# 3. BENCHMARK GEMINI API
# =====================================================================
def benchmark_gemini_api():
    print("\nBenchmarking Google Gemini API response latency...")
    from gemini_rotator import GeminiProxy
    client = GeminiProxy()
    
    if not client.client:
        print("  → Skip: No GEMINI API KEYS found in environment.")
        return None
        
    try:
        # Test models
        models_to_test = ['gemini-3.1-flash-lite']
        gemini_results = {}
        
        test_prompt = "Hãy viết một câu nhận xét ngắn (dưới 10 từ) về tầm quan trọng của việc chẩn đoán sớm u não."
        
        for m in models_to_test:
            print(f"  → Testing {m}...")
            latencies = []
            
            # Run 3 times to get average
            for i in range(3):
                start = time.time()
                response = client.models.generate_content(
                    model=m,
                    contents=test_prompt,
                    config=types.GenerateContentConfig(temperature=0.2, max_output_tokens=100)
                )
                duration = time.time() - start
                latencies.append(duration)
                
            avg_latency = np.mean(latencies)
            print(f"    - Average response latency: {avg_latency:.2f} seconds")
            gemini_results[m] = {
                'avg_latency_sec': avg_latency,
                'sample_response': (response.text or "").strip()
            }
        return gemini_results
    except Exception as e:
        print(f"  → Failed to benchmark Gemini API: {e}")
        return None

# =====================================================================
# MAIN RUN
# =====================================================================
def main():
    try:
        X_test, y_test = load_test_dataset()
    except Exception as e:
        print(f"CRITICAL ERROR loading dataset: {e}")
        return
        
    # Scan models directory for available model weights
    all_files = os.listdir(MODELS_DIR)
    model_files = [f for f in all_files if f.endswith(('.keras', '.h5'))]
    print(f"\nFound {len(model_files)} model files in '{MODELS_DIR}': {model_files}")
    
    results = []
    for f in model_files:
        filepath = os.path.join(MODELS_DIR, f)
        model_name = f # Use filename as name
        res = benchmark_local_model(model_name, filepath, X_test, y_test)
        if res is not None:
            results.append(res)
            
    # Benchmark Gemini API
    gemini_res = benchmark_gemini_api()
    
    # =====================================================================
    # REPORT GENERATION & CHARTING
    # =====================================================================
    if not results:
        print("\nNo models could be loaded and evaluated.")
        return
        
    # Sort results by Accuracy descending
    results = sorted(results, key=lambda x: x['accuracy'], reverse=True)
    
    # 1. Print Markdown Summary
    print("\n" + "="*80)
    print("                     BENCHMARK SUMMARY REPORT")
    print("="*80)
    print(f"| {'Model File':<40} | {'Accuracy':<10} | {'F1-Score':<10} | {'Latency (ms)':<12} | {'Size (MB)':<10} |")
    print(f"|{'-'*42}|{'-'*12}|{'-'*12}|{'-'*14}|{'-'*12}|")
    for r in results:
        print(f"| {r['model_name']:<40} | {r['accuracy']*100:>8.2f}% | {r['f1_score']*100:>8.2f}% | {r['latency_ms']:>10.2f} | {r['file_size_mb']:>8.2f} |")
    print("="*80)
    
    if gemini_res:
        print("\n--- Google Gemini API Response Latency ---")
        for m, g_data in gemini_res.items():
            print(f"- {m:<20}: {g_data['avg_latency_sec']:.2f} seconds (Sample response: \"{g_data['sample_response']}\")")
        print("="*80)
        
    # 2. Generate Comparison Chart
    try:
        model_names = [r['model_name'] for r in results]
        accuracies = [r['accuracy'] * 100 for r in results]
        f1_scores = [r['f1_score'] * 100 for r in results]
        latencies = [r['latency_ms'] for r in results]
        sizes = [r['file_size_mb'] for r in results]
        
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        fig.suptitle('MRI Brain Tumor Classification Models Comparison', fontsize=16, fontweight='bold')
        
        # Plot 1: Accuracy
        sns.barplot(x=model_names, y=accuracies, ax=axes[0, 0], palette='viridis')
        axes[0, 0].set_title('Test Set Accuracy (%)', fontweight='bold')
        axes[0, 0].set_ylabel('Accuracy (%)')
        axes[0, 0].set_ylim(0, 105)
        for i, val in enumerate(accuracies):
            axes[0, 0].text(i, val + 1, f"{val:.2f}%", ha='center', fontweight='bold')
        axes[0, 0].tick_params(axis='x', rotation=15)
        
        # Plot 2: F1-Score
        sns.barplot(x=model_names, y=f1_scores, ax=axes[0, 1], palette='plasma')
        axes[0, 1].set_title('Macro F1-Score (%)', fontweight='bold')
        axes[0, 1].set_ylabel('F1-Score (%)')
        axes[0, 1].set_ylim(0, 105)
        for i, val in enumerate(f1_scores):
            axes[0, 1].text(i, val + 1, f"{val:.2f}%", ha='center', fontweight='bold')
        axes[0, 1].tick_params(axis='x', rotation=15)
        
        # Plot 3: Latency
        sns.barplot(x=model_names, y=latencies, ax=axes[1, 0], palette='rocket')
        axes[1, 0].set_title('Average Inference Latency (ms/image)', fontweight='bold')
        axes[1, 0].set_ylabel('Latency (ms)')
        for i, val in enumerate(latencies):
            axes[1, 0].text(i, val + (max(latencies)*0.01), f"{val:.2f}ms", ha='center', fontweight='bold')
        axes[1, 0].tick_params(axis='x', rotation=15)
        
        # Plot 4: File Size
        sns.barplot(x=model_names, y=sizes, ax=axes[1, 1], palette='mako')
        axes[1, 1].set_title('Model File Size (MB)', fontweight='bold')
        axes[1, 1].set_ylabel('Size (MB)')
        for i, val in enumerate(sizes):
            axes[1, 1].text(i, val + (max(sizes)*0.01), f"{val:.1f}MB", ha='center', fontweight='bold')
        axes[1, 1].tick_params(axis='x', rotation=15)
        
        plt.tight_layout()
        chart_path = os.path.join(MODELS_DIR, "benchmark_comparison.png")
        plt.savefig(chart_path, dpi=150)
        plt.close()
        print(f"\nGenerated benchmark comparison chart: {chart_path}")
        
    except Exception as e:
        print(f"Error generating comparison chart: {e}")
        
    # Save a detailed report as a JSON file or markdown
    try:
        report_md_path = "models/benchmark_report.md"
        with open(report_md_path, "w", encoding="utf-8") as rf:
            rf.write("# Báo Cáo Đánh Giá Hiệu Năng Mô Hình (Benchmark Report)\n\n")
            rf.write(f"Ngày đánh giá: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            rf.write("## 1. Kết quả Tổng quan trên Tập Test\n\n")
            
            rf.write("| Tên Mô Hình | Accuracy | Precision | Recall | F1-Score | Độ trễ (ms/ảnh) | Dung lượng (MB) | Tham số (Params) |\n")
            rf.write("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n")
            for r in results:
                params_str = f"{r['total_params']:,}" if isinstance(r['total_params'], (int, float)) else r['total_params']
                rf.write(f"| **{r['model_name']}** | {r['accuracy']*100:.2f}% | {r['precision']*100:.2f}% | {r['recall']*100:.2f}% | {r['f1_score']*100:.2f}% | {r['latency_ms']:.2f} ms | {r['file_size_mb']:.2f} MB | {params_str} |\n")
            
            if gemini_res:
                rf.write("\n## 2. Đánh giá Mô hình Gemini API (Độ trễ phản hồi mạng)\n\n")
                rf.write("| Mô hình Gemini | Thời gian phản hồi trung bình (s) | Ghi chú phản hồi mẫu |\n")
                rf.write("| :--- | :---: | :--- |\n")
                for m, g_data in gemini_res.items():
                    rf.write(f"| `{m}` | {g_data['avg_latency_sec']:.2f} s | \"{g_data['sample_response']}\" |\n")
                    
            rf.write("\n## 3. Chi tiết từng Mô hình\n\n")
            for r in results:
                rf.write(f"### Mô hình: {r['model_name']}\n\n")
                rf.write(f"- **Kích thước file:** {r['file_size_mb']:.2f} MB\n")
                params_str = f"{r['total_params']:,}" if isinstance(r['total_params'], (int, float)) else r['total_params']
                rf.write(f"- **Tổng số tham số:** {params_str} tham số\n")
                rf.write(f"- **Thời gian tải mô hình:** {r['load_time_sec']:.2f} giây\n")
                rf.write(f"- **Độ trễ dự đoán:** {r['latency_ms']:.2f} ms/ảnh\n\n")
                
                rf.write("#### Chi tiết các lớp:\n")
                rf.write("| Nhóm U | Precision | Recall | F1-Score | Support |\n")
                rf.write("| :--- | :---: | :---: | :---: | :---: |\n")
                for cat in CATEGORIES:
                    rep_cat = r['report'][cat]
                    rf.write(f"| {cat} | {rep_cat['precision']*100:.2f}% | {rep_cat['recall']*100:.2f}% | {rep_cat['f1-score']*100:.2f}% | {rep_cat['support']} |\n")
                rf.write("\n---\n\n")
                
        print(f"Saved detailed markdown report to: {report_md_path}")
    except Exception as e:
        print(f"Error generating markdown report: {e}")

if __name__ == "__main__":
    main()
