import React from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { FONTS, COLORS, SHADOWS } from '@/constants/theme';
import { API_BASE } from '@/services/apiClient';

const INITIALS_COLORS = [
  COLORS.neonCyan,
  COLORS.neonMagenta,
  COLORS.neonViolet,
  COLORS.neonOrange,
  COLORS.neonLime,
] as const;

export interface AvatarProps {
  uri?: string | null;
  displayName: string;
  size?: number;
  showOnline?: boolean;
  glowColor?: string;
  style?: StyleProp<ViewStyle>;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() ?? '')
    .join('');
}

function getBgColor(name: string): string {
  const index = (name.charCodeAt(0) ?? 0) % INITIALS_COLORS.length;
  return INITIALS_COLORS[index];
}

export function Avatar({
  uri,
  displayName,
  size = 40,
  showOnline = false,
  glowColor,
  style,
}: AvatarProps) {
  const resolvedUri = uri
    ? uri.startsWith('http') ? uri : `${API_BASE}${uri}`
    : null;

  const initials = getInitials(displayName || '?');
  const bgColor = getBgColor(displayName || '?');
  const dotSize = Math.round(size * 0.28);
  const fontSize = Math.round(size * 0.36);

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        glowColor ? SHADOWS.neonGlow(glowColor, 0.6) : undefined,
        style,
      ]}
    >
      {resolvedUri ? (
        <Image
          source={{ uri: resolvedUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.initialsContainer,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor + '33' },
          ]}
        >
          <Text style={[styles.initials, { fontSize, color: bgColor }]}>
            {initials}
          </Text>
        </View>
      )}

      {showOnline && (
        <View
          style={[
            styles.onlineDot,
            { width: dotSize, height: dotSize, borderRadius: dotSize / 2 },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'visible',
  },
  initialsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  initials: {
    fontFamily: FONTS.bodyBold,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.neonLime,
    borderWidth: 2,
    borderColor: '#fff',
  },
});
