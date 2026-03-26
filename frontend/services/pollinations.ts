import { post } from './apiClient';

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

export async function generateImage(
  prompt: string,
  mode: string,
  width: number,
  height: number,
): Promise<string> {
  // Pollinations generates the image on GET request (not HEAD).
  // Return the URL directly — the Image component will trigger generation on load.
  return buildImageUrl(prompt, mode, width, height);
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

export async function generateAllSocialFormats(
  prompt: string,
  onProgress?: (current: number, total: number, label: string) => void,
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  const formats = Object.entries(SOCIAL_FORMATS);
  const total = formats.length;

  for (let i = 0; i < formats.length; i++) {
    const [key, { width, height, label }] = formats[i];
    onProgress?.(i + 1, total, label);

    try {
      const url = await generateImage(prompt, 'social-cover', width, height);
      results.set(key, url);
    } catch {
      results.set(key, null);
    }
  }

  return results;
}
