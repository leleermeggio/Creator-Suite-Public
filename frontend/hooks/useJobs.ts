import { useState, useEffect, useCallback } from 'react';
import { getJobs, addJob, updateJob } from '@/services/jobs';
import type { Job } from '@/types';

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const j = await getJobs();
      setJobs(j);
    } catch (error: unknown) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createJob = useCallback(
    async (partial: Omit<Job, 'id' | 'startedAt' | 'status'>) => {
      try {
        const job = await addJob(partial);
        await refresh();
        return job;
      } catch (error: unknown) {
        throw new Error(error instanceof Error ? error.message : 'Error creating job');
      }
    },
    [refresh],
  );

  const completeJob = useCallback(
    async (id: string, outputFileId?: string) => {
      try {
        await updateJob(id, {
          status: 'completed',
          completedAt: new Date().toISOString(),
          outputFileId,
        });
        await refresh();
      } catch (error: unknown) {
        throw new Error(error instanceof Error ? error.message : 'Error completing job');
      }
    },
    [refresh],
  );

  const failJob = useCallback(
    async (id: string, error: string) => {
      try {
        await updateJob(id, {
          status: 'failed',
          completedAt: new Date().toISOString(),
          error,
        });
        await refresh();
      } catch (error: unknown) {
        throw new Error(error instanceof Error ? error.message : 'Error failing job');
      }
    },
    [refresh],
  );

  return { jobs, loading, refresh, createJob, completeJob, failJob };
}
