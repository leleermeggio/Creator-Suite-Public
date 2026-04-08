import React from 'react';
import { StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

const DRAWER_WIDTH = 280;
const VELOCITY_THRESHOLD = 500;
const POSITION_THRESHOLD = DRAWER_WIDTH * 0.4;

interface GestureDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function GestureDrawer({ isOpen, onClose, children }: GestureDrawerProps) {
  const translateX = useSharedValue(isOpen ? 0 : -DRAWER_WIDTH);
  const startX = useSharedValue(0);

  React.useEffect(() => {
    translateX.value = withSpring(isOpen ? 0 : -DRAWER_WIDTH, {
      damping: 20,
      stiffness: 180,
    });
  }, [isOpen]);

  const pan = Gesture.Pan()
    .onStart(() => {
      // Capture actual position at gesture start to avoid stale closure on isOpen prop
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      translateX.value = Math.min(0, Math.max(-DRAWER_WIDTH, startX.value + e.translationX));
    })
    .onEnd((e) => {
      const shouldClose =
        e.velocityX < -VELOCITY_THRESHOLD ||
        translateX.value < -POSITION_THRESHOLD;
      if (shouldClose) {
        translateX.value = withSpring(-DRAWER_WIDTH, { damping: 20, stiffness: 180 });
        runOnJS(onClose)();
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 180 });
      }
    });

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-DRAWER_WIDTH, 0],
      [0, 0.6],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Drawer */}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.drawer, drawerStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: '#000',
    zIndex: 100,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    zIndex: 101,
  },
});
