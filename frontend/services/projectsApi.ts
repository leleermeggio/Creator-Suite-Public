import { post, get } from './apiClient';

export interface ProjectResponse {
  id: string;
  title: string;
  description: string | null;
}

export async function createProject(
  title: string,
  description?: string,
): Promise<ProjectResponse> {
  return post<ProjectResponse>('/projects/', { title, description });
}

export async function listProjects(): Promise<ProjectResponse[]> {
  return get<ProjectResponse[]>('/projects/');
}
