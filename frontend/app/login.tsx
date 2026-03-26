import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CosmicBackground } from '@/components/CosmicBackground';
import { GlowCard } from '@/components/GlowCard';
import { GradientText } from '@/components/GradientText';
import { useAuthContext } from '@/context/AuthContext';
import { COLORS, SPACING, TYPO, FONTS, RADIUS, SHADOWS } from '@/constants/theme';

export default function LoginScreen() {
  const { login } = useAuthContext();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
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
          <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
            {/* Logo / Title */}
            <View style={styles.logoSection}>
              <Text style={styles.logoIcon}>⚡</Text>
              <GradientText gradient={COLORS.gradAurora} style={styles.logoText}>
                CazZone
              </GradientText>
              <Text style={styles.logoSub}>Studio AI per Creator</Text>
            </View>

            {/* Form card */}
            <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
              <GlowCard
                gradient={COLORS.gradCyan}
                glowIntensity={0.35}
                borderWidth={1.5}
                style={styles.card}
              >
                <Text style={styles.formTitle}>Accedi</Text>

                {/* Email */}
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

                {/* Password */}
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

                {/* Error */}
                {error !== '' && (
                  <Text style={styles.errorText}>{error}</Text>
                )}

                {/* Submit button */}
                <Pressable
                  onPress={handleLogin}
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.btnWrapper,
                    { opacity: pressed || submitting ? 0.75 : 1 },
                    Platform.OS === 'web' && { cursor: 'pointer' as any },
                  ]}
                >
                  <LinearGradient
                    colors={[COLORS.neonCyan, COLORS.neonViolet]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.btn}
                  >
                    {submitting ? (
                      <ActivityIndicator color={COLORS.bg} size="small" />
                    ) : (
                      <Text style={styles.btnText}>Accedi</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </GlowCard>
            </Animated.View>

            {/* Dev mode hint */}
            <View style={styles.devHint}>
              <Text style={styles.devHintText}>
                Test: dev@cazzone.local / CazZone2024!
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  flex: {
    flex: 1,
  },
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
  logoSection: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  logoIcon: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  logoText: {
    ...TYPO.hero,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  logoSub: {
    ...TYPO.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  card: {
    width: '100%',
  },
  formTitle: {
    ...TYPO.h2,
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  fieldGroup: {
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    ...TYPO.label,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  input: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.select({ web: 12, default: 14 }),
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.15)',
    ...(Platform.OS === 'web'
      ? {
          outlineStyle: 'none' as any,
          transition: 'border-color 0.2s ease' as any,
        }
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
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    ...SHADOWS.neonGlow(COLORS.neonCyan, 0.5),
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
  devHint: {
    marginTop: SPACING.xl,
    alignItems: 'center',
  },
  devHintText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
