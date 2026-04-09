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
import type { ApiError } from '@/services/apiClient';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const index = await getProjectIndex();
      setProjects(index);
    } catch (error: any) {
      console.error('Error loading projects:', error);
      // Show user-friendly error via toast or alert
      if (__DEV__) {
        console.warn(`Failed to load projects: ${error?.message ?? 'Unknown'}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const syncWithBackend = useCallback(async (): Promise<void> => {
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
          } catch (error: ApiError) {
            // best-effort — project may already exist or BE unreachable
            if (__DEV__) console.warn('Backend sync failed:', error.message);
          }
        }
      }

      await refresh();
    } catch (error: any) {
      // offline or unauthenticated — silently skip
      if (__DEV__) {
        console.debug('Backend sync skipped (offline/unauth):', error?.message);
      }
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
      } catch (error: unknown) {
        // Fallback to local-only creation if backend unavailable
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.warn('Backend create failed, using local ID:', errorMsg);
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

      try {
        await ensureProjectDirs(projectId, phases.map(p => p.id));
        await saveProject(project);
        await refresh();
        return projectId;
      } catch (error: unknown) {
        console.error('Error creating project:', error);
        throw new Error(error instanceof Error ? error.message : 'Error creating project');
      }
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
