"""
flood_service.py

Handles flood-risk logic for the system:
- Loads static hazard-zone definitions (base hazard level, geometry).
- Converts a simulated/user-supplied rainfall intensity into a *current*
  risk level per zone (1=Low .. 4=Severe), mimicking how a real system
  would combine a static hazard map (like Project NOAH's) with live
  weather/sensor data.
- Optionally asks Google Gemini to produce a human-readable explanation
  of the current situation. Falls back to a rule-based description if
  no Gemini API key is configured or the call fails, so the app never
  breaks in front of a panel/demo.
"""

import json
import os
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

RISK_LABELS = {1: "Low", 2: "Moderate", 3: "High", 4: "Severe"}

# Rainfall (mm within a rolling period) -> how many hazard levels to add
# on top of a zone's base hazard level. Loosely modeled on PAGASA's
# rainfall warning thresholds (Yellow/Orange/Red).
def _rainfall_bump(rainfall_mm: float) -> int:
    if rainfall_mm >= 200:   # Red warning territory (>200mm/24h)
        return 3
    if rainfall_mm >= 100:   # Orange warning
        return 2
    if rainfall_mm >= 30:    # Yellow warning
        return 1
    return 0


def load_flood_zones() -> dict:
    with open(DATA_DIR / "flood_zones.json", "r", encoding="utf-8") as f:
        return json.load(f)


def compute_current_risk(rainfall_mm: float = 0) -> dict:
    """
    Returns { zone_id: {level: int, label: str, name, description, polygon} }
    combining each zone's static base hazard level with the current
    simulated rainfall intensity.
    """
    data = load_flood_zones()
    bump = _rainfall_bump(rainfall_mm)
    result = {}
    for zone in data["zones"]:
        zid = zone["id"]
        base = data["base_hazard_level"].get(zid, 1)
        level = min(4, base + bump)
        result[zid] = {
            "id": zid,
            "name": zone["name"],
            "description": zone["description"],
            "polygon": zone["polygon"],
            "level": level,
            "label": RISK_LABELS[level],
        }
    return result


def generate_fallback_summary(rainfall_mm: float, risk_by_zone: dict) -> str:
    """Rule-based summary used when Gemini is unavailable."""
    severe = [z["name"] for z in risk_by_zone.values() if z["level"] >= 4]
    high = [z["name"] for z in risk_by_zone.values() if z["level"] == 3]

    lines = [f"Simulated rainfall intensity: {rainfall_mm:.0f} mm/24h."]
    if severe:
        lines.append("Severe flood risk currently affects: " + ", ".join(severe) + ".")
    if high:
        lines.append("High flood risk currently affects: " + ", ".join(high) + ".")
    if not severe and not high:
        lines.append("No zones currently at high or severe flood risk.")
    lines.append("Routes through severe-risk zones are avoided automatically; "
                  "high-risk zones are penalized but may still be used if no safer path exists.")
    return " ".join(lines)


def generate_ai_summary(rainfall_mm: float, risk_by_zone: dict) -> str:
    """
    Uses Google Gemini (if GEMINI_API_KEY is set) to turn the structured
    risk data into a short, readable situational summary. Falls back to
    generate_fallback_summary on any error, so the API never fails the
    user-facing request just because the AI call failed.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return generate_fallback_summary(rainfall_mm, risk_by_zone)

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)

        zone_lines = "\n".join(
            f"- {z['name']}: hazard level {z['level']} ({z['label']})"
            for z in risk_by_zone.values()
        )
        prompt = (
            "You are assisting a flood-risk navigation system for Caloocan City, Philippines. "
            f"Simulated rainfall is {rainfall_mm:.0f} mm over 24 hours. "
            "Current hazard levels per zone:\n"
            f"{zone_lines}\n\n"
            "In 3-4 short sentences, summarize the overall flood situation for a commuter "
            "and give one practical safety recommendation. Keep it plain and factual, "
            "no markdown, no headers."
        )
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        response = model.generate_content(prompt)
        text = (response.text or "").strip()
        return text if text else generate_fallback_summary(rainfall_mm, risk_by_zone)
    except Exception as e:  # noqa: BLE001
        logger.error(f"Gemini summary generation failed: {e}")
        return generate_fallback_summary(rainfall_mm, risk_by_zone)
