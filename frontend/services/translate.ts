import { post } from './apiClient';

export async function translateText(
  text: string,
  targetLang: string,
  _apiKey?: string,
  _model?: string,
): Promise<string> {
  const res = await post<{ result: string }>('/tools/translate', { text, target_language: targetLang });
  return res.result;
}

export const LANGUAGES: Record<string, string> = {
  it: 'Italiano',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  ru: 'Русский',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  ar: 'العربية',
  hi: 'हिन्दी',
  tr: 'Türkçe',
  pl: 'Polski',
  nl: 'Nederlands',
  sv: 'Svenska',
  da: 'Dansk',
  fi: 'Suomi',
  no: 'Norsk',
  el: 'Ελληνικά',
  cs: 'Čeština',
  ro: 'Română',
  hu: 'Magyar',
  uk: 'Українська',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
  he: 'עברית',
  bg: 'Български',
};
