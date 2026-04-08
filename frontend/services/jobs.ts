import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Job } from '@/types';

const JOBS_KEY = 'jobs';
const MAX_JOBS = 100;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function getJobs(): Promise<Job[]> {
  const raw = await AsyncStorage.getItem(JOBS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function addJob(
  partial: Omit<Job, 'id' | 'startedAt' | 'status'>,
): Promise<Job> {
  const jobs = await getJobs();
  const job: Job = {
    ...partial,
    id: generateId(),
    status: 'running',
    startedAt: new Date().toISOString(),
  };
  jobs.unshift(job);
  const trimmed = jobs.slice(0, MAX_JOBS);
  await AsyncStorage.setItem(JOBS_KEY, JSON.stringify(trimmed));
  return job;
}

export async function updateJob(
  id: string,
  updates: Partial<Job>,
): Promise<void> {
  const jobs = await getJobs();
  const index = jobs.findIndex(j => j.id === id);
  if (index >= 0) {
    jobs[index] = { ...jobs[index], ...updates };
    await AsyncStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
  }
}
