import React from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';

interface ImagePromptInputProps {
  prompt: string;
  setPrompt: (value: string) => void;
  placeholder?: string;
}

export function ImagePromptInput({ prompt, setPrompt, placeholder = "Describe the image you want to generate..." }: ImagePromptInputProps) {
  return (
    <TextInput
      style={styles.promptInput}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      multiline
      value={prompt}
      onChangeText={setPrompt}
      numberOfLines={3}
      {...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {})}
    />
  );
}

const styles = StyleSheet.create({
  promptInput: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 15,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    minHeight: 80,
    textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
});
