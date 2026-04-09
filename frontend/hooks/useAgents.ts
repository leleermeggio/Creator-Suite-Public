import { useState, useEffect, useCallback } from 'react';
import {
  listAgents,
  listPresetAgents,
  deleteAgent as apiDeleteAgent,
  type AgentResponse,
} from '@/services/agentsApi';

export function useAgents() {
  const [agents, setAgents] = useState<AgentResponse[]>([]);
  const [presets, setPresets] = useState<AgentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [all, presetList] = await Promise.all([listAgents(), listPresetAgents()]);
      setAgents(all.filter((a) => !a.is_preset));
      setPresets(presetList);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error loading agents');
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAgent = useCallback(
    async (id: string) => {
      try {
        await apiDeleteAgent(id);
        await refresh();
      } catch (error: unknown) {
        throw new Error(error instanceof Error ? error.message : 'Error deleting agent');
      }
    },
    [refresh],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { agents, presets, loading, error, refresh, deleteAgent };
}
