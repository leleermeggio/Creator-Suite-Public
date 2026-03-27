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

export type AiProvider = 'pollinations' | 'groq' | 'gemini' | 'openrouter';

export interface ProviderConfig {
  id: AiProvider;
  name: string;
  description: string;
  requiresKey: boolean;
  signupUrl: string;
  models: string[];
  defaultModel: string;
}

export const AI_PROVIDERS: ProviderConfig[] = [
  {
    id: 'pollinations',
    name: 'Pollinations AI',
    description: 'Gratuito, nessuna chiave richiesta',
    requiresKey: false,
    signupUrl: '',
    models: ['openai', 'mistral', 'llama'],
    defaultModel: 'openai',
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Gratuito, velocissimo, Llama 3.3 70B',
    requiresKey: true,
    signupUrl: 'https://console.groq.com/keys',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.3-70b-versatile',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gratuito con chiave AI Studio, ottimo per OCR',
    requiresKey: true,
    signupUrl: 'https://aistudio.google.com/apikey',
    models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'],
    defaultModel: 'gemini-2.0-flash',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Gratuito, accesso a modelli multipli',
    requiresKey: true,
    signupUrl: 'https://openrouter.ai/keys',
    models: ['meta-llama/llama-3.1-8b-instruct:free', 'google/gemma-2-9b-it:free', 'mistralai/mistral-7b-instruct:free'],
    defaultModel: 'meta-llama/llama-3.1-8b-instruct:free',
  },
];

export interface AppSettings {
  aiProvider: AiProvider;
  aiModel: string;
  googleApiKey: string;
  groqApiKey: string;
  openrouterApiKey: string;
  nanobananaApiKey: string;
  geminiModel: string;
  notifications: boolean;
  autoProcess: boolean;
  highQuality: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: 'pollinations',
  aiModel: 'openai',
  googleApiKey: '',
  groqApiKey: '',
  openrouterApiKey: '',
  nanobananaApiKey: '',
  geminiModel: 'gemini-2.0-flash',
  notifications: true,
  autoProcess: false,
  highQuality: true,
};

export type ImageProvider = 'stable-horde' | 'nanobanana';

export interface ImageProviderConfig {
  id: ImageProvider;
  name: string;
  description: string;
  requiresKey: boolean;
  signupUrl: string;
  models: string[];
  defaultModel: string;
}

export const IMAGE_PROVIDERS: ImageProviderConfig[] = [
  {
    id: 'stable-horde',
    name: 'Stable Horde',
    description: 'Gratuito, nessuna chiave richiesta',
    requiresKey: false,
    signupUrl: '',
    models: ['Deliberate', 'DreamShaper', 'Realistic Vision'],
    defaultModel: 'Deliberate',
  },
  {
    id: 'nanobanana',
    name: 'NanoBanana',
    description: 'Gemini-powered, crediti gratuiti disponibili',
    requiresKey: true,
    signupUrl: 'https://nanobananaapi.ai/api-key',
    models: ['nano-banana', 'nano-banana-pro'],
    defaultModel: 'nano-banana',
  },
];
