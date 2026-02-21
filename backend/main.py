import os
import re
from datetime import datetime
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(title="MTC Assessment API")

# Set up API to be called from browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


ISLAMIC_API_BASE = "https://islamicapi.com/api/v1/ramadan/"


def _to_24h_hhmm(time_str: str) -> str:
    """
    IslamicAPI returns times like '5:42 AM' / '5:48 PM' (see docs).
    Convert to 'HH:MM' 24-hour.
    """
    s = time_str.strip()
    # If the string input is already in the correct format, this code handles it.
    if re.fullmatch(r"\d{1,2}:\d{2}", s):
        hh, mm = s.split(":")
        return f"{int(hh):02d}:{int(mm):02d}"

    # Check if a correct time is given, if yes then return it with appropiate formaat
    try:
        dt = datetime.strptime(s, "%I:%M %p")
        return dt.strftime("%H:%M")
    except ValueError as e:
        raise ValueError(f"Unrecognized time format: '{time_str}'") from e


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Salaam World"}


@app.get("/ramadan")
async def get_ramadan(
    lat: str = Query(..., description="Latitude, e.g. 40.7128"),
    lon: str = Query(..., description="Longitude, e.g. -74.0060"),
) -> list[dict[str, Any]]:
    """
    asks islamicAPI and gets an array in return
    """
    api_key = os.getenv("ISLAMIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Missing ISLAMIC_API_KEY. Add it to backend/.env",
        )

    params = {"lat": lat, "lon": lon, "api_key": api_key}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(ISLAMIC_API_BASE, params=params)
            resp.raise_for_status()
            payload = resp.json()
    except httpx.HTTPStatusError as e:
        detail = f"Upstream IslamicAPI error: HTTP {e.response.status_code}"
        try:
            detail += f" - {e.response.json()}"
        except Exception:
            detail += f" - {e.response.text}"
        raise HTTPException(status_code=502, detail=detail) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch Ramadan data: {e}") from e

    # We should get a list of 30 days
    # each with a "date" and "time": {"sahur": "...", "iftar": "..."}.
    try:
        fasting_days = payload["data"]["fasting"]
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail="Unexpected IslamicAPI response shape (missing data.fasting).",
        ) from e

    out: list[dict[str, Any]] = []
    for day in fasting_days:
        date_str = day.get("date")
        time_obj = day.get("time", {})
        sahur_raw = time_obj.get("sahur")
        iftar_raw = time_obj.get("iftar")

        if not (date_str and sahur_raw and iftar_raw):
            # Skip malformed entries
            continue

        try:
            sahur_24 = _to_24h_hhmm(sahur_raw)
            iftar_24 = _to_24h_hhmm(iftar_raw)
        except ValueError:
            # If time parsing fails, skip entry (or you could raise)
            continue

        out.append(
            {
                "date": date_str,
                "sahur": sahur_24,
                "iftar": iftar_24,
                "hijri_readable": day.get("hijri_readable"),
                "day": day.get("day"),
            }
        )

    if not out:
        raise HTTPException(status_code=502, detail="No fasting days returned from IslamicAPI.")
    return out