import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors } from '@neuroscan/constants';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      style={[styles.button, styles[variant], disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.text, variant === 'outline' && styles.outlineText]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

interface Styles {
  button: ViewStyle;
  primary: ViewStyle;
  outline: ViewStyle;
  disabled: ViewStyle;
  text: TextStyle;
  outlineText: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  primary: { backgroundColor: Colors.primary },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  disabled: { opacity: 0.5 },
  text: { color: Colors.white, fontWeight: '600', fontSize: 16 },
  outlineText: { color: Colors.primary },
});

export { Button };
