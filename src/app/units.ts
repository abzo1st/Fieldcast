export const STORAGE_UNITS = "fieldcast:unitPrefs";

export type TempUnit = "c" | "f";
export type WindUnit = "mph" | "ms";
export type RainUnit = "mm" | "in";

export type UnitPrefs = {
  temp: TempUnit;
  wind: WindUnit;
  rain: RainUnit;
};

export const defaultUnitPrefs: UnitPrefs = {
  temp: "c",
  wind: "mph",
  rain: "mm",
};

export function loadUnitPrefs(): UnitPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_UNITS);
    if (!raw) return defaultUnitPrefs;
    const p = JSON.parse(raw) as Partial<UnitPrefs>;
    return {
      temp: p.temp === "f" ? "f" : "c",
      wind: p.wind === "ms" ? "ms" : "mph",
      rain: p.rain === "in" ? "in" : "mm",
    };
  } catch {
    return defaultUnitPrefs;
  }
}

export function saveUnitPrefs(p: UnitPrefs): void {
  localStorage.setItem(STORAGE_UNITS, JSON.stringify(p));
}

export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

export function msToMph(ms: number): number {
  return ms * 2.2369362920544;
}

export function mmToIn(mm: number): number {
  return mm / 25.4;
}

export function mphToMs(mph: number): number {
  return mph / 2.2369362920544;
}

/** Typical spray drift safety ceiling (display only; UK rules vary). */
export const SPRAY_SAFE_MPH = 10;

export function spraySafeLimitText(wind: WindUnit): string {
  if (wind === "ms") return `${Math.round(mphToMs(SPRAY_SAFE_MPH) * 10) / 10} m/s`;
  return `${SPRAY_SAFE_MPH} mph`;
}

export function formatWindFromMs(ms: number, wind: WindUnit): string {
  if (wind === "ms") return `${Math.round(ms * 10) / 10} m/s`;
  return `${Math.round(msToMph(ms))} mph`;
}

export function formatWindNumberFromMs(ms: number, wind: WindUnit): number {
  return wind === "ms" ? Math.round(ms * 10) / 10 : Math.round(msToMph(ms));
}

export function windUnitLabel(wind: WindUnit): string {
  return wind === "ms" ? "m/s" : "mph";
}

export function rainUnitLabel(rain: RainUnit): string {
  return rain === "in" ? "in" : "mm";
}

export function formatTempFromC(c: number, temp: TempUnit): string {
  if (temp === "f") return `${Math.round(cToF(c))}°F`;
  return `${Math.round(c)}°C`;
}

export function formatTempPartsFromC(c: number, temp: TempUnit): { value: string; unit: string } {
  if (temp === "f") return { value: String(Math.round(cToF(c))), unit: "°F" };
  return { value: String(Math.round(c)), unit: "°C" };
}

export function formatRainFromMm(mm: number | null | undefined, rain: RainUnit): string {
  if (mm == null || Number.isNaN(mm)) return "—";
  if (rain === "in") {
    const inches = mmToIn(mm);
    return `${Math.round(inches * 100) / 100} in`;
  }
  return `${Math.round(mm * 10) / 10} mm`;
}

export function convertTempChart(c: number, temp: TempUnit): number {
  return temp === "f" ? Math.round(cToF(c) * 10) / 10 : Math.round(c * 10) / 10;
}

export function convertRainChart(mm: number, rain: RainUnit): number {
  if (rain === "in") return Math.round(mmToIn(mm) * 100) / 100;
  return Math.round(mm * 10) / 10;
}
