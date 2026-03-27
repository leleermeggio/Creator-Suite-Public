import { COLORS } from './theme';

export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  gradient: readonly string[];
  accentColor: string;
  available: boolean;
}

export const TOOLS: Tool[] = [
  {
    id: 'transcribe',
    name: 'Trascrivi',
    description: 'Audio e video in testo con Whisper AI',
    icon: '🎙️',
    gradient: COLORS.gradCyan,
    accentColor: COLORS.neonCyan,
    available: false,
  },
  {
    id: 'translate',
    name: 'Traduci',
    description: 'Traduzione istantanea in 100+ lingue',
    icon: '🌍',
    gradient: COLORS.gradViolet,
    accentColor: COLORS.neonViolet,
    available: true,
  },
  {
    id: 'download',
    name: 'Scarica',
    description: 'Video e audio da YouTube, Instagram e altro',
    icon: '⬇️',
    gradient: COLORS.gradOrange,
    accentColor: COLORS.neonOrange,
    available: false,
  },
  {
    id: 'summarize',
    name: 'Riassumi',
    description: 'Riassunti intelligenti con Gemini AI',
    icon: '✨',
    gradient: COLORS.gradMagenta,
    accentColor: COLORS.neonMagenta,
    available: true,
  },
  {
    id: 'ocr',
    name: 'OCR',
    description: 'Estrai testo da immagini e documenti',
    icon: '👁️',
    gradient: COLORS.gradLime,
    accentColor: COLORS.neonLime,
    available: true,
  },
  {
    id: 'tts',
    name: 'Text to Speech',
    description: 'Converti testo in audio naturale',
    icon: '🔊',
    gradient: COLORS.gradSunset,
    accentColor: COLORS.neonYellow,
    available: false,
  },
  {
    id: 'convert',
    name: 'Converti',
    description: 'Converti formati audio e video',
    icon: '🔄',
    gradient: ['#3B82F6', '#00F5FF'],
    accentColor: COLORS.neonBlue,
    available: false,
  },
  {
    id: 'jumpcut',
    name: 'Jump Cut',
    description: 'Rimuovi i silenzi automaticamente',
    icon: '✂️',
    gradient: COLORS.gradFire,
    accentColor: COLORS.neonPink,
    available: true,
  },
  {
    id: 'ai-image',
    name: 'Genera Immagini AI',
    description: 'Thumbnail, loghi e copertine con AI',
    icon: '🎨',
    gradient: ['#FF00E5', '#FFE633'],
    accentColor: '#FF00E5',
    available: true,
  },
];
