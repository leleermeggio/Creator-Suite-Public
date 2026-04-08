import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CosmicBackground } from '@/components/CosmicBackground';
import { GlowCard } from '@/components/GlowCard';
import { GradientText } from '@/components/GradientText';
import { AnimatedScreen } from '@/components/animated';
import { useAuthContext } from '@/context/AuthContext';
import { COLORS, SPACING, TYPO, FONTS, RADIUS, SHADOWS, BORDERS } from '@/constants/theme';

export default function LoginScreen() {
  const { login } = useAuthContext();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const shakeX = useSharedValue(0);
  const logoY = useSharedValue(0);
  const btnScale = useSharedValue(1);

  React.useEffect(() => {
    logoY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoY.value }],
  }));

  const btnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  React.useEffect(() => {
    btnScale.value = withSpring(submitting ? 0.97 : 1, { damping: 15, stiffness: 200 });
  }, [submitting]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const shake = () => {
    shakeX.value = withSequence(
      withTiming(10, { duration: 60 }),
      withTiming(-10, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(-8, { duration: 60 }),
      withTiming(0, { duration: 60 })
    );
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Inserisci email e password.');
      shake();
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message ?? 'Accesso fallito. Riprova.');
      shake();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <CosmicBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: 'padding', default: undefined })}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AnimatedScreen style={styles.inner}>
            {/* Logo / Title */}
            <View style={styles.logoSection}>
              <Animated.View style={logoStyle}>
                <Text style={styles.logoIcon}>⚡</Text>
              </Animated.View>
              <GradientText gradient={COLORS.gradAurora} style={styles.logoText}>
                Creator Zone
              </GradientText>
              <Text style={styles.logoSub}>Studio AI per Creator</Text>
            </View>

            {/* Form card — shakes on error */}
            <Animated.View style={shakeStyle}>
              <GlowCard
                gradient={COLORS.gradCyan}
                glowIntensity={0.35}
                borderWidth={1.5}
                style={styles.card}
              >
                <Text style={styles.formTitle}>Accedi</Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>EMAIL</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="la-tua@email.com"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    editable={!submitting}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>PASSWORD</Text>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                    editable={!submitting}
                    onSubmitEditing={handleLogin}
                    returnKeyType="go"
                  />
                </View>

                {error !== '' && <Text style={styles.errorText}>{error}</Text>}

                <Animated.View
                  style={[styles.btnWrapper, btnAnimStyle]}
                >
                  <LinearGradient
                    colors={[COLORS.neonCyan, COLORS.neonViolet]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.btn}
                  >
                    <Text
                      style={styles.btnText}
                      onPress={handleLogin}
                    >
                      {submitting ? '...' : 'Accedi'}
                    </Text>
                  </LinearGradient>
                </Animated.View>
              </GlowCard>
            </Animated.View>
          </AnimatedScreen>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xxxl,
  },
  inner: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  logoSection: { alignItems: 'center', marginBottom: SPACING.xxl },
  logoIcon: { fontSize: 48, marginBottom: SPACING.sm },
  logoText: { ...TYPO.hero, textAlign: 'center', marginBottom: SPACING.xs },
  logoSub: {
    ...TYPO.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  card: { width: '100%' },
  formTitle: { ...TYPO.h2, color: COLORS.textPrimary, marginBottom: SPACING.lg },
  fieldGroup: { marginBottom: SPACING.md },
  fieldLabel: { ...TYPO.label, color: COLORS.textMuted, marginBottom: SPACING.xs },
  input: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: Platform.select({ web: 14, default: 16 }),
    borderWidth: 1,
    borderColor: BORDERS.subtle,
    ...(Platform.OS === 'web'
      ? { outlineStyle: 'none' as any, transition: 'border-color 0.2s ease' as any }
      : {}),
  },
  errorText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.neonPink,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  btnWrapper: {
    marginTop: SPACING.lg,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    ...SHADOWS.subtle,
  },
  btn: {
    paddingVertical: Platform.select({ web: 14, default: 16 }),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  btnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.bg,
    letterSpacing: 0.5,
  },
});
