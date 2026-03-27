import type { CSSProperties } from "react";

type Props = {
  /** Controls overall logo size (icon + wordmark). */
  size?: "sm" | "md";
  /** Optional className for outer container. */
  className?: string;
  /** Optional override for the small tagline line. */
  tagline?: string;
  /** If true, hides the tagline line. */
  hideTagline?: boolean;
};

const ICON_SIZES: Record<NonNullable<Props["size"]>, { box: number; glyph: number }> = {
  sm: { box: 32, glyph: 18 },
  md: { box: 36, glyph: 20 },
};

export function FieldcastLogo({
  size = "sm",
  className,
  tagline = "AGRICULTURAL INTELLIGENCE",
  hideTagline,
}: Props) {
  const { box, glyph } = ICON_SIZES[size];

  const iconStyle: CSSProperties = {
    width: box,
    height: box,
    borderRadius: 12,
    background:
      "radial-gradient(120% 120% at 20% 10%, rgba(74,222,128,0.55) 0%, rgba(34,197,94,0.22) 32%, rgba(13,31,20,0.0) 72%), linear-gradient(135deg, rgba(16,185,129,0.18), rgba(34,197,94,0.08))",
    border: "1px solid rgba(74,222,128,0.22)",
    boxShadow: "0 10px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
    display: "grid",
    placeItems: "center",
    position: "relative",
    overflow: "hidden",
  };

  const wordmarkStyle: CSSProperties = {
    fontSize: size === "sm" ? "0.98rem" : "1.05rem",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    lineHeight: 1,
    background: "linear-gradient(135deg, #ffffff 0%, rgba(167,243,208,0.92) 45%, rgba(74,222,128,0.95) 100%)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    textShadow: "0 8px 22px rgba(0,0,0,0.35)",
  };

  return (
    <div className={className} style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div aria-hidden="true" style={iconStyle}>
        {/* subtle grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.12,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "10px 10px",
            maskImage: "radial-gradient(80% 80% at 50% 40%, #000 0%, transparent 70%)",
          }}
        />

        {/* field + forecast arc glyph */}
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: "relative" }}
        >
          <path
            d="M3.2 16.2c2.6-2 5.8-3.2 8.8-3.2 3.1 0 6.2 1.2 8.8 3.2"
            stroke="rgba(74,222,128,0.95)"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M4.2 19.3c2.4-1.4 5.1-2.2 7.8-2.2 2.7 0 5.4.8 7.8 2.2"
            stroke="rgba(255,255,255,0.78)"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M6.2 11.4c1.9-1.4 3.9-2.3 5.8-2.6 2.3-.4 4.6.2 6.7 1.6"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M12 5.2c2.3 0 4.6.9 6.4 2.6"
            stroke="rgba(74,222,128,0.55)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={wordmarkStyle}>Fieldcast</span>
        {!hideTagline && (
          <span
            style={{
              marginTop: 2,
              fontSize: "0.55rem",
              letterSpacing: "0.14em",
              color: "rgba(134,239,172,0.42)",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {tagline}
          </span>
        )}
      </div>
    </div>
  );
}

