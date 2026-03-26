import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const BASE_DIR = FileSystem.documentDirectory || '';

export function getProjectDir(projectId: string): string {
  return `${BASE_DIR}projects/${projectId}/`;
}

export function getPhaseDir(projectId: string, phaseId: string): string {
  return `${BASE_DIR}projects/${projectId}/${phaseId}/`;
}

export async function ensureProjectDirs(projectId: string, phaseIds: string[]): Promise<void> {
  if (Platform.OS === 'web') return;
  for (const phaseId of phaseIds) {
    const dir = getPhaseDir(projectId, phaseId);
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  }
}

export async function saveFileToPhase(
  projectId: string,
  phaseId: string,
  sourceUri: string,
  filename: string,
): Promise<string> {
  if (Platform.OS === 'web') return sourceUri;
  const destDir = getPhaseDir(projectId, phaseId);
  await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
  const destUri = `${destDir}${filename}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  return destUri;
}

export async function deleteProjectFiles(projectId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const dir = getProjectDir(projectId);
  const info = await FileSystem.getInfoAsync(dir);
  if (info.exists) {
    await FileSystem.deleteAsync(dir, { idempotent: true });
  }
}

export async function deleteFile(localUri: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const info = await FileSystem.getInfoAsync(localUri);
  if (info.exists) {
    await FileSystem.deleteAsync(localUri, { idempotent: true });
  }
}
