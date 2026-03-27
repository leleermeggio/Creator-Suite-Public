from __future__ import annotations
from backend.services.thumbnail_templates.base import BaseThumbnailTemplate, ThumbnailContext
from backend.services.thumbnail_templates.impact import ImpactTemplate
from backend.services.thumbnail_templates.split import SplitTemplate
from backend.services.thumbnail_templates.gradient_bar import GradientBarTemplate
from backend.services.thumbnail_templates.bold_side import BoldSideTemplate
from backend.services.thumbnail_templates.minimal import MinimalTemplate
from backend.services.thumbnail_templates.reaction import ReactionTemplate
from backend.services.thumbnail_templates.neon import NeonTemplate
from backend.services.thumbnail_templates.cinematic import CinematicTemplate

TEMPLATE_REGISTRY: dict[str, type[BaseThumbnailTemplate]] = {
    "impact": ImpactTemplate,
    "split": SplitTemplate,
    "gradient-bar": GradientBarTemplate,
    "bold-side": BoldSideTemplate,
    "minimal": MinimalTemplate,
    "reaction": ReactionTemplate,
    "neon": NeonTemplate,
    "cinematic": CinematicTemplate,
}

def get_template(template_id: str) -> BaseThumbnailTemplate:
    cls = TEMPLATE_REGISTRY.get(template_id, ImpactTemplate)
    return cls()
