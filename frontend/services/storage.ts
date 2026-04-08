import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Project, ProjectIndexEntry, AppSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

const KEYS = {
  projectIndex: 'project_index',
  project: (id: string) => `project:${id}`,
  settings: 'settings',
  jobs: 'jobs',
};

export async function getProjectIndex(): Promise<ProjectIndexEntry[]> {
  const raw = await AsyncStorage.getItem(KEYS.projectIndex);
  return raw ? JSON.parse(raw) : [];
}

export async function getProject(id: string): Promise<Project | null> {
  const raw = await AsyncStorage.getItem(KEYS.project(id));
  return raw ? JSON.parse(raw) : null;
}

export async function saveProject(project: Project): Promise<void> {
  project.updatedAt = new Date().toISOString();
  await AsyncStorage.setItem(KEYS.project(project.id), JSON.stringify(project));
  await updateProjectIndex(project);
}

export async function deleteProject(id: string): Promise<void> {
  await AsyncStorage.removeItem(KEYS.project(id));
  const index = await getProjectIndex();
  const filtered = index.filter(e => e.id !== id);
  await AsyncStorage.setItem(KEYS.projectIndex, JSON.stringify(filtered));
}

async function updateProjectIndex(project: Project): Promise<void> {
  const index = await getProjectIndex();
  const entry: ProjectIndexEntry = {
    id: project.id,
    name: project.name,
    status: project.status,
    updatedAt: project.updatedAt,
    templateIcon: project.phases[0]?.icon,
    phaseCount: project.phases.length,
    currentPhaseIndex: project.currentPhaseIndex,
    phaseIcons: project.phases.map(p => p.icon),
    publishDate: project.contentBrief?.publishDate,
    platforms: project.contentBrief?.platforms,
  };
  const existing = index.findIndex(e => e.id === project.id);
  if (existing >= 0) {
    index[existing] = entry;
  } else {
    index.unshift(entry);
  }
  await AsyncStorage.setItem(KEYS.projectIndex, JSON.stringify(index));
}

export async function getSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(KEYS.settings);
  return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
}
