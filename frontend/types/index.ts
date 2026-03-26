export interface ProjectFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  phaseId: string;
  source: 'uploaded' | 'tool-output';
  sourceToolId?: string;
  localUri: string;
  createdAt: string;
}

export interface Phase {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number;
  suggestedToolIds: string[];
  files: ProjectFile[];
  status: 'pending' | 'active' | 'completed';
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  templateId?: string;
  phases: Phase[];
  currentPhaseIndex: number;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectIndexEntry {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'archived';
  updatedAt: string;
  templateIcon?: string;
  phaseCount: number;
  currentPhaseIndex: number;
}

export interface PhaseTemplate {
  name: string;
  icon: string;
  color: string;
  order: number;
  suggestedToolIds: string[];
}

export interface Template {
  id: string;
  name: string;
  icon: string;
  description: string;
  creatorType: string;
  defaultPhases: PhaseTemplate[];
  builtIn: boolean;
}

export interface Job {
  id: string;
  toolId: string;
  projectId?: string;
  phaseId?: string;
  status: 'running' | 'completed' | 'failed';
  inputSummary: string;
  outputFileId?: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface AppSettings {
  geminiModel: string;
  googleApiKey: string;
  notifications: boolean;
  autoProcess: boolean;
  highQuality: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  geminiModel: 'gemini-1.5-flash',
  googleApiKey: '',
  notifications: true,
  autoProcess: false,
  highQuality: true,
};
