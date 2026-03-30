export type ControlMode = 'REGISTA' | 'COPILOTA' | 'AUTOPILOTA';

export interface PresetStepDef {
  tool_id: string;
  label: string;
  parameters: Record<string, unknown>;
  auto_run: boolean;
  required: boolean;
  condition: string | null;
}

export interface PresetAgentDef {
  preset_id: string;
  name: string;
  icon: string;
  description: string;
  steps: PresetStepDef[];
  target_platforms: string[];
  default_mode: ControlMode;
}

export const CONTROL_MODE_LABELS: Record<ControlMode, { label: string; emoji: string; desc: string }> = {
  REGISTA: { label: 'Regista', emoji: '🎬', desc: 'Controllo totale, step per step' },
  COPILOTA: { label: 'Copilota', emoji: '🤝', desc: 'AI + te, decisioni creative insieme' },
  AUTOPILOTA: { label: 'Autopilota', emoji: '🚀', desc: 'AI autonoma, revisione finale' },
};

export const PRESET_AGENTS: PresetAgentDef[] = [
  {
    preset_id: 'short-video',
    name: 'Short Video',
    icon: '🎬',
    description: 'Download → Jumpcut → Captions → Thumbnail → Export per TikTok, Reels, Shorts',
    target_platforms: ['tiktok', 'reels', 'shorts'],
    default_mode: 'COPILOTA',
    steps: [
      { tool_id: 'download', label: 'Download / Import', parameters: {}, auto_run: true, required: true, condition: null },
      { tool_id: 'jumpcut', label: 'Jumpcut', parameters: {}, auto_run: true, required: true, condition: null },
      { tool_id: 'captions', label: 'Captions', parameters: {}, auto_run: false, required: true, condition: null },
      { tool_id: 'thumbnail', label: 'Thumbnail', parameters: {}, auto_run: false, required: false, condition: null },
      { tool_id: 'export', label: 'Export', parameters: {}, auto_run: false, required: true, condition: null },
    ],
  },
  {
    preset_id: 'podcast-clip',
    name: 'Podcast Clip',
    icon: '🎙️',
    description: 'Transcribe → AI highlights → Cut → Captions → Export per YouTube, Spotify',
    target_platforms: ['youtube', 'spotify'],
    default_mode: 'COPILOTA',
    steps: [
      { tool_id: 'transcribe', label: 'Trascrivi', parameters: {}, auto_run: true, required: true, condition: null },
      { tool_id: 'ai-highlights', label: 'AI Highlights', parameters: {}, auto_run: false, required: true, condition: null },
      { tool_id: 'cut', label: 'Taglia Segmenti', parameters: {}, auto_run: false, required: true, condition: null },
      { tool_id: 'captions', label: 'Captions', parameters: {}, auto_run: false, required: true, condition: null },
      { tool_id: 'export', label: 'Export', parameters: {}, auto_run: false, required: true, condition: null },
    ],
  },
  {
    preset_id: 'blog-from-video',
    name: 'Blog da Video',
    icon: '📝',
    description: 'Transcribe → Summarize → Translate → Export testo per Blog, LinkedIn',
    target_platforms: ['blog', 'linkedin'],
    default_mode: 'AUTOPILOTA',
    steps: [
      { tool_id: 'transcribe', label: 'Trascrivi', parameters: {}, auto_run: true, required: true, condition: null },
      { tool_id: 'summarize', label: 'Riassumi', parameters: {}, auto_run: true, required: true, condition: null },
      { tool_id: 'translate', label: 'Traduci', parameters: {}, auto_run: false, required: false, condition: null },
      { tool_id: 'export-text', label: 'Esporta Testo', parameters: {}, auto_run: false, required: true, condition: null },
    ],
  },
  {
    preset_id: 'thumbnail-pack',
    name: 'Thumbnail Pack',
    icon: '🖼️',
    description: 'Analizza → Genera 3-4 thumbnail AI con stili diversi',
    target_platforms: ['all'],
    default_mode: 'COPILOTA',
    steps: [
      { tool_id: 'analyze-media', label: 'Analizza Contenuto', parameters: {}, auto_run: true, required: true, condition: null },
      { tool_id: 'thumbnail', label: 'Genera Thumbnail', parameters: { count: 4 }, auto_run: false, required: true, condition: null },
    ],
  },
  {
    preset_id: 'multi-platform',
    name: 'Multi-Platform',
    icon: '🌐',
    description: '1 video → tutti i formati + caption adattate per ogni piattaforma',
    target_platforms: ['youtube', 'tiktok', 'instagram'],
    default_mode: 'COPILOTA',
    steps: [
      { tool_id: 'download', label: 'Import', parameters: {}, auto_run: true, required: true, condition: null },
      { tool_id: 'captions', label: 'Captions', parameters: {}, auto_run: false, required: true, condition: null },
      { tool_id: 'export', label: 'Export Multi-Format', parameters: { formats: ['youtube', 'tiktok', 'instagram'] }, auto_run: false, required: true, condition: null },
    ],
  },
  {
    preset_id: 'audio-cleanup',
    name: 'Audio Cleanup',
    icon: '🔊',
    description: 'Extract audio → Normalize → Remove noise → Re-attach video',
    target_platforms: ['all'],
    default_mode: 'AUTOPILOTA',
    steps: [
      { tool_id: 'extract-audio', label: 'Estrai Audio', parameters: {}, auto_run: true, required: true, condition: null },
      { tool_id: 'normalize', label: 'Normalizza', parameters: {}, auto_run: true, required: true, condition: null },
      { tool_id: 'denoise', label: 'Rimuovi Rumore', parameters: {}, auto_run: true, required: true, condition: null },
      { tool_id: 'reattach', label: 'Riattacca Video', parameters: {}, auto_run: true, required: true, condition: null },
    ],
  },
  {
    preset_id: 'repurpose',
    name: 'Repurpose',
    icon: '♻️',
    description: 'Long video → AI analisi → 3-5 clip → shorts con captions + thumbnail',
    target_platforms: ['tiktok', 'reels', 'shorts'],
    default_mode: 'COPILOTA',
    steps: [
      { tool_id: 'transcribe', label: 'Trascrivi', parameters: {}, auto_run: true, required: true, condition: null },
      { tool_id: 'ai-clips', label: 'AI Trova Clip', parameters: { count: 5 }, auto_run: false, required: true, condition: null },
      { tool_id: 'captions', label: 'Captions', parameters: {}, auto_run: false, required: true, condition: null },
      { tool_id: 'thumbnail', label: 'Thumbnail', parameters: {}, auto_run: false, required: false, condition: null },
    ],
  },
  {
    preset_id: 'translate-localize',
    name: 'Traduci & Localizza',
    icon: '🌍',
    description: 'Transcribe → Translate → TTS voiceover → Export localizzato',
    target_platforms: ['all'],
    default_mode: 'COPILOTA',
    steps: [
      { tool_id: 'transcribe', label: 'Trascrivi', parameters: {}, auto_run: true, required: true, condition: null },
      { tool_id: 'translate', label: 'Traduci Captions', parameters: { languages: ['en', 'es', 'fr'] }, auto_run: false, required: true, condition: null },
      { tool_id: 'tts', label: 'TTS Voiceover', parameters: {}, auto_run: false, required: false, condition: null },
      { tool_id: 'export', label: 'Export Localizzato', parameters: {}, auto_run: false, required: true, condition: null },
    ],
  },
  {
    preset_id: 'content-refresh',
    name: 'Content Refresh',
    icon: '🔄',
    description: 'Old video → Re-thumbnail → Fresh captions → New AI description',
    target_platforms: ['all'],
    default_mode: 'COPILOTA',
    steps: [
      { tool_id: 'download', label: 'Import URL', parameters: {}, auto_run: true, required: true, condition: null },
      { tool_id: 'thumbnail', label: 'Re-Thumbnail', parameters: {}, auto_run: false, required: true, condition: null },
      { tool_id: 'captions', label: 'Fresh Captions', parameters: {}, auto_run: false, required: true, condition: null },
      { tool_id: 'summarize', label: 'AI Description', parameters: {}, auto_run: false, required: false, condition: null },
    ],
  },
];
