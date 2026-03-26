"""Local dev server launcher for Creator Suite API."""
import os

# Ensure backend/.env is loaded
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./creator_suite_dev.db")

if __name__ == "__main__":
    import uvicorn
    from backend.main import create_app

    import socket
    app = create_app()
    local_ip = socket.gethostbyname(socket.gethostname())
    print("=" * 60)
    print("  Creator Suite API — Local Dev Server")
    print(f"  Local:     http://127.0.0.1:8000")
    print(f"  Network:   http://{local_ip}:8000")
    print(f"  Docs:      http://127.0.0.1:8000/docs")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
