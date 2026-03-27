import type { GeoDirectResult } from "./openweather";

/**
 * UK outward + inward (no space). GIR 0AA is handled separately.
 * Inward is always one digit + two letters.
 */
export function looksLikeUkPostcode(input: string): boolean {
  const raw = input.trim().toUpperCase();
  if (raw === "GIR 0AA" || raw.replace(/\s/g, "") === "GIR0AA") return true;
  const compact = raw.replace(/\s/g, "");
  if (compact.length < 5 || compact.length > 7) return false;
  if (!/[0-9][A-Z]{2}$/.test(compact)) return false;
  const inward = compact.slice(-3);
  if (!/^\d[A-Z]{2}$/.test(inward)) return false;
  const outward = compact.slice(0, -3);
  if (outward.length < 2 || outward.length > 4) return false;
  return /^[A-Z]{1,2}\d[A-Z\d]*$/i.test(outward);
}

type PostcodesIoResult = {
  postcode: string;
  latitude: number;
  longitude: number;
  admin_district?: string;
  admin_ward?: string;
  parish?: string;
};

type PostcodesIoResponse = { status: number; result: PostcodesIoResult | null };

/**
 * Resolves a UK postcode to coordinates via postcodes.io (OpenWeather geocoding does not
 * reliably support UK postcodes).
 */
export async function lookupUkPostcode(postcode: string): Promise<GeoDirectResult | null> {
  const compact = postcode.trim().replace(/\s+/g, "");
  const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}`;
  const res = await fetch(url);
  const text = await res.text().catch(() => "");
  if (!res.ok) return null;
  try {
    const j = JSON.parse(text) as PostcodesIoResponse;
    const r = j.result;
    if (!r) return null;
    const label = r.admin_district || r.parish || r.admin_ward || "United Kingdom";
    return {
      name: label,
      lat: r.latitude,
      lon: r.longitude,
      country: "GB",
      state: r.postcode,
    };
  } catch {
    return null;
  }
}
