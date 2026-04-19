"""Local dev server launcher for Creator Suite API."""
import os

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
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
