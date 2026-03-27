import { useState } from "react";
import { useNavigate } from "react-router";
import { Leaf, MapPin, Search, Wind, CloudRain, Thermometer, Shield, ArrowRight } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

const BG = "https://images.unsplash.com/photo-1604590627104-655d2be93b23?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxVSyUyMGZhcm1sYW5kJTIwZGF3biUyMGFlcmlhbCUyMGdvbGRlbiUyMGhvdXJ8ZW58MXx8fHwxNzcxOTgzNDMwfDA&ixlib=rb-4.1.0&q=80&w=1080";

const SUGGESTIONS = [
  "York, Yorkshire",
  "Inverness, Scotland",
  "Hereford, Herefordshire",
  "Bury St Edmunds, Suffolk",
  "Exeter, Devon",
  "Carlisle, Cumbria",
];

const FEATURES = [
  { icon: <Wind className="w-4 h-4" />, label: "Spray drift risk" },
  { icon: <CloudRain className="w-4 h-4" />, label: "Rainfall accumulation" },
  { icon: <Thermometer className="w-4 h-4" />, label: "Frost risk alerts" },
  { icon: <Shield className="w-4 h-4" />, label: "Livestock warnings" },
];

export default function Landing() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const filtered = query.length > 0
    ? SUGGESTIONS.filter(s => s.toLowerCase().includes(query.toLowerCase()))
    : SUGGESTIONS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  const handleSuggestion = (s: string) => {
    setQuery(s);
    navigate("/dashboard");
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Background */}
      <div className="absolute inset-0">
        <ImageWithFallback
          src={BG}
          alt="British farmland at dawn"
          className="w-full h-full object-cover"
        />
        {/* Multi-stop gradient for editorial feel */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(170deg,rgba(7,17,10,0.90) 0%,rgba(9,22,13,0.78) 40%,rgba(11,26,16,0.88) 100%)" }}
        />
        {/* Subtle noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: "128px" }} />
      </div>

      {/* Top nav bar */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 pt-7 pb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.2)" }}
          >
            <Leaf className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <p className="text-white leading-none" style={{ fontSize: "0.95rem", fontWeight: 700, letterSpacing: "-0.01em" }}>
              FarmWeather <span className="text-green-400">UK</span>
            </p>
            <p style={{ fontSize: "0.55rem", letterSpacing: "0.12em", color: "rgba(134,239,172,0.45)", fontWeight: 600 }}>AGRICULTURAL INTELLIGENCE</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" style={{ boxShadow: "0 0 8px rgba(74,222,128,0.8)" }} />
          <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Live · Met Office data</span>
        </div>
      </nav>

      {/* Main content — centred vertically */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-16" style={{ minHeight: "calc(100vh - 72px)" }}>

        {/* Eyebrow tag */}
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full mb-8"
          style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.18)" }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span style={{ fontSize: "0.72rem", color: "rgba(134,239,172,0.85)", fontWeight: 600, letterSpacing: "0.06em" }}>
            TRUSTED BY 2,400+ UK FARMERS
          </span>
        </div>

        {/* Headline */}
        <h1
          className="text-white text-center mb-5 leading-none"
          style={{ fontSize: "clamp(2.2rem, 5.5vw, 4rem)", fontWeight: 800, letterSpacing: "-0.03em", maxWidth: "700px" }}
        >
          Weather built for<br />
          <span style={{ color: "#4ade80" }}>UK farmers.</span>
        </h1>

        <p
          className="text-center mb-10 max-w-sm leading-relaxed"
          style={{ fontSize: "1rem", color: "rgba(255,255,255,0.45)", fontWeight: 400 }}
        >
          Hyper-local forecasts, spray drift alerts, frost warnings, and field-ready recommendations — all in one glance.
        </p>

        {/* Search bar */}
        <div className="w-full max-w-lg relative">
          <form onSubmit={handleSubmit}>
            <div
              className="flex items-center rounded-2xl overflow-visible transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: focused ? "1.5px solid rgba(74,222,128,0.55)" : "1.5px solid rgba(255,255,255,0.12)",
                backdropFilter: "blur(24px)",
                boxShadow: focused
                  ? "0 0 0 4px rgba(74,222,128,0.08), 0 20px 60px rgba(0,0,0,0.4)"
                  : "0 20px 60px rgba(0,0,0,0.35)",
              }}
            >
              <MapPin className="w-4 h-4 text-green-400 ml-5 flex-shrink-0" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 150)}
                placeholder="Town, postcode or farm location…"
                className="flex-1 bg-transparent outline-none px-4 py-4"
                style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.9)", fontWeight: 400 }}
                autoComplete="off"
              />
              <button
                type="submit"
                className="m-2 flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95"
                style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", fontSize: "0.875rem", flexShrink: 0, boxShadow: "0 4px 12px rgba(22,163,74,0.4)" }}
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline" style={{ fontWeight: 600 }}>Search</span>
              </button>
            </div>
          </form>

          {/* Suggestions dropdown */}
          {focused && (
            <div
              className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50"
              style={{
                background: "rgba(10,22,14,0.97)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(24px)",
                boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
              }}
            >
              {filtered.length > 0 ? (
                <>
                  <p style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", fontWeight: 600 }} className="px-5 pt-4 pb-2">
                    {query ? "MATCHING LOCATIONS" : "POPULAR FARM REGIONS"}
                  </p>
                  {filtered.map(s => (
                    <button
                      key={s}
                      onMouseDown={() => handleSuggestion(s)}
                      className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors group"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="w-3.5 h-3.5 text-green-500/50 flex-shrink-0 group-hover:text-green-400 transition-colors" />
                        <span style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.65)", fontWeight: 400 }} className="group-hover:text-white transition-colors">{s}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-green-400 transition-colors" />
                    </button>
                  ))}
                </>
              ) : (
                <div className="px-5 py-5 flex items-center gap-3">
                  <Search className="w-4 h-4" style={{ color: "rgba(255,255,255,0.2)" }} />
                  <span style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.35)" }}>No locations found — press Enter to search</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick region picks */}
        <div className="flex flex-wrap justify-center gap-2 mt-5 max-w-lg">
          {["Yorkshire", "Lincolnshire", "Devon", "Perthshire", "Cheshire", "Norfolk"].map(region => (
            <button
              key={region}
              onClick={() => { setQuery(region); navigate("/dashboard"); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-150 hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.1)", fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", fontWeight: 500 }}
            >
              <MapPin className="w-2.5 h-2.5" />
              {region}
            </button>
          ))}
        </div>

        {/* Feature pills row */}
        <div className="flex flex-wrap justify-center gap-3 mt-12">
          {FEATURES.map(f => (
            <div
              key={f.label}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span style={{ color: "rgba(74,222,128,0.7)" }}>{f.icon}</span>
              <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{f.label}</span>
            </div>
          ))}
        </div>

      </div>

      {/* Footer strip */}
      <div className="relative z-10 flex items-center justify-center pb-6">
        <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.2)", fontWeight: 400, letterSpacing: "0.02em" }}>
          Met Office data · Updated every 30 min · Built for UK agriculture
        </p>
      </div>

    </div>
  );
}
