import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

export const SCREEN = { width, height };

// Cosmic Neon palette — deep space darks with electric neon accents
export const COLORS = {
  // Backgrounds
  bg: '#06060C',
  bgCard: '#0D0D18',
  bgElevated: '#12122A',
  bgGlass: 'rgba(13, 13, 24, 0.72)',

  // Neon primaries
  neonCyan: '#00F5FF',
  neonMagenta: '#FF00E5',
  neonLime: '#ADFF2F',
  neonOrange: '#FF6B35',
  neonViolet: '#8B5CF6',
  neonPink: '#FF2D78',
  neonYellow: '#FFE633',
  neonBlue: '#3B82F6',

  // Text
  textPrimary: '#F0F0FF',
  textSecondary: '#8888AA',
  textMuted: '#555577',

  // Gradients (pairs)
  gradCyan: ['#00F5FF', '#0088FF'],
  gradMagenta: ['#FF00E5', '#8B00FF'],
  gradLime: ['#ADFF2F', '#00FF88'],
  gradOrange: ['#FF6B35', '#FF2D78'],
  gradViolet: ['#8B5CF6', '#3B82F6'],
  gradSunset: ['#FF6B35', '#FFE633'],
  gradAurora: ['#00F5FF', '#8B5CF6', '#FF00E5'],
  gradFire: ['#FF2D78', '#FF6B35', '#FFE633'],
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
  xxl2: 80,
  xxl3: 96,
} as const;

export const RADIUS = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
} as const;

export const BORDERS = {
  subtle: 'rgba(255,255,255,0.06)',
  hover: 'rgba(255,255,255,0.12)',
  active: 'rgba(0,245,255,0.15)',
  platform: {
    youtube: 'rgba(255,0,0,0.2)',
    tiktok: 'rgba(255,255,255,0.1)',
    instagram: 'rgba(225,48,108,0.2)',
  },
} as const;

export const FONTS = {
  // Display / headings — geometric, premium
  displayBold: 'PlusJakartaSans_700Bold',
  displayExtra: 'PlusJakartaSans_800ExtraBold',
  // Body — clean, data-optimized
  bodyLight: 'Inter_300Light',
  bodyRegular: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const TYPO = {
  hero: { fontFamily: FONTS.displayExtra, fontSize: 38, lineHeight: 44, letterSpacing: -1 },
  h1: { fontFamily: FONTS.displayBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  h2: { fontFamily: FONTS.displayBold, fontSize: 22, lineHeight: 28 },
  h3: { fontFamily: FONTS.bodySemiBold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: FONTS.bodyRegular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: FONTS.bodyMedium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: FONTS.bodyMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
  label: { fontFamily: FONTS.bodySemiBold, fontSize: 13, lineHeight: 18, letterSpacing: 1, textTransform: 'uppercase' as const },
} as const;

export const SHADOWS = {
  neonGlow: (color: string, intensity = 1) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6 * intensity,
    shadowRadius: 20 * intensity,
    elevation: 12,
    ...(Platform.OS === 'web' ? {
      boxShadow: `0 0 ${20 * intensity}px ${color}44, 0 0 ${60 * intensity}px ${color}22`,
    } : {}),
  }),
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;

// Responsive breakpoints for web
export const isWeb = Platform.OS === 'web';
export const isSmall = width < 380;
export const isMedium = width >= 380 && width < 768;
export const isLarge = width >= 768;
export const isDesktop = width >= 1024;

export const getColumns = () => {
  if (isDesktop) return 4;
  if (isLarge) return 3;
  return 2;
};

// ── Spec-aligned theme palettes (section 13) ──────────────────────────────────

export interface ThemePalette {
  bg: string;
  bgSidebar: string;
  card: string;
  elevated: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  cyan: string;
  magenta: string;
  violet: string;
  border: string;
  borderActive: string;
  sidebarActive: string;
  grain: boolean;
}

export const DARK_PALETTE: ThemePalette = {
  bg: '#04040A',
  bgSidebar: '#080812',
  card: '#0A0A16',
  elevated: '#10102A',
  text: '#EEEEFF',
  textSecondary: '#7777AA',
  textMuted: '#444466',
  cyan: '#00FFD0',
  magenta: '#FF00AA',
  violet: '#9944FF',
  border: 'rgba(255,255,255,0.06)',
  borderActive: 'rgba(0,255,208,0.25)',
  sidebarActive: 'rgba(0,255,208,0.08)',
  grain: true,
};

export const LIGHT_PALETTE: ThemePalette = {
  bg: '#F4F4F8',
  bgSidebar: '#FFFFFF',
  card: '#FFFFFF',
  elevated: '#F0F0F6',
  text: '#111122',
  textSecondary: '#555577',
  textMuted: '#9999AA',
  cyan: '#00B896',
  magenta: '#CC0088',
  violet: '#7722DD',
  border: 'rgba(0,0,0,0.08)',
  borderActive: 'rgba(0,184,150,0.3)',
  sidebarActive: 'rgba(0,184,150,0.08)',
  grain: false,
};
