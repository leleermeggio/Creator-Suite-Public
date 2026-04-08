export interface PlatformDef {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export const PLATFORMS: PlatformDef[] = [
  { id: 'tiktok', name: 'TikTok', emoji: '🎵', color: '#FF0050' },
  { id: 'youtube', name: 'YouTube', emoji: '▶️', color: '#FF0000' },
  { id: 'instagram', name: 'Instagram', emoji: '📷', color: '#E1306C' },
  { id: 'reels', name: 'Reels', emoji: '🎬', color: '#E1306C' },
  { id: 'shorts', name: 'Shorts', emoji: '⚡', color: '#FF0000' },
  { id: 'spotify', name: 'Spotify', emoji: '🎧', color: '#1DB954' },
  { id: 'linkedin', name: 'LinkedIn', emoji: '💼', color: '#0A66C2' },
  { id: 'blog', name: 'Blog', emoji: '📝', color: '#888888' },
  { id: 'all', name: 'Tutte le piattaforme', emoji: '🌐', color: '#9944FF' },
];

export function getPlatformDef(id: string): PlatformDef | undefined {
  return PLATFORMS.find((p) => p.id === id);
}
