// A city or region search uses OpenWeather API, whereas a UK postcodes search uses postcodes.io.

import { openWeatherGeocodeDirect, type GeoDirectResult } from "./openweather";
import { looksLikeUkPostcode, lookupUkPostcode } from "./ukPostcode";

export async function searchLocations(query: string, limit = 6): Promise<GeoDirectResult[]> {
  const q = query.trim();
  if (!q) return [];
  if (looksLikeUkPostcode(q)) {
    const pc = await lookupUkPostcode(q);
    if (!pc) throw new Error("Postcode not found");
    return [pc];
  }
  return openWeatherGeocodeDirect(q, limit);
}
