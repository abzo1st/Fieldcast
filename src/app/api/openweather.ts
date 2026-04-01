// Geocoding and One Call fetch OpenWeather through a dev/preview proxy or explicit base so the browser avoids CORS on api.openweathermap.org.

export type OpenWeatherUnits = "metric" | "imperial";

/**
 * OpenWeather does not allow browser `fetch()` to api.openweathermap.org from your app origin (CORS).
 * Vite proxies `/__ow` → api.openweathermap.org in dev *and* `vite preview`.
 *
 * `import.meta.env.DEV` is false after `npm run build`, so we must detect localhost at runtime
 * or preview builds would call OpenWeather directly and fail in the browser.
 *
 * Override: set VITE_OPENWEATHER_API_BASE to your own proxy URL if deployed without Vite.
 */
function getOwBase(): string {
  const explicit = (import.meta.env.VITE_OPENWEATHER_API_BASE as string | undefined)?.trim();
  if (explicit) return explicit;
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") return "/__ow";
  }
  if (import.meta.env.DEV) return "/__ow";
  return "https://api.openweathermap.org";
}

// Key is supplied at build time; callers throw if it is missing so failures are explicit.
function getApiKey() {
  const key = import.meta.env.VITE_OPENWEATHER_API_KEY as string | undefined;
  return key?.trim() ? key.trim() : null;
}

function withParams(path: string, params: Record<string, string | number | boolean | undefined | null>) {
  // Relative paths (e.g. /__ow/...) need a base — single-arg new URL() throws "Failed to construct URL".
  const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const u = new URL(path, base);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    u.searchParams.set(k, String(v));
  }
  return u.toString();
}

// Reads the body as text once, then parses JSON; non-OK responses reuse OpenWeather’s `message` when present.
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    let detail = text || res.statusText;
    try {
      const j = JSON.parse(text) as { message?: string; cod?: string | number };
      if (j.message) detail = j.message;
    } catch {
      /* keep raw */
    }
    throw new Error(`OpenWeather (${res.status}): ${detail}`);
  }
  return JSON.parse(text) as T;
}

// Same shape as postcodes.io results after mapping, so search UIs can use one type.
export type GeoDirectResult = {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
};

// Resolves free-text place names to coordinates via OpenWeather’s Geocoding API.
export async function openWeatherGeocodeDirect(query: string, limit = 6): Promise<GeoDirectResult[]> {
  const key = getApiKey();
  if (!key) throw new Error("Missing VITE_OPENWEATHER_API_KEY");
  const url = withParams(`${getOwBase()}/geo/1.0/direct`, { q: query, limit, appid: key });
  return fetchJson<GeoDirectResult[]>(url);
}

// --- One Call 3.0 response slices (dashboard reads current, hourly, daily, alerts) ---

export type OneCallWeather = { id: number; main: string; description: string; icon: string };

export type OneCallAlert = {
  sender_name: string;
  event: string;
  start: number;
  end: number;
  description: string;
  tags?: string[];
};

export type OneCallCurrent = {
  dt: number;
  sunrise: number;
  sunset: number;
  temp: number;
  feels_like: number;
  pressure: number;
  humidity: number;
  dew_point: number;
  uvi: number;
  clouds: number;
  visibility: number;
  wind_speed: number;
  wind_deg: number;
  wind_gust?: number;
  weather: OneCallWeather[];
  rain?: { "1h"?: number };
  snow?: { "1h"?: number };
};

export type OneCallHourly = {
  dt: number;
  temp: number;
  pop: number;
  wind_speed: number;
  wind_gust?: number;
  humidity: number;
  weather: OneCallWeather[];
  rain?: { "1h"?: number };
  snow?: { "1h"?: number };
};

export type OneCallDailyTemp = { min: number; max: number };

export type OneCallDaily = {
  dt: number;
  sunrise: number;
  sunset: number;
  temp: OneCallDailyTemp;
  humidity: number;
  wind_speed: number;
  wind_gust?: number;
  pop: number;
  rain?: number;
  snow?: number;
  uvi: number;
  weather: OneCallWeather[];
};

export type OneCallResponse = {
  lat: number;
  lon: number;
  timezone: string;
  timezone_offset: number;
  current: OneCallCurrent;
  hourly: OneCallHourly[];
  daily: OneCallDaily[];
  alerts?: OneCallAlert[];
};

export async function openWeatherOneCall(params: {
  lat: number;
  lon: number;
  units?: OpenWeatherUnits;
  exclude?: string[];
}): Promise<OneCallResponse> {
  const key = getApiKey();
  if (!key) throw new Error("Missing VITE_OPENWEATHER_API_KEY");
  // `exclude` defaults to dropping minutely; extend or narrow per caller.
  const url = withParams(`${getOwBase()}/data/3.0/onecall`, {
    lat: params.lat,
    lon: params.lon,
    units: params.units ?? "metric",
    exclude: params.exclude?.join(",") ?? "minutely",
    appid: key,
  });
  return fetchJson<OneCallResponse>(url);
}

