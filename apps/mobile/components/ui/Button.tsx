import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
} from 'react-native';
import { Colors } from '@/constants/colors';

interface ButtonProps extends PressableProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  loading = false,
  fullWidth = true,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const textStyles = [
    baseText,
    variant === 'primary' && styles.primaryText,
    variant === 'secondary' && styles.secondaryText,
    variant === 'ghost' && styles.ghostText,
  ];

  return (
    <Pressable accessibilityRole="button"
      style={({ pressed }) => [
        baseContainer,
        fullWidth ? { width: '100%' as const } : null,
        variant === 'primary' ? styles.primaryBg : null,
        variant === 'secondary' ? styles.secondaryBg : null,
        variant === 'ghost' ? styles.ghostBg : null,
        isDisabled ? { opacity: 0.5 } : null,
        pressed ? { opacity: 0.85 } : null,
      ]}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#fff' : Colors.orange}
          size="small"
        />
      ) : (
        <Text style={textStyles}>{label}</Text>
      )}
    </Pressable>
  );
}

const baseContainer = {
  height: 52,
  borderRadius: 999,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  paddingHorizontal: 20,
};

const baseText = {
  fontSize: 16,
  fontFamily: 'DMSans-Bold',
  letterSpacing: 0.2,
};

// Getters, so each read uses the current theme's colours
const styles = {
  get primaryBg() { return { backgroundColor: Colors.orange }; },
  get secondaryBg() {
    return { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.orange };
  },
  ghostBg: { backgroundColor: 'transparent' },
  primaryText: { color: '#fff' },
  get secondaryText() { return { color: Colors.orange }; },
  get ghostText() { return { color: Colors.muted }; },
};
