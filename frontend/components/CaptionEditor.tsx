import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  ListRenderItem,
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING, TYPO } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export interface CaptionSegment {
  id: string;
  start: number;
  end: number;
  text: string;
}

interface SegmentRowProps {
  segment: CaptionSegment;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, text: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

function SegmentRow({ segment, isSelected, onSelect, onUpdate }: SegmentRowProps) {
  const { palette } = useTheme();

  return (
    <Pressable
      onPress={() => onSelect(segment.id)}
      style={[
        styles.segmentRow,
        {
          backgroundColor: isSelected ? palette.sidebarActive : 'transparent',
          borderColor: isSelected ? palette.borderActive : palette.border,
        },
      ]}
    >
      <View style={styles.timecodes}>
        <Text style={[styles.timecode, { color: palette.cyan }]}>
          {formatTime(segment.start)}
        </Text>
        <Text style={[styles.timeSep, { color: palette.textMuted }]}>→</Text>
        <Text style={[styles.timecode, { color: palette.cyan }]}>
          {formatTime(segment.end)}
        </Text>
      </View>

      {isSelected ? (
        <TextInput
          value={segment.text}
          onChangeText={(t) => onUpdate(segment.id, t)}
          multiline
          style={[
            styles.textInput,
            {
              color: palette.text,
              borderColor: palette.borderActive,
              backgroundColor: palette.elevated,
            },
          ]}
          autoFocus
        />
      ) : (
        <Text
          style={[styles.segmentText, { color: palette.text }]}
          numberOfLines={2}
        >
          {segment.text}
        </Text>
      )}
    </Pressable>
  );
}

interface CaptionEditorProps {
  segments: CaptionSegment[];
  onChange: (segments: CaptionSegment[]) => void;
  onExport?: (segments: CaptionSegment[]) => void;
}

export function CaptionEditor({ segments, onChange, onExport }: CaptionEditorProps) {
  const { palette } = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleUpdate = useCallback(
    (id: string, text: string) => {
      onChange(segments.map((s) => (s.id === id ? { ...s, text } : s)));
    },
    [segments, onChange]
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const renderItem: ListRenderItem<CaptionSegment> = ({ item }) => (
    <SegmentRow
      segment={item}
      isSelected={selectedId === item.id}
      onSelect={handleSelect}
      onUpdate={handleUpdate}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          Caption Editor
        </Text>
        <Text style={[styles.segCount, { color: palette.textMuted }]}>
          {segments.length} segments
        </Text>
        {onExport && (
          <Pressable
            onPress={() => onExport(segments)}
            style={[styles.exportBtn, { borderColor: palette.cyan }]}
          >
            <Text style={[styles.exportBtnText, { color: palette.cyan }]}>
              Export SRT
            </Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={segments}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.sm,
  },
  headerTitle: {
    ...TYPO.h3,
    flex: 1,
  },
  segCount: {
    ...TYPO.caption,
  },
  exportBtn: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  exportBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  list: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  segmentRow: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transition: 'background 0.15s' } as any)
      : {}),
  },
  timecodes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  timecode: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  timeSep: {
    fontSize: 10,
  },
  segmentText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  textInput: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
});
