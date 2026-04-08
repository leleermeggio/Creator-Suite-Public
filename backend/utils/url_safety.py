from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

from fastapi import HTTPException, status


def assert_safe_url(url: str) -> None:
    """Raise HTTP 400 if the URL could be used for SSRF.

    Rejects non-http(s) schemes, missing host, private/loopback/link-local IPs.
    """
    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL is required",
        )

    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only http and https URLs are allowed",
        )

    host = parsed.hostname
    if not host:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL must contain a valid host",
        )

    try:
        resolved_ip = socket.gethostbyname(host)
        addr = ipaddress.ip_address(resolved_ip)
    except (socket.gaierror, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not resolve host or invalid address",
        )

    if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requests to internal or private addresses are not allowed",
        )
