import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  MapPin, Wind, Droplets, CloudRain, Sun,
  Snowflake, Layers, Tractor, ChevronDown,
  AlertTriangle, Info,
  Eye, Gauge, Sunrise, Sunset,
  CircleCheck, FlaskConical, Waves,
  ChartBar, ArrowRight, ArrowLeft, XCircle, AlertCircle,
  Wifi, Shield, Zap, ChevronRight, Search, BookmarkPlus, X, History
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { FieldcastLogo } from "../components/FieldcastLogo";
import { openWeatherOneCall, type GeoDirectResult, type OneCallResponse } from "../api/openweather";
import { searchLocations } from "../api/locationSearch";

function msToMph(ms: number) {
  return ms * 2.2369362920544;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatTime(tsSeconds: number) {
  const d = new Date(tsSeconds * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatShortDate(tsSeconds: number) {
  const d = new Date(tsSeconds * 1000);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatWeekday(tsSeconds: number) {
  const d = new Date(tsSeconds * 1000);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function getIconEmoji(icon: string | undefined) {
  if (!icon) return "🌤️";
  if (icon.startsWith("01")) return "☀️";
  if (icon.startsWith("02")) return "🌤️";
  if (icon.startsWith("03") || icon.startsWith("04")) return "☁️";
  if (icon.startsWith("09")) return "🌧️";
  if (icon.startsWith("10")) return "🌦️";
  if (icon.startsWith("11")) return "⛈️";
  if (icon.startsWith("13")) return "❄️";
  if (icon.startsWith("50")) return "🌫️";
  return "🌤️";
}

type SavedLocation = { name: string; lat: number; lon: number };

const STORAGE_SAVED = "fieldcast:savedLocations";
const STORAGE_RECENT = "fieldcast:recentLocations";
const RECENT_MAX = 5;

function locationsMatch(a: SavedLocation, b: SavedLocation) {
  return Math.abs(a.lat - b.lat) < 0.001 && Math.abs(a.lon - b.lon) < 0.001;
}

function readSavedFromStorage(): SavedLocation[] {
  try {
    const raw = localStorage.getItem(STORAGE_SAVED);
    const parsed = raw ? (JSON.parse(raw) as SavedLocation[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lon));
  } catch {
    return [];
  }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const frostColors: Record<string, string> = {
  None:     "bg-emerald-100 text-emerald-700",
  Low:      "bg-yellow-100  text-yellow-700",
  Moderate: "bg-orange-100  text-orange-700",
  High:     "bg-red-100     text-red-700",
  Severe:   "bg-red-800     text-red-50",
};

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
      {label}
    </span>
  );
}

function MetricTile({
  icon, label, value, sub, valueColor = "text-gray-800", badge
}: {
  icon: ReactNode; label: string; value: string;
  sub?: string; valueColor?: string; badge?: ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 flex flex-col gap-1" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ color: "#94a3b8" }}>{icon}</span>
          <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", color: "#94a3b8" }}>{label.toUpperCase()}</span>
        </div>
        {badge}
      </div>
      <p className={`font-bold leading-tight ${valueColor}`} style={{ fontSize: "1.25rem" }}>{value}</p>
      {sub && <p style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "forecast" | "chart">("overview");
  const [alertsOpen, setAlertsOpen] = useState(true);
  const [forecastView, setForecastView] = useState<"hourly" | "daily" | "weekly" | "monthly">("daily");
  const [profileOpen, setProfileOpen] = useState(false);
  const [rainfallPeriod, setRainfallPeriod] = useState<"24h" | "7d" | "30d">("24h");
  const [livestockOpen, setLivestockOpen] = useState(true);
  const [oneCall, setOneCall] = useState<OneCallResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [locQuery, setLocQuery] = useState("");
  const [locFocused, setLocFocused] = useState(false);
  const [locResults, setLocResults] = useState<GeoDirectResult[]>([]);
  const [locSearching, setLocSearching] = useState(false);
  const [locSearchErr, setLocSearchErr] = useState<string | null>(null);
  const [isCompactHeader, setIsCompactHeader] = useState(false);
  const [recentTick, setRecentTick] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const urlName = searchParams.get("name") || null;
  const urlLat = searchParams.get("lat");
  const urlLon = searchParams.get("lon");
  const coordsFromUrl = useMemo(() => {
    const lat = urlLat ? Number(urlLat) : NaN;
    const lon = urlLon ? Number(urlLon) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  }, [urlLat, urlLon]);

  const effectiveLocation = useMemo<SavedLocation | null>(() => {
    if (coordsFromUrl) {
      return { name: urlName ?? "Selected location", ...coordsFromUrl };
    }
    try {
      const raw = localStorage.getItem("fieldcast:lastLocation");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { name: string; lat: number; lon: number };
      if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lon)) return null;
      return parsed as SavedLocation;
    } catch {
      return null;
    }
  }, [coordsFromUrl, urlName]);

  const recentLocations = useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_RECENT);
      const parsed = raw ? (JSON.parse(raw) as SavedLocation[]) : [];
      const arr = Array.isArray(parsed) ? parsed : [];
      return arr
        .filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lon))
        .slice(0, RECENT_MAX);
    } catch {
      return [];
    }
  }, [location.search, locFocused, recentTick]);

  const locQueryTrim = locQuery.trim();
  const filteredRecentLocations = useMemo(() => {
    if (!locQueryTrim) return recentLocations;
    const q = locQueryTrim.toLowerCase();
    return recentLocations.filter((r) => r.name.toLowerCase().includes(q));
  }, [recentLocations, locQueryTrim]);

  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(() => readSavedFromStorage());

  const currentIsSaved = useMemo(() => {
    if (!effectiveLocation) return false;
    return savedLocations.some((s) => locationsMatch(s, effectiveLocation));
  }, [effectiveLocation, savedLocations]);

  function persistSaved(next: SavedLocation[]) {
    localStorage.setItem(STORAGE_SAVED, JSON.stringify(next));
    setSavedLocations(next);
  }

  function addCurrentLocationToSaved() {
    if (!effectiveLocation) return;
    const next = [effectiveLocation, ...savedLocations.filter((s) => !locationsMatch(s, effectiveLocation))];
    persistSaved(next);
  }

  function removeSaved(entry: SavedLocation) {
    persistSaved(savedLocations.filter((s) => !locationsMatch(s, entry)));
  }

  function removeFromRecent(entry: SavedLocation) {
    try {
      const raw = localStorage.getItem(STORAGE_RECENT);
      const parsed = raw ? (JSON.parse(raw) as SavedLocation[]) : [];
      const prev = Array.isArray(parsed) ? parsed : [];
      const next = prev.filter((p) => !locationsMatch(p, entry));
      localStorage.setItem(STORAGE_RECENT, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setRecentTick((t) => t + 1);
  }

  function goToSavedLocation(p: SavedLocation) {
    localStorage.setItem("fieldcast:lastLocation", JSON.stringify(p));
    const slug = slugify(p.name);
    navigate(`/location/${slug}?name=${encodeURIComponent(p.name)}&lat=${p.lat}&lon=${p.lon}`);
    setProfileOpen(false);
  }

  function navigateToLocationFromSearch(loc: { name: string; lat: number; lon: number; country?: string; state?: string }) {
    const display = loc.state ? `${loc.name}, ${loc.state}` : loc.country ? `${loc.name}, ${loc.country}` : loc.name;
    const entry: SavedLocation = { name: display, lat: loc.lat, lon: loc.lon };
    localStorage.setItem("fieldcast:lastLocation", JSON.stringify(entry));
    const prev: SavedLocation[] = (() => {
      try {
        const raw = localStorage.getItem(STORAGE_RECENT);
        const parsed = raw ? (JSON.parse(raw) as SavedLocation[]) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();
    const deduped = [entry, ...prev.filter((p) => !(Math.abs(p.lat - entry.lat) < 0.001 && Math.abs(p.lon - entry.lon) < 0.001))].slice(0, RECENT_MAX);
    localStorage.setItem(STORAGE_RECENT, JSON.stringify(deduped));
    const slug = slugify(display);
    navigate(`/location/${slug}?name=${encodeURIComponent(display)}&lat=${loc.lat}&lon=${loc.lon}`);
    setLocQuery("");
    setLocResults([]);
    setLocSearchErr(null);
    setProfileOpen(false);
  }

  useEffect(() => {
    let cancelled = false;
    const q = locQuery.trim();
    if (!locFocused) return;
    if (q.length < 2) {
      setLocResults([]);
      setLocSearchErr(null);
      setLocSearching(false);
      return;
    }

    setLocSearching(true);
    setLocSearchErr(null);
    const t = window.setTimeout(() => {
      searchLocations(q, 6)
        .then((r) => {
          if (cancelled) return;
          setLocResults(r);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setLocResults([]);
          setLocSearchErr(e instanceof Error ? e.message : "Location search failed");
        })
        .finally(() => {
          if (cancelled) return;
          setLocSearching(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [locQuery, locFocused]);

  const handleLocSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = locQuery.trim();
    if (!q) return;
    try {
      setLocSearching(true);
      setLocSearchErr(null);
      const r = await searchLocations(q, 1);
      if (r[0]) navigateToLocationFromSearch(r[0]);
      else setLocSearchErr("No matching locations found");
    } catch (err: unknown) {
      setLocSearchErr(err instanceof Error ? err.message : "Location search failed");
    } finally {
      setLocSearching(false);
    }
  };

  useEffect(() => {
  let lastY = window.scrollY;

  const onScroll = () => {
    const currentY = window.scrollY;

    if (currentY <= 40) {
      setIsCompactHeader(false);
    } else if (currentY > lastY + 2) {
      setIsCompactHeader(true);
    } else if (currentY < lastY - 8) {
      setIsCompactHeader(false);
    }

    lastY = currentY;
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}, []);

  useEffect(() => {
    if (!effectiveLocation) return;
    let cancelled = false;
    setLoading(true);
    setLoadErr(null);

    openWeatherOneCall({ lat: effectiveLocation.lat, lon: effectiveLocation.lon, units: "metric", exclude: ["minutely"] })
      .then((data) => {
        if (cancelled) return;
        setOneCall(data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setOneCall(null);
        setLoadErr(e instanceof Error ? e.message : "Failed to load weather data");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveLocation]);

  const live = oneCall;
  const liveName = effectiveLocation?.name ?? "UK location";
  const liveCurrent = live?.current ?? null;
  const liveWindMph = liveCurrent ? Math.round(msToMph(liveCurrent.wind_speed)) : null;
  const liveGustMph = liveCurrent?.wind_gust ? Math.round(msToMph(liveCurrent.wind_gust)) : null;
  const liveHumidity = liveCurrent ? Math.round(liveCurrent.humidity) : null;
  const liveUvi = liveCurrent ? Math.round(liveCurrent.uvi) : null;
  const liveTemp = liveCurrent ? Math.round(liveCurrent.temp) : null;
  const liveFeels = liveCurrent ? Math.round(liveCurrent.feels_like) : null;
  const liveCond = liveCurrent?.weather?.[0]?.description ? liveCurrent.weather[0].description : null;
  const liveEmoji = liveCurrent?.weather?.[0]?.icon ? getIconEmoji(liveCurrent.weather[0].icon) : "🌤️";
  const liveRainTodayMm = live?.daily?.[0]?.rain ?? null;
  const liveFrostLevel = live?.daily?.[0]?.temp?.min !== undefined
    ? (live.daily[0].temp.min <= 0 ? "Moderate" : live.daily[0].temp.min <= 2 ? "Low" : "None")
    : "Low";

  const activeLocationSlug = slugify(liveName);

  useEffect(() => {
    if (!effectiveLocation) return;
    const slug = params.slug;
    const expected = slugify(effectiveLocation.name);
    if (!slug || slug !== expected) {
      navigate(`/location/${expected}?name=${encodeURIComponent(effectiveLocation.name)}&lat=${effectiveLocation.lat}&lon=${effectiveLocation.lon}`, { replace: true });
    }
  }, [effectiveLocation, params.slug, navigate]);

  const liveHourly = useMemo(() => {
    return (live?.hourly ?? []).slice(0, 17).map((h) => ({
      time: formatTime(h.dt),
      emoji: getIconEmoji(h.weather?.[0]?.icon),
      temp: Math.round(h.temp),
      rain: Math.round(clamp(h.pop ?? 0, 0, 1) * 100),
      wind: Math.round(msToMph(h.wind_speed)),
      now: liveCurrent ? Math.abs(h.dt - liveCurrent.dt) < 3600 : false,
    }));
  }, [live?.hourly, liveCurrent]);

  const isCurrentHour = (timestamp) => {
    const now = new Date();
    const hour = new Date(timestamp * 1000);
    return now.getHours() === hour.getHours();
  }

  const liveDaily = useMemo(() => {
    return (live?.daily ?? []).slice(0, 7).map((d, idx) => {
      const day = idx === 0 ? "Today" : formatWeekday(d.dt);
      const date = formatShortDate(d.dt);
      const rainMm = Math.round((d.rain ?? 0) * 10) / 10;
      const popPct = Math.round(clamp(d.pop ?? 0, 0, 1) * 100);
      const windMph = Math.round(msToMph(d.wind_speed));
      return {
        day,
        date,
        emoji: getIconEmoji(d.weather?.[0]?.icon),
        cond: d.weather?.[0]?.main ?? "Forecast",
        hi: Math.round(d.temp.max),
        lo: Math.round(d.temp.min),
        rain: popPct,
        rainMm,
        wind: windMph,
        frost: d.temp.min <= 0 ? "Moderate" : d.temp.min <= 2 ? "Low" : "None",
        note: popPct >= 70 ? "Wet spell likely — plan accordingly" : popPct >= 40 ? "Mixed conditions — monitor closely" : "Good fieldwork potential",
      };
    });
  }, [live?.daily]);

  const liveChartData = useMemo(() => {
    return (live?.daily ?? []).slice(0, 7).map((d) => ({
      day: formatWeekday(d.dt),
      high: Math.round(d.temp.max),
      low: Math.round(d.temp.min),
      rain: Math.round(((d.rain ?? 0) + (d.snow ?? 0)) * 10) / 10,
    }));
  }, [live?.daily]);

  const hourlyForUi = useMemo(() => {
    if(liveHourly.length) {
      return liveHourly;
    }

    return [
        { time: "07:00", emoji: "🌫️", temp: 4, rain: 5, wind: 12, label: "Misty" },
        { time: "08:00", emoji: "🌤️", temp: 5, rain: 5, wind: 13, label: "Part cloud" },
        { time: "09:00", emoji: "🌤️", temp: 6, rain: 10, wind: 14, label: "Part cloud" },
        { time: "10:00", emoji: "⛅", temp: 6, rain: 10, wind: 15, label: "Part cloud", now: true },
        { time: "11:00", emoji: "⛅", temp: 7, rain: 15, wind: 15, label: "Part cloud" },
        { time: "12:00", emoji: "🌥️", temp: 7, rain: 20, wind: 16, label: "Mostly cloud" },
        { time: "13:00", emoji: "🌥️", temp: 7, rain: 20, wind: 17, label: "Mostly cloud" },
        { time: "14:00", emoji: "🌥️", temp: 7, rain: 25, wind: 18, label: "Mostly cloud" },
        { time: "15:00", emoji: "☁️", temp: 6, rain: 30, wind: 19, label: "Overcast" },
        { time: "16:00", emoji: "☁️", temp: 6, rain: 35, wind: 20, label: "Overcast" },
        { time: "17:00", emoji: "🌦️", temp: 5, rain: 45, wind: 21, label: "Light rain" },
        { time: "18:00", emoji: "🌦️", temp: 5, rain: 50, wind: 20, label: "Light rain" },
        { time: "19:00", emoji: "🌧️", temp: 4, rain: 60, wind: 18, label: "Rain" },
        { time: "20:00", emoji: "🌧️", temp: 4, rain: 55, wind: 17, label: "Rain" },
        { time: "21:00", emoji: "☁️", temp: 3, rain: 30, wind: 15, label: "Overcast" },
        { time: "22:00", emoji: "☁️", temp: 3, rain: 20, wind: 14, label: "Overcast" },
        { time: "23:00", emoji: "🌑", temp: 2, rain: 10, wind: 13, label: "Clear" },
      ];
  }, [liveHourly]);

  const farmerDecisions = useMemo(() => {
    if (!hourlyForUi.length) return {sprayDriftRisk: "Low", irrigationAdvice: "", frostRisk: "Low",
      heatRisk: "Low heat risk. Suitable conditions for all activities.",
      livestockAlerts: "No alerts", todaysVerdict: "Good conditions for fieldwork today.",
      actions: { canSpray: true, canHarvest: true, canGraze: true },
      canICards: [] as { question: string; status: "yes"|"caution"|"no"; reason: string }[],
      peakTemp: null as null|{ value: number; time: string },
      peakRain: null as null|{ value: number; time: string },
      peakWind: null as null|{ value: number; time: string },
    };

    const sprayDriftRisk = hourlyForUi.some((hour) => hour.wind > 15)
      ? "High risk of spray drift. Avoid spraying during these hours."
      : hourlyForUi.some((hour) => hour.wind > 10)
        ? "Moderate risk of spray drift. Consider delaying spraying or using drift-reduction techniques."
        : "Low";
  
    const irrigationAdvice = hourlyForUi.some((hour) => hour.rain >= 50)
      ? "Heavy rain expected. Irrigation not recommended."
      : hourlyForUi.some((hour) => hour.rain >= 20)
        ? "Moderate rain expected. Monitor soil moisture before irrigating."
        : "Low chance of rain. Irrigation may be beneficial if soil is dry.";
    
    const frostRisk = hourlyForUi.some((hour) => hour.temp <= 0)
      ? "Frost conditions expected. Protect sensitive crops and avoid frost-prone activities."
      : hourlyForUi.some((hour) => hour.temp <= 4)
        ? "Moderate frost risk, monitor temperatures closely."
        : "Low"
  
    const heatRisk = hourlyForUi.some((hour) => hour.temp >= 32)
      ? "High heat risk. Avoid strenuous activities and consider irrigation to protect crops."
      : hourlyForUi.some((hour) => hour.temp >= 28)
        ? "Moderate heat risk. Ensure livestock have access to shade and water."
        : "Low heat risk. Suitable conditions for all activities.";
    
    const livestockAlerts = hourlyForUi.some((hour) => hour.temp >= 28)
      ? "High heat risk for livestock. Provide shade, water and avoid outdoor activities during peak heat hours."
      : hourlyForUi.some((hour) => hour.temp <= 0)
        ? "Frost conditions expected. Ensure livestock have shelter and consider bringing them indoors if possible."
        : "No alerts"; 
          
    const todaysVerdict = hourlyForUi.some((hour) => hour.rain >= 50 && hour.wind >= 25)
      ? "Heavy rain and strong winds expected today"
      : hourlyForUi.some((hour) => hour.rain >= 25 && hour.wind > 15)
      ? "Moderate rain and winds expected today"
      : hourlyForUi.some((hour) => hour.rain > 5 && hour.wind > 8)
      ? "Light rain and winds expected today"
      : hourlyForUi.some((hour) => hour.rain >= 50)
      ? "Heavy rain expected today"
      : hourlyForUi.some((hour) => hour.rain >= 25)
      ? "Moderate rain expected today"
      : hourlyForUi.some((hour) => hour.rain > 5)
      ? "Light rain expected today"
      : hourlyForUi.some((hour) => hour.wind >= 25)
      ? "Strong winds expected today"
      : hourlyForUi.some((hour) => hour.wind > 15)
      ? "Moderate winds expected today"
      : hourlyForUi.some((hour) => hour.wind > 8)
      ? "Light winds expected today"
      : "Good conditions for fieldwork today."
  
    const actions = {
      canSpray: sprayDriftRisk === "Low" && frostRisk === "Low",
      canHarvest: todaysVerdict.includes("Good") || todaysVerdict.includes("Dry"),
      canGraze: livestockAlerts === "No alerts",
    };

    const canICards: { question: string; status: "yes"|"caution"|"no"; reason: string }[] = [
      {
        question: "Can I Spray?",
        status: hourlyForUi.some(h => h.wind > 15) ? "no" : hourlyForUi.some(h => h.wind > 10) ? "caution" : "yes",
        reason: hourlyForUi.some(h => h.wind > 15)
          ? `Wind exceeds 10 mph limit so high drift risk`
          : hourlyForUi.some(h => h.wind > 10)
            ? `Borderline wind speed, use low-drift nozzles`
            : `Wind within safe spraying limit`,
      },
      {
        question: "Can I Harvest?",
        status: hourlyForUi.some(h => h.rain >= 50) ? "no" : hourlyForUi.some(h => h.rain >= 25) ? "caution" : "yes",
        reason: hourlyForUi.some(h => h.rain >= 50)
          ? "Heavy rain"
          : hourlyForUi.some(h => h.rain >= 25)
            ? "Damp"
            : "Conditions workable",
      },
      {
        question: "Can I move livestock?",
        status: hourlyForUi.some(h => h.wind > 25 || h.temp >= 28 || h.temp <= 0) ? "caution" : "yes",
        reason: hourlyForUi.some(h => h.wind > 25)
          ? "Strong winds, shelter livestock"
          : hourlyForUi.some(h => h.temp >= 28)
            ? "Heat risk, move to cooler areas"
            : hourlyForUi.some(h => h.temp <= 0)
              ? "Frost risk"
              : "Conditions safe for moving",
      },
      {
        question: "Can I use machinery?",
        status: hourlyForUi.some(h => h.rain >= 50) ? "no" : hourlyForUi.some(h => h.rain >= 25) ? "caution" : "yes",
        reason: hourlyForUi.some(h => h.rain >= 50)
          ? "Heavy rain"
          : hourlyForUi.some(h => h.rain >= 25)
            ? "Wet conditions"
            : "Ground conditions acceptable",
      },
      {
        question: "Can I apply fertiliser?",
        status: hourlyForUi.some(h => h.wind > 15 || h.rain >= 50) ? "no" : hourlyForUi.some(h => h.wind > 10 || h.rain >= 25) ? "caution" : "yes",
        reason: hourlyForUi.some(h => h.wind > 15)
          ? "Wind too high, drift and waste risk"
          : hourlyForUi.some(h => h.rain >= 50)
            ? "Heavy rain, runoff risk"
            : hourlyForUi.some(h => h.wind > 10 || h.rain >= 25)
              ? "Borderline conditions, monitor closely"
              : "Conditions suitable",
      },
      {
        question: "Can I do a field inspection?",
        status: hourlyForUi.some(h => h.wind > 25) ? "caution" : "yes",
        reason: hourlyForUi.some(h => h.wind > 25)
          ? "Very strong winds, take care on exposed ground"
          : "Good visibility for inspection",
      },
    ];

    const peakTempHour = hourlyForUi.reduce((a, b) => b.temp > a.temp ? b : a);
    const peakRainHour = hourlyForUi.reduce((a, b) => b.rain > a.rain ? b : a);
    const peakWindHour = hourlyForUi.reduce((a, b) => b.wind > a.wind ? b : a);

    return {
      sprayDriftRisk,
      irrigationAdvice,
      frostRisk,
      heatRisk,
      livestockAlerts,
      todaysVerdict,
      actions,
      canICards,
      peakTemp: { value: peakTempHour.temp, time: peakTempHour.time },
      peakRain: { value: peakRainHour.rain, time: peakRainHour.time },
      peakWind: { value: peakWindHour.wind, time: peakWindHour.time },
    };
  }, [hourlyForUi]);

  const forecastForUi = liveDaily.length
    ? liveDaily
    : [
        { day: "Today", date: "24 Feb", emoji: "🌤️", cond: "Partly Cloudy", hi: 7, lo: 2, rain: 20, rainMm: 2, wind: 15, frost: "None", note: "Fair – light work only" },
        { day: "Wed", date: "25 Feb", emoji: "☁️", cond: "Overcast", hi: 6, lo: 1, rain: 55, rainMm: 7, wind: 20, frost: "Low", note: "Further wetting expected" },
        { day: "Thu", date: "26 Feb", emoji: "🌧️", cond: "Rain Showers", hi: 5, lo: -1, rain: 80, rainMm: 12, wind: 22, frost: "Moderate", note: "Risk of waterlogging" },
        { day: "Fri", date: "27 Feb", emoji: "🌥️", cond: "Cloudy", hi: 5, lo: 0, rain: 40, rainMm: 4, wind: 16, frost: "Moderate", note: "Slow drainage" },
        { day: "Sat", date: "28 Feb", emoji: "🌤️", cond: "Sunny Intervals", hi: 9, lo: 2, rain: 15, rainMm: 1, wind: 10, frost: "Low", note: "Improving – assess" },
        { day: "Sun", date: "1 Mar", emoji: "☀️", cond: "Sunny", hi: 11, lo: 4, rain: 5, rainMm: 0, wind: 8, frost: "None", note: "Good fieldwork window" },
        { day: "Mon", date: "2 Mar", emoji: "🌦️", cond: "Light Rain", hi: 9, lo: 5, rain: 45, rainMm: 5, wind: 14, frost: "None", note: "Monitor closely" },
      ];

  const chartDataForUi = liveChartData.length
    ? liveChartData
    : [
        { day: "Tue", high: 7, low: 2, rain: 2 },
        { day: "Wed", high: 6, low: 1, rain: 7 },
        { day: "Thu", high: 5, low: -1, rain: 12 },
        { day: "Fri", high: 5, low: 0, rain: 4 },
        { day: "Sat", high: 9, low: 2, rain: 1 },
        { day: "Sun", high: 11, low: 4, rain: 0 },
        { day: "Mon", high: 9, low: 5, rain: 5 },
      ];

  const rainfallData: Record<"24h" | "7d" | "30d", { amount: number; avg: number; label: string; status: string; statusColor: string; tip: string }> = {
    "24h": { amount: 2.4, avg: 1.8, label: "Last 24 hours", status: "Above average",              statusColor: "text-amber-600", tip: "Fields accessible but monitor closely. Avoid low-lying areas." },
    "7d":  { amount: 31,  avg: 18,  label: "Last 7 days",   status: "Significantly above average", statusColor: "text-red-600",   tip: "Soil is very wet. Heavy machinery should stay on headlands only." },
    "30d": { amount: 74,  avg: 48,  label: "Last 30 days",  status: "Well above average",          statusColor: "text-red-500",   tip: "Prolonged wet period. Drainage checks essential before any fieldwork." },
  };

  //derived data//
  const liveSunrise = live?.daily?.[0]?.sunrise ? formatTime(live.daily[0].sunrise) : "07:14";
  const liveSunset  = live?.daily?.[0]?.sunset  ? formatTime(live.daily[0].sunset)  : "17:42";

  const daylightLeftStr = (() => {
    if (!live?.daily?.[0]?.sunset) return null;
    const nowSec = Date.now() / 1000;
    const diff = live.daily[0].sunset - nowSec;
    if (diff <= 0) return "Sunset passed";
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return `${h}h ${m}m`;
  })();

  const sunArcPct = (() => {
    if (!live?.daily?.[0]?.sunrise || !live?.daily?.[0]?.sunset) return 44;
    const nowSec = Date.now() / 1000;
    const { sunrise, sunset } = live.daily[0];
    const pct = Math.min(Math.max((nowSec - sunrise) / (sunset - sunrise), 0), 1);
    return Math.round(pct * 100);
  })();

  const liveMonthRainMm = (() => {
    const days = live?.daily ?? [];
    if (!days.length) return null;
    const total = days.reduce((s, d) => s + (d.rain ?? 0), 0);
    return Math.round(total);
  })();

  const sprayDriftLevel = (() => {
    const wind = liveWindMph ?? 0;
    const gust = liveGustMph ?? 0;
    if (wind > 15 || gust > 20) return "HIGH";
    if (wind > 10 || gust > 15) return "MODERATE";
    return "LOW";
  })();

  const sprayDriftLevelColor = sprayDriftLevel === "HIGH" ? "#ef4444" : sprayDriftLevel === "MODERATE" ? "#f59e0b" : "#10b981";
  const sprayDriftLevelIndex = sprayDriftLevel === "HIGH" ? 2 : sprayDriftLevel === "MODERATE" ? 1 : 0;
  const canSprayToday = sprayDriftLevel === "LOW";

  const sevenDayRainTotal = Math.round(forecastForUi.slice(0,7).reduce((s, d) => s + (d.rainMm ?? 0), 0) * 10) / 10;
  const frostDaysCount = forecastForUi.slice(0,7).filter(d => d.frost !== "None").length;
  const bestFieldworkDay = (() => {
    const candidates = forecastForUi.slice(1); // skip today
    if (!candidates.length) return null;
    return candidates.reduce((best, d) => {
      const score = (100 - d.rain) + d.hi - d.wind;
      const bestScore = (100 - best.rain) + best.hi - best.wind;
      return score > bestScore ? d : best;
    });
  })();

  const nextHeavyRainDay = forecastForUi.find(d => d.rain >= 50 && d.day !== "Today");

  const livestockAlertItems = (() => {
    const alerts: { icon: string; urgency: string; urgencyColor: string; title: string; body: string; action: string }[] = [];
    const maxWind = liveWindMph ?? 0;
    const maxGust = liveGustMph ?? 0;
    const minTemp = live?.daily?.[0]?.temp?.min ?? 99;
    const rainDays = forecastForUi.filter(d => d.rainMm >= 10);

    if (maxGust > 20 || maxWind > 15) {
      alerts.push({
        icon: "💨", urgency: "Act today", urgencyColor: "bg-red-100 text-red-800 border-red-200",
        title: "Wind speeds dangerous for exposed animals",
        body: `Gusts up to ${maxGust ?? maxWind} mph forecast. Move vulnerable livestock — lambs, young cattle — to sheltered fields or housing before this afternoon.`,
        action: "Shelter animals now",
      });
    }
    if (minTemp <= 2) {
      const frostDay = forecastForUi.find(d => d.frost !== "None" && d.day !== "Today");
      alerts.push({
        icon: "❄️", urgency: frostDay ? `Act ${frostDay.day}` : "Act soon", urgencyColor: "bg-amber-100 text-amber-800 border-amber-200",
        title: "Frost risk — check overnight water supplies",
        body: `Temperatures dropping to ${Math.round(minTemp)}°C. Check water troughs for freezing. Ensure adequate bedding and overnight housing for vulnerable animals.`,
        action: frostDay ? `Prepare before ${frostDay.day} evening` : "Prepare overnight shelter",
      });
    }
    if (rainDays.length >= 2) {
      alerts.push({
        icon: "🌧️", urgency: "Monitor this week", urgencyColor: "bg-sky-100 text-sky-800 border-sky-200",
        title: "Waterlogged pastures, risk to hoof health",
        body: "Heavy rain this week could leave pastures waterlogged. Prolonged standing in wet mud risks lameness and foot rot in cattle and sheep. Consider rotating grazing areas.",
        action: "Review field rotation plan",
      });
    }
    return alerts;
  })();

  const todayActionCards = (() => {
    const cards: { icon: React.ReactNode; iconBg: string; title: string; body: string; footer: string }[] = [];
    const { sprayDriftRisk, frostRisk, todaysVerdict } = farmerDecisions as any;
    const wind = liveWindMph ?? 0;
    const minTemp = live?.daily?.[0]?.temp?.min;
    const frostDay = forecastForUi.find(d => d.frost !== "None" && d.day !== "Today");
    const heavyRainDay = forecastForUi.find(d => d.rainMm >= 10 && d.day !== "Today");

    if (sprayDriftRisk && sprayDriftRisk !== "Low") {
      const nextGoodDay = forecastForUi.slice(1).find(d => d.wind <= 10 && d.rain < 20);
      cards.push({
        icon: <FlaskConical className="w-5 h-5 text-red-500" />, iconBg: "bg-red-50",
        title: "Don't spray today",
        body: `Wind is ${wind} mph, too strong. Any spray will drift and could harm neighbouring land or watercourses.`,
        footer: nextGoodDay ? `✅ ${nextGoodDay.day} looks suitable` : "✅ Check forecast for next window",
      });
    } else {
      cards.push({
        icon: <FlaskConical className="w-5 h-5 text-emerald-500" />, iconBg: "bg-emerald-50",
        title: "Good spray window today",
        body: `Wind is ${wind} mph, within safe limits. Good opportunity for spraying if soil conditions allow.`,
        footer: "✅ Act during daylight hours",
      });
    }

    if (frostDay && minTemp !== undefined && minTemp <= 2) {
      cards.push({
        icon: <Snowflake className="w-5 h-5 text-amber-500" />, iconBg: "bg-amber-50",
        title: `Prepare for ${frostDay.day} frost`,
        body: `Temperatures will drop to ${Math.round(minTemp)}°C. Cover any vulnerable crops, salad leaves, early brassicas, before ${frostDay.day} evening.`,
        footer: `⏰ Act before ${frostDay.day} 17:00`,
      });
    }

    if (heavyRainDay) {
      cards.push({
        icon: <Waves className="w-5 h-5 text-sky-500" />, iconBg: "bg-sky-50",
        title: "Check your field drains",
        body: `Soil is already wet and ${heavyRainDay.rainMm} mm of rain is coming ${heavyRainDay.day}. Make sure drains and ditches are clear to avoid waterlogging.`,
        footer: "💧 Do this today if possible",
      });
    }

    // Ensure at least one card always shows
    if (cards.length === 0) {
      cards.push({
        icon: <CircleCheck className="w-5 h-5 text-emerald-500" />, iconBg: "bg-emerald-50",
        title: "Good conditions today",
        body: "No major weather concerns. A good opportunity for fieldwork, inspections, and general farm tasks.",
        footer: "✅ Make the most of the window",
      });
    }

    return cards;
  })();

  // Derived: today's verdict display
  const verdictDisplay = (() => {
    const v = (farmerDecisions as any).todaysVerdict ?? "Good conditions for fieldwork today.";
    const isGood = v.toLowerCase().includes("good");
    const isCaution = v.toLowerCase().includes("caution") || v.toLowerCase().includes("light") || v.toLowerCase().includes("moderate");
    return {
      emoji: isGood ? "✅" : isCaution ? "⚠️" : "🚫",
      headline: v,
      body: (() => {
        const parts: string[] = [];
        const wind = liveWindMph ?? 0;
        const sd = (farmerDecisions as any).sprayDriftRisk ?? "";
        const fr = (farmerDecisions as any).frostRisk ?? "";
        if (sd && sd !== "Low") parts.push("Winds too strong for spraying.");
        if (fr && fr !== "Low") parts.push("Frost risk tonight, protect crops.");
        if ((liveRainTodayMm ?? 0) > 5) parts.push("Wet conditions, limit heavy machinery.");
        if (parts.length === 0) parts.push("Conditions look suitable for most farm tasks.");
        return parts.join(" ");
      })(),
    };
  })();

  // Derived: today's date string for hourly header
  const todayDateStr = liveCurrent
    ? new Date(liveCurrent.dt * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase()
    : "";
  
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F2F4F6" }}>

      {/* HEADER */}
      <header 
        className="sticky top-0 z-50 transition-all duration-300" 
        style={{
          background: "#0d1f14",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          boxShadow: isCompactHeader
          ? "0 4px 18px rgba(0,0,0,0.22)"
          : "0 4px 32px rgba(0,0,0,0.4)",
        }}
        >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div
        className="flex items-center justify-between gap-4 transition-all duration-300"
        style={{ height: isCompactHeader ? "54px" : "64px" }}
        >
          {/* Back + Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 text-white/50 hover:text-white/90 transition-colors pr-3 border-r border-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Home</span>
            </button>
            <FieldcastLogo size="sm" />
          </div>

          {/* Farm Profile Switcher */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(p => !p)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white hover:bg-white/10 transition-colors"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <MapPin className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
              <div className="text-left hidden sm:block">
                <p style={{ fontSize: "0.85rem" }}>{liveName}</p>
                <p className="text-green-300/50 leading-none" style={{ fontSize: "0.6rem" }}>UK location</p>
              </div>
              <span className="sm:hidden" style={{ fontSize: "0.85rem" }}>{liveName.split(",")[0]}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-white/30 ml-1 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
            </button>
            {profileOpen && (
              <div className="absolute top-full mt-2 left-0 w-68 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50" style={{ width: 272 }}>
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest">Saved Locations</p>
                </div>
                {savedLocations.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-gray-500">No saved places yet. Add the map location you’re viewing with “Save current” below.</p>
                ) : (
                  savedLocations.map((p, i) => (
                    <div
                      key={`${p.lat},${p.lon}`}
                      className={`flex items-stretch gap-0 ${i < savedLocations.length - 1 ? "border-b border-gray-50" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => goToSavedLocation(p)}
                        className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${slugify(p.name) === activeLocationSlug ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${slugify(p.name) === activeLocationSlug ? "text-green-700" : "text-gray-700"}`}>{p.name}</p>
                          <p className="text-gray-400 text-xs">{p.lat.toFixed(3)}, {p.lon.toFixed(3)}</p>
                        </div>
                        {slugify(p.name) === activeLocationSlug && <CircleCheck className="w-4 h-4 text-green-500 flex-shrink-0" />}
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${p.name} from saved`}
                        className="px-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSaved(p);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
                {effectiveLocation && !currentIsSaved && (
                  <button
                    type="button"
                    onClick={() => addCurrentLocationToSaved()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-left text-sm font-semibold text-green-700 bg-green-50/80 hover:bg-green-50 border-t border-gray-100 transition-colors"
                  >
                    <BookmarkPlus className="w-4 h-4 flex-shrink-0" />
                    Save current location
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Date + Connectivity */}
          <div
          className="hidden sm:flex flex-col items-end gap-1 transition-all duration-300 overflow-hidden"
          style={{
            maxWidth: isCompactHeader ? "0px" : "220px",
            opacity: isCompactHeader ? 0 : 1,
            }}
>
            <p className="text-white/80 text-xs">
              {liveCurrent
                ? new Date(liveCurrent.dt * 1000).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                : "—"}
            </p>
            <div className="flex items-center gap-1.5">
              <Wifi className="w-3 h-3 text-green-400" />
              <p className="text-green-300/70" style={{ fontSize: "0.65rem" }}>
                {loading ? "Loading…" : loadErr ? "Error loading data" : `Online · Updated ${liveCurrent ? formatTime(liveCurrent.dt) : "—"}`}
              </p>
            </div>
          </div>
        </div>

        {/* Location search */}
        <div
        className="relative transition-all duration-300 overflow-visible z-[55]"
        style={{
          paddingBottom: isCompactHeader ? "6px" : "12px",
          maxHeight: isCompactHeader ? "52px" : "88px",
          opacity: 1,
          transform: "translateY(0)",
          pointerEvents: "auto",
          }}
>
          <form onSubmit={handleLocSearchSubmit}>
            <div
              className="flex items-center rounded-xl overflow-visible transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: locFocused ? "1px solid rgba(74,222,128,0.45)" : "1px solid rgba(255,255,255,0.1)",
                boxShadow: locFocused ? "0 0 0 3px rgba(74,222,128,0.12)" : "none",
              }}
            >
              <Search className="w-3.5 h-3.5 text-green-400/80 ml-3 flex-shrink-0" />
              <input
                type="text"
                value={locQuery}
                onChange={(e) => setLocQuery(e.target.value)}
                onFocus={() => setLocFocused(true)}
                onBlur={() => setTimeout(() => setLocFocused(false), 180)}
                placeholder="Search another location…"
                className="flex-1 min-w-0 bg-transparent outline-none px-3 py-2.5 text-white placeholder:text-white/35"
                style={{ fontSize: "0.8125rem" }}
                autoComplete="off"
                aria-label="Search for a location"
              />
              <button
                type="submit"
                disabled={locSearching || !locQuery.trim()}
                className="m-1 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}
              >
                {locSearching ? "…" : "Go"}
              </button>
            </div>
          </form>

          {locFocused && (
            <div
              className="absolute left-0 right-0 top-full mt-1 rounded-xl z-[70] max-h-[min(70vh,420px)] overflow-x-hidden overflow-y-auto"
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
              }}
            >
              {locSearchErr && (
                <div className="px-4 py-3 border-b border-amber-100 bg-amber-50">
                  <p className="text-amber-800 text-xs font-medium">{locSearchErr}</p>
                </div>
              )}

              {locQueryTrim.length >= 2 && (
                <>
                  {locResults.length > 0 && (
                    <>
                      <p className="text-[0.65rem] font-semibold tracking-widest text-slate-400 px-4 pt-3 pb-1">SUGGESTIONS</p>
                      {locResults.map((r) => {
                        const label = r.state ? `${r.name}, ${r.state}` : `${r.name}, ${r.country}`;
                        return (
                          <button
                            key={`${r.lat},${r.lon}`}
                            type="button"
                            onMouseDown={() => navigateToLocationFromSearch(r)}
                            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 border-t border-slate-100"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <MapPin className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                              <span className="truncate">{label}</span>
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                          </button>
                        );
                      })}
                    </>
                  )}
                  {locSearching && (
                    <div className="px-4 py-3 flex items-center gap-2 text-xs text-slate-500 border-t border-slate-100">
                      <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      Searching…
                    </div>
                  )}
                  {!locSearching && !locSearchErr && locResults.length === 0 && (
                    <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">No matches — try a town or UK postcode</p>
                  )}
                </>
              )}

              {filteredRecentLocations.length > 0 && (
                <>
                  <p className="text-[0.65rem] font-semibold tracking-widest text-slate-400 px-4 pt-3 pb-1 border-t border-slate-100">
                    RECENT
                  </p>
                  {filteredRecentLocations.map((r) => (
                    <div
                      key={`${r.lat},${r.lon}`}
                      className="flex items-stretch border-t border-slate-100"
                    >
                      <button
                        type="button"
                        onMouseDown={() =>
                          navigateToLocationFromSearch({ name: r.name, lat: r.lat, lon: r.lon })
                        }
                        className="flex-1 min-w-0 flex items-center justify-between gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <History className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="truncate">{r.name}</span>
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${r.name} from recent`}
                        className="px-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeFromRecent(r);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </>
              )}

              {locQueryTrim.length > 0 && locQueryTrim.length < 2 && (
                <p className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100">
                  Type at least 2 characters for live suggestions
                </p>
              )}

              {!locSearchErr && locQueryTrim.length === 0 && (
                <p
                  className={`px-4 py-3 text-xs text-slate-500 ${filteredRecentLocations.length > 0 ? "border-t border-slate-100" : ""}`}
                >
                  Town, city, or UK postcode — type 2+ characters for suggestions
                </p>
              )}
            </div>
          )}
        </div>
        </div>

        {/* Tabs */}
        <div
        className="max-w-6xl mx-auto px-4 sm:px-6 flex transition-all duration-300"
        style={{ minHeight: isCompactHeader ? "40px" : "48px" }}
        >
          {(["overview", "forecast", "chart"] as const).map(tab => (
            <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="relative text-sm transition-all duration-300"
            style={{
              paddingLeft: isCompactHeader ? "1rem" : "1.25rem",
              paddingRight: isCompactHeader ? "1rem" : "1.25rem",
              paddingTop: isCompactHeader ? "0.65rem" : "0.75rem",
              paddingBottom: isCompactHeader ? "0.65rem" : "0.75rem",
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? "#4ade80" : "rgba(255,255,255,0.38)",
              borderBottom: activeTab === tab ? "2px solid #4ade80" : "2px solid transparent",
              }}
>
              {tab === "chart" ? "7-Day Chart" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7 space-y-6">
        {loadErr && (
          <div className="rounded-2xl px-5 py-4 flex items-start gap-3" style={{ background: "#FFFBEB", border: "1px solid #fde68a" }}>
            <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-900 font-semibold text-sm">Couldn’t load OpenWeather data.</p>
              <p className="text-amber-800/80 text-sm mt-1" style={{ lineHeight: 1.6 }}>{loadErr}</p>
            </div>
          </div>
        )}

        {/* HERO BANNER */}
        <div className="rounded-2xl overflow-hidden relative" style={{ height: 190, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1604590627104-655d2be93b23?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxVSyUyMGZhcm1sYW5kJTIwZGF3biUyMGFlcmlhbCUyMGdvbGRlbiUyMGhvdXJ8ZW58MXx8fHwxNzcxOTgzNDMwfDA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="UK farm fields"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(100deg,rgba(7,17,10,0.92) 0%,rgba(7,17,10,0.55) 55%,rgba(7,17,10,0.15) 100%)" }} />
          <div className="absolute inset-0 flex items-center px-7 sm:px-10">
            <div className="flex items-center gap-8">
              <div>
                <p style={{ fontSize: "0.62rem", fontWeight: 600, letterSpacing: "0.12em", color: "rgba(134,239,172,0.6)" }} className="mb-2">
                  {liveName.toUpperCase()}
                </p>
                <div className="flex items-start gap-1.5">
                  <span className="text-white leading-none" style={{ fontSize: "5.5rem", fontWeight: 300, letterSpacing: "-0.04em" }}>
                    {liveTemp ?? 7}
                  </span>
                  <span style={{ fontSize: "2rem", fontWeight: 300, color: "rgba(255,255,255,0.5)", marginTop: "0.7rem" }}>°C</span>
                </div>
                <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", fontWeight: 400, marginTop: "2px" }}>
                  Feels like {liveFeels ?? 4}°C · {liveCond ? liveCond.charAt(0).toUpperCase() + liveCond.slice(1) : "Partly Cloudy"} {liveEmoji}
                </p>
              </div>
              <div className="hidden md:flex flex-col gap-2.5" style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: "2rem" }}>
                {[
                  { icon: <Wind className="w-3.5 h-3.5 text-amber-400" />, text: `${liveWindMph ?? 15} mph`, accent: (liveWindMph ?? 15) > 10 ? "No spraying" : "Spray window possible", accentColor: "#fcd34d" },
                  { icon: <Droplets className="w-3.5 h-3.5 text-blue-400" />, text: `Humidity ${liveHumidity ?? 78}%`, accent: null, accentColor: "" },
                  { icon: <CloudRain className="w-3.5 h-3.5 text-sky-400" />, text: "2.4 mm today · 38 mm this month", accent: null, accentColor: "" },
                  { icon: <Sun className="w-3.5 h-3.5 text-yellow-300" />, text: `UV Index ${liveUvi ?? 1} — ${liveUvi !== null && liveUvi >= 6 ? "High" : liveUvi !== null && liveUvi >= 3 ? "Moderate" : "Low"}`, accent: null, accentColor: "" },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {row.icon}
                    <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.65)", fontWeight: 400 }}>{row.text}</span>
                    {row.accent && <span style={{ fontSize: "0.78rem", fontWeight: 600, color: row.accentColor }}>— {row.accent}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ALERTS */}
        <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid rgba(234,88,12,0.25)" }}>
          {/* Collapsible header */}
          <button
            onClick={() => setAlertsOpen(prev => !prev)}
            className="w-full flex items-center justify-between px-5 py-3.5 transition-colors"
            style={{ background: "linear-gradient(135deg,#431407,#7c2d12)", borderBottom: alertsOpen ? "1px solid rgba(234,88,12,0.2)" : "none" }}
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className="text-orange-100 font-semibold text-sm" style={{ letterSpacing: "0.01em" }}>Active Warnings</span>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold" style={{ boxShadow: "0 2px 8px rgba(249,115,22,0.4)" }}>
                {(live?.alerts?.length ?? 0) || 0}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-orange-300/60 transition-transform duration-200 ${alertsOpen ? "rotate-180" : ""}`} />
          </button>

          {/* Collapsible body */}
          {alertsOpen && (
            <div className="bg-white divide-y" style={{ borderTop: "none" }}>
              {(live?.alerts?.length ?? 0) > 0 ? (
                live!.alerts!.slice(0, 3).map((a, i) => (
                  <div key={`${a.event}-${a.start}-${i}`} className="p-5 flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(234,88,12,0.1)" }}>
                      <AlertTriangle className="w-4.5 h-4.5 text-orange-500" style={{ width: "1.1rem", height: "1.1rem" }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-xs font-semibold" style={{ background: "rgba(234,88,12,0.1)", color: "#9a3412" }}>Alert</span>
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ background: "#F2F4F6", color: "#64748b" }}>
                          {a.sender_name || "OpenWeather"}
                        </span>
                      </div>
                      <p className="text-gray-900 font-semibold text-sm">{a.event}</p>
                      <p className="text-gray-500 text-xs mt-1 leading-relaxed" style={{ whiteSpace: "pre-wrap" }}>
                        {a.description}
                      </p>
                      <p className="text-orange-400 text-xs mt-2 font-medium">
                        {`Valid ${new Date(a.start * 1000).toLocaleString()} – ${new Date(a.end * 1000).toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-5 flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(16,185,129,0.12)" }}>
                    <CircleCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 font-semibold text-sm">No active weather alerts for this location.</p>
                    <p className="text-gray-500 text-xs mt-1 leading-relaxed">You can still use the forecast below for planning fieldwork.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">

            {/* HOURLY BREAKDOWN */}
            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div className="px-5 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: "1px solid #F1F3F5" }}>
                <p className="text-gray-800 font-semibold text-sm">Hourly Forecast — Today</p>
                <p style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 500 }}>Scroll to see full day →</p>
              </div>
              <div className="overflow-x-auto">
                <div className="flex px-3 py-3 gap-1" style={{ minWidth: "max-content" }}>
                  {hourlyForUi.map((h) => (
                    <div
                      key={h.time}
                      className={`flex flex-col items-center gap-2 px-3 py-3 rounded-2xl flex-shrink-0 relative ${
                        h.now
                          ? "bg-green-50 border border-green-200"
                          : "hover:bg-gray-50 border border-transparent"
                      }`}
                      style={{ minWidth: 68 }}
                    >
                      {h.now && (
                        <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-xs px-2 py-0.5 rounded-full bg-green-500 text-white font-semibold" style={{ fontSize: "0.6rem" }}>NOW</span>
                      )}
                      <p className={`text-xs font-medium mt-1 ${h.now ? "text-green-700" : "text-gray-400"}`}>{h.time}</p>
                      <span className="text-2xl">{h.emoji}</span>
                      <p className={`font-semibold text-sm ${h.now ? "text-green-800" : "text-gray-700"}`}>{h.temp}°</p>
                      {/* Rain bar */}
                      <div className="w-full flex flex-col items-center gap-1">
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-400"
                            style={{ width: `${h.rain}%`, opacity: 0.7 + h.rain / 200 }}
                          />
                        </div>
                        <p className="text-blue-500 font-medium" style={{ fontSize: "0.65rem" }}>{h.rain}%</p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Wind className="w-3 h-3 text-gray-300" />
                        <p className="text-gray-400" style={{ fontSize: "0.65rem" }}>{h.wind}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Legend */}
              <div className="px-5 pb-3 flex items-center gap-4" style={{ borderTop: "1px solid #F8FAFC" }}>
                <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded bg-blue-400" /><span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>Rain chance</span></div>
                <div className="flex items-center gap-1.5"><Wind className="w-3 h-3 text-gray-300" /><span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>Wind (mph)</span></div>
              </div>
            </div>

            {/* TODAY'S VERDICT */}
            <div className="rounded-2xl p-6 flex items-center gap-5" style={{ background: "linear-gradient(135deg,#1c0a02 0%,#7c2d12 100%)", boxShadow: "0 8px 32px rgba(124,45,18,0.3)" }}>
              <div className="text-6xl flex-shrink-0">⚠️</div>
              <div className="flex-1">
                <p className="text-amber-200 text-xs font-bold uppercase tracking-widest mb-2">Today's Verdict</p>
                <p className="text-white font-bold" style={{ fontSize: "1.5rem", lineHeight: 1.2 }}>Caution — limited fieldwork only</p>
                <p className="text-amber-100/90 mt-2" style={{ fontSize: "1rem", lineHeight: 1.6 }}>Winds too strong for spraying. Soil is wet. Do light inspections only and prepare crops for Thursday frost.</p>
              </div>
              <div className="hidden sm:flex flex-col items-center gap-1 flex-shrink-0 bg-white/10 rounded-2xl px-5 py-4">
                <p className="text-amber-200 text-xs font-semibold">Daylight left</p>
                <p className="text-white font-bold text-2xl">9h 28m</p>
                <p className="text-amber-200/60 text-xs">Sets 17:42</p>
              </div>
            </div>

            {/* CAN I...? QUICK CHECK */}
            <div>
              <div className="flex items-center gap-3 px-1 mb-4">
                <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", color: "#94a3b8" }}>CAN I… TODAY?</p>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { question: "Spray crops?",      status: "no",      icon: <FlaskConical className="w-5 h-5" />, reason: "Wind 25 mph — too high" },
                  { question: "Use machinery?",    status: "caution", icon: <Tractor className="w-5 h-5" />,      reason: "Soil wet — headlands only" },
                  { question: "Apply fertiliser?", status: "no",      icon: <Waves className="w-5 h-5" />,        reason: "Wind & rain risk" },
                  { question: "Harvest?",          status: "no",      icon: <Layers className="w-5 h-5" />,       reason: "Soil too wet" },
                  { question: "Field inspection?", status: "yes",     icon: <Eye className="w-5 h-5" />,          reason: "Good visibility" },
                  { question: "Move livestock?",   status: "caution", icon: <Shield className="w-5 h-5" />,       reason: "Windy — shelter first" },
                ].map(({ question, status, icon, reason }) => {
                  const styles = {
                    yes:     { bg: "bg-emerald-50 border-emerald-200", icon: "text-emerald-700 bg-emerald-100", label: "Yes",     labelColor: "text-emerald-700", reasonColor: "text-emerald-800", badge: <CircleCheck className="w-4 h-4 text-emerald-600" /> },
                    caution: { bg: "bg-amber-50 border-amber-200",     icon: "text-amber-700 bg-amber-100",     label: "Caution", labelColor: "text-amber-700",   reasonColor: "text-amber-800",   badge: <AlertCircle className="w-4 h-4 text-amber-600" /> },
                    no:      { bg: "bg-red-50 border-red-200",         icon: "text-red-700 bg-red-100",         label: "No",      labelColor: "text-red-700",     reasonColor: "text-red-800",     badge: <XCircle className="w-4 h-4 text-red-600" /> },
                  }[status];
                  return (
                    <div key={question} className={`rounded-2xl border p-4 flex flex-col gap-2 ${styles.bg}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${styles.icon}`}>{icon}</div>
                      <div>
                        <p className="text-gray-900 font-bold text-sm leading-snug">{question}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {styles.badge}
                          <span className={`text-sm font-bold ${styles.labelColor}`}>{styles.label}</span>
                        </div>
                      </div>
                      <p className={`text-xs font-semibold leading-snug ${styles.reasonColor}`}>{reason}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SPRAY DRIFT RISK + RAINFALL ACCUMULATION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* SPRAY DRIFT RISK INDICATOR */}
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #fecaca", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                <div className="px-5 pt-5 pb-4 flex items-start justify-between" style={{ borderBottom: "1px solid #F1F3F5" }}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-5 h-5 text-red-500" />
                      <p className="text-gray-900 font-bold text-base">Spray Drift Risk</p>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Based on wind speed, gusts & humidity</p>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg text-white font-bold text-sm flex-shrink-0" style={{ background: "#ef4444", boxShadow: "0 2px 8px rgba(239,68,68,0.35)" }}>HIGH</span>
                </div>
                <div className="px-5 py-4 space-y-4">
                  <div>
                    <div className="flex gap-1.5 mb-1.5">
                      {["Low","Moderate","High","Extreme"].map((l, i) => (
                        <div key={l} className="flex-1 h-4 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: ["#10b981","#f59e0b","#ef4444","#7f1d1d"][i], opacity: i === 2 ? 1 : 0.3 }}>
                          {i === 2 && <span className="text-white font-bold" style={{ fontSize: "0.55rem" }}>▲</span>}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-gray-500 font-medium" style={{ fontSize: "0.68rem" }}>
                      <span>Low</span><span>Moderate</span><span className="text-red-600 font-bold">High</span><span>Extreme</span>
                    </div>
                  </div>
                  {[
                    { label: "Wind speed", value: "15 mph", note: "⚠️ Limit is 10 mph",      ok: false },
                    { label: "Wind gusts", value: "24 mph", note: "⚠️ Severe drift risk",     ok: false },
                    { label: "Humidity",   value: "78%",    note: "✅ Within safe range",      ok: true  },
                  ].map(f => (
                    <div key={f.label} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                      <span className="text-gray-600 font-medium text-sm">{f.label}</span>
                      <div className="text-right">
                        <p className="text-gray-900 font-bold text-sm">{f.value}</p>
                        <p className={`text-xs font-semibold ${f.ok ? "text-emerald-700" : "text-red-600"}`}>{f.note}</p>
                      </div>
                    </div>
                  ))}
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <p className="text-red-800 font-bold text-sm">Do not spray today.</p>
                    <p className="text-red-700 text-xs mt-0.5 font-medium">Risk of drift onto neighbouring land and watercourses. Next safe window: Saturday morning.</p>
                  </div>
                </div>
              </div>

              {/* RAINFALL ACCUMULATION TRACKER */}
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #bae6fd", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                <div className="px-5 pt-5 pb-4 flex items-start justify-between" style={{ borderBottom: "1px solid #F1F3F5" }}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CloudRain className="w-5 h-5 text-sky-500" />
                      <p className="text-gray-900 font-bold text-base">Rainfall Accumulation</p>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{rainfallData[rainfallPeriod].label}</p>
                  </div>
                  <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-shrink-0">
                    {(["24h","7d","30d"] as const).map(p => (
                      <button key={p} onClick={() => setRainfallPeriod(p)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${rainfallPeriod === p ? "bg-white text-sky-600 shadow-sm" : "text-gray-500"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="px-5 py-4 space-y-4">
                  <div className="flex items-end gap-3">
                    <p className="text-sky-600 font-bold" style={{ fontSize: "3rem", lineHeight: 1 }}>{rainfallData[rainfallPeriod].amount}</p>
                    <div className="mb-1">
                      <p className="text-sky-400 font-bold text-xl">mm</p>
                      <p className={`text-xs font-bold ${rainfallData[rainfallPeriod].statusColor}`}>{rainfallData[rainfallPeriod].status}</p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-gray-500 mb-1.5">
                        <span>This period</span>
                        <span className="text-sky-600">{rainfallData[rainfallPeriod].amount} mm</span>
                      </div>
                      <div className="w-full h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-sky-400 transition-all duration-500"
                          style={{ width: `${Math.min((rainfallData[rainfallPeriod].amount / (rainfallData[rainfallPeriod].avg * 1.8)) * 100, 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-gray-500 mb-1.5">
                        <span>Historical average</span>
                        <span className="text-gray-500">{rainfallData[rainfallPeriod].avg} mm</span>
                      </div>
                      <div className="w-full h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gray-300 transition-all duration-500"
                          style={{ width: `${Math.min((rainfallData[rainfallPeriod].avg / (rainfallData[rainfallPeriod].avg * 1.8)) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
                    <p className="text-sky-800 text-sm font-semibold leading-relaxed">💧 {rainfallData[rainfallPeriod].tip}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* KEY CONDITIONS */}
            <div>
              <div className="flex items-center gap-3 px-1 mb-4">
                <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", color: "#94a3b8" }}>CURRENT CONDITIONS</p>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Wind */}
                <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.1)" }}>
                      <Wind className="w-5 h-5 text-amber-500" />
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: "rgba(245,158,11,0.12)", color: "#b45309" }}>High</span>
                  </div>
                  <p style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 500, marginBottom: "4px" }}>Wind Speed</p>
                  <p className="text-amber-600 font-bold" style={{ fontSize: "2rem", lineHeight: 1 }}>{liveWindMph ?? 15} <span style={{ fontSize: "1rem", fontWeight: 500 }}>mph</span></p>
                  <p style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "6px" }}>Gusts to {liveGustMph ?? 24} mph</p>
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid #F1F3F5" }}>
                    <p style={{ fontSize: "0.72rem", color: "#d97706", fontWeight: 600 }}>⚠️ Safe spraying limit is 10 mph</p>
                  </div>
                </div>

                {/* Rainfall */}
                <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(14,165,233,0.1)" }}>
                      <CloudRain className="w-5 h-5 text-sky-500" />
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: "rgba(14,165,233,0.1)", color: "#0369a1" }}>Light</span>
                  </div>
                  <p style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 500, marginBottom: "4px" }}>Rainfall Today</p>
                  <p className="text-sky-600 font-bold" style={{ fontSize: "2rem", lineHeight: 1 }}>{liveRainTodayMm ?? 2.4} <span style={{ fontSize: "1rem", fontWeight: 500 }}>mm</span></p>
                  <p style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "6px" }}>38 mm this month</p>
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid #F1F3F5" }}>
                    <p style={{ fontSize: "0.72rem", color: "#0ea5e9", fontWeight: 600 }}>🌧️ Heavy rain expected Thursday</p>
                  </div>
                </div>

                {/* Soil Moisture */}
                <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(59,130,246,0.1)" }}>
                      <Layers className="w-5 h-5 text-blue-500" />
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: "rgba(59,130,246,0.1)", color: "#1d4ed8" }}>Wet</span>
                  </div>
                  <p style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 500, marginBottom: "4px" }}>Soil Moisture</p>
                  <p className="text-blue-600 font-bold" style={{ fontSize: "2rem", lineHeight: 1 }}>76 <span style={{ fontSize: "1rem", fontWeight: 500 }}>%</span></p>
                  <div className="mt-2 w-full h-1.5 rounded-full overflow-hidden" style={{ background: "#F1F3F5" }}>
                    <div className="h-full rounded-full w-[76%]" style={{ background: "linear-gradient(90deg,#10b981,#3b82f6)" }} />
                  </div>
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid #F1F3F5" }}>
                    <p style={{ fontSize: "0.72rem", color: "#3b82f6", fontWeight: 600 }}>⚠️ Avoid heavy machinery in fields</p>
                  </div>
                </div>

                {/* Frost Risk */}
                <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.1)" }}>
                      <Snowflake className="w-5 h-5 text-indigo-400" />
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: "rgba(234,179,8,0.12)", color: "#854d0e" }}>{liveFrostLevel}</span>
                  </div>
                  <p style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 500, marginBottom: "4px" }}>Frost Risk</p>
                  <p className="text-indigo-600 font-bold" style={{ fontSize: "2rem", lineHeight: 1 }}>{liveFrostLevel}</p>
                  <p style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "6px" }}>Soil temp 4°C at 10 cm depth</p>
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid #F1F3F5" }}>
                    <p style={{ fontSize: "0.72rem", color: "#6366f1", fontWeight: 600 }}>🌙 Risk rises Thursday night</p>
                  </div>
                </div>
              </div>
            </div>

            {/* LIVESTOCK ALERTS */}
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <button
                onClick={() => setLivestockOpen(p => !p)}
                className="w-full flex items-center justify-between px-5 py-4 transition-colors"
                style={{ background: "#F8FAFB", borderBottom: livestockOpen ? "1px solid #E4E7EA" : "none" }}
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4.5 h-4.5" style={{ width: "1.1rem", height: "1.1rem", color: "#7c3aed" }} />
                  <span className="text-gray-800 font-semibold text-sm">Livestock Weather Alerts</span>
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold" style={{ background: "#7c3aed", fontSize: "0.65rem" }}>3</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${livestockOpen ? "rotate-180" : ""}`} style={{ color: "#94a3b8" }} />
              </button>
              {livestockOpen && (
                <div className="bg-white divide-y" style={{ borderColor: "#F1F3F5" }}>
                  {[
                    {
                      icon: "💨", urgency: "Act today", urgencyColor: "bg-red-100 text-red-800 border-red-200",
                      title: "Wind speeds dangerous for exposed animals",
                      body: "Gusts up to 24 mph forecast. Move vulnerable livestock — lambs, young cattle — to sheltered fields or housing before this afternoon.",
                      action: "Shelter animals by 14:00 today",
                    },
                    {
                      icon: "❄️", urgency: "Act Thursday", urgencyColor: "bg-amber-100 text-amber-800 border-amber-200",
                      title: "Frost risk — check overnight water supplies",
                      body: "Temperatures dropping to -1°C Thursday night. Check water troughs for freezing. Ensure adequate bedding and overnight housing for vulnerable animals.",
                      action: "Prepare before Thursday 17:00",
                    },
                    {
                      icon: "🌧️", urgency: "Monitor this week", urgencyColor: "bg-sky-100 text-sky-800 border-sky-200",
                      title: "Waterlogged pastures — risk to hoof health",
                      body: "Heavy rain this week could leave pastures waterlogged. Prolonged standing in wet mud risks lameness and foot rot in cattle and sheep. Consider rotating grazing areas.",
                      action: "Review field rotation plan",
                    },
                  ].map((alert, i) => (
                    <div key={i} className="p-5 flex items-start gap-4">
                      <div className="text-3xl flex-shrink-0 mt-1">{alert.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${alert.urgencyColor}`}>{alert.urgency}</span>
                        </div>
                        <p className="text-gray-900 font-bold text-sm mb-1">{alert.title}</p>
                        <p className="text-gray-600 text-sm leading-relaxed mb-3">{alert.body}</p>
                        <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 w-fit" style={{ background: "rgba(124,58,237,0.07)" }}>
                          <ChevronRight className="w-3 h-3" style={{ color: "#7c3aed" }} />
                          <p className="text-sm font-semibold" style={{ color: "#6d28d9" }}>{alert.action}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SUNRISE / SUNSET */}
            <div className="bg-white rounded-2xl p-4 flex items-center gap-4" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div className="flex items-center gap-3">
                <Sunrise className="w-5 h-5 text-amber-400" />
                <div>
                  <p style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 500 }}>Sunrise</p>
                  <p className="text-gray-900 font-semibold">07:14</p>
                </div>
              </div>
              <div className="flex-1 hidden sm:block px-4">
                <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "#F1F3F5" }}>
                  <div className="absolute left-[30%] right-[27%] h-full rounded-full" style={{ background: "linear-gradient(90deg,#fbbf24,#fb923c)" }} />
                  <div className="absolute top-1/2 left-[44%] -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-yellow-400 border-2 border-white shadow" />
                </div>
                <div className="flex justify-between mt-1.5" style={{ fontSize: "0.65rem", color: "#cbd5e1" }}>
                  <span>Midnight</span><span>Now</span><span>Midnight</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 500 }}>Sunset</p>
                  <p className="text-gray-900 font-semibold">17:42</p>
                </div>
                <Sunset className="w-5 h-5 text-orange-400" />
              </div>
            </div>

            {/* ACTIONS FOR TODAY */}
            <div>
              <div className="flex items-center gap-3 px-1 mb-4">
                <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", color: "#94a3b8" }}>WHAT TO DO TODAY</p>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    dot: "bg-red-500", bg: "border-red-100", icon: <FlaskConical className="w-5 h-5 text-red-500" />, iconBg: "bg-red-50 border-red-100",
                    title: "Don't spray today",
                    body: "Wind is 15 mph — too strong. Any spray will drift and could harm neighbouring land or watercourses.",
                    footer: "✅ Saturday morning looks suitable",
                    footerBg: "bg-red-50",
                  },
                  {
                    dot: "bg-amber-400", bg: "border-amber-100", icon: <Snowflake className="w-5 h-5 text-amber-500" />, iconBg: "bg-amber-50 border-amber-100",
                    title: "Prepare for Thursday frost",
                    body: "Temperatures will drop to -1°C Thursday night. Cover any vulnerable crops — salad leaves, early brassicas — before Thursday evening.",
                    footer: "⏰ Act before Thursday 17:00",
                    footerBg: "bg-amber-50",
                  },
                  {
                    dot: "bg-sky-400", bg: "border-sky-100", icon: <Waves className="w-5 h-5 text-sky-500" />, iconBg: "bg-sky-50 border-sky-100",
                    title: "Check your field drains",
                    body: "Soil is already wet and 12 mm of rain is coming Thursday. Make sure drains and ditches are clear to avoid waterlogging.",
                    footer: "💧 Do this today if possible",
                    footerBg: "bg-sky-50",
                  },
                ].map((a, i) => (
                  <div key={i} className="bg-white rounded-2xl p-5 flex flex-col gap-3" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.iconBg}`} style={{ border: "none" }}>{a.icon}</div>
                    <div>
                      <p className="text-gray-900 font-semibold text-sm">{a.title}</p>
                      <p className="text-gray-500 text-sm mt-1.5 leading-relaxed">{a.body}</p>
                    </div>
                    <div className="rounded-xl px-3 py-2 mt-auto" style={{ background: "#F8FAFB" }}>
                      <p className="text-gray-600 text-xs font-semibold">{a.footer}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* FORECAST TAB */}
        {activeTab === "forecast" && (
          <div className="space-y-4">

            {/* Sub-tab toggle */}
            <div className="flex items-center gap-0.5 bg-white rounded-xl p-1 w-fit" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              {(["hourly", "daily", "weekly", "monthly"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setForecastView(v)}
                  className="capitalize px-4 py-2 rounded-lg text-sm transition-all duration-150"
                  style={{
                    fontWeight: forecastView === v ? 600 : 400,
                    background: forecastView === v ? "#16a34a" : "transparent",
                    color: forecastView === v ? "#fff" : "#94a3b8",
                    boxShadow: forecastView === v ? "0 2px 8px rgba(22,163,74,0.3)" : "none",
                  }}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* ── HOURLY ── */}
            {forecastView === "hourly" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", color: "#94a3b8" }}>HOURLY FORECAST — TODAY, 24 FEB</p>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                  <div className="overflow-x-auto">
                    <div className="flex px-3 py-3 gap-1" style={{ minWidth: "max-content" }}>
                      {hourlyForUi.map((h) => (
                        <div
                          key={h.time}
                          className={`flex flex-col items-center gap-2 px-3 py-3 rounded-2xl flex-shrink-0 relative ${
                            h.now ? "bg-green-50 border border-green-200" : "hover:bg-gray-50 border border-transparent"
                          }`}
                          style={{ minWidth: 72 }}
                        >
                          {h.now && (
                            <span className="absolute -top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-green-500 text-white font-semibold" style={{ fontSize: "0.6rem" }}>NOW</span>
                          )}
                          <p className={`text-xs font-medium mt-1 ${h.now ? "text-green-700" : "text-gray-400"}`}>{h.time}</p>
                          <span className="text-2xl">{h.emoji}</span>
                          <p className={`font-semibold text-sm ${h.now ? "text-green-800" : "text-gray-700"}`}>{h.temp}°</p>
                          <div className="w-full flex flex-col items-center gap-1">
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-blue-400" style={{ width: `${h.rain}%` }} />
                            </div>
                            <p className="text-blue-500 font-medium" style={{ fontSize: "0.65rem" }}>{h.rain}%</p>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <Wind className="w-3 h-3 text-gray-300" />
                            <p className="text-gray-400" style={{ fontSize: "0.65rem" }}>{h.wind}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="px-5 py-3 flex items-center gap-4 border-t border-gray-100">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded bg-blue-400" /><span className="text-gray-400" style={{ fontSize: "0.68rem" }}>Rain chance</span></div>
                    <div className="flex items-center gap-1.5"><Wind className="w-3 h-3 text-gray-300" /><span className="text-gray-400" style={{ fontSize: "0.68rem" }}>Wind (mph)</span></div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Peak temperature",  value: "7°C",    sub: "Around 12:00–14:00", vc: "#f97316" },
                    { label: "Highest rain risk",  value: "60%",    sub: "19:00 tonight",      vc: "#3b82f6" },
                    { label: "Peak wind",          value: "21 mph", sub: "17:00 this evening",  vc: "#d97706" },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl p-4 text-center" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                      <p style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 500, marginBottom: 4 }}>{s.label}</p>
                      <p style={{ fontSize: "1.55rem", fontWeight: 700, color: s.vc, lineHeight: 1.1 }}>{s.value}</p>
                      <p style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 4 }}>{s.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── DAILY ── */}
            {forecastView === "daily" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", color: "#94a3b8" }}>7-DAY FORECAST — {liveName.toUpperCase()}</p>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div className="overflow-x-auto pb-2 -mx-1 px-1">
                  <div className="flex gap-3" style={{ minWidth: "max-content" }}>
                    {forecastForUi.map((d) => {
                      const rainBar = Math.min((d.rainMm / 15) * 100, 100);
                      const isToday = d.day === "Today";
                      return (
                        <div key={d.day} className="rounded-2xl p-4 flex-shrink-0"
                          style={{ minWidth: 156, background: isToday ? "linear-gradient(145deg,#f0fdf4,#e8faf0)" : "white", border: isToday ? "1px solid #86efac" : "1px solid #E4E7EA", boxShadow: isToday ? "0 4px 20px rgba(34,197,94,0.15)" : "0 1px 4px rgba(0,0,0,0.05)" }}>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className={`font-semibold text-sm ${isToday ? "text-green-800" : "text-gray-700"}`}>{d.day}</p>
                              <p className="text-gray-400" style={{ fontSize: "0.68rem" }}>{d.date}</p>
                            </div>
                            {isToday && <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500 text-white font-medium">Now</span>}
                          </div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-3xl">{d.emoji}</span>
                            <p className="text-gray-500 text-xs leading-tight">{d.cond}</p>
                          </div>
                          <div className="flex items-end gap-1 mb-3">
                            <span className="font-semibold text-gray-700" style={{ fontSize: "1.5rem", lineHeight: 1 }}>{d.hi}°</span>
                            <span className="text-gray-400 text-sm mb-0.5">/ {d.lo}°</span>
                          </div>
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1">
                                <CloudRain className="w-3 h-3 text-blue-400" />
                                <span className="text-gray-400" style={{ fontSize: "0.68rem" }}>{d.rain}%</span>
                              </div>
                              <span className="text-blue-600 font-medium" style={{ fontSize: "0.68rem" }}>{d.rainMm}mm</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-blue-400" style={{ width: `${rainBar}%` }} />
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mb-3">
                            <Wind className="w-3 h-3 text-gray-400" />
                            <span className="text-gray-500" style={{ fontSize: "0.68rem" }}>{d.wind} mph</span>
                          </div>
                          {d.frost !== "None" && (
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg mb-2 ${frostColors[d.frost]}`}>
                              <Snowflake className="w-3 h-3" />
                              <span style={{ fontSize: "0.65rem" }} className="font-medium">Frost: {d.frost}</span>
                            </div>
                          )}
                          <p className="text-gray-400 leading-snug" style={{ fontSize: "0.63rem" }}>{d.note}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Rainfall (7 days)", value: "31 mm",  sub: "Above average",         vc: "#2563eb" },
                    { label: "Best Fieldwork Day",      value: "Sunday", sub: "1 Mar · Sunny · 11°C",  vc: "#059669" },
                    { label: "Frost Risk Days",         value: "3",      sub: "Thu, Fri, Sat nights",   vc: "#ea580c" },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl p-4 text-center" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                      <p style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 500, marginBottom: 4 }}>{s.label}</p>
                      <p style={{ fontSize: "1.55rem", fontWeight: 700, color: s.vc, lineHeight: 1.1 }}>{s.value}</p>
                      <p style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 4 }}>{s.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── WEEKLY ── */}
            {forecastView === "weekly" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", color: "#94a3b8" }}>4-WEEK OUTLOOK — YORK, YORKSHIRE</p>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div className="space-y-3">
                  {[
                    { week: "This week", dates: "24 Feb – 2 Mar", emoji: "🌧️", summary: "Wet and windy", hi: 11, lo: -1, rain: 31, wind: 22, frost: "Moderate", fieldwork: "Poor",    fieldColor: "bg-red-100 text-red-700 border-red-200",         note: "Heavy rain mid-week. Frost risk Thursday night. Best window Sunday." },
                    { week: "Week 2",    dates: "3 – 9 Mar",      emoji: "🌤️", summary: "Improving, drier", hi: 13, lo: 2, rain: 12, wind: 14, frost: "Low",  fieldwork: "Fair",    fieldColor: "bg-amber-100 text-amber-700 border-amber-200",   note: "Pressure building mid-week. Good opportunity for light cultivation." },
                    { week: "Week 3",    dates: "10 – 16 Mar",    emoji: "⛅",  summary: "Mixed spells",  hi: 12, lo: 3, rain: 18, wind: 16, frost: "Low",      fieldwork: "Fair",    fieldColor: "bg-amber-100 text-amber-700 border-amber-200",   note: "Unsettled at start, drier towards weekend. Monitor closely." },
                    { week: "Week 4",    dates: "17 – 23 Mar",    emoji: "☀️", summary: "Settled & warm", hi: 15, lo: 5, rain: 6,  wind: 10, frost: "None",    fieldwork: "Good",    fieldColor: "bg-emerald-100 text-emerald-700 border-emerald-200", note: "Good fieldwork window likely. Ideal for spraying and sowing." },
                  ].map((w, i) => (
                    <div key={i} className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                      <div className="flex items-start gap-4">
                        <div className="text-4xl flex-shrink-0 mt-1">{w.emoji}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 flex-wrap mb-2">
                            <div>
                              <p className="text-gray-900 font-semibold">{w.week}</p>
                              <p style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{w.dates}</p>
                            </div>
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${w.fieldColor}`}>
                              Fieldwork: {w.fieldwork}
                            </span>
                          </div>
                          <p className="text-gray-500 text-sm mb-3">{w.summary}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
                            {[
                              { bg: "#F8FAFB", label: "High / Low",    value: `${w.hi}° / ${w.lo}°`, labelColor: "#94a3b8", valueColor: "#1e293b" },
                              { bg: "#EFF6FF", label: "Est. Rainfall", value: `${w.rain} mm`,          labelColor: "#60a5fa", valueColor: "#1d4ed8" },
                              { bg: "#FFFBEB", label: "Peak Wind",     value: `${w.wind} mph`,          labelColor: "#fbbf24", valueColor: "#b45309" },
                              { bg: "#EEF2FF", label: "Frost Risk",    value: w.frost,                 labelColor: "#818cf8", valueColor: "#4338ca" },
                            ].map(cell => (
                              <div key={cell.label} className="rounded-xl px-3 py-2 text-center" style={{ background: cell.bg }}>
                                <p style={{ fontSize: "0.65rem", color: cell.labelColor, fontWeight: 500 }}>{cell.label}</p>
                                <p style={{ fontSize: "0.9rem", fontWeight: 700, color: cell.valueColor }}>{cell.value}</p>
                              </div>
                            ))}
                          </div>
                          <p style={{ fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.6 }}>💡 {w.note}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "#FFFBEB", border: "1px solid #fde68a" }}>
                  <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p style={{ fontSize: "0.78rem", color: "#92400e", lineHeight: 1.6 }}>Weekly and extended forecasts become less accurate beyond 5 days. Use these as general planning guidance only and check daily closer to the time.</p>
                </div>
              </div>
            )}

            {/* ── MONTHLY ── */}
            {forecastView === "monthly" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", color: "#94a3b8" }}>MONTHLY OVERVIEW — MARCH 2026</p>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Calendar grid */}
                <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                  <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #F1F3F5" }}>
                    <p className="text-gray-900 font-semibold">March 2026</p>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Indicative outlook only</span>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-7 mb-2">
                      {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
                        <div key={d} className="text-center text-gray-400 font-semibold" style={{ fontSize: "0.68rem" }}>{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {([
                        { blank: true }, { blank: true }, { blank: true }, { blank: true }, { blank: true }, { blank: true },
                        { day: 1,  emoji: "☀️",  hi: 11, type: "good" },
                        { day: 2,  emoji: "🌦️", hi: 9,  type: "caution" },
                        { day: 3,  emoji: "🌤️", hi: 10, type: "good" },
                        { day: 4,  emoji: "⛅",  hi: 11, type: "ok" },
                        { day: 5,  emoji: "🌥️", hi: 12, type: "ok" },
                        { day: 6,  emoji: "☁️",  hi: 11, type: "caution" },
                        { day: 7,  emoji: "🌧️", hi: 9,  type: "poor" },
                        { day: 8,  emoji: "🌧️", hi: 8,  type: "poor" },
                        { day: 9,  emoji: "🌦️", hi: 9,  type: "caution" },
                        { day: 10, emoji: "⛅",  hi: 11, type: "ok" },
                        { day: 11, emoji: "🌤️", hi: 12, type: "good" },
                        { day: 12, emoji: "☀️",  hi: 13, type: "good" },
                        { day: 13, emoji: "☀️",  hi: 14, type: "good" },
                        { day: 14, emoji: "🌤️", hi: 13, type: "good" },
                        { day: 15, emoji: "⛅",  hi: 12, type: "ok" },
                        { day: 16, emoji: "🌥️", hi: 11, type: "caution" },
                        { day: 17, emoji: "☁️",  hi: 10, type: "caution" },
                        { day: 18, emoji: "🌦️", hi: 11, type: "caution" },
                        { day: 19, emoji: "🌤️", hi: 13, type: "good" },
                        { day: 20, emoji: "☀️",  hi: 14, type: "good" },
                        { day: 21, emoji: "☀️",  hi: 15, type: "good" },
                        { day: 22, emoji: "☀️",  hi: 15, type: "good" },
                        { day: 23, emoji: "🌤️", hi: 14, type: "good" },
                        { day: 24, emoji: "⛅",  hi: 13, type: "ok" },
                        { day: 25, emoji: "🌥️", hi: 12, type: "caution" },
                        { day: 26, emoji: "🌦️", hi: 11, type: "caution" },
                        { day: 27, emoji: "🌧️", hi: 10, type: "poor" },
                        { day: 28, emoji: "🌦️", hi: 11, type: "caution" },
                        { day: 29, emoji: "🌤️", hi: 13, type: "good" },
                        { day: 30, emoji: "☀️",  hi: 14, type: "good" },
                        { day: 31, emoji: "☀️",  hi: 15, type: "good" },
                      ] as Array<{ blank: true } | { day: number; emoji: string; hi: number; type: string }>).map((cell, i) => {
                        if ("blank" in cell) return <div key={`b${i}`} />;
                        const TODAY_DAY = 1;
                        const isToday = cell.day === TODAY_DAY;
                        const bg: Record<string,string> = { good: "bg-emerald-50", ok: "bg-gray-50", caution: "bg-amber-50", poor: "bg-red-50" };
                        const tempColor: Record<string,string> = { good: "text-emerald-600", ok: "text-gray-600", caution: "text-amber-600", poor: "text-red-500" };
                        return (
                          <div
                            key={cell.day}
                            className={`rounded-xl p-1.5 flex flex-col items-center gap-0.5 relative ${isToday ? "" : bg[cell.type]}`}
                            style={{
                              border: isToday ? "2px solid #3b82f6" : "1px solid transparent",
                              boxShadow: isToday ? "0 0 0 3px rgba(59,130,246,0.15)" : "none",
                              background: isToday ? "#eff6ff" : undefined,
                            }}
                          >
                            {isToday && (
                              <span
                                className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-white rounded-full leading-none"
                                style={{ background: "#3b82f6", fontSize: "0.5rem", fontWeight: 700, paddingTop: "2px", paddingBottom: "2px", paddingLeft: "5px", paddingRight: "5px", letterSpacing: "0.04em", whiteSpace: "nowrap" }}
                              >
                                TODAY
                              </span>
                            )}
                            <p className="font-semibold" style={{ fontSize: "0.65rem", color: isToday ? "#1d4ed8" : "#6b7280" }}>
                              {cell.day}
                            </p>
                            <span style={{ fontSize: "1rem" }}>{cell.emoji}</span>
                            <p className={`font-semibold ${isToday ? "text-blue-700" : tempColor[cell.type]}`} style={{ fontSize: "0.65rem" }}>{cell.hi}°</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-4 pt-3" style={{ borderTop: "1px solid #F1F3F5" }}>
                      {[
                        { bg: "#d1fae5", border: "#6ee7b7", label: "Good fieldwork", thick: false },
                        { bg: "#f1f5f9", border: "#cbd5e1", label: "Acceptable",      thick: false },
                        { bg: "#fef3c7", border: "#fcd34d", label: "Caution",         thick: false },
                        { bg: "#fee2e2", border: "#fca5a5", label: "Poor",            thick: false },
                        { bg: "#eff6ff", border: "#3b82f6", label: "Today",           thick: true  },
                      ].map(l => (
                        <div key={l.label} className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded" style={{ background: l.bg, border: `${l.thick ? "2px" : "1px"} solid ${l.border}` }} />
                          <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Est. Monthly Rainfall", value: "62 mm", sub: "Avg: 48 mm",         vc: "#2563eb" },
                    { label: "Good Fieldwork Days",   value: "14",    sub: "of 31 days",          vc: "#059669" },
                    { label: "Frost Risk Nights",     value: "4",     sub: "Early March mainly",  vc: "#6366f1" },
                    { label: "Avg Max Temperature",   value: "12°C",  sub: "Across the month",    vc: "#f97316" },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl p-4 text-center" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                      <p style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 500, marginBottom: 4 }}>{s.label}</p>
                      <p style={{ fontSize: "1.5rem", fontWeight: 700, color: s.vc, lineHeight: 1.1 }}>{s.value}</p>
                      <p style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 4 }}>{s.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "#FFFBEB", border: "1px solid #fde68a" }}>
                  <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p style={{ fontSize: "0.78rem", color: "#92400e", lineHeight: 1.6 }}>Monthly data is an indicative outlook based on seasonal trends and medium-range modelling. Accuracy decreases significantly beyond 10 days. Always check the daily or hourly view closer to the time.</p>
                </div>
              </div>
            )}

          </div>
        )}

        {/* CHART TAB */}
        {activeTab === "chart" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", color: "#94a3b8" }}>7-DAY WEATHER TREND</p>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div className="flex items-center gap-2 mb-6">
                <ChartBar className="w-4 h-4 text-gray-400" />
                <p className="text-gray-800 font-semibold text-sm">Temperature & Rainfall Outlook</p>
              </div>
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartDataForUi} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="t" orientation="left" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}°`} domain={["dataMin - 3", "dataMax + 3"]} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}mm`} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 8px 24px rgba(0,0,0,0.1)", fontSize: 12 }} />
                    <Bar yAxisId="r" dataKey="rain" name="Rainfall (mm)" fill="url(#rainGrad)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Line yAxisId="t" type="monotone" dataKey="low" name="Min Temp (°C)" stroke="#2563eb" strokeWidth={2.5} strokeDasharray="5 3" dot={{ fill: "#2563eb", r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                    <Line yAxisId="t" type="monotone" dataKey="high" name="Max Temp (°C)" stroke="#f97316" strokeWidth={2.5} dot={{ fill: "#f97316", r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-5 mt-4 pt-4" style={{ borderTop: "1px solid #F1F3F5" }}>
                <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-orange-400 rounded" /><span style={{ fontSize: "0.75rem", color: "#64748b" }}>Max temp</span></div>
                <div className="flex items-center gap-2"><div className="w-6 border-t-2 border-dashed border-blue-500" /><span style={{ fontSize: "0.75rem", color: "#64748b" }}>Min temp</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded" style={{ background: "rgba(59,130,246,0.5)" }} /><span style={{ fontSize: "0.75rem", color: "#64748b" }}>Rainfall (mm)</span></div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E4E7EA", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <p className="text-gray-800 font-semibold text-sm mb-4">Soil Moisture Forecast (7-day outlook)</p>
              <div className="space-y-2">
                {[
                  { day: "Tue 24", pct: 76, status: "Wet",         color: "#3b82f6" },
                  { day: "Wed 25", pct: 82, status: "Wet",         color: "#3b82f6" },
                  { day: "Thu 26", pct: 91, status: "Waterlogged", color: "#7c3aed" },
                  { day: "Fri 27", pct: 88, status: "Wet",         color: "#3b82f6" },
                  { day: "Sat 28", pct: 81, status: "Wet",         color: "#3b82f6" },
                  { day: "Sun 1",  pct: 73, status: "Wet",         color: "#3b82f6" },
                  { day: "Mon 2",  pct: 75, status: "Wet",         color: "#3b82f6" },
                ].map(row => (
                  <div key={row.day} className="flex items-center gap-3">
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 500 }} className="w-12">{row.day}</span>
                    <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "#F1F3F5" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${row.pct}%`, backgroundColor: row.color, opacity: 0.75 }} />
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }} className="w-10 text-right">{row.pct}%</span>
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }} className="w-20">{row.status}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-4 pt-4" style={{ borderTop: "1px solid #F1F3F5" }}>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-400" /><span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Dry</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-400" /><span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Optimal</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-400" /><span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Wet</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-purple-600" /><span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Waterlogged</span></div>
              </div>
            </div>
          </div>
        )}

        <footer className="text-center py-6" style={{ borderTop: "1px solid #E4E7EA" }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" style={{ boxShadow: "0 0 6px rgba(74,222,128,0.7)" }} />
            <p style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 500 }}>Fieldcast · Agricultural Weather Intelligence</p>
          </div>
        </footer>
      </main>
    </div>
  );
}