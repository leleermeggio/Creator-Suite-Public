import { post, get } from './apiClient';

export interface ThumbnailGenerateParams {
  project_id: string;
  template_id: string;
  title: string;
  subtitle?: string;
  accent_color: string;
  subject_photo_b64?: string;
}

interface JobResponse {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  result?: { storage_key?: string; download_url?: string };
  error?: string;
}

async function pollJob(jobId: string, intervalMs = 2000, timeoutMs = 120000): Promise<JobResponse> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = await get<JobResponse>(`/jobs/${jobId}`);
    if (job.status === 'completed' || job.status === 'failed') return job;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Timeout: generazione thumbnail troppo lenta.');
}

export async function generateThumbnail(params: ThumbnailGenerateParams): Promise<string> {
  const { job_id } = await post<{ job_id: string; status: string }>('/thumbnails/generate', params);
  const job = await pollJob(job_id);
  if (job.status === 'failed') throw new Error(job.error ?? 'Generazione fallita.');
  const url = job.result?.download_url ?? job.result?.storage_key;
  if (!url) throw new Error('Nessun URL nella risposta.');
  return url;
}
