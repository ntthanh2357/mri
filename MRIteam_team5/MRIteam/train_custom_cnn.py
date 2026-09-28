import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import MaxPooling2D, Conv2D, Dense, Dropout, Flatten, Input, BatchNormalization
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import ReduceLROnPlateau, ModelCheckpoint, EarlyStopping
import numpy as np
import os
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from preprocess import medical_preprocessing_v2

# ============================================================
# CẤU HÌNH & LOAD DỮ LIỆU
# ============================================================
IMG_SIZE = (224, 224) # Giữ nguyên 224x224 để tương thích hệ thống cũ
TRAIN_PATH = "archive_v2/Training"
TEST_PATH = "archive_v2/Testing"
CATEGORIES = ['glioma', 'meningioma', 'notumor', 'pituitary']
SAVE_DIR = "models"
os.makedirs(SAVE_DIR, exist_ok=True)
BATCH_SIZE = 32

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

# Tác giả Kaggle dùng augmentation khá mạnh:
data_augmentation = keras.Sequential([
    keras.layers.RandomFlip("horizontal"),
    keras.layers.RandomRotation(0.02, fill_mode='constant'),
    keras.layers.RandomContrast(0.1),
    keras.layers.RandomZoom(height_factor=0.01, width_factor=0.05),
    keras.layers.RandomTranslation(height_factor=0.0015, width_factor=0.0015, fill_mode='constant'),
])

train_dataset = (tf.data.Dataset.from_tensor_slices((X_train_paths, y_train))
    .shuffle(1000)
    .map(process_path, num_parallel_calls=tf.data.AUTOTUNE)
    .batch(BATCH_SIZE)
    .map(lambda x, y: (data_augmentation(x, training=True) / 255.0, y), num_parallel_calls=tf.data.AUTOTUNE) # Normalize [0, 1]
    .prefetch(tf.data.AUTOTUNE))

val_dataset = (tf.data.Dataset.from_tensor_slices((X_val_paths, y_val))
    .map(process_path, num_parallel_calls=tf.data.AUTOTUNE)
    .batch(BATCH_SIZE)
    .map(lambda x, y: (x / 255.0, y), num_parallel_calls=tf.data.AUTOTUNE)
    .prefetch(tf.data.AUTOTUNE))

# ============================================================
# XÂY DỰNG MÔ HÌNH TỪ KAGGLE NOTEBOOK
# ============================================================
print("\nKhởi tạo Custom CNN (Mô hình đạt 99% trên Kaggle)...")
model = Sequential([
    Input(shape=(224, 224, 3)),
    
    # Convolutional layer 1
    Conv2D(64, (5, 5), activation="relu", padding="same"),
    BatchNormalization(),
    MaxPooling2D(pool_size=(3, 3)),
    Dropout(0.2),

    # Convolutional layer 2
    Conv2D(64, (5, 5), activation="relu", padding="same"),
    BatchNormalization(),
    MaxPooling2D(pool_size=(3, 3)),
    Dropout(0.2),

    # Convolutional layer 3
    Conv2D(128, (4, 4), activation="relu", padding="same"),
    BatchNormalization(),
    MaxPooling2D(pool_size=(2, 2)),
    Dropout(0.3),

    # Convolutional layer 4
    Conv2D(128, (4, 4), activation="relu", padding="same"),
    BatchNormalization(),
    MaxPooling2D(pool_size=(2, 2)),
    Dropout(0.3),
    
    Flatten(),

    # Dense layers 
    Dense(512, activation="relu"),
    BatchNormalization(),
    Dropout(0.5),
    Dense(4, activation="softmax")
])

model.summary()

# Tác giả Kaggle dùng cấu hình Adam khá đặc biệt
optimizer = Adam(learning_rate=0.001, beta_1=0.85, beta_2=0.9925)
model.compile(optimizer=optimizer, loss='sparse_categorical_crossentropy', metrics=['accuracy'])

# ============================================================
# HUẤN LUYỆN
# ============================================================
best_model_path = os.path.join(SAVE_DIR, 'custom_cnn_kaggle.keras')

model_rlr = ReduceLROnPlateau(monitor='val_loss', factor=0.8, min_lr=1e-4, patience=4, verbose=1)
model_mc = ModelCheckpoint(best_model_path, monitor='val_accuracy', mode='max', save_best_only=True, verbose=1)
model_es = EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True, verbose=1)

print("\nBắt đầu huấn luyện...")
history = model.fit(
    train_dataset,
    epochs=50,
    validation_data=val_dataset,
    callbacks=[model_rlr, model_mc, model_es]
)

print(f"\n[DONE] Đã lưu Custom CNN Kaggle tại {best_model_path}")
