import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

type RamadanDay = {
  date: string;      // "YYYY-MM-DD"
  sahur: string;     // "HH:MM" 24h
  iftar: string;     // "HH:MM" 24h
  hijri_readable?: string;
  day?: string;
};

type NextEvent =
  | { kind: "sahur" | "iftar"; at: Date; label: string }
  | null;

function pad2nd(n: number) {
  return String(n).padStart(2, "0");
}

function get_localtime(d: Date) {
  return `${d.getFullYear()}-${pad2nd(d.getMonth() + 1)}-${pad2nd(d.getDate())}`;
}

function make_Date_parser(ymd: string, hhmm: string) {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  const [hh, mm] = hhmm.split(":").map((x) => Number(x));
  // local time
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function format_timing(ms: number) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  return `${pad2nd(h)}:${pad2nd(m)}:${pad2nd(s)}`;
}

export default function App() {
  const [days, setDays] = useState<RamadanDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  const tickRef = useRef<number | null>(null);

  // 1) get user location (fallback to a hardcoded location if denied)
  useEffect(() => {
    if (!navigator.geolocation) {
      setCoords({ lat: 41.8781, lon: -87.6298 }); // Chicago fallback
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        // permission denied / error -> fallback
        setCoords({ lat: 41.8781, lon: -87.6298 }); // Chicago fallback
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, []);

  // 2) fetch ramadan data from backend (NOT directly from IslamicAPI)
  useEffect(() => {
    if (!coords) return;

    const controller = new AbortController();

    async function run() {
      setError(null);
      setDays(null);

      try {
        const url = new URL("http://localhost:8000/ramadan");
        url.searchParams.set("lat", coords.lat.toFixed(6));
        url.searchParams.set("lon", coords.lon.toFixed(6));

        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Backend error (${res.status}): ${text}`);
        }

        const data = (await res.json()) as RamadanDay[];
        setDays(data);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError(e?.message ?? "Failed to load Ramadan data");
      }
    }

    run();
    return () => controller.abort();
  }, [coords]);

  // 3) live clock for countdown
  useEffect(() => {
    tickRef.current = window.setInterval(() => setNow(new Date()), 250);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  const todayYMD = useMemo(() => get_localtime(now), [now]);

  const nextEvent: NextEvent = useMemo(() => {
    if (!days || days.length === 0) return null;

    // Find today's entry (by date string)
    const today = days.find((d) => d.date === todayYMD);

    const nowMs = now.getTime();

    // helper: earliest event after "now"
    const candidateEvents: { kind: "sahur" | "iftar"; at: Date; label: string }[] = [];

    if (today) {
      const sahurAt = make_Date_parser(today.date, today.sahur);
      const iftarAt = make_Date_parser(today.date, today.iftar);

      if (sahurAt.getTime() > nowMs) candidateEvents.push({ kind: "sahur", at: sahurAt, label: "Next Suhoor" });
      if (iftarAt.getTime() > nowMs) candidateEvents.push({ kind: "iftar", at: iftarAt, label: "Next Iftar" });
    }

    // If nothing left today, use next day's sahur
    if (candidateEvents.length === 0) {
      // Find the first day strictly after todayYMD
      const nextDay = days.find((d) => d.date > todayYMD) ?? null;
      if (!nextDay) return null;

      const sahurAt = make_Date_parser(nextDay.date, nextDay.sahur);
      return { kind: "sahur", at: sahurAt, label: "Next Suhoor" };
    }

    // choose earliest upcoming among sahur/iftar
    candidateEvents.sort((a, b) => a.at.getTime() - b.at.getTime());
    return candidateEvents[0];
  }, [days, now, todayYMD]);

  const countdown = useMemo(() => {
    if (!nextEvent) return null;
    return format_timing(nextEvent.at.getTime() - now.getTime());
  }, [nextEvent, now]);

  return (
    <div className="page">
      <header className="header">
        <h1>MTC Ramadan Calendar, submission of Ibrahim Aldrees</h1>
        <p className="sub">
          {coords ? (
            <>
              Using location: <span className="mono">{coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}</span>
            </>
          ) : (
            "Getting your location…"
          )}
        </p>
      </header>

      {error && (
        <div className="card error">
          <div className="cardTitle">Couldn’t load data</div>
          <div className="cardBody">{error}</div>
          <div className="cardHint">
            Make sure the backend is running on <span className="mono">http://localhost:8000</span> and your API key is set in <span className="mono">backend/.env</span>.
          </div>
        </div>
      )}

      {!error && !days && (
        <div className="card">
          <div className="cardTitle">Loading…</div>
          <div className="cardBody">Fetching the 30-day Ramadan schedule from your backend.</div>
        </div>
      )}

      {!error && days && (
        <>
          <section className="card">
            <div className="cardTitle">Calendar (30 days)</div>
            <div className="grid">
              {days.map((d) => {
                const isToday = d.date === todayYMD;
                return (
                  <div key={d.date} className={`day ${isToday ? "today" : ""}`}>
                    <div className="dayTop">
                      <div className="date">{d.date}</div>
                      {d.hijri_readable && <div className="hijri">{d.hijri_readable}</div>}
                    </div>
                    <div className="times">
                      <div className="timeRow">
                        <span className="label">Sahur</span>
                        <span className="mono" id="time">{d.sahur}</span>
                      </div>
                      <div className="timeRow">
                        <span className="label">Iftar</span>
                        <span className="mono" id="time">{d.iftar}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card">
            <div className="cardTitle">Countdown</div>

            {nextEvent && countdown ? (
              <div className="countdownRow">

                <div className="countdown">
                  <div className="countdownLabel">{nextEvent.label}</div>
                  <div className="countdownValue mono">{countdown}</div>
                  <div className="countdownMeta">
                    Target: <span className="mono">{nextEvent.at.toLocaleString()}</span>
                  </div>
                </div>

              </div>
            ) : (
              <div className="cardBody">
                No upcoming Suhoor/Iftar found in the loaded range.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}