import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getMission,
  startMission as apiStart,
  pauseMission as apiPause,
  resumeMission as apiResume,
  updateMissionMode as apiUpdateMode,
  executeStep as apiExecuteStep,
  skipStep as apiSkipStep,
  updateStepParams as apiUpdateParams,
  acceptInsight as apiAcceptInsight,
  dismissInsight as apiDismissInsight,
  type MissionResponse,
} from '@/services/missionsApi';

const POLL_INTERVAL_MS = 3000;

export function useMission(id: string | null) {
  const [mission, setMission] = useState<MissionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return null;
    try {
      const data = await getMission(id);
      setMission(data);
      return data;
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load mission');
      return null;
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [id, refresh]);

  // Auto-poll while RUNNING
  useEffect(() => {
    if (!mission) return;
    if (mission.status === 'RUNNING') {
      pollRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [mission?.status, refresh]);

  const start = useCallback(async () => {
    if (!id) return;
    const data = await apiStart(id);
    setMission(data);
  }, [id]);

  const pause = useCallback(async () => {
    if (!id) return;
    const data = await apiPause(id);
    setMission(data);
  }, [id]);

  const resume = useCallback(async () => {
    if (!id) return;
    const data = await apiResume(id);
    setMission(data);
  }, [id]);

  const updateMode = useCallback(
    async (mode: string) => {
      if (!id) return;
      const data = await apiUpdateMode(id, mode);
      setMission(data);
    },
    [id],
  );

  const executeStep = useCallback(
    async (stepIndex: number) => {
      if (!id) return;
      const data = await apiExecuteStep(id, stepIndex);
      setMission(data);
    },
    [id],
  );

  const skipStep = useCallback(
    async (stepIndex: number) => {
      if (!id) return;
      const data = await apiSkipStep(id, stepIndex);
      setMission(data);
    },
    [id],
  );

  const updateStepParams = useCallback(
    async (stepIndex: number, parameters: Record<string, unknown>) => {
      if (!id) return;
      const data = await apiUpdateParams(id, stepIndex, parameters);
      setMission(data);
    },
    [id],
  );

  const acceptInsight = useCallback(
    async (insightId: string) => {
      if (!id) return;
      const data = await apiAcceptInsight(id, insightId);
      setMission(data);
    },
    [id],
  );

  const dismissInsight = useCallback(
    async (insightId: string) => {
      if (!id) return;
      const data = await apiDismissInsight(id, insightId);
      setMission(data);
    },
    [id],
  );

  return {
    mission,
    loading,
    error,
    isPolling: mission?.status === 'RUNNING',
    refresh,
    start,
    pause,
    resume,
    updateMode,
    executeStep,
    skipStep,
    updateStepParams,
    acceptInsight,
    dismissInsight,
  };
}
