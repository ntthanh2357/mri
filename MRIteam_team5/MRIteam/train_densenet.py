import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.applications import DenseNet121 # type: ignore
from tensorflow.keras.applications.densenet import preprocess_input # type: ignore
from tensorflow.keras.models import Model # type: ignore
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout # type: ignore
from tensorflow.keras.optimizers import Adam # type: ignore
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau, Callback # type: ignore
import numpy as np
import os
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.utils.class_weight import compute_class_weight
import seaborn as sns

from preprocess import medical_preprocessing_v2

# ============================================================
# 1. Cấu hình
# ============================================================
IMG_SIZE   = (224, 224)
TRAIN_PATH = "archive_v2/Training"
TEST_PATH  = "archive_v2/Testing"
CATEGORIES = ['glioma', 'meningioma', 'notumor', 'pituitary']
SAVE_DIR   = "models"
os.makedirs(SAVE_DIR, exist_ok=True)
BATCH_SIZE = 32

# ============================================================
# 2. Load dữ liệu (Giống các script khác để công bằng)
# ============================================================
def load_paths_from_dir(directory):
    paths, labels = [], []
    for category in CATEGORIES:
        path = os.path.join(directory, category)
        if not os.path.isdir(path): continue
        class_num = CATEGORIES.index(category)
        for img_name in os.listdir(path):
            if img_name.lower().endswith(('.jpg', '.jpeg', '.png')):
                paths.append(os.path.join(path, img_name))
                labels.append(class_num)
    combined = list(zip(paths, labels))
    np.random.shuffle(combined)
    if combined:
        paths, labels = zip(*combined)
        return list(paths), np.array(labels, dtype='int32')
    return [], np.array([], dtype='int32')

X_train_paths, y_raw = load_paths_from_dir(TRAIN_PATH)
X_test_paths, y_test = load_paths_from_dir(TEST_PATH)

X_train_paths, X_val_paths, y_train, y_val = train_test_split(
    X_train_paths, y_raw, test_size=0.2, random_state=42, stratify=y_raw
)

def process_path(file_path, label):
    def _process(p):
        p_str = p.decode('utf-8')
        img = medical_preprocessing_v2(p_str)
        if img is None: img = np.zeros((224, 224, 3), dtype=np.float32)
        return img
    img = tf.numpy_function(_process, [file_path], tf.float32)
    img.set_shape([224, 224, 3])
    return img, label

# Data Augmentation (Keras 3)
data_augmentation = keras.Sequential([
    keras.layers.RandomFlip("horizontal"),
    keras.layers.RandomRotation(0.0278),
    keras.layers.RandomZoom(0.1),
    keras.layers.RandomTranslation(0.08, 0.08),
    keras.layers.RandomBrightness(0.1),
])

train_dataset = (tf.data.Dataset.from_tensor_slices((X_train_paths, y_train))
    .shuffle(buffer_size=len(X_train_paths), seed=42)
    .map(process_path, num_parallel_calls=tf.data.AUTOTUNE)
    .batch(BATCH_SIZE)
    .map(lambda x, y: (preprocess_input(data_augmentation(x, training=True)), y), num_parallel_calls=tf.data.AUTOTUNE)
    .prefetch(tf.data.AUTOTUNE))

val_dataset = (tf.data.Dataset.from_tensor_slices((X_val_paths, y_val))
    .map(process_path, num_parallel_calls=tf.data.AUTOTUNE)
    .batch(BATCH_SIZE)
    .map(lambda x, y: (preprocess_input(x), y), num_parallel_calls=tf.data.AUTOTUNE)
    .prefetch(tf.data.AUTOTUNE))

test_dataset = (tf.data.Dataset.from_tensor_slices((X_test_paths, y_test))
    .map(process_path, num_parallel_calls=tf.data.AUTOTUNE)
    .batch(BATCH_SIZE)
    .map(lambda x, y: (preprocess_input(x), y), num_parallel_calls=tf.data.AUTOTUNE)
    .prefetch(tf.data.AUTOTUNE))

# ============================================================
# 3. Xây dựng mô hình DenseNet121
# ============================================================
print("\nKhởi tạo mô hình DenseNet121...")
base_model = DenseNet121(weights='imagenet', include_top=False, input_shape=(224, 224, 3))
base_model.trainable = False

x = base_model.output
x = GlobalAveragePooling2D()(x)
x = Dense(256, activation='relu')(x)
x = Dropout(0.5)(x)
predictions = Dense(4, activation='softmax')(x)

model = Model(inputs=base_model.input, outputs=predictions)
model.compile(optimizer=Adam(learning_rate=1e-3), loss='sparse_categorical_crossentropy', metrics=['accuracy'])

# ============================================================
# 4. Huấn luyện
# ============================================================
best_model_path = os.path.join(SAVE_DIR, 'best_densenet_model.keras')
callbacks: list[Callback] = [
    ModelCheckpoint(filepath=best_model_path, monitor='val_accuracy', save_best_only=True, verbose=1),
    EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True, verbose=1),
    ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3, min_lr=1e-6, verbose=1),
]

class_weights = compute_class_weight(class_weight='balanced', classes=np.unique(y_train), y=y_train)
class_weight_dict = dict(enumerate(class_weights))

print("\n[STAGE 1] Huấn luyện Classification Head (DenseNet đóng băng)...")
history1 = model.fit(train_dataset, epochs=10, validation_data=val_dataset, class_weight=class_weight_dict)

print("\n[STAGE 2] Fine-tuning (Mở khóa block cuối của DenseNet)...")
base_model.trainable = True
for layer in base_model.layers[:-40]:
    layer.trainable = False

model.compile(optimizer=Adam(learning_rate=1e-5), loss='sparse_categorical_crossentropy', metrics=['accuracy'])
history2 = model.fit(train_dataset, epochs=25, validation_data=val_dataset, class_weight=class_weight_dict, callbacks=callbacks)

# ============================================================
# 5. Đánh giá tập Test & Lưu kết quả
# ============================================================
print("\n--- BÁO CÁO ĐÁNH GIÁ DENSENET121 TRÊN TẬP TEST ---")
y_pred = model.predict(test_dataset)
y_pred_classes = np.argmax(y_pred, axis=1)

print(classification_report(y_test, y_pred_classes, target_names=CATEGORIES))

plt.figure(figsize=(8, 6))
cm = confusion_matrix(y_test, y_pred_classes)
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=CATEGORIES, yticklabels=CATEGORIES)
plt.title('Confusion Matrix - DenseNet121')
plt.ylabel('Actual Label')
plt.xlabel('Predicted Label')
plt.savefig(os.path.join(SAVE_DIR, 'confusion_matrix_densenet.png'))
print(f"Đã huấn luyện xong! Model lưu tại: {best_model_path}")
