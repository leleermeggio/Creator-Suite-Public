import React from 'react';
import { Pressable, Platform, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface AnimatedCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  /** Stagger index — delays entrance by index × 60ms */
  index?: number;
}

export function AnimatedCard({ children, onPress, style, index = 0 }: AnimatedCardProps) {
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0);
  const pressScale = useSharedValue(1);

  React.useEffect(() => {
    const delay = index * 60;
    const timer = setTimeout(() => {
      scale.value = withSpring(1, { damping: 15, stiffness: 150 });
      opacity.value = withTiming(1, { duration: 300 });
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pressScale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    pressScale.value = withSpring(0.96, { damping: 20, stiffness: 400 });
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  return (
    <Animated.View style={[style, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{ flex: 1 }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
