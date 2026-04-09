import { post } from './apiClient';
import type { ApiError } from './apiClient';

const BASE_URL = 'https://image.pollinations.ai/prompt';

const STYLE_PREFIXES: Record<string, string> = {
  thumbnail: 'YouTube thumbnail style, bold text, expressive, high contrast, ',
  logo: 'minimalist logo design, clean vector style, centered, ',
  'social-cover': 'social media cover image, vibrant, eye-catching, ',
};

export const SOCIAL_FORMATS = {
  youtube: { width: 1280, height: 720, label: 'YouTube' },
  tiktok: { width: 1080, height: 1920, label: 'TikTok' },
  instagram_post: { width: 1080, height: 1080, label: 'Instagram Post' },
  instagram_story: { width: 1080, height: 1920, label: 'Instagram Story' },
} as const;

export type SocialFormat = keyof typeof SOCIAL_FORMATS;

export function buildImageUrl(
  prompt: string,
  mode: string,
  width: number,
  height: number,
): string {
  const prefix = STYLE_PREFIXES[mode] || '';
  const fullPrompt = encodeURIComponent(prefix + prompt);
  return `${BASE_URL}/${fullPrompt}?width=${width}&height=${height}&nologo=true&seed=${Date.now()}`;
}

export interface GenerateImageOptions {
  prompt: string;
  mode: string;
  width: number;
  height: number;
  timeoutMs?: number; // Default: 30 seconds
}

export async function generateImage(
  options: GenerateImageOptions,
): Promise<string> {
  const { prompt, mode, width, height, timeoutMs = 30000 } = options;
  
  try {
    // Pollinations generates the image on GET request (not HEAD).
    // Return the URL directly — the Image component will trigger generation on load.
    return buildImageUrl(prompt, mode, width, height);
  } catch (error: any) {
    const message = error?.message ?? 'Failed to generate image';
    throw new Error(`Image generation error: ${message}`);
  }
}

export interface ThumbnailResponse {
  id: string;
  project_id: string;
  storage_key?: string | null;
  download_url?: string | null;
  prompt?: string | null;
}

export async function generateImageViaBE(
  prompt: string,
  projectId: string,
): Promise<string> {
  const thumb = await post<ThumbnailResponse>('/thumbnails/generate', {
    project_id: projectId,
    prompt,
  });
  return thumb.download_url ?? thumb.storage_key ?? '';
}

export interface GenerateAllSocialFormatsOptions {
  prompt: string;
  onProgress?: (current: number, total: number, label: string) => void;
  onError?: (format: string, error: Error) => void;
}

export async function generateAllSocialFormats(
  options: GenerateAllSocialFormatsOptions,
): Promise<Map<string, string | null>> {
  const { prompt, onProgress, onError } = options;
  const results = new Map<string, string | null>();
  const formats = Object.entries(SOCIAL_FORMATS);
  const total = formats.length;

  for (let i = 0; i < formats.length; i++) {
    const [key, { width, height, label }] = formats[i];
    onProgress?.(i + 1, total, label);

    try {
      const url = await generateImage({ prompt, mode: 'social-cover', width, height });
      results.set(key, url);
    } catch (error: unknown) {
      console.error(`Error generating format ${key}:`, error);
      onError?.(key, error as Error);
      results.set(key, null);
    }
  }

  return results;
}
