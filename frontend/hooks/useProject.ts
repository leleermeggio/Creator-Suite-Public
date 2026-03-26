import { useState, useEffect, useCallback } from 'react';
import { getProject, saveProject } from '@/services/storage';
import { saveFileToPhase } from '@/services/file-system';
import type { Project, ProjectFile } from '@/types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function useProject(id: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) return;
    const p = await getProject(id);
    setProject(p);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (updated: Project) => {
      await saveProject(updated);
      setProject(updated);
    },
    [],
  );

  const advancePhase = useCallback(async () => {
    if (!project) return;
    const updated = { ...project, phases: [...project.phases] };
    // Complete current phase
    if (updated.phases[updated.currentPhaseIndex]) {
      updated.phases[updated.currentPhaseIndex] = {
        ...updated.phases[updated.currentPhaseIndex],
        status: 'completed',
      };
    }
    // Activate next if exists
    const next = updated.currentPhaseIndex + 1;
    if (next < updated.phases.length) {
      updated.currentPhaseIndex = next;
      updated.phases[next] = { ...updated.phases[next], status: 'active' };
    } else {
      updated.status = 'completed';
    }
    await save(updated);
  }, [project, save]);

  const setActivePhase = useCallback(
    async (index: number) => {
      if (!project) return;
      const updated = { ...project, phases: [...project.phases] };
      updated.currentPhaseIndex = index;
      if (updated.phases[index].status === 'pending') {
        updated.phases[index] = { ...updated.phases[index], status: 'active' };
      }
      await save(updated);
    },
    [project, save],
  );

  const addFileToPhase = useCallback(
    async (
      phaseId: string,
      sourceUri: string,
      filename: string,
      mimeType: string,
      size: number,
      source: 'uploaded' | 'tool-output' = 'uploaded',
      sourceToolId?: string,
    ): Promise<ProjectFile> => {
      if (!project) throw new Error('No project loaded');

      const localUri = await saveFileToPhase(project.id, phaseId, sourceUri, filename);
      const file: ProjectFile = {
        id: generateId(),
        filename,
        mimeType,
        size,
        phaseId,
        source,
        sourceToolId,
        localUri,
        createdAt: new Date().toISOString(),
      };

      const updated = { ...project, phases: [...project.phases] };
      const phaseIdx = updated.phases.findIndex(p => p.id === phaseId);
      if (phaseIdx >= 0) {
        updated.phases[phaseIdx] = {
          ...updated.phases[phaseIdx],
          files: [...updated.phases[phaseIdx].files, file],
        };
      }
      await save(updated);
      return file;
    },
    [project, save],
  );

  const linkFileToPhase = useCallback(
    async (file: ProjectFile, targetPhaseId: string) => {
      if (!project) return;
      const linked: ProjectFile = {
        ...file,
        id: generateId(),
        phaseId: targetPhaseId,
        createdAt: new Date().toISOString(),
      };
      const updated = { ...project, phases: [...project.phases] };
      const phaseIdx = updated.phases.findIndex(p => p.id === targetPhaseId);
      if (phaseIdx >= 0) {
        updated.phases[phaseIdx] = {
          ...updated.phases[phaseIdx],
          files: [...updated.phases[phaseIdx].files, linked],
        };
      }
      await save(updated);
    },
    [project, save],
  );

  const moveFile = useCallback(
    async (fileId: string, fromPhaseId: string, toPhaseId: string) => {
      if (!project) return;
      const updated = { ...project, phases: [...project.phases] };
      const fromIdx = updated.phases.findIndex(p => p.id === fromPhaseId);
      const toIdx = updated.phases.findIndex(p => p.id === toPhaseId);
      if (fromIdx < 0 || toIdx < 0) return;

      const file = updated.phases[fromIdx].files.find(f => f.id === fileId);
      if (!file) return;

      updated.phases[fromIdx] = {
        ...updated.phases[fromIdx],
        files: updated.phases[fromIdx].files.filter(f => f.id !== fileId),
      };
      updated.phases[toIdx] = {
        ...updated.phases[toIdx],
        files: [...updated.phases[toIdx].files, { ...file, phaseId: toPhaseId }],
      };
      await save(updated);
    },
    [project, save],
  );

  const deleteFile = useCallback(
    async (phaseId: string, fileId: string) => {
      if (!project) return;
      const updated = { ...project, phases: [...project.phases] };
      const phaseIdx = updated.phases.findIndex(p => p.id === phaseId);
      if (phaseIdx >= 0) {
        updated.phases[phaseIdx] = {
          ...updated.phases[phaseIdx],
          files: updated.phases[phaseIdx].files.filter(f => f.id !== fileId),
        };
      }
      await save(updated);
    },
    [project, save],
  );

  return {
    project,
    loading,
    refresh,
    advancePhase,
    setActivePhase,
    addFileToPhase,
    linkFileToPhase,
    moveFile,
    deleteFile,
  };
}
