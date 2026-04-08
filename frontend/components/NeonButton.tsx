import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { COLORS, RADIUS, FONTS, SHADOWS } from '@/constants/theme';

interface NeonButtonProps {
  label: string;
  onPress: () => void;
  gradient?: readonly string[];
  style?: ViewStyle;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
}

export function NeonButton({
  label,
  onPress,
  gradient = COLORS.gradCyan,
  style,
  size = 'md',
  loading = false,
  disabled = false,
}: NeonButtonProps) {
  const scale = useSharedValue(1);

  const padV = size === 'sm' ? 10 : size === 'md' ? 14 : 18;
  const padH = size === 'sm' ? 20 : size === 'md' ? 28 : 36;
  const fontSize = size === 'sm' ? 13 : size === 'md' ? 15 : 17;

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(0.95, { damping: 12, stiffness: 400 });
    }
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 400 });
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPress={disabled || loading ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        {...(Platform.OS === 'web'
          ? ({
              style: {
                cursor: disabled || loading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s ease',
                opacity: disabled || loading ? 0.6 : 1,
              } as any,
            })
          : {})}
      >
        <LinearGradient
          colors={gradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradient,
            { paddingVertical: padV, paddingHorizontal: padH },
            SHADOWS.neonGlow(gradient[0], disabled ? 0.15 : 0.4),
            (disabled || loading) && styles.disabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.bg} />
          ) : (
            <Text style={[styles.label, { fontSize }]}>{label}</Text>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.bg,
    letterSpacing: 0.5,
  },
  disabled: {
    opacity: 0.5,
  },
});
