import { get, post, put, del } from './apiClient';

export interface StepDefinition {
  tool_id: string;
  label: string;
  parameters: Record<string, unknown>;
  auto_run: boolean;
  required: boolean;
  condition: string | null;
}

export interface AgentResponse {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  description: string | null;
  steps: StepDefinition[] | null;
  default_mode: string;
  target_platforms: string[] | null;
  is_preset: boolean;
  preset_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentCreate {
  name: string;
  icon?: string;
  description?: string;
  steps?: StepDefinition[];
  default_mode?: string;
  target_platforms?: string[];
}

export async function listAgents(): Promise<AgentResponse[]> {
  return get<AgentResponse[]>('/agents/');
}

export async function listPresetAgents(): Promise<AgentResponse[]> {
  return get<AgentResponse[]>('/agents/presets');
}

export async function getAgent(id: string): Promise<AgentResponse> {
  return get<AgentResponse>(`/agents/${id}`);
}

export async function createAgent(data: AgentCreate): Promise<AgentResponse> {
  return post<AgentResponse>('/agents/', data);
}

export async function updateAgent(id: string, data: Partial<AgentCreate>): Promise<AgentResponse> {
  return put<AgentResponse>(`/agents/${id}`, data);
}

export async function deleteAgent(id: string): Promise<void> {
  return del<void>(`/agents/${id}`);
}

export async function generateAgent(description: string): Promise<AgentResponse> {
  return post<AgentResponse>('/agents/generate', { description });
}
