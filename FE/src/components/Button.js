import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Colors from '../constants/colors';

const Button = ({ title, onPress, variant = 'primary', disabled = false }) => {
  return (
    <TouchableOpacity
      style={[styles.button, styles[variant], disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.text, variant === 'outline' && styles.outlineText]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  primary: { backgroundColor: Colors.primary },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.primary },
  disabled: { opacity: 0.5 },
  text: { color: Colors.white, fontWeight: '600', fontSize: 16 },
  outlineText: { color: Colors.primary },
});

export default Button;
