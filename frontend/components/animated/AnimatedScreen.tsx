import React from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';

interface AnimatedScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function AnimatedScreen({ children, style }: AnimatedScreenProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  React.useEffect(() => {
    opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) });
    translateY.value = withSpring(0, { damping: 20, stiffness: 180 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
    flex: 1,
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
