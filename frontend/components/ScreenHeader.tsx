import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLORS, FONTS, SPACING, SHADOWS, TYPO } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: React.ReactNode;
  gradient?: readonly string[];
  style?: ViewStyle;
}

export function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  right,
  gradient,
  style,
}: ScreenHeaderProps) {
  const router = useRouter();
  const { palette } = useTheme();

  return (
    <View style={[styles.wrapper, Platform.OS === 'web' && { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as any, style]}>
      {/* Blur layer */}
      {Platform.OS !== 'web' ? (
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}

      {/* Gradient accent at bottom edge */}
      <LinearGradient
        colors={gradient ? (gradient as any) : ['transparent', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.accentLine}
      />

      <View style={[styles.content, { backgroundColor: Platform.OS === 'web' ? palette.bgSidebar + 'EE' : 'transparent' }]}>
        <View style={styles.left}>
          {showBack && (
            <Pressable
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={8}
            >
              <Text style={[styles.backIcon, { color: palette.cyan }]}>‹</Text>
            </Pressable>
          )}
          <View>
            <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: palette.textSecondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.select({ ios: 54, android: 24, default: 20 }),
    paddingBottom: SPACING.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  backIcon: {
    fontSize: 28,
    lineHeight: 30,
    fontFamily: FONTS.displayBold,
  },
  title: {
    ...TYPO.h2,
  },
  subtitle: {
    ...TYPO.caption,
    marginTop: 1,
  },
  accentLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.5,
  },
});
