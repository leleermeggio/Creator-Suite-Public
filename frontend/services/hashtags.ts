import { post } from '@/services/apiClient';

export interface HashtagsResult {
  result: string;
}

export const generateHashtags = async (
  text: string,
  maxCount: number = 5,
): Promise<string> => {
  const data = await post<HashtagsResult>('/tools/hashtags', {
    text,
    max_count: maxCount,
  });
  return data.result;
};
