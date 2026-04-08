import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { FONTS, RADIUS, SPACING } from '@/constants/theme';

/* ─────────────────────────────── helpers ──────────────────────────────── */

function isVideoPath(path: string): boolean {
  return /\.(mp4|mov|mkv|webm)$/i.test(path);
}

function isAudioPath(path: string): boolean {
  return /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(path);
}

/* ────────────────────────────── sub-components ─────────────────────────── */

function VideoPreview({ src }: { src: string }) {
  const { palette } = useTheme();
  if (Platform.OS !== 'web') {
    return (
      <Text style={[styles.fallbackText, { color: palette.textMuted }]}>
        Anteprima video disponibile solo su web.
      </Text>
    );
  }
  return (
    <video
      src={src}
      controls
      style={{
        width: '100%',
        maxHeight: 360,
        borderRadius: RADIUS.md,
        backgroundColor: '#000',
        marginTop: SPACING.sm,
      }}
    />
  );
}

function AudioPreview({ src }: { src: string }) {
  const { palette } = useTheme();
  if (Platform.OS !== 'web') {
    return (
      <Text style={[styles.fallbackText, { color: palette.textMuted }]}>
        Anteprima audio disponibile solo su web.
      </Text>
    );
  }
  return (
    <audio
      src={src}
      controls
      style={{
        width: '100%',
        marginTop: SPACING.sm,
      }}
    />
  );
}

function TextPreview({ label, content }: { label: string; content: string }) {
  const { palette } = useTheme();
  return (
    <View style={[styles.textBlock, { backgroundColor: palette.elevated, borderColor: palette.border }]}>
      <Text style={[styles.textLabel, { color: palette.textMuted }]}>{label}</Text>
      <Text style={[styles.textContent, { color: palette.text }]}>{content}</Text>
    </View>
  );
}

function StatsPreview({ data }: { data: Record<string, unknown> }) {
  const { palette } = useTheme();
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined);
  return (
    <View style={styles.statsGrid}>
      {entries.map(([key, value]) => (
        <View
          key={key}
          style={[styles.statCard, { backgroundColor: palette.elevated, borderColor: palette.border }]}
        >
          <Text style={[styles.statKey, { color: palette.textMuted }]}>
            {key.replace(/_/g, ' ')}
          </Text>
          <Text style={[styles.statValue, { color: palette.cyan }]}>
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ─────────────────────────────── main export ──────────────────────────── */

interface StepOutputPreviewProps {
  toolId: string;
  output: Record<string, unknown>;
}

export function StepOutputPreview({ toolId, output }: StepOutputPreviewProps) {
  const { palette } = useTheme();

  // Error state
  if (output.error) {
    return (
      <View style={[styles.errorBox, { borderColor: palette.magenta, backgroundColor: `${palette.magenta}11` }]}>
        <Text style={[styles.errorTitle, { color: palette.magenta }]}>❌ Errore</Text>
        <Text style={[styles.errorMessage, { color: palette.text }]}>{String(output.error)}</Text>
      </View>
    );
  }

  const outputPath = typeof output.output_path === 'string' ? output.output_path : null;

  // Video output
  if (outputPath && isVideoPath(outputPath)) {
    return (
      <View>
        <VideoPreview src={outputPath} />
      </View>
    );
  }

  // Audio output
  if (outputPath && isAudioPath(outputPath)) {
    return (
      <View>
        <AudioPreview src={outputPath} />
      </View>
    );
  }

  // Text-based outputs
  if (typeof output.transcript === 'string') {
    return <TextPreview label="Trascrizione" content={output.transcript} />;
  }

  if (typeof output.translated_text === 'string') {
    return <TextPreview label="Testo tradotto" content={output.translated_text} />;
  }

  if (typeof output.summary === 'string') {
    return <TextPreview label="Riepilogo" content={output.summary} />;
  }

  if (typeof output.captions === 'string') {
    return <TextPreview label="Captions" content={output.captions} />;
  }

  if (Array.isArray(output.captions)) {
    return <TextPreview label="Captions" content={(output.captions as unknown[]).join('\n')} />;
  }

  // Processing/analysis tool stats
  const processingTools = ['jumpcut', 'analyze-media', 'audio_cleanup', 'normalize', 'denoise', 'reattach'];
  if (processingTools.includes(toolId)) {
    const statsData = { ...output };
    delete statsData.output_path;
    if (Object.keys(statsData).length > 0) {
      return <StatsPreview data={statsData} />;
    }
  }

  // Generic status message
  if (typeof output.status === 'string' || typeof output.message === 'string') {
    const msg = (output.message as string) ?? (output.status as string);
    return (
      <Text style={[styles.genericStatus, { color: palette.textSecondary }]}>{msg}</Text>
    );
  }

  // Fallback: show all keys as stats
  if (Object.keys(output).length > 0) {
    return <StatsPreview data={output} />;
  }

  return (
    <Text style={[styles.genericStatus, { color: palette.textMuted }]}>
      Nessun output disponibile.
    </Text>
  );
}

/* ────────────────────────────────── styles ─────────────────────────────── */

const styles = StyleSheet.create({
  errorBox: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  errorTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
  },
  errorMessage: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  fallbackText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
  },
  textBlock: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  textLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  textContent: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  statCard: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    minWidth: 100,
    flex: 1,
    gap: 2,
  },
  statKey: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'capitalize',
  },
  statValue: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
  },
  genericStatus: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
});
