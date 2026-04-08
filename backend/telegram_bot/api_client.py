from __future__ import annotations

import httpx


class CreatorSuiteClient:
    """Thin async HTTP client for the Creator Suite backend API."""

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        http_client: httpx.AsyncClient | None = None,
    ):
        self._base_url = base_url
        self._client = http_client
        self._token: str | None = None

    def set_token(self, token: str) -> None:
        self._token = token

    @property
    def _headers(self) -> dict[str, str]:
        if self._token:
            return {"Authorization": f"Bearer {self._token}"}
        return {}

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is not None:
            return self._client
        return httpx.AsyncClient(base_url=self._base_url)

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        client = await self._get_client()
        resp = await client.request(method, path, headers=self._headers, **kwargs)
        resp.raise_for_status()
        return resp.json()

    async def register(self, email: str, password: str, display_name: str) -> dict:
        return await self._request(
            "POST",
            "/auth/register",
            json={
                "email": email,
                "password": password,
                "display_name": display_name,
            },
        )

    async def login(self, email: str, password: str) -> dict:
        return await self._request(
            "POST",
            "/auth/login",
            json={
                "email": email,
                "password": password,
            },
        )

    async def refresh_token(self, refresh_token: str) -> dict:
        return await self._request(
            "POST",
            "/auth/refresh",
            json={
                "refresh_token": refresh_token,
            },
        )

    async def create_project(self, title: str, description: str | None = None) -> dict:
        return await self._request(
            "POST",
            "/projects/",
            json={
                "title": title,
                "description": description,
            },
        )

    async def submit_job(
        self, project_id: str, job_type: str, input_params: dict | None = None
    ) -> dict:
        return await self._request(
            "POST",
            "/jobs/",
            json={
                "project_id": project_id,
                "type": job_type,
                "input_params": input_params,
            },
        )

    async def get_job(self, job_id: str) -> dict:
        return await self._request("GET", f"/jobs/{job_id}")

    async def list_jobs(self, project_id: str) -> list[dict]:
        return await self._request("GET", f"/jobs/?project_id={project_id}")

    # --- Media ---

    async def get_upload_url(
        self, project_id: str, filename: str, content_type: str, size_bytes: int
    ) -> dict:
        return await self._request(
            "POST",
            "/media/upload-url",
            json={
                "project_id": project_id,
                "filename": filename,
                "content_type": content_type,
                "size_bytes": size_bytes,
            },
        )

    async def register_asset(
        self,
        project_id: str,
        filename: str,
        storage_key: str,
        mime_type: str,
        size_bytes: int,
        duration_seconds: float | None = None,
    ) -> dict:
        return await self._request(
            "POST",
            "/media/register",
            json={
                "project_id": project_id,
                "filename": filename,
                "storage_key": storage_key,
                "mime_type": mime_type,
                "size_bytes": size_bytes,
                "duration_seconds": duration_seconds,
            },
        )

    async def list_assets(self, project_id: str) -> list[dict]:
        return await self._request("GET", f"/media/?project_id={project_id}")

    async def import_url(self, project_id: str, url: str) -> dict:
        return await self._request(
            "POST",
            "/media/import-url",
            json={
                "project_id": project_id,
                "url": url,
            },
        )

    # --- Exports ---

    async def create_export(
        self, project_id: str, format_preset: str = "youtube_1080p", **kwargs
    ) -> dict:
        return await self._request(
            "POST",
            "/exports/",
            json={
                "project_id": project_id,
                "format_preset": format_preset,
                **kwargs,
            },
        )

    async def get_export(self, export_id: str) -> dict:
        return await self._request("GET", f"/exports/{export_id}")

    async def list_exports(self, project_id: str) -> list[dict]:
        return await self._request("GET", f"/exports/?project_id={project_id}")

    # --- Captions ---

    async def generate_captions(
        self,
        project_id: str,
        asset_id: str | None = None,
        language: str = "auto",
    ) -> dict:
        return await self._request(
            "POST",
            "/captions/generate",
            json={
                "project_id": project_id,
                "asset_id": asset_id,
                "language": language,
            },
        )

    async def list_captions(self, project_id: str) -> list[dict]:
        return await self._request("GET", f"/captions/?project_id={project_id}")

    async def update_caption(self, caption_id: str, **kwargs) -> dict:
        return await self._request("PUT", f"/captions/{caption_id}", json=kwargs)

    async def translate_caption(self, caption_id: str, target_language: str) -> dict:
        return await self._request(
            "POST",
            f"/captions/{caption_id}/translate",
            json={
                "target_language": target_language,
            },
        )

    # --- Search ---

    async def search(self, project_id: str, query: str) -> list[dict]:
        return await self._request(
            "POST",
            "/search/",
            json={
                "project_id": project_id,
                "query": query,
            },
        )

    # --- Graphics Overlays ---

    async def create_overlay(
        self, project_id: str, overlay_type: str, **kwargs
    ) -> dict:
        return await self._request(
            "POST",
            "/overlays/",
            json={
                "project_id": project_id,
                "overlay_type": overlay_type,
                **kwargs,
            },
        )

    async def list_overlays(self, project_id: str) -> list[dict]:
        return await self._request("GET", f"/overlays/?project_id={project_id}")

    async def update_overlay(self, overlay_id: str, **kwargs) -> dict:
        return await self._request("PUT", f"/overlays/{overlay_id}", json=kwargs)

    async def delete_overlay(self, overlay_id: str) -> None:
        client = await self._get_client()
        resp = await client.request(
            "DELETE", f"/overlays/{overlay_id}", headers=self._headers
        )
        resp.raise_for_status()

    # --- Watermark ---

    async def add_image_watermark(
        self,
        project_id: str,
        asset_id: str,
        watermark_storage_key: str,
        **kwargs,
    ) -> dict:
        return await self._request(
            "POST",
            "/watermark/image",
            json={
                "project_id": project_id,
                "asset_id": asset_id,
                "watermark_storage_key": watermark_storage_key,
                **kwargs,
            },
        )

    async def add_text_watermark(
        self,
        project_id: str,
        asset_id: str,
        text: str,
        **kwargs,
    ) -> dict:
        return await self._request(
            "POST",
            "/watermark/text",
            json={
                "project_id": project_id,
                "asset_id": asset_id,
                "text": text,
                **kwargs,
            },
        )

    # --- Caption Burn-in ---

    async def burn_in_captions(self, caption_id: str) -> dict:
        return await self._request("POST", f"/captions/{caption_id}/burn-in")
