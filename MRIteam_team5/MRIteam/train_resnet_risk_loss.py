import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.applications import ResNet50V2 # type: ignore
from tensorflow.keras.applications.resnet_v2 import preprocess_input # type: ignore
from tensorflow.keras.models import Model # type: ignore
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout, Reshape, add, Activation, multiply, GlobalMaxPooling2D, Input # type: ignore
from tensorflow.keras.optimizers import Adam # type: ignore
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau, Callback # type: ignore
import numpy as np
import os
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import seaborn as sns

from preprocess import medical_preprocessing_v2

# ============================================================
# 1. Cấu hình & Định nghĩa Risk Matrix
# ============================================================
IMG_SIZE   = (224, 224)
TRAIN_PATH = "archive_v2/Training"
TEST_PATH  = "archive_v2/Testing"
CATEGORIES = ['glioma', 'meningioma', 'notumor', 'pituitary']
SAVE_DIR   = "models"
os.makedirs(SAVE_DIR, exist_ok=True)
BATCH_SIZE = 32

# Ma trận rủi ro lâm sàng (True Class x Predicted Class)
# 0: glioma (ác tính), 1: meningioma (đa phần lành), 2: notumor (khỏe mạnh), 3: pituitary (tuyến yên)
RISK_MATRIX = [
    # Cột:  Pred Glioma | Pred Menin | Pred Notumor | Pred Pitu
    [       1.0,          2.0,         5.0,           2.0],  # True: Glioma (Bỏ sót u ác phạt cực nặng x5)
    [       1.5,          1.0,         4.0,           2.0],  # True: Meningioma
    [       0.5,          0.5,         1.0,           0.5],  # True: Notumor (Đoán nhầm có u: phạt nhẹ x0.5 vì chỉ gây hoang mang, ko chết người)
    [       1.5,          2.0,         4.0,           1.0],  # True: Pituitary
]

def risk_calibrated_loss(risk_matrix):
    risk_tensor = tf.constant(risk_matrix, dtype=tf.float32)
    
    def loss(y_true, y_pred):
        # Đưa y_true về mảng 1 chiều một cách an toàn
        y_true_int = tf.cast(tf.reshape(y_true, [-1]), tf.int32)
        
        # Tính toán sai số cơ bản (trả về vector 1D)
        base_loss = tf.keras.losses.sparse_categorical_crossentropy(y_true, y_pred)
        
        # Xác định nhãn dự đoán hiện tại
        y_pred_class = tf.cast(tf.argmax(y_pred, axis=-1), tf.int32)
        
        # Tra bảng ma trận rủi ro
        indices = tf.stack([y_true_int, y_pred_class], axis=1)
        risk_weights = tf.gather_nd(risk_tensor, indices)
        
        # Nhân sai số với trọng số rủi ro
        return tf.reduce_mean(base_loss * risk_weights)
    return loss

# ============================================================
# 2. Load Dữ liệu (Dùng chung chuẩn)
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

data_augmentation = keras.Sequential([
    keras.layers.RandomFlip("horizontal"),
    keras.layers.RandomRotation(0.05),
    keras.layers.RandomZoom(0.1),
])

train_dataset = (tf.data.Dataset.from_tensor_slices((X_train_paths, y_train))
    .shuffle(1000)
    .map(process_path, num_parallel_calls=tf.data.AUTOTUNE)
    .batch(BATCH_SIZE)
    .map(lambda x, y: (preprocess_input(data_augmentation(x, training=True)), y), num_parallel_calls=tf.data.AUTOTUNE)
    .prefetch(tf.data.AUTOTUNE))

val_dataset = (tf.data.Dataset.from_tensor_slices((X_val_paths, y_val))
    .map(process_path, num_parallel_calls=tf.data.AUTOTUNE)
    .batch(BATCH_SIZE)
    .map(lambda x, y: (preprocess_input(x), y), num_parallel_calls=tf.data.AUTOTUNE)
    .prefetch(tf.data.AUTOTUNE))

# ============================================================
# 3. Xây dựng mô hình ResNet50 + CBAM
# ============================================================
def channel_attention_module(x, ratio=8):
    channel = x.shape[-1]
    shared_layer_one = Dense(channel // ratio, activation='relu', kernel_initializer='he_normal', use_bias=True)
    shared_layer_two = Dense(channel, kernel_initializer='he_normal', use_bias=True)
    
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

inputs = Input(shape=(224, 224, 3))
base_model = ResNet50V2(weights='imagenet', include_top=False, input_tensor=inputs)
base_model.trainable = False

x = base_model.output
x = channel_attention_module(x)
x = GlobalAveragePooling2D()(x)
x = Dense(256, activation='relu')(x)
x = Dropout(0.5)(x)
predictions = Dense(4, activation='softmax')(x)

model = Model(inputs=base_model.input, outputs=predictions)

# ÁP DỤNG HÀM LOSS ĐỀ XUẤT (NCKH)
model.compile(optimizer=Adam(1e-3), loss=risk_calibrated_loss(RISK_MATRIX), metrics=['accuracy'])

# ============================================================
# 4. Huấn luyện
# ============================================================
best_model_path = os.path.join(SAVE_DIR, 'resnet_risk_calibrated.keras')
callbacks: list[Callback] = [
    ModelCheckpoint(best_model_path, monitor='val_accuracy', save_best_only=True, verbose=1),
    EarlyStopping(monitor='val_accuracy', patience=6, restore_best_weights=True)
]

print("\n[STAGE 1] Huấn luyện với Risk-Calibrated Loss...")
model.fit(train_dataset, epochs=10, validation_data=val_dataset, callbacks=callbacks)

print("\n[STAGE 2] Fine-tuning block cuối...")
base_model.trainable = True
for layer in base_model.layers[:-30]: layer.trainable = False

model.compile(optimizer=Adam(1e-5), loss=risk_calibrated_loss(RISK_MATRIX), metrics=['accuracy'])
model.fit(train_dataset, epochs=20, validation_data=val_dataset, callbacks=callbacks)

print(f"Đã huấn luyện xong mô hình NCKH! Đã lưu tại: {best_model_path}")
