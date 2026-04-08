import React, { useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';
import type { ProjectIndexEntry } from '@/types';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const STRIP_DAYS = 28;

function stripDate(iso: string): string {
  return iso.slice(0, 10);
}

function buildDays(today: Date): Date[] {
  const days: Date[] = [];
  for (let i = -3; i < STRIP_DAYS; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

interface CalendarEntry {
  project: ProjectIndexEntry;
  date: string;
}

interface ContentCalendarStripProps {
  projects: ProjectIndexEntry[];
  onProjectPress: (id: string) => void;
}

export function ContentCalendarStrip({ projects, onProjectPress }: ContentCalendarStripProps) {
  const scrollRef = useRef<ScrollView>(null);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const days = useMemo(() => buildDays(today), [today]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Build a map of date → projects
  const calendarMap = useMemo(() => {
    const map = new Map<string, ProjectIndexEntry[]>();
    for (const p of projects) {
      if (p.publishDate) {
        const key = stripDate(p.publishDate);
        const list = map.get(key) ?? [];
        list.push(p);
        map.set(key, list);
      }
    }
    return map;
  }, [projects]);

  const scheduledProjects = selectedDate ? (calendarMap.get(selectedDate) ?? []) : [];
  const totalScheduled = useMemo(() => {
    let count = 0;
    for (const [, list] of calendarMap) count += list.length;
    return count;
  }, [calendarMap]);

  const todayStr = stripDate(today.toISOString());

  return (
    <View style={styles.container}>
      {/* Strip header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calendario</Text>
        {totalScheduled > 0 && (
          <View style={styles.scheduledBadge}>
            <Text style={styles.scheduledBadgeText}>{totalScheduled} pianificati</Text>
          </View>
        )}
      </View>

      {/* Day strip */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {days.map((day, i) => {
          const key = stripDate(day.toISOString());
          const isToday = key === todayStr;
          const isPast = day < today;
          const isSelected = key === selectedDate;
          const entries = calendarMap.get(key) ?? [];
          const hasEntries = entries.length > 0;

          return (
            <Pressable
              key={i}
              onPress={() => setSelectedDate(isSelected ? null : key)}
              style={[
                styles.dayCell,
                isToday && styles.dayCellToday,
                isSelected && styles.dayCellSelected,
                isPast && !isToday && styles.dayCellPast,
              ]}
            >
              <Text style={[
                styles.dayName,
                isToday && styles.dayNameToday,
                isSelected && styles.dayNameSelected,
                isPast && !isToday && styles.dayNamePast,
              ]}>
                {DAY_LABELS[day.getDay()]}
              </Text>
              <Text style={[
                styles.dayNum,
                isToday && styles.dayNumToday,
                isSelected && styles.dayNumSelected,
                isPast && !isToday && styles.dayNumPast,
              ]}>
                {day.getDate()}
              </Text>

              {/* Entry dots */}
              <View style={styles.dotRow}>
                {hasEntries ? (
                  entries.slice(0, 3).map((_, di) => (
                    <View
                      key={di}
                      style={[styles.entryDot, {
                        backgroundColor: entries[di].status === 'completed'
                          ? COLORS.neonLime
                          : COLORS.neonCyan,
                      }]}
                    />
                  ))
                ) : (
                  <View style={styles.dotPlaceholder} />
                )}
              </View>

              {entries.length > 3 && (
                <Text style={styles.moreLabel}>+{entries.length - 3}</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Inline day panel (non-modal for simplicity) */}
      {selectedDate && scheduledProjects.length > 0 && (
        <View style={styles.dayPanel}>
          <View style={styles.dayPanelHeader}>
            <Text style={styles.dayPanelTitle}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('it-IT', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </Text>
            <Pressable onPress={() => setSelectedDate(null)} hitSlop={8}>
              <Text style={styles.dayPanelClose}>✕</Text>
            </Pressable>
          </View>
          {scheduledProjects.map(p => (
            <Pressable
              key={p.id}
              onPress={() => { setSelectedDate(null); onProjectPress(p.id); }}
              style={({ pressed }) => [styles.dayPanelRow, { opacity: pressed ? 0.75 : 1 }]}
            >
              <Text style={styles.dayPanelIcon}>{p.templateIcon || '📁'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.dayPanelName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.dayPanelPhase}>
                  Fase {p.currentPhaseIndex + 1}/{p.phaseCount}
                </Text>
              </View>
              <View style={[
                styles.dayPanelStatus,
                { backgroundColor: (p.status === 'completed' ? COLORS.neonLime : COLORS.neonCyan) + '18' },
              ]}>
                <Text style={[
                  styles.dayPanelStatusText,
                  { color: p.status === 'completed' ? COLORS.neonLime : COLORS.neonCyan },
                ]}>
                  {p.status === 'completed' ? '✅' : '📅'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: SPACING.lg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontFamily: FONTS.bodySemiBold, fontSize: 11,
    color: COLORS.textMuted, letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  scheduledBadge: {
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
    borderRadius: RADIUS.full, backgroundColor: COLORS.neonCyan + '18',
    borderWidth: 1, borderColor: COLORS.neonCyan + '33',
  },
  scheduledBadgeText: { fontFamily: FONTS.bodyMedium, fontSize: 10, color: COLORS.neonCyan },

  strip: { gap: 6, paddingBottom: 4 },
  dayCell: {
    width: 46, alignItems: 'center',
    paddingVertical: SPACING.sm, paddingHorizontal: 4,
    borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: COLORS.bgCard,
    gap: 2,
  },
  dayCellToday: {
    borderColor: COLORS.neonCyan + '55',
    backgroundColor: COLORS.neonCyan + '0A',
  },
  dayCellSelected: {
    borderColor: COLORS.neonViolet + '88',
    backgroundColor: COLORS.neonViolet + '12',
  },
  dayCellPast: { opacity: 0.45 },

  dayName: { fontFamily: FONTS.bodyMedium, fontSize: 9, color: COLORS.textMuted, letterSpacing: 0.5 },
  dayNameToday: { color: COLORS.neonCyan },
  dayNameSelected: { color: COLORS.neonViolet },
  dayNamePast: {},

  dayNum: { fontFamily: FONTS.displayBold, fontSize: 16, color: COLORS.textSecondary, lineHeight: 20 },
  dayNumToday: { color: COLORS.neonCyan },
  dayNumSelected: { color: COLORS.neonViolet },
  dayNumPast: {},

  dotRow: { flexDirection: 'row', gap: 2, height: 6, alignItems: 'center', justifyContent: 'center' },
  entryDot: { width: 5, height: 5, borderRadius: 3 },
  dotPlaceholder: { width: 5, height: 5 },
  moreLabel: { fontFamily: FONTS.bodyMedium, fontSize: 8, color: COLORS.textMuted },

  // Day panel (inline below strip)
  dayPanel: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.neonViolet + '33',
    overflow: 'hidden',
  },
  dayPanelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  dayPanelTitle: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: COLORS.textPrimary },
  dayPanelClose: { fontSize: 11, color: COLORS.textMuted },
  dayPanelRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  dayPanelIcon: { fontSize: 20 },
  dayPanelName: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.textPrimary },
  dayPanelPhase: { fontFamily: FONTS.bodyRegular, fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  dayPanelStatus: { width: 28, height: 28, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  dayPanelStatusText: { fontSize: 13 },
});
