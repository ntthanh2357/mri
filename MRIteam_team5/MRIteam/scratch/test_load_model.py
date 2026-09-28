import builtins
import tensorflow as tf

# Gán tf vào builtins bằng setattr để tránh cảnh báo linter static analysis
setattr(builtins, "tf", tf)

try:
    tf.keras.config.enable_unsafe_deserialization()
except AttributeError:
    pass

try:
    model_path = "models/resnet_risk_calibrated.keras"
    model = tf.keras.models.load_model(model_path, custom_objects={'tf': tf}, safe_mode=False, compile=False)
    print("SUCCESS_LOADED:", model.input_shape, "Output:", model.output_shape)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    print("SUCCESS_COMPILED")
except Exception as e:
    print("LOAD_FAILED:", e)
