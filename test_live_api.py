"""Live API smoke test — tests the running server end-to-end."""
import httpx
import sys

BASE = "http://127.0.0.1:8000"

def main():
    c = httpx.Client(base_url=BASE, timeout=10)
    errors = []

    # 1. Health check
    print("1. Health check...")
    r = c.get("/health")
    assert r.status_code == 200, f"Health failed: {r.status_code}"
    print(f"   OK: {r.json()}")

    # 2. Register
    print("2. Register user...")
    r = c.post("/auth/register", json={
        "email": "test@creator-example.com",
        "password": "TestPass123!",
        "display_name": "Test User",
    })
    if r.status_code == 201:
        tokens = r.json()
        print(f"   OK: registered, got access_token")
    elif r.status_code == 409:
        print("   OK: user already exists, logging in...")
        r = c.post("/auth/login", json={
            "email": "test@creator-example.com",
            "password": "TestPass123!",
        })
        assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
        tokens = r.json()
        print(f"   OK: logged in")
    else:
        print(f"   FAIL: {r.status_code} {r.text}")
        errors.append("register")
        return

    token = tokens["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Create project
    print("3. Create project...")
    r = c.post("/projects/", json={"title": "My First Video"}, headers=headers)
    assert r.status_code == 201, f"Project failed: {r.status_code} {r.text}"
    project = r.json()
    project_id = project["id"]
    print(f"   OK: project '{project['title']}' (id={project_id[:8]}...)")

    # 4. List projects
    print("4. List projects...")
    r = c.get("/projects/", headers=headers)
    assert r.status_code == 200
    projects = r.json()
    print(f"   OK: {len(projects)} project(s)")

    # 5. Generate captions
    print("5. Generate captions...")
    r = c.post("/captions/generate", json={
        "project_id": project_id,
        "language": "it",
        "style_preset": "youtube",
    }, headers=headers)
    assert r.status_code == 201, f"Captions failed: {r.status_code} {r.text}"
    caption = r.json()
    print(f"   OK: caption id={caption['id'][:8]}... lang={caption['language']}")

    # 6. Create export
    print("6. Create export...")
    r = c.post("/exports/", json={
        "project_id": project_id,
        "format_preset": "youtube_1080p",
    }, headers=headers)
    assert r.status_code == 201, f"Export failed: {r.status_code} {r.text}"
    export = r.json()
    print(f"   OK: export id={export['id'][:8]}... format={export['format_preset']}")

    # 7. Create overlay
    print("7. Create graphics overlay...")
    r = c.post("/overlays/", json={
        "project_id": project_id,
        "overlay_type": "text",
        "name": "Title Card",
        "properties": {"text": "Welcome!", "font_size": 48},
    }, headers=headers)
    assert r.status_code == 201, f"Overlay failed: {r.status_code} {r.text}"
    overlay = r.json()
    print(f"   OK: overlay '{overlay['name']}' type={overlay['overlay_type']}")

    # 8. Create team
    print("8. Create team...")
    r = c.post("/teams/", json={"name": "My Studio"}, headers=headers)
    assert r.status_code == 201, f"Team failed: {r.status_code} {r.text}"
    team = r.json()
    print(f"   OK: team '{team['name']}' id={team['id'][:8]}...")

    # 9. Add comment
    print("9. Add comment...")
    r = c.post(f"/projects/{project_id}/comments/", json={
        "text": "Looks great at 5 seconds!",
        "timeline_timestamp": 5.0,
    }, headers=headers)
    assert r.status_code == 201, f"Comment failed: {r.status_code} {r.text}"
    comment = r.json()
    print(f"   OK: comment '{comment['text'][:30]}' at t={comment['timeline_timestamp']}s")

    # 10. Analytics event
    print("10. Send analytics event...")
    r = c.post("/analytics/events", json={
        "events": [
            {"event_type": "feature_used", "event_data": {"feature": "captions"}},
            {"event_type": "export_completed", "event_data": {"format": "youtube_1080p"}},
        ]
    }, headers=headers)
    assert r.status_code == 202, f"Analytics failed: {r.status_code} {r.text}"
    print(f"   OK: {r.json()}")

    # 11. Subscription
    print("11. Check subscription...")
    r = c.get("/subscriptions/me", headers=headers)
    assert r.status_code == 200, f"Sub failed: {r.status_code} {r.text}"
    sub = r.json()
    print(f"   OK: plan={sub['plan']} limits={sub['limits']}")

    # 12. OpenAPI docs
    print("12. Check API docs...")
    r = c.get("/openapi.json")
    assert r.status_code == 200
    spec = r.json()
    paths = len(spec.get("paths", {}))
    print(f"   OK: OpenAPI spec has {paths} endpoint paths")

    print()
    print("=" * 50)
    print(f"  ALL {12} CHECKS PASSED!")
    print(f"  API is fully operational.")
    print("=" * 50)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\nFAILED: {e}")
        sys.exit(1)
