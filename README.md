# MTC Programming Assessment

This is a full stack programming assessment for **Muslim Tech Collaborative (MTC)**. You will build a Ramadan calendar feature that fetches prayer/fasting times from a live API and displays them in a clean UI.

---

## Getting Started

```bash
git clone https://github.com/yaseenhalabi/mtc-assessment.git
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file inside `backend/`:
```
ISLAMIC_API_KEY=your_key_here
```

Start the dev server:
```bash
fastapi dev main.py
```

The API will be available at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## The Task

### Backend

Create a backend route:

```
GET /ramadan
```

This route should call the following external API:

```
GET https://islamicapi.com/api/v1/ramadan/?lat={lat}&lon={lon}&api_key={YOUR_API_KEY}
```

**API Documentation:** https://islamicapi.com/doc/ramadan/

**Required query parameters to forward:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `lat` | string | Latitude of the user's location | `40.7128` |
| `lon` | string | Longitude of the user's location | `-74.0060` |

You will need to sign up at [islamicapi.com](https://islamicapi.com) to obtain an API key. Store it securely as an environment variable — never hardcode it.

**Your `/ramadan` route should return a JSON array** with one object per day of Ramadan. Each object must include at minimum:

```json
[
  {
    "date": "2026-02-18",
    "sahur": "05:32",
    "iftar": "17:48"
  },
  ...
]
```

You may include additional fields from the API response if you find them useful.

---

### Frontend

Build a frontend that:

1. **Calls your `/ramadan` backend route** to fetch the Ramadan calendar data (pass the user's latitude and longitude, or use a hardcoded location for simplicity).

2. **Displays a Ramadan calendar** — a list or grid showing all 30 days, with each day's date, Sahur time, and Iftar time. The current day should be visually highlighted.

3. **Shows a countdown timer** below the calendar that displays how long is left until the next Suhoor or Iftaar, updating in real time.

---

## Requirements Summary

- [ ] Backend route `GET /ramadan` that proxies the Islamic API and returns structured day-by-day data
- [ ] API key stored in an environment variable (`.env`), not committed to git
- [ ] Frontend fetches from your backend (not the external API directly)
- [ ] Calendar view displaying all 30 days with Sahur and Iftar times
- [ ] Current day is highlighted in the calendar
- [ ] Live countdown timer to the next Suhoor or Iftaar

---

## Tech Stack

- **Backend:** Python, [FastAPI](https://fastapi.tiangolo.com/), `httpx` (for calling the external API), `python-dotenv`
- **Frontend:** React 19, TypeScript, Vite

---

## Notes

- Focus on correctness and clarity — clean, readable code matters
- The UI does not need to be elaborate, but it should be functional and presentable
- If you have questions about the external API, refer to the [official docs](https://islamicapi.com/doc/ramadan/)


