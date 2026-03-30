import { useState, useEffect, useCallback } from 'react';
import {
  getAgent,
  updateAgent as apiUpdateAgent,
  deleteAgent as apiDeleteAgent,
  type AgentResponse,
  type AgentCreate,
} from '@/services/agentsApi';

export function useAgent(id: string | null) {
  const [agent, setAgent] = useState<AgentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAgent(id);
      setAgent(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load agent');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const update = useCallback(
    async (data: Partial<AgentCreate>) => {
      if (!id) return;
      const updated = await apiUpdateAgent(id, data);
      setAgent(updated);
      return updated;
    },
    [id],
  );

  const remove = useCallback(async () => {
    if (!id) return;
    await apiDeleteAgent(id);
    setAgent(null);
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { agent, loading, error, refresh, update, remove };
}
