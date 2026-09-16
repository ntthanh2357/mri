import tensorflow as tf
from keras.applications.resnet50 import ResNet50
from keras.models import Model
from keras.layers import Dense, GlobalAveragePooling2D, Dropout, GlobalMaxPooling2D, Reshape, multiply, add, Activation, Concatenate, Conv2D, Lambda
import os

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

def spatial_attention_module(x):
    # Fix the missing output_shape in Lambda layers
    avg_pool = Lambda(lambda x: tf.reduce_mean(x, axis=-1, keepdims=True), output_shape=lambda s: (s[0], s[1], s[2], 1))(x)
    max_pool = Lambda(lambda x: tf.reduce_max(x, axis=-1, keepdims=True), output_shape=lambda s: (s[0], s[1], s[2], 1))(x)
    concat = Concatenate(axis=-1)([avg_pool, max_pool])
    cbam_feature = Conv2D(filters=1, kernel_size=7, strides=1, padding='same', activation='sigmoid', kernel_initializer='he_normal', use_bias=False)(concat)
    return multiply([x, cbam_feature])

def cbam_block(x, ratio=8):
    x = channel_attention_module(x, ratio)
    x = spatial_attention_module(x)
    return x

base_model = ResNet50(weights=None, include_top=False, input_shape=(224, 224, 3))
x = base_model.output
x = cbam_block(x)
x = GlobalAveragePooling2D()(x)
x = Dense(256, activation='relu')(x)
x = Dropout(0.5)(x)
predictions = Dense(4, activation='softmax')(x)

model = Model(inputs=base_model.input, outputs=predictions)

# Load weights from the saved model
model.load_weights('models/brain_tumor_resnet_final.keras')

# Save the model as .h5 as requested
model.save('models/brain_tumor_resnet_final.h5', save_format='h5')
model.save('models/best_resnet_model.h5', save_format='h5')

# Also save an updated .keras model that has the output_shape fixes
model.save('models/brain_tumor_resnet_final_fixed.keras')

print("Conversion and fixes applied successfully!")
