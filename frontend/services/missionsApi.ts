import { get, post, put } from './apiClient';

export interface StepResult {
  step_index: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'SKIPPED' | 'FAILED';
  job_id: string | null;
  output: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface InsightCardData {
  id: string;
  type: 'quality' | 'opportunity' | 'visual' | 'cross_platform';
  message: string;
  action_tool: string | null;
  action_params: Record<string, unknown> | null;
  status: 'PENDING' | 'ACCEPTED' | 'DISMISSED' | 'SAVED';
  confidence: number;
}

export interface MissionResponse {
  id: string;
  agent_id: string;
  project_id: string;
  user_id: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  current_step_index: number;
  mode: 'REGISTA' | 'COPILOTA' | 'AUTOPILOTA';
  step_results: StepResult[] | null;
  insights: InsightCardData[] | null;
  started_at: string;
  completed_at: string | null;
}

export interface MissionCreate {
  agent_id: string;
  project_id: string;
  mode?: 'REGISTA' | 'COPILOTA' | 'AUTOPILOTA';
}

export async function createMission(data: MissionCreate): Promise<MissionResponse> {
  return post<MissionResponse>('/missions/', data);
}

export async function listMissions(): Promise<MissionResponse[]> {
  return get<MissionResponse[]>('/missions/');
}

export async function getMission(id: string): Promise<MissionResponse> {
  return get<MissionResponse>(`/missions/${id}`);
}

export async function startMission(id: string): Promise<MissionResponse> {
  return post<MissionResponse>(`/missions/${id}/start`);
}

export async function pauseMission(id: string): Promise<MissionResponse> {
  return post<MissionResponse>(`/missions/${id}/pause`);
}

export async function resumeMission(id: string): Promise<MissionResponse> {
  return post<MissionResponse>(`/missions/${id}/resume`);
}

export async function updateMissionMode(id: string, mode: string): Promise<MissionResponse> {
  return put<MissionResponse>(`/missions/${id}/mode`, { mode });
}

export async function executeStep(missionId: string, stepIndex: number): Promise<MissionResponse> {
  return post<MissionResponse>(`/missions/${missionId}/steps/${stepIndex}/execute`);
}

export async function skipStep(missionId: string, stepIndex: number): Promise<MissionResponse> {
  return post<MissionResponse>(`/missions/${missionId}/steps/${stepIndex}/skip`);
}

export async function updateStepParams(
  missionId: string,
  stepIndex: number,
  parameters: Record<string, unknown>,
): Promise<MissionResponse> {
  return put<MissionResponse>(`/missions/${missionId}/steps/${stepIndex}/params`, { parameters });
}

export async function acceptInsight(missionId: string, insightId: string): Promise<MissionResponse> {
  return post<MissionResponse>(`/missions/${missionId}/insights/${insightId}/accept`);
}

export async function dismissInsight(missionId: string, insightId: string): Promise<MissionResponse> {
  return post<MissionResponse>(`/missions/${missionId}/insights/${insightId}/dismiss`);
}
