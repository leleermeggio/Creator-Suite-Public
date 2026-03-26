import { post, get, ApiError } from './apiClient';

export type JobType =
  | 'transcribe'
  | 'jumpcut'
  | 'export'
  | 'caption'
  | 'audio_cleanup'
  | 'smart_search'
  | 'thumbnail'
  | 'download'
  | 'convert'
  | 'tts'
  | 'translate';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface JobResponse {
  id: string;
  project_id: string;
  user_id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  input_params: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export async function createJob(
  project_id: string,
  type: JobType,
  input_params?: Record<string, unknown>,
): Promise<JobResponse> {
  return post<JobResponse>('/jobs/', { project_id, type, input_params });
}

export async function getJob(job_id: string): Promise<JobResponse> {
  return get<JobResponse>(`/jobs/${job_id}`);
}

export async function pollJob(
  job_id: string,
  intervalMs: number = 2000,
  timeoutMs: number = 300_000,
): Promise<JobResponse> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await getJob(job_id);
    if (job.status === 'completed' || job.status === 'failed') {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new ApiError(408, `Job ${job_id} timed out after ${timeoutMs}ms`);
}
