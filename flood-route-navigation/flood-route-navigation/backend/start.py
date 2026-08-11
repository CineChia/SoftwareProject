#!/usr/bin/env python3
"""Convenience entry point for running the Flood Route Navigation API."""

import os
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")

    print("=" * 60)
    print("  Flood Detection Route Navigation System - Backend API")
    print("=" * 60)
    print(f"  Starting server at http://{host}:{port}")
    print(f"  API docs available at http://localhost:{port}/docs")
    print("=" * 60)

    uvicorn.run(
    "main:app",
    host=host,
    port=port,
    reload=True,
    reload_excludes=["venv/*", "venv"],
    log_level="info",
)
