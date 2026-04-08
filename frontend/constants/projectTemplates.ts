export interface ProjectTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  tags: string[];
  gradient: readonly [string, string];
  defaultExportPreset: string;
  suggestedTools: string[];
  phases: Array<{
    name: string;
    icon: string;
    color: string;
  }>;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'youtube-long',
    name: 'YouTube Long-Form',
    icon: '🎬',
    description: 'Full workflow for 10–60 min YouTube videos: cut, caption, thumbnail, export 1080p60.',
    tags: ['youtube', 'longform', '16:9'],
    gradient: ['#FF6B35', '#FF2D78'],
    defaultExportPreset: 'youtube_1080p',
    suggestedTools: ['jumpcut', 'transcribe', 'captions', 'thumbnail', 'export'],
    phases: [
      { name: 'Record', icon: '🎙️', color: '#FF6B35' },
      { name: 'Edit',   icon: '✂️',  color: '#FF2D78' },
      { name: 'Polish', icon: '✨',  color: '#8B5CF6' },
      { name: 'Publish',icon: '🚀',  color: '#ADFF2F' },
    ],
  },
  {
    id: 'short-form',
    name: 'Short / Reel / TikTok',
    icon: '📱',
    description: 'Fast 9:16 vertical cut: trim silence, burn captions, export for TikTok/Reels/Shorts.',
    tags: ['tiktok', 'reels', 'shorts', '9:16', 'vertical'],
    gradient: ['#00F5FF', '#8B5CF6'],
    defaultExportPreset: 'tiktok',
    suggestedTools: ['jumpcut', 'captions', 'export'],
    phases: [
      { name: 'Clip',    icon: '✂️',  color: '#00F5FF' },
      { name: 'Caption', icon: '💬',  color: '#8B5CF6' },
      { name: 'Export',  icon: '📦',  color: '#FF00E5' },
    ],
  },
  {
    id: 'podcast',
    name: 'Podcast',
    icon: '🎙️',
    description: 'End-to-end podcast: noise cleanup, normalize, transcribe, export MP3 @ 192 kbps.',
    tags: ['podcast', 'audio', 'mp3'],
    gradient: ['#ADFF2F', '#00FF88'],
    defaultExportPreset: 'podcast',
    suggestedTools: ['audio_cleanup', 'normalize', 'transcribe', 'translate', 'export'],
    phases: [
      { name: 'Record',     icon: '🎙️', color: '#ADFF2F' },
      { name: 'Clean Audio',icon: '🔊',  color: '#00FF88' },
      { name: 'Transcribe', icon: '📝',  color: '#00F5FF' },
      { name: 'Publish',    icon: '🚀',  color: '#8B5CF6' },
    ],
  },
  {
    id: 'multilingual',
    name: 'Multilingual Content',
    icon: '🌍',
    description: 'Translate captions & TTS dub into multiple languages, then export per-locale.',
    tags: ['translate', 'multilingual', 'dub', 'tts'],
    gradient: ['#FFE633', '#FF6B35'],
    defaultExportPreset: 'youtube_1080p',
    suggestedTools: ['transcribe', 'translate', 'tts', 'captions', 'export'],
    phases: [
      { name: 'Transcribe', icon: '📝',  color: '#FFE633' },
      { name: 'Translate',  icon: '🌐',  color: '#FF6B35' },
      { name: 'Dub / TTS',  icon: '🔊',  color: '#FF2D78' },
      { name: 'Export All', icon: '📦',  color: '#8B5CF6' },
    ],
  },
];

export const getTemplateById = (id: string): ProjectTemplate | undefined =>
  PROJECT_TEMPLATES.find((t) => t.id === id);
