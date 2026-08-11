"""
Flood Detection Route Navigation System — Backend API
College project prototype, scoped to Caloocan City, Metro Manila.
Inspired by the concept behind DOST's Project NOAH (hazard mapping +
early warning), combined with route navigation that avoids flooded roads.

Run with:  python3 start.py
Docs at:   http://localhost:8000/docs
"""

import logging
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from services import flood_service, route_finder

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Flood Detection Route Navigation System API",
    description="Flood-risk-aware route navigation for Caloocan City, Metro Manila.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Request/response models ----------

class RouteRequest(BaseModel):
    origin_id: str = Field(..., description="Node ID of the starting location")
    destination_id: str = Field(..., description="Node ID of the destination")
    rainfall_mm: float = Field(0, ge=0, le=500, description="Simulated rainfall in mm over 24h")


class RainfallRequest(BaseModel):
    rainfall_mm: float = Field(..., ge=0, le=500)


# ---------- Routes ----------

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "message": "Flood Detection Route Navigation API is running",
        "version": "1.0.0",
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/api/locations")
async def get_locations():
    """Returns all navigable locations (nodes) in the Caloocan network."""
    return {"locations": route_finder.get_nodes()}


@app.get("/api/flood-zones")
async def get_flood_zones(rainfall_mm: float = 0):
    """
    Returns all flood hazard zones with their CURRENT risk level,
    computed from the base hazard level plus simulated rainfall intensity.
    """
    try:
        risk_by_zone = flood_service.compute_current_risk(rainfall_mm)
        return {
            "rainfall_mm": rainfall_mm,
            "zones": list(risk_by_zone.values()),
        }
    except Exception as e:
        logger.error(f"Error computing flood zones: {e}")
        raise HTTPException(status_code=500, detail="Failed to compute flood zone risk")


@app.post("/api/route")
async def get_safest_route(req: RouteRequest):
    """
    Computes the safest route between two locations given the current
    simulated rainfall level. Roads through severe-risk zones are treated
    as closed/impassable; other flooded roads are penalized but usable
    if no safer alternative exists.
    """
    try:
        risk_by_zone = flood_service.compute_current_risk(req.rainfall_mm)

        route = route_finder.find_safest_route(req.origin_id, req.destination_id, risk_by_zone)
        if route is None:
            raise HTTPException(
                status_code=404,
                detail="No passable route found. All roads between these points may be closed due to severe flood risk.",
            )

        crossed_zone_info = [risk_by_zone[z] for z in route["flood_zones_crossed"] if z in risk_by_zone]
        ai_summary = flood_service.generate_ai_summary(req.rainfall_mm, risk_by_zone)

        return {
            "success": True,
            "route": route,
            "flood_zones_on_route": crossed_zone_info,
            "situation_summary": ai_summary,
            "rainfall_mm": req.rainfall_mm,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error computing route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error while computing route")


@app.get("/api/situation-summary")
async def get_situation_summary(rainfall_mm: float = 0):
    """Standalone endpoint to get just the AI-generated situational summary."""
    risk_by_zone = flood_service.compute_current_risk(rainfall_mm)
    summary = flood_service.generate_ai_summary(rainfall_mm, risk_by_zone)
    return {"rainfall_mm": rainfall_mm, "summary": summary}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
