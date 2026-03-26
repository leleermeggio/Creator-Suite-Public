import React from 'react';
import { Text, StyleSheet, Platform, TextStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from 'react-native';
import { COLORS } from '@/constants/theme';

interface GradientTextProps {
  children: React.ReactNode;
  gradient?: readonly string[];
  style?: TextStyle | TextStyle[];
}

/**
 * On web we use CSS background-clip. On native we fall back to the first gradient color.
 * Full MaskedView gradient text would need @react-native-masked-view.
 */
export function GradientText({
  children,
  gradient = COLORS.gradCyan,
  style,
}: GradientTextProps) {
  if (Platform.OS === 'web') {
    return (
      <Text
        style={[
          style,
          {
            // @ts-ignore - web only
            backgroundImage: `linear-gradient(135deg, ${gradient.join(', ')})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          },
        ]}
      >
        {children}
      </Text>
    );
  }

  // Native fallback: use first color
  return (
    <Text style={[style, { color: gradient[0] }]}>
      {children}
    </Text>
  );
}
