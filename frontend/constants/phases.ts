export const PHASE_COLORS = [
  '#FF6B35', // Orange
  '#FF2D78', // Pink
  '#8B5CF6', // Violet
  '#ADFF2F', // Lime
  '#00F5FF', // Cyan
  '#FFE633', // Yellow
] as const;

export function getPhaseColor(index: number): string {
  return PHASE_COLORS[index % PHASE_COLORS.length];
}
