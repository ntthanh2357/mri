import tensorflow as tf
import keras
from keras.applications.resnet50 import ResNet50, preprocess_input
from keras.models import Model
from keras.layers import Dense, GlobalAveragePooling2D, Dropout, GlobalMaxPooling2D, Reshape, multiply, add, Activation, Concatenate, Conv2D
from keras.optimizers import Adam
from keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau
import numpy as np
import os
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.utils.class_weight import compute_class_weight
import seaborn as sns

# Import hàm tiền xử lý
from preprocess import medical_preprocessing_v2

# ============================================================
# 1. Cấu hình và Đường dẫn
# ============================================================
IMG_SIZE   = (224, 224)

# BUG FIX: Dùng đường dẫn tương đối để chạy được trên mọi máy
TRAIN_PATH = "archive_v2/Training"
TEST_PATH  = "archive_v2/Testing"

CATEGORIES = ['glioma', 'meningioma', 'notumor', 'pituitary']

# Thư mục lưu model
SAVE_DIR   = "models"
os.makedirs(SAVE_DIR, exist_ok=True)

# ============================================================
# 2. Load dữ liệu
# ============================================================
def load_paths_from_dir(directory):
    """Nạp đường dẫn ảnh từ thư mục và trả về (paths, labels) thay vì nạp tất cả vào RAM."""
    paths = []
    labels = []
    for category in CATEGORIES:
        path = os.path.join(directory, category)
        if not os.path.isdir(path):
            print(f"Cảnh báo: Không tìm thấy thư mục {path}")
            continue
        class_num = CATEGORIES.index(category)
        for img_name in os.listdir(path):
            if not img_name.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue
            img_path = os.path.join(path, img_name)
            paths.append(img_path)
            labels.append(class_num)

    combined = list(zip(paths, labels))
    np.random.shuffle(combined)
    if combined:
        paths, labels = zip(*combined)
        return list(paths), np.array(labels, dtype='int32')
    return [], np.array([], dtype='int32')

print("Đang quét dữ liệu Training...")
X_train_paths, y_raw = load_paths_from_dir(TRAIN_PATH)
print(f"  → Tìm thấy {len(X_train_paths)} ảnh Training.")

print("Đang quét dữ liệu Testing...")
X_test_paths, y_test = load_paths_from_dir(TEST_PATH)
print(f"  → Tìm thấy {len(X_test_paths)} ảnh Testing.")

# Chia tập Training thành Train/Val (80/20)
X_train_paths, X_val_paths, y_train, y_val = train_test_split(
    X_train_paths, y_raw, test_size=0.2, random_state=42, stratify=y_raw
)
print(f"  Train: {len(X_train_paths)} | Val: {len(X_val_paths)}")

# Hàm xử lý ảnh lười (Lazy-loading) cho tf.data
def process_path(file_path, label):
    def _process(p):
        p_str = p.decode('utf-8')
        img = medical_preprocessing_v2(p_str)
        if img is None:
            img = np.zeros((224, 224, 3), dtype=np.float32)
        return img
    img = tf.numpy_function(_process, [file_path], tf.float32)
    img.set_shape([224, 224, 3])
    return img, label

# ============================================================
# 3. Data Augmentation (Keras 3 native - tương thích hoàn toàn)
# ============================================================
data_augmentation = keras.Sequential([
    keras.layers.RandomFlip("horizontal"),
    keras.layers.RandomRotation(0.0278),  # ~10 degrees (an toàn cho MRI)
    keras.layers.RandomZoom(0.1),         # 10%
    keras.layers.RandomTranslation(0.08, 0.08),
    keras.layers.RandomBrightness(0.1),   # range 0.9 to 1.1
], name="data_augmentation")

BATCH_SIZE = 32

# Tạo tf.data.Dataset với augmentation cho tập train
train_dataset = (
    tf.data.Dataset.from_tensor_slices((X_train_paths, y_train))
    .shuffle(buffer_size=len(X_train_paths), seed=42)
    .map(process_path, num_parallel_calls=tf.data.AUTOTUNE)
    .batch(BATCH_SIZE)
    .map(lambda x, y: (preprocess_input(data_augmentation(x, training=True)), y),
         num_parallel_calls=tf.data.AUTOTUNE)
    .prefetch(tf.data.AUTOTUNE)
)

val_dataset = (
    tf.data.Dataset.from_tensor_slices((X_val_paths, y_val))
    .map(process_path, num_parallel_calls=tf.data.AUTOTUNE)
    .batch(BATCH_SIZE)
    .map(lambda x, y: (preprocess_input(x), y), num_parallel_calls=tf.data.AUTOTUNE)
    .prefetch(tf.data.AUTOTUNE)
)

test_dataset = (
    tf.data.Dataset.from_tensor_slices((X_test_paths, y_test))
    .map(process_path, num_parallel_calls=tf.data.AUTOTUNE)
    .batch(BATCH_SIZE)
    .map(lambda x, y: (preprocess_input(x), y), num_parallel_calls=tf.data.AUTOTUNE)
    .prefetch(tf.data.AUTOTUNE)
)

# ============================================================
# 4. Xây dựng mô hình ResNet50 tích hợp CBAM (Cơ chế chú ý)
# ============================================================
def channel_attention_module(x, ratio=8):
    channel = x.shape[-1]
    shared_layer_one = Dense(channel // ratio, activation='relu', kernel_initializer='he_normal', use_bias=True, bias_initializer='zeros')
    shared_layer_two = Dense(channel, kernel_initializer='he_normal', use_bias=True, bias_initializer='zeros')
    
    avg_pool = GlobalAveragePooling2D()(x)
    avg_pool = Reshape((1, 1, channel))(avg_pool)
    avg_pool = shared_layer_one(avg_pool)
    avg_pool = shared_layer_two(avg_pool)
    
    max_pool = GlobalMaxPooling2D()(x)
    max_pool = Reshape((1, 1, channel))(max_pool)
    max_pool = shared_layer_one(max_pool)
    max_pool = shared_layer_two(max_pool)
    
    cbam_feature = add([avg_pool, max_pool])
    cbam_feature = Activation('sigmoid')(cbam_feature)
    return multiply([x, cbam_feature])

from keras.layers import Lambda

def spatial_attention_module(x):
    avg_pool = Lambda(lambda x: tf.reduce_mean(x, axis=-1, keepdims=True), output_shape=lambda s: (s[0], s[1], s[2], 1))(x)
    max_pool = Lambda(lambda x: tf.reduce_max(x, axis=-1, keepdims=True), output_shape=lambda s: (s[0], s[1], s[2], 1))(x)
    concat = Concatenate(axis=-1)([avg_pool, max_pool])
    cbam_feature = Conv2D(filters=1, kernel_size=7, strides=1, padding='same', activation='sigmoid', kernel_initializer='he_normal', use_bias=False)(concat)
    return multiply([x, cbam_feature])

def cbam_block(x, ratio=8):
    """Áp dụng Channel Attention rồi đến Spatial Attention"""
    x = channel_attention_module(x, ratio)
    x = spatial_attention_module(x)
    return x

base_model = ResNet50(weights='imagenet', include_top=False, input_shape=(224, 224, 3))

# GIAI ĐOẠN 1: Đóng băng toàn bộ ResNet50
base_model.trainable = False

x = base_model.output

# --- TÍCH HỢP CƠ CHẾ CHÚ Ý (CBAM) ---
# Áp dụng Attention vào các feature map cuối cùng của ResNet50 trước khi phân loại
x = cbam_block(x)

x = GlobalAveragePooling2D()(x)
x = Dense(256, activation='relu')(x)
x = Dropout(0.5)(x)
predictions = Dense(4, activation='softmax')(x)

model = Model(inputs=base_model.input, outputs=predictions)
model.compile(
    optimizer=Adam(learning_rate=1e-3), # Learning rate lớn cho head
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)
model.summary()

# ============================================================
# 5. Callbacks
# ============================================================
# BUG FIX: Thêm EarlyStopping và ModelCheckpoint để lưu best model
best_model_path = os.path.join(SAVE_DIR, 'best_resnet_model.h5')

callbacks = [
    ModelCheckpoint(
        filepath=best_model_path,
        monitor='val_accuracy',
        save_best_only=True,
        verbose=1
    ),
    EarlyStopping(
        monitor='val_loss',
        patience=5,
        restore_best_weights=True,
        verbose=1
    ),
    ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=3,
        min_lr=1e-6,
        verbose=1
    ),
]

# ============================================================
# 6. Huấn luyện
# ============================================================
print("\nTính toán Class Weights để xử lý mất cân bằng dữ liệu...")
class_weights = compute_class_weight(
    class_weight='balanced',
    classes=np.unique(y_train),
    y=y_train
)
class_weight_dict = dict(enumerate(class_weights))
print(f"Class weights: {class_weight_dict}")

print("\n[GIAI ĐOẠN 1] Bắt đầu huấn luyện Classification Head (ResNet50 bị đóng băng)...")
history1 = model.fit(
    train_dataset,
    epochs=10, 
    validation_data=val_dataset,
    class_weight=class_weight_dict
)

print("\n[GIAI ĐOẠN 2] Fine-tuning (Mở khóa 30 layers cuối của ResNet50)...")
base_model.trainable = True
for layer in base_model.layers[:-30]:
    layer.trainable = False

# Re-compile với learning rate cực nhỏ
model.compile(
    optimizer=Adam(learning_rate=1e-5), # Giảm nhỏ LR để tránh hỏng weights
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

history2 = model.fit(
    train_dataset,
    epochs=30, # Thêm 30 epochs, kết hợp EarlyStopping
    validation_data=val_dataset,
    class_weight=class_weight_dict,
    callbacks=callbacks
)

# Gộp lịch sử huấn luyện để vẽ biểu đồ
history = history1
for key in history2.history.keys():
    if key in history.history:
        history.history[key].extend(history2.history[key])
    else:
        # Nếu ở Stage 1 không có val metrics (chưa dùng callback)
        history.history[key] = history2.history[key]

# ============================================================
# 7. Vẽ biểu đồ quá trình huấn luyện
# ============================================================
plt.figure(figsize=(12, 4))

plt.subplot(1, 2, 1)
plt.plot(history.history['accuracy'],     label='Train Accuracy')
plt.plot(history.history['val_accuracy'], label='Val Accuracy')
plt.title('Training and Validation Accuracy')
plt.xlabel('Epoch')
plt.ylabel('Accuracy')
plt.legend()

plt.subplot(1, 2, 2)
plt.plot(history.history['loss'],     label='Train Loss')
plt.plot(history.history['val_loss'], label='Val Loss')
plt.title('Training and Validation Loss')
plt.xlabel('Epoch')
plt.ylabel('Loss')
plt.legend()

plt.tight_layout()
chart_path = os.path.join(SAVE_DIR, 'training_history.png')
plt.savefig(chart_path, dpi=150)
plt.show()
print(f"Đã lưu biểu đồ huấn luyện tại: {chart_path}")

# ============================================================
# 8. Đánh giá mô hình trên tập Test độc lập
# ============================================================
print("\n--- BÁO CÁO ĐÁNH GIÁ TRÊN TẬP TEST ---")

# 1. Dự đoán trên tập Test
# (Dùng test_dataset thay vì X_test để đảm bảo dữ liệu qua hàm preprocess_input)
y_pred = model.predict(test_dataset)
y_pred_classes = np.argmax(y_pred, axis=1)

# 2. In báo cáo chi tiết cho bài báo (Accuracy, Recall, F1-score)
print("\n--- PERFORMANCE METRICS ON TEST DATASET ---")
report = classification_report(y_test, y_pred_classes, target_names=CATEGORIES)
print(report)

# 3. Vẽ Ma trận nhầm lẫn (Confusion Matrix) - Bắt buộc phải có trong báo cáo
plt.figure(figsize=(8, 6))
cm = confusion_matrix(y_test, y_pred_classes)
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
            xticklabels=CATEGORIES, yticklabels=CATEGORIES)
plt.title('Confusion Matrix on Test Set')
plt.ylabel('Actual Label')
plt.xlabel('Predicted Label')
plt.savefig('confusion_matrix.png')
plt.show()

# ============================================================
# 9. Lưu mô hình cuối cùng
# ============================================================
# BUG FIX: Dùng định dạng .h5 theo yêu cầu của TF2.x trong trường hợp Lambda layer
final_model_path = os.path.join(SAVE_DIR, 'brain_tumor_resnet_final.h5')
model.save(final_model_path, save_format='h5')
print(f"Đã lưu mô hình cuối tại: {final_model_path}")
print(f"Model tốt nhất (best val_accuracy) đã lưu tại: {best_model_path}")