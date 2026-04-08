import { useEffect, useRef } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';

/**
 * useStaggeredEntry — returns a shared progress value and a `getItemStyle` helper.
 * Call `getItemStyle(index)` inside useAnimatedStyle in each list item.
 *
 * Usage in component:
 *   const { progress, getItemStyle } = useStaggeredEntry(items.length, 60);
 *   // inside item render:
 *   const style = useAnimatedStyle(() => getItemStyle(index, items.length));
 */
export function useStaggeredEntry(count: number, delayMs = 60) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 400 + count * delayMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [count]);

  const getItemStyle = (index: number, total: number) => {
    'worklet';
    const duration = 400 + total * delayMs;
    const start = (index * delayMs) / duration;
    const itemProgress = interpolate(
      progress.value,
      [start, Math.min(start + 0.5, 1)],
      [0, 1],
      'clamp'
    );
    return {
      opacity: itemProgress,
      transform: [{ translateY: interpolate(itemProgress, [0, 1], [24, 0]) }],
    };
  };

  return { progress, getItemStyle };
}

/**
 * useFloatOnScroll — returns a translateY animated style for a floating element
 * (e.g. tab bar) that hides when scrolling down and reappears on scroll up.
 */
export function useFloatOnScroll(hideOffset = 80) {
  const translateY = useSharedValue(0);
  const lastScrollY = useRef(0);

  const onScroll = (scrollY: number) => {
    const delta = scrollY - lastScrollY.current;
    lastScrollY.current = scrollY;

    if (delta > 4 && scrollY > 100) {
      translateY.value = withSpring(hideOffset, { damping: 20, stiffness: 200 });
    } else if (delta < -4) {
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return { animatedStyle, onScroll };
}

/**
 * usePulseGlow — returns scale + opacity animated style for a neon pulse effect.
 * Loops infinitely while `active` is true.
 */
export function usePulseGlow(active = true) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 900, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(1.0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.6, { duration: 900, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
    } else {
      scale.value = withSpring(1);
      opacity.value = withTiming(0.6);
    }
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return animatedStyle;
}

/**
 * useSpringPress — returns animated style + handlers for spring press feedback.
 */
export function useSpringPress(toScale = 0.96) {
  const scale = useSharedValue(1);

  const onPressIn = () => {
    scale.value = withSpring(toScale, { damping: 15, stiffness: 400 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { animatedStyle, onPressIn, onPressOut };
}

/**
 * useEntranceAnimation — single item fade + slide-up entrance.
 */
export function useEntranceAnimation(delayMs = 0) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      progress.value = withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
      });
    }, delayMs);
    return () => clearTimeout(timeout);
  }, []);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [20, 0]) }],
  }));
}
