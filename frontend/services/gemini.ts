import { post } from './apiClient';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

async function geminiRequest(
  apiKey: string,
  model: string,
  contents: any[],
  systemInstruction?: string,
): Promise<string> {
  const body: any = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const res = await fetch(
    `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${err}`);
  }

  const data: GeminiResponse = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

export async function summarizeText(
  _apiKey: string,
  _model: string,
  text: string,
): Promise<string> {
  const res = await post<{ result: string }>('/tools/summarize', { text });
  return res.result;
}

export async function ocrImage(
  _apiKey: string,
  _model: string,
  imageBase64: string,
  _mimeType = 'image/jpeg',
): Promise<string> {
  const res = await post<{ result: string }>('/tools/ocr', { image_base64: imageBase64 });
  return res.result;
}

const PROJECT_SYSTEM_PROMPT = `You are a workflow assistant for content creators. The user will describe their creative process.
Return ONLY valid JSON with this structure:
{
  "projectName": "suggested name",
  "description": "one-line summary",
  "phases": [
    {
      "name": "phase name in Italian",
      "icon": "single emoji",
      "suggestedToolIds": ["toolId1", "toolId2"]
    }
  ]
}
Available tool IDs: transcribe, translate, download, summarize, ocr, tts, convert, jumpcut, ai-image
Return 3-6 phases. Keep phase names short (1-2 words, Italian).`;

export interface GeneratedProject {
  projectName: string;
  description: string;
  phases: Array<{ name: string; icon: string; suggestedToolIds: string[] }>;
}

export async function generateProjectFromDescription(
  apiKey: string,
  model: string,
  description: string,
): Promise<GeneratedProject> {
  const raw = await geminiRequest(
    apiKey,
    model,
    [{ role: 'user', parts: [{ text: description }] }],
    PROJECT_SYSTEM_PROMPT,
  );

  // Extract JSON from response (may have markdown code fences)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid JSON response from Gemini');

  return JSON.parse(jsonMatch[0]) as GeneratedProject;
}
