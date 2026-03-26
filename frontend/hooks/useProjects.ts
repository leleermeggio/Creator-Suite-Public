import { useState, useEffect, useCallback } from 'react';
import {
  getProjectIndex,
  saveProject,
  deleteProject as deleteProjectStorage,
  getProject,
} from '@/services/storage';
import { ensureProjectDirs } from '@/services/file-system';
import { deleteProjectFiles } from '@/services/file-system';
import { createProject as beCreateProject, listProjects } from '@/services/projectsApi';
import type { Project, ProjectIndexEntry, Phase, PhaseTemplate } from '@/types';
import { getPhaseColor } from '@/constants/phases';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const index = await getProjectIndex();
    setProjects(index);
    setLoading(false);
  }, []);

  const syncWithBackend = useCallback(async () => {
    try {
      const [beProjects, localIndex] = await Promise.all([
        listProjects(),
        getProjectIndex(),
      ]);
      const localIds = new Set(localIndex.map(e => e.id));

      for (const bep of beProjects) {
        if (!localIds.has(bep.id)) {
          const stub: Project = {
            id: bep.id,
            name: bep.title,
            description: bep.description ?? undefined,
            phases: [],
            currentPhaseIndex: 0,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await saveProject(stub);
        }
      }

      const beIds = new Set(beProjects.map(p => p.id));
      for (const local of localIndex) {
        if (!beIds.has(local.id)) {
          try {
            await beCreateProject(local.name);
          } catch {
            // best-effort — project may already exist or BE unreachable
          }
        }
      }

      await refresh();
    } catch {
      // offline or unauthenticated — silently skip
    }
  }, [refresh]);

  useEffect(() => {
    // Initial load: refresh immediately for instant local data,
    // then sync with backend in background (sync calls refresh again when done)
    refresh();
    syncWithBackend();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const createProject = useCallback(
    async (
      name: string,
      phaseTemplates: PhaseTemplate[],
      description?: string,
      templateId?: string,
    ): Promise<string> => {
      let projectId: string;
      try {
        const beProject = await beCreateProject(name, description);
        projectId = beProject.id;
      } catch {
        projectId = generateId();
      }

      const phases: Phase[] = phaseTemplates.map((pt, i) => ({
        id: generateId(),
        name: pt.name,
        icon: pt.icon,
        color: pt.color || getPhaseColor(i),
        order: i,
        suggestedToolIds: pt.suggestedToolIds,
        files: [],
        status: i === 0 ? 'active' : 'pending',
      }));

      const project: Project = {
        id: projectId,
        name,
        description,
        templateId,
        phases,
        currentPhaseIndex: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await ensureProjectDirs(projectId, phases.map(p => p.id));
      await saveProject(project);
      await refresh();
      return projectId;
    },
    [refresh],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      await deleteProjectFiles(id);
      await deleteProjectStorage(id);
      await refresh();
    },
    [refresh],
  );

  const archiveProject = useCallback(
    async (id: string) => {
      const project = await getProject(id);
      if (project) {
        project.status = 'archived';
        await saveProject(project);
        await refresh();
      }
    },
    [refresh],
  );

  const unarchiveProject = useCallback(
    async (id: string) => {
      const project = await getProject(id);
      if (project) {
        project.status = 'active';
        await saveProject(project);
        await refresh();
      }
    },
    [refresh],
  );

  return {
    projects,
    loading,
    refresh,
    createProject,
    deleteProject,
    archiveProject,
    unarchiveProject,
  };
}
