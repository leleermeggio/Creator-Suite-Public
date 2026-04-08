import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { FONTS, RADIUS, SPACING } from '@/constants/theme';

interface MediaUploaderProps {
  onFileSelected: (file: File) => void;
  uploading?: boolean;
  uploadProgress?: number;
  acceptedTypes?: string;
  label?: string;
}

export function MediaUploader({
  onFileSelected,
  uploading = false,
  uploadProgress,
  acceptedTypes = 'video/*,audio/*,image/*',
  label = 'Carica un file',
}: MediaUploaderProps) {
  const { palette } = useTheme();
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = (file: File) => {
    setSelectedFile(file);
    onFileSelected(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const openPicker = () => {
    inputRef.current?.click();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const borderColor = dragOver
    ? palette.cyan
    : uploading
      ? palette.violet
      : selectedFile
        ? palette.magenta
        : palette.border;

  if (Platform.OS !== 'web') {
    // Native fallback — no drag-and-drop support
    return (
      <View style={[styles.dropZone, { borderColor: palette.border, backgroundColor: palette.card }]}>
        <Text style={[styles.icon]}>📁</Text>
        <Text style={[styles.labelText, { color: palette.textSecondary }]}>
          Caricamento file non disponibile su questa piattaforma
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* Hidden file input */}
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="file"
        accept={acceptedTypes}
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />

      {/* Drop zone */}
      <Pressable onPress={openPicker}>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor,
            borderRadius: RADIUS.lg,
            backgroundColor: dragOver
              ? `${palette.cyan}11`
              : palette.card,
            padding: SPACING.xl,
            alignItems: 'center',
            justifyContent: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING.sm,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            minHeight: 160,
          }}
        >
          {uploading ? (
            <>
              <ActivityIndicator color={palette.violet} size="large" />
              <Text style={[styles.labelText, { color: palette.textSecondary }]}>
                Caricamento in corso…
              </Text>
              {uploadProgress !== undefined && (
                <View style={[styles.progressBar, { backgroundColor: palette.elevated }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.round(uploadProgress)}%` as unknown as number,
                        backgroundColor: palette.violet,
                      },
                    ]}
                  />
                </View>
              )}
              {uploadProgress !== undefined && (
                <Text style={[styles.captionText, { color: palette.textMuted }]}>
                  {Math.round(uploadProgress)}%
                </Text>
              )}
            </>
          ) : selectedFile ? (
            <>
              <Text style={styles.icon}>✅</Text>
              <Text style={[styles.fileNameText, { color: palette.text }]} numberOfLines={1}>
                {selectedFile.name}
              </Text>
              <Text style={[styles.captionText, { color: palette.textMuted }]}>
                {formatBytes(selectedFile.size)} · {selectedFile.type || 'file'}
              </Text>
              <Text style={[styles.changeText, { color: palette.cyan }]}>
                Tocca per cambiare file
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.icon}>{dragOver ? '📂' : '📁'}</Text>
              <Text style={[styles.labelText, { color: palette.text }]}>{label}</Text>
              <Text style={[styles.captionText, { color: palette.textMuted }]}>
                Trascina qui il file oppure tocca per sfogliare
              </Text>
              <Text style={[styles.captionText, { color: palette.textMuted }]}>
                {acceptedTypes.replace(/\*/g, 'tutti').replace(/,/g, ', ')}
              </Text>
            </>
          )}
        </div>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    gap: SPACING.sm,
  },
  icon: {
    fontSize: 36,
  },
  labelText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
    textAlign: 'center',
  },
  fileNameText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 280,
  },
  captionText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    textAlign: 'center',
  },
  changeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  progressBar: {
    height: 4,
    borderRadius: RADIUS.sm,
    width: 200,
    overflow: 'hidden',
    marginTop: SPACING.xs,
  },
  progressFill: {
    height: 4,
    borderRadius: RADIUS.sm,
  },
});
