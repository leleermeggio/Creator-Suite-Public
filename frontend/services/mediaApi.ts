import { get, post } from './apiClient';
import { API_BASE } from './apiClient';

export interface UploadURLResponse {
  upload_url: string;
  storage_key: string;
}

export interface MediaAsset {
  id: string;
  project_id: string;
  user_id: string;
  filename: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  download_url?: string;
  created_at: string;
}

export async function getUploadUrl(
  projectId: string,
  filename: string,
  contentType: string,
  sizeBytes: number,
): Promise<UploadURLResponse> {
  return post<UploadURLResponse>('/media/upload-url', {
    project_id: projectId,
    filename,
    content_type: contentType,
    size_bytes: sizeBytes,
  });
}

export async function uploadFileToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
  await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
}

export async function registerAsset(data: {
  project_id: string;
  filename: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds?: number;
}): Promise<MediaAsset> {
  return post<MediaAsset>('/media/register', data);
}

export async function listAssets(projectId: string): Promise<MediaAsset[]> {
  return get<MediaAsset[]>(`/media/?project_id=${projectId}`);
}

export async function getAsset(assetId: string): Promise<MediaAsset> {
  return get<MediaAsset>(`/media/${assetId}`);
}

export async function uploadFileDirect(projectId: string, file: File): Promise<MediaAsset> {
  try {
    const { upload_url, storage_key } = await getUploadUrl(projectId, file.name, file.type || 'application/octet-stream', file.size);
    await uploadFileToPresignedUrl(upload_url, file);
    return await registerAsset({
      project_id: projectId,
      filename: file.name,
      storage_key,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
    });
  } catch (error: unknown) {
    console.error('Upload failed, falling back to local:', error);
    return await registerAsset({
      project_id: projectId,
      filename: file.name,
      storage_key: `local/${projectId}/${file.name}`,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
    });
  }
}

// Re-export API_BASE for convenience (used in upload utilities)
export { API_BASE };
