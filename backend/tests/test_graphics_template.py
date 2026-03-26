from __future__ import annotations

from backend.services.graphics_template_service import (
    TEMPLATES,
    get_template,
    list_templates,
)


def test_list_templates_returns_all():
    templates = list_templates()
    assert len(templates) >= 6
    assert "title_card_minimal" in templates
    assert "lower_third_modern" in templates
    assert "text_overlay_shadow" in templates


def test_get_template_valid():
    t = get_template("title_card_minimal")
    assert t is not None
    assert t["font"] == "Inter"
    assert t["size"] == 72


def test_get_template_invalid():
    assert get_template("nonexistent") is None


def test_templates_have_required_fields():
    for name, t in TEMPLATES.items():
        assert "font" in t, f"{name} missing font"
        assert "size" in t, f"{name} missing size"
        assert "color" in t, f"{name} missing color"
