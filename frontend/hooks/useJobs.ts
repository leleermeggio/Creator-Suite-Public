import { useState, useEffect, useCallback } from 'react';
import { getJobs, addJob, updateJob } from '@/services/jobs';
import type { Job } from '@/types';

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const j = await getJobs();
    setJobs(j);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createJob = useCallback(
    async (partial: Omit<Job, 'id' | 'startedAt' | 'status'>) => {
      const job = await addJob(partial);
      await refresh();
      return job;
    },
    [refresh],
  );

  const completeJob = useCallback(
    async (id: string, outputFileId?: string) => {
      await updateJob(id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        outputFileId,
      });
      await refresh();
    },
    [refresh],
  );

  const failJob = useCallback(
    async (id: string, error: string) => {
      await updateJob(id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error,
      });
      await refresh();
    },
    [refresh],
  );

  return { jobs, loading, refresh, createJob, completeJob, failJob };
}
