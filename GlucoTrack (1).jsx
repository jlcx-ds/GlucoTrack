import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Plus, ChevronDown, ChevronRight, Droplet, Syringe, LogOut, Check, X, AlertTriangle,
  Sparkles, Trash2, Copy, Mail, Gauge, PenTool, TrendingUp, Link as LinkIcon, Users,
  Loader2, RotateCcw,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Design tokens                                                       */
/* ------------------------------------------------------------------ */
const C = {
  bg: "#F5F8F8", surface: "#FFFFFF", ink: "#152025", muted: "#5C7278", faint: "#8CA0A5",
  accent: "#0F7173", accentDark: "#0A5254", accentSoft: "#E4F1F1",
  line: "#DCE6E7", lineSoft: "#EBF1F1",
  hyper: "#1E3A8A", hyperSoft: "#E8ECFA", hypo: "#C2281C", hypoSoft: "#FBE9E7",
  normal: "#166E3D", normalSoft: "#E5F4EC", warn: "#A9590C", warnSoft: "#FBEEDD",
  carb: "#B45309", carbSoft: "#FEF3E0", noncarb: "#0F766E", noncarbSoft: "#E1F4F1",
};
const MEAL_COLORS = {
  Breakfast: { fg: "#B45309", bg: "#FEF3E0" },
  Lunch: { fg: "#0F766E", bg: "#E1F4F1" },
  Dinner: { fg: "#4338CA", bg: "#EEF0FE" },
  Snack: { fg: C.muted, bg: C.lineSoft },
};

const FONTS = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
    .gt-display { font-family:'Space Grotesk', sans-serif; }
    .gt-body { font-family:'Inter', sans-serif; }
    .gt-mono { font-family:'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
    .gt-scroll::-webkit-scrollbar { height:8px; width:8px; }
    .gt-scroll::-webkit-scrollbar-thumb { background:${C.line}; border-radius:8px; }
    * { box-sizing: border-box; }
    input[type="datetime-local"]::-webkit-calendar-picker-indicator { opacity:0.6; }
    @keyframes gt-spin { to { transform: rotate(360deg); } }
    .gt-spin { animation: gt-spin 0.9s linear infinite; }
  `}</style>
);

/* ------------------------------------------------------------------ */
/* Storage keys & Standard LocalStorage Implementation                */
/* ------------------------------------------------------------------ */
const K_LOGS = "gt-logs-v2";
const K_SETTINGS = "gt-settings-v2";
const K_EMAILS = "gt-family-emails-v2";

function storageGet(key) {
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (err) {
    console.error("Storage read error:", err);
    return null;
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error("Storage write error:", err);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const uid = () => Math.random().toString(36).slice(2, 10);
const toMmol = (value, unit) => (unit === "mgdl" ? value / 18 : value);
const fromMmol = (mmol, unit) => (unit === "mgdl" ? Math.round(mmol * 18) : Math.round(mmol * 10) / 10);
const unitLabel = (unit) => (unit === "mgdl" ? "mg/dL" : "mmol/L");
const dayKey = (iso) => new Date(iso).toDateString();
const monthKeyOf = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const yearOf = (iso) => new Date(iso).getFullYear();
const monthLabelOf = (monthKey) => { const [y, m] = monthKey.split("-"); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: "long" }); };
function currentMonthKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function fmtDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function fmtDateOnly(iso) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}
function glucoseStatus(mmol, type, settings) {
  if (mmol < settings.hypoThreshold) return "hypo";
  const hyperThresh = type === "Fasting" ? settings.targetHigh : settings.postMealHigh;
  if (mmol > hyperThresh) return "hyper";
  return "normal";
}
function statusColors(status) {
  if (status === "hypo") return { fg: C.hypo, bg: C.hypoSoft };
  if (status === "hyper") return { fg: C.hyper, bg: C.hyperSoft };
  return { fg: C.normal, bg: C.normalSoft };
}
function suggestBasal(reading, tiers) {
  const sorted = [...tiers].sort((a, b) => a.low - b.low);
  const tier = sorted.find((t) => reading >= t.low && reading < t.high);
  if (tier) return { dose: tier.dose, note: null };
  if (reading < sorted[0].low) return { dose: Math.max(0, sorted[0].dose - 2), note: "Below your configured range — confirm with your care team." };
  const last = sorted[sorted.length - 1];
  const steps = Math.ceil(reading - last.high);
  return { dose: last.dose + steps * 2, note: "Above your configured range — confirm with your care team." };
}
function calcBolus(reading, settings, carbs) {
  const target = (settings.targetLow + settings.targetHigh) / 2;
  const correction = Math.max(0, reading - target) / settings.isf;
  const carbBolus = carbs > 0 ? carbs / settings.cir : 0;
  return { target, correction, carbBolus, total: correction + carbBolus };
}
const round1 = (n) => Math.round(n * 10) / 10;

/* Offline fallback classifier */
const CARB_WORDS = ["rice", "bread", "pasta", "noodle", "potato", "roti", "chapati", "naan", "banana", "apple",
  "mango", "cereal", "oats", "corn", "beans", "lentil", "quinoa", "tortilla", "cake", "cookie", "sugar", "juice",
  "soda", "fries", "chips", "pastry", "bun", "toast", "milk", "yogurt", "grapes"];
const NONCARB_WORDS = ["chicken", "beef", "fish", "salmon", "egg", "tofu", "broccoli", "spinach", "lettuce",
  "cheese", "butter", "oil", "avocado", "nuts", "almond", "cucumber", "kale", "shrimp", "steak", "bacon", "turkey"];

function offlineClassify(description) {
  const parts = description.split(/,|\band\b|\+/gi).map((p) => p.trim()).filter(Boolean);
  const list = parts.length ? parts : [description];
  return list.map((name) => {
    const lower = name.toLowerCase();
    const isCarb = CARB_WORDS.some((w) => lower.includes(w));
    const isNon = NONCARB_WORDS.some((w) => lower.includes(w));
    const classification = isCarb && !isNon ? "Carbohydrate" : isNon ? "Non-Carbohydrate" : "Carbohydrate";
    return { name, classification, carbs_g: classification === "Carbohydrate" ? 20 : 1 };
  });
}

async function classifyFoodWithAI(description) {
  const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY || "";
  
  const prompt = `You are a nutrition assistant inside a diabetes tracking app. Break the following meal description into its individual food components. For each component, classify it as "Carbohydrate" (meaningfully raises blood glucose) or "Non-Carbohydrate" (protein/fat/fibrous, negligible glucose impact), and estimate net carbohydrate grams for the portion described (assume one standard serving if no portion is given).

Meal: "${description}"

Respond with ONLY valid JSON in exactly this shape, no markdown fences, no commentary:
{"components":[{"name":"string","classification":"Carbohydrate","carbs_g":0}]}`;

  const headers = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true"
  };
  if (apiKey) headers["x-api-key"] = apiKey;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }]
    }),
  });

  if (!response.ok) throw new Error(`API returned status ${response.status}`);
  const data = await response.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  if (!textBlock) throw new Error("No text in response");

  const clean = textBlock.text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);
  if (!parsed.components || !Array.isArray(parsed.components)) throw new Error("Bad shape");

  return parsed.components.map((c) => ({
    name: c.name,
    classification: c.classification === "Non-Carbohydrate" ? "Non-Carbohydrate" : "Carbohydrate",
    carbs_g: Number(c.carbs_g) || 0
  }));
}

/* ------------------------------------------------------------------ */
/* Seed data / defaults                                                */
/* ------------------------------------------------------------------ */
function seedLogs() {
  const now = new Date();
  const at = (daysAgo, h, m) => { const d = new Date(now); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d.toISOString(); };
  return [
    { id: uid(), datetime: at(0, 7, 15), glucose: 5.4, readingType: "Fasting", mealType: null, food: "", components: [], netCarbs: 0, basalDose: 10, bolusGiven: null, notes: "Slept well, no snack last night." },
    { id: uid(), datetime: at(0, 12, 40), glucose: 8.6, readingType: "Post-Meal", mealType: "Lunch", food: "Grilled chicken with brown rice and broccoli",
      components: [{ name: "Grilled chicken", classification: "Non-Carbohydrate", carbs_g: 0 }, { name: "Brown rice", classification: "Carbohydrate", carbs_g: 38 }, { name: "Broccoli", classification: "Non-Carbohydrate", carbs_g: 2 }],
      netCarbs: 40, basalDose: null, bolusGiven: 2.5, notes: "" },
    { id: uid(), datetime: at(1, 7, 5), glucose: 3.6, readingType: "Fasting", mealType: null, food: "", components: [], netCarbs: 0, basalDose: 8, bolusGiven: null, notes: "Felt shaky, treated with juice before recheck." },
    { id: uid(), datetime: at(1, 19, 30), glucose: 11.2, readingType: "Post-Meal", mealType: "Dinner", food: "Two slices of pizza and a soda",
      components: [{ name: "Pizza crust", classification: "Carbohydrate", carbs_g: 55 }, { name: "Cheese topping", classification: "Non-Carbohydrate", carbs_g: 2 }, { name: "Soda", classification: "Carbohydrate", carbs_g: 39 }],
      netCarbs: 96, basalDose: null, bolusGiven: 6, notes: "Birthday dinner out." },
    { id: uid(), datetime: at(1, 8, 20), glucose: 6.9, readingType: "Post-Meal", mealType: "Breakfast", food: "Oatmeal with banana",
      components: [{ name: "Oatmeal", classification: "Carbohydrate", carbs_g: 27 }, { name: "Banana", classification: "Carbohydrate", carbs_g: 23 }],
      netCarbs: 50, basalDose: null, bolusGiven: 3, notes: "" },
    { id: uid(), datetime: at(2, 6, 50), glucose: 6.3, readingType: "Fasting", mealType: null, food: "", components: [], netCarbs: 0, basalDose: 12, bolusGiven: null, notes: "" },
    { id: uid(), datetime: at(2, 13, 10), glucose: 7.1, readingType: "Post-Meal", mealType: "Lunch", food: "Greek yogurt with berries and almonds",
      components: [{ name: "Greek yogurt", classification: "Non-Carbohydrate", carbs_g: 6 }, { name: "Berries", classification: "Carbohydrate", carbs_g: 15 }, { name: "Almonds", classification: "Non-Carbohydrate", carbs_g: 2 }],
      netCarbs: 21, basalDose: null, bolusGiven: 1.5, notes: "" },
  ];
}
function defaultSettings() {
  return {
    targetLow: 4, targetHigh: 7, postMealHigh: 10, hypoThreshold: 4,
    cir: 15, isf: 2.0,
    basalTiers: [
      { id: uid(), low: 4, high: 5, dose: 8 },
      { id: uid(), low: 5, high: 6, dose: 10 },
      { id: uid(), low: 6, high: 7, dose: 12 },
    ],
    penCapacity: 300,
    penBaselineRemaining: 300,
    penBaselineDate: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg shadow-lg gt-body text-sm flex items-center gap-2" style={{ background: C.ink, color: "#fff" }}>
      <Check size={15} />{toast}
    </div>
  );
}
function Chip({ children, fg, bg, mono }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${mono ? "gt-mono" : "gt-body"}`} style={{ color: fg, background: bg }}>{children}</span>;
}
function Field({ label, children, hint }) {
  return (
    <label className="block mb-3.5">
      <span className="block gt-body text-xs font-semibold mb-1.5" style={{ color: C.muted }}>{label}</span>
      {children}
      {hint && <span className="block gt-body text-[11px] mt-1" style={{ color: C.faint }}>{hint}</span>}
    </label>
  );
}
const inputStyle = { width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, fontSize: 14, outline: "none" };

/* ------------------------------------------------------------------ */
/* Login                                                                */
/* ------------------------------------------------------------------ */
function LoginScreen({ onSelectRole }) {
  return (
    <div className="min-h-screen flex items-center justify-center gt-body px-4" style={{ background: C.bg }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: C.accent }}><Droplet size={18} color="#fff" /></div>
          <span className="gt-display text-2xl font-semibold" style={{ color: C.ink }}>GlucoTrack</span>
        </div>
        <div className="rounded-2xl p-6" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <h1 className="gt-display text-lg font-semibold mb-1" style={{ color: C.ink }}>Sign in</h1>
          <p className="gt-body text-sm mb-6" style={{ color: C.muted }}>
            Choose how you're accessing this log. Roles are simulated for this demo — a production build would sit behind real account authentication. Log data is stored in your local browser storage.
          </p>
          <button onClick={() => onSelectRole("patient")} className="w-full mb-3 rounded-xl px-4 py-3 flex items-center gap-3 text-left transition-opacity hover:opacity-90" style={{ background: C.accent, color: "#fff" }}>
            <Syringe size={18} />
            <span><span className="block gt-body font-semibold text-sm">Continue as Patient</span><span className="block gt-body text-xs opacity-80">Full access — log entries, dosing, settings</span></span>
          </button>
          <button onClick={() => onSelectRole("family")} className="w-full rounded-xl px-4 py-3 flex items-center gap-3 text-left border transition-colors hover:bg-black/[0.02]" style={{ borderColor: C.line, color: C.ink }}>
            <Users size={18} color={C.accent} />
            <span><span className="block gt-body font-semibold text-sm">Continue as Family Viewer</span><span className="block gt-body text-xs" style={{ color: C.muted }}>Read-only — view logs and trends</span></span>
          </button>
        </div>
        <p className="gt-body text-[11px] text-center mt-5" style={{ color: C.faint }}>Dosing figures are calculated from parameters you enter. Not medical advice.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                               */
/* ------------------------------------------------------------------ */
function Header({ role, tab, setTab, unit, setUnit, onLogout }) {
  return (
    <header className="sticky top-0 z-30 gt-body" style={{ background: C.surface, borderBottom: `1px solid ${C.line}` }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: C.accent }}><Droplet size={14} color="#fff" /></div>
          <span className="gt-display text-base font-semibold hidden sm:inline" style={{ color: C.ink }}>GlucoTrack</span>
        </div>
        <nav className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: C.bg }}>
          <button onClick={() => setTab("dashboard")} className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors" style={tab === "dashboard" ? { background: C.surface, color: C.ink, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { color: C.muted }}>Dashboard</button>
          <button onClick={() => setTab("history")} className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors" style={tab === "history" ? { background: C.surface, color: C.ink, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { color: C.muted }}>History</button>
          {role === "patient" && <button onClick={() => setTab("settings")} className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors" style={tab === "settings" ? { background: C.surface, color: C.ink, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { color: C.muted }}>Settings</button>}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center rounded-lg overflow-hidden border" style={{ borderColor: C.line }}>
            <button onClick={() => setUnit("mmol")} className="px-2.5 py-1.5 text-xs gt-mono font-semibold" style={unit === "mmol" ? { background: C.accentSoft, color: C.accentDark } : { color: C.muted }}>mmol/L</button>
            <button onClick={() => setUnit("mgdl")} className="px-2.5 py-1.5 text-xs gt-mono font-semibold" style={unit === "mgdl" ? { background: C.accentSoft, color: C.accentDark } : { color: C.muted }}>mg/dL</button>
          </div>
          <Chip fg={role === "patient" ? C.accentDark : C.muted} bg={role === "patient" ? C.accentSoft : C.lineSoft}>{role === "patient" ? "Patient · Admin" : "Family · Read-only"}</Chip>
          <button onClick={onLogout} title="Switch role" className="p-2 rounded-lg hover:bg-black/[0.04]" style={{ color: C.muted }}><LogOut size={16} /></button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Summary bar with sparkline                                          */
/* ------------------------------------------------------------------ */
function Sparkline({ logs, settings }) {
  const points = [...logs].sort((a, b) => new Date(a.datetime) - new Date(b.datetime)).slice(-14);
  if (points.length < 2) return <div style={{ height: 40 }} />;
  const w = 260, h = 40, pad = 4;
  const vals = points.map((p) => p.glucose);
  const min = Math.min(...vals, settings.hypoThreshold);
  const max = Math.max(...vals, settings.postMealHigh);
  const x = (i) => pad + (i * (w - pad * 2)) / (points.length - 1);
  const y = (v) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.glucose).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={path} fill="none" stroke={C.accent} strokeWidth="1.75" />
      {points.map((p, i) => { const st = glucoseStatus(p.glucose, p.readingType, settings); const sc = statusColors(st); return <circle key={p.id} cx={x(i)} cy={y(p.glucose)} r={st === "normal" ? 2 : 3} fill={sc.fg} />; })}
    </svg>
  );
}
function SummaryBar({ logs, unit, settings, penRemaining }) {
  const latest = logs[0];
  const last7 = logs.filter((l) => Date.now() - new Date(l.datetime).getTime() < 7 * 86400000);
  const avg7 = last7.length ? last7.reduce((s, l) => s + l.glucose, 0) / last7.length : 0;
  const latestStatus = latest ? glucoseStatus(latest.glucose, latest.readingType, settings) : "normal";
  const sc = statusColors(latestStatus);
  const penPct = Math.max(0, Math.min(100, (penRemaining / settings.penCapacity) * 100));
  const penLow = penPct < 15;
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-1.5 mb-1.5"><Droplet size={13} color={C.muted} /><span className="gt-body text-xs font-medium" style={{ color: C.muted }}>Latest reading</span></div>
          {latest ? (<><div className="gt-mono text-2xl font-semibold" style={{ color: sc.fg }}>{fromMmol(latest.glucose, unit)}<span className="text-sm ml-1" style={{ color: C.faint }}>{unitLabel(unit)}</span></div><div className="gt-body text-xs mt-0.5" style={{ color: C.faint }}>{latest.readingType}{latest.mealType ? ` · ${latest.mealType}` : ""} · {fmtDateTime(latest.datetime)}</div></>) : <div className="gt-body text-sm" style={{ color: C.faint }}>No entries yet</div>}
        </div>
        <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-1.5 mb-1.5"><TrendingUp size={13} color={C.muted} /><span className="gt-body text-xs font-medium" style={{ color: C.muted }}>7-day average</span></div>
          <div className="gt-mono text-2xl font-semibold" style={{ color: C.ink }}>{last7.length ? fromMmol(avg7, unit) : "—"}<span className="text-sm ml-1" style={{ color: C.faint }}>{unitLabel(unit)}</span></div>
          <div className="mt-1"><Sparkline logs={logs} settings={settings} /></div>
        </div>
        <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-1.5 mb-1.5"><PenTool size={13} color={C.muted} /><span className="gt-body text-xs font-medium" style={{ color: C.muted }}>Basal pen level</span></div>
          <div className="gt-mono text-2xl font-semibold" style={{ color: penLow ? C.warn : C.ink }}>{Math.max(0, Math.round(penRemaining))}<span className="text-sm ml-1" style={{ color: C.faint }}>/ {settings.penCapacity} U</span></div>
          <div className="w-full h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: C.lineSoft }}><div className="h-full rounded-full" style={{ width: `${penPct}%`, background: penLow ? C.warn : C.accent }} /></div>
          {penLow && <div className="gt-body text-[11px] mt-1" style={{ color: C.warn }}>Running low — consider a refill</div>}
        </div>
        <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-1.5 mb-1.5"><Gauge size={13} color={C.muted} /><span className="gt-body text-xs font-medium" style={{ color: C.muted }}>Target fasting range</span></div>
          <div className="gt-mono text-2xl font-semibold" style={{ color: C.ink }}>{fromMmol(settings.targetLow, unit)}–{fromMmol(settings.targetHigh, unit)}</div>
          <div className="gt-body text-xs mt-0.5" style={{ color: C.faint }}>{unitLabel(unit)} · from Settings</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared detail body                                                  */
/* ------------------------------------------------------------------ */
function EntryDetailBody({ log, unit, settings }) {
  const isFasting = log.readingType === "Fasting";
  const basalSuggestion = isFasting ? suggestBasal(log.glucose, settings.basalTiers) : null;
  const bolus = !isFasting ? calcBolus(log.glucose, settings, log.netCarbs) : null;
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <div className="gt-body text-xs font-semibold mb-2" style={{ color: C.muted }}>MEAL BREAKDOWN</div>
        {log.components.length ? (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {log.components.map((c, i) => (
              <Chip key={i} fg={c.classification === "Carbohydrate" ? C.carb : C.noncarb} bg={c.classification === "Carbohydrate" ? C.carbSoft : C.noncarbSoft}>{c.name} · {c.carbs_g}g</Chip>
            ))}
          </div>
        ) : <div className="gt-body text-sm mb-3" style={{ color: C.faint }}>No food logged for this entry.</div>}
        {log.notes && (<><div className="gt-body text-xs font-semibold mb-1 mt-3" style={{ color: C.muted }}>NOTES</div><p className="gt-body text-sm" style={{ color: C.ink }}>{log.notes}</p></>)}
      </div>
      <div>
        {isFasting ? (
          <>
            <div className="gt-body text-xs font-semibold mb-2" style={{ color: C.muted }}>BASAL DOSE LOGIC</div>
            <div className="rounded-lg p-3 gt-mono text-sm" style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.ink }}>fasting {fromMmol(log.glucose, unit)} {unitLabel(unit)} → tier suggests <b>{basalSuggestion.dose} U</b></div>
            {basalSuggestion.note && <div className="flex items-start gap-1.5 mt-2 gt-body text-xs" style={{ color: C.warn }}><AlertTriangle size={13} className="mt-0.5 shrink-0" />{basalSuggestion.note}</div>}
            <div className="gt-body text-sm mt-2" style={{ color: C.muted }}>Logged dose: <span className="gt-mono font-semibold" style={{ color: C.ink }}>{log.basalDose ?? "—"} U</span></div>
          </>
        ) : (
          <>
            <div className="gt-body text-xs font-semibold mb-2" style={{ color: C.muted }}>SUGGESTED BOLUS</div>
            <div className="rounded-lg p-3 gt-mono text-[13px] leading-relaxed" style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.ink }}>
              ({fromMmol(log.glucose, unit)} − {fromMmol(bolus.target, unit)}) ÷ {settings.isf} &nbsp;+&nbsp; {log.netCarbs} ÷ {settings.cir}
              <br />= {round1(bolus.correction)} U correction + {round1(bolus.carbBolus)} U carb
              <br /><b>= {round1(bolus.total)} U suggested</b>
            </div>
            <div className="gt-body text-sm mt-2" style={{ color: C.muted }}>Bolus given: <span className="gt-mono font-semibold" style={{ color: C.ink }}>{log.bolusGiven ?? "—"} U</span></div>
          </>
        )}
      </div>
    </div>
  );
}
function RowExpanded({ log, unit, settings }) {
  return (
    <tr>
      <td colSpan={10} className="p-0">
        <div className="px-5 sm:px-8 py-5" style={{ background: C.bg, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
          <EntryDetailBody log={log} unit={unit} settings={settings} />
        </div>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Day view modal                                                       */
/* ------------------------------------------------------------------ */
function DayViewModal({ dateKeyValue, entries, unit, settings, onClose }) {
  if (!dateKeyValue) return null;
  const sorted = [...entries].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  const avg = sorted.length ? sorted.reduce((s, l) => s + l.glucose, 0) / sorted.length : 0;
  const totalCarbs = sorted.reduce((s, l) => s + (l.netCarbs || 0), 0);
  const totalBasal = sorted.reduce((s, l) => s + (l.basalDose || 0), 0);
  return (
    <div className="fixed inset-0 z-40 flex items-stretch sm:items-center justify-center sm:p-4" style={{ background: "rgba(21,32,37,0.4)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="gt-body w-full sm:max-w-2xl sm:rounded-2xl overflow-y-auto gt-scroll" style={{ background: C.surface, maxHeight: "100vh", height: "100%" }}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-4" style={{ background: C.surface, borderBottom: `1px solid ${C.line}` }}>
          <div>
            <div className="gt-display text-base font-semibold" style={{ color: C.ink }}>{sorted.length ? fmtDateOnly(sorted[0].datetime) : dateKeyValue}</div>
            <div className="text-xs gt-body mt-0.5" style={{ color: C.muted }}>
              {sorted.length} entr{sorted.length === 1 ? "y" : "ies"} · avg <span className="gt-mono">{fromMmol(avg, unit)} {unitLabel(unit)}</span> · <span className="gt-mono">{totalCarbs}g</span> carbs · <span className="gt-mono">{totalBasal}U</span> basal
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/[0.05]"><X size={18} color={C.muted} /></button>
        </div>
        <div className="p-5 space-y-3">
          {sorted.map((log) => {
            const status = glucoseStatus(log.glucose, log.readingType, settings);
            const sc = statusColors(status);
            const mc = log.mealType ? MEAL_COLORS[log.mealType] : null;
            return (
              <div key={log.id} className="rounded-xl p-4" style={{ border: `1px solid ${C.line}` }}>
                <div className="flex items-center flex-wrap gap-2 mb-3">
                  <span className="gt-mono text-xs font-semibold" style={{ color: C.faint }}>{fmtTime(log.datetime)}</span>
                  <Chip fg={log.readingType === "Fasting" ? C.accentDark : C.muted} bg={log.readingType === "Fasting" ? C.accentSoft : C.lineSoft}>{log.readingType}</Chip>
                  {mc && <Chip fg={mc.fg} bg={mc.bg}>{log.mealType}</Chip>}
                  <span className="gt-mono font-semibold px-2 py-0.5 rounded-md text-sm ml-auto" style={{ color: sc.fg, background: sc.bg }}>{fromMmol(log.glucose, unit)} {unitLabel(unit)}</span>
                </div>
                {log.food && <div className="gt-body text-sm mb-3" style={{ color: C.ink }}>{log.food}</div>}
                <EntryDetailBody log={log} unit={unit} settings={settings} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Data grid                                                           */
/* ------------------------------------------------------------------ */
function DataGrid({ logs, unit, settings, expandedId, setExpandedId, role, onDelete, onOpenDay }) {
  if (!logs.length) {
    return (
      <div className="text-center py-16 gt-body" style={{ color: C.faint }}>
        <Droplet size={28} className="mx-auto mb-3" />
        <p className="text-sm">No entries yet. Add your first reading to start the log.</p>
      </div>
    );
  }
  const cols = ["", "Date & Time", "Glucose", "Type", "Meal", "Food / Meal", "Classification", "Net Carbs (g)", "Basal (U)", "Notes"];
  return (
    <div className="overflow-x-auto gt-scroll rounded-xl" style={{ border: `1px solid ${C.line}` }}>
      <table className="w-full gt-body text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: C.bg }}>
            {cols.map((c, i) => <th key={i} className="text-left px-4 py-2.5 font-semibold text-xs whitespace-nowrap" style={{ color: C.muted, borderBottom: `1px solid ${C.line}` }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const status = glucoseStatus(log.glucose, log.readingType, settings);
            const sc = statusColors(status);
            const open = expandedId === log.id;
            const carbCount = log.components.filter((c) => c.classification === "Carbohydrate").length;
            const nonCount = log.components.length - carbCount;
            const mc = log.mealType ? MEAL_COLORS[log.mealType] : null;
            return (
              <React.Fragment key={log.id}>
                <tr onClick={() => setExpandedId(open ? null : log.id)} className="cursor-pointer transition-colors hover:bg-black/[0.015]"
                  style={{ borderBottom: open ? "none" : `1px solid ${C.lineSoft}`, background: open ? C.accentSoft + "40" : "transparent" }}>
                  <td className="pl-3 pr-1 py-3" style={{ color: C.faint }}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
                  <td className="px-3 py-3 whitespace-nowrap underline decoration-dotted underline-offset-4"
                    style={{ color: C.ink }}
                    title="View the full day"
                    onClick={(e) => { e.stopPropagation(); onOpenDay(dayKey(log.datetime)); }}>
                    {fmtDateTime(log.datetime)}
                  </td>
                  <td className="px-3 py-3"><span className="gt-mono font-semibold px-2 py-0.5 rounded-md" style={{ color: sc.fg, background: sc.bg }}>{fromMmol(log.glucose, unit)}</span></td>
                  <td className="px-3 py-3 whitespace-nowrap"><Chip fg={log.readingType === "Fasting" ? C.accentDark : C.muted} bg={log.readingType === "Fasting" ? C.accentSoft : C.lineSoft}>{log.readingType}</Chip></td>
                  <td className="px-3 py-3 whitespace-nowrap"
                    onClick={(e) => { if (mc) { e.stopPropagation(); onOpenDay(dayKey(log.datetime)); } }}>
                    {mc ? <Chip fg={mc.fg} bg={mc.bg}>{log.mealType}</Chip> : <span style={{ color: C.faint }}>—</span>}
                  </td>
                  <td className="px-3 py-3 max-w-[220px] truncate" style={{ color: C.ink }}>{log.food || "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {log.components.length ? (
                      <span className="gt-body text-xs" style={{ color: C.muted }}>
                        {carbCount ? <span style={{ color: C.carb }}>{carbCount} carb</span> : null}{carbCount && nonCount ? " · " : ""}{nonCount ? <span style={{ color: C.noncarb }}>{nonCount} non-carb</span> : null}
                      </span>
                    ) : <span style={{ color: C.faint }}>—</span>}
                  </td>
                  <td className="px-3 py-3 gt-mono" style={{ color: C.ink }}>{log.netCarbs || "—"}</td>
                  <td className="px-3 py-3 gt-mono" style={{ color: C.ink }}>{log.basalDose ?? "—"}</td>
                  <td className="px-3 py-3 max-w-[160px] truncate" style={{ color: C.muted }}>{log.notes || "—"}</td>
                </tr>
                {open && (
                  <>
                    <RowExpanded log={log} unit={unit} settings={settings} />
                    {role === "patient" && (
                      <tr>
                        <td colSpan={10} className="px-8 pb-3 pt-1" style={{ background: C.bg, borderBottom: `1px solid ${C.line}` }}>
                          <button onClick={(e) => { e.stopPropagation(); onDelete(log.id); }} className="inline-flex items-center gap-1.5 text-xs gt-body font-medium px-2.5 py-1.5 rounded-md hover:bg-black/[0.04]" style={{ color: C.hypo }}>
                            <Trash2 size={13} /> Delete entry
                          </button>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quick add panel                                                     */
/* ------------------------------------------------------------------ */
function QuickAddPanel({ open, onClose, onSave, settings, unit }) {
  const [datetime, setDatetime] = useState(() => new Date().toISOString().slice(0, 16));
  const [glucoseInput, setGlucoseInput] = useState("");
  const [readingType, setReadingType] = useState("Fasting");
  const [mealType, setMealType] = useState("Breakfast");
  const [food, setFood] = useState("");
  const [components, setComponents] = useState([]);
  const [netCarbsOverride, setNetCarbsOverride] = useState(null);
  const [classifying, setClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState("");
  const [basalDose, setBasalDose] = useState("");
  const [bolusGiven, setBolusGiven] = useState("");
  const [notes, setNotes] = useState("");

  if (!open) return null;

  const glucoseMmol = glucoseInput ? toMmol(parseFloat(glucoseInput), unit) : null;
  const netCarbs = netCarbsOverride !== null ? netCarbsOverride : components.reduce((s, c) => s + (c.classification === "Carbohydrate" ? Number(c.carbs_g) || 0 : 0), 0);
  const basalSuggestion = readingType === "Fasting" && glucoseMmol != null ? suggestBasal(glucoseMmol, settings.basalTiers) : null;
  const bolusPreview = readingType === "Post-Meal" && glucoseMmol != null ? calcBolus(glucoseMmol, settings, netCarbs) : null;

  async function handleClassify() {
    if (!food.trim()) return;
    setClassifying(true); setClassifyError("");
    try {
      const comps = await classifyFoodWithAI(food);
      setComponents(comps); setNetCarbsOverride(null);
    } catch (e) {
      setComponents(offlineClassify(food)); setNetCarbsOverride(null);
      setClassifyError("AI API call failed or is missing key — loaded offline estimate instead.");
    } finally { setClassifying(false); }
  }
  function updateComponent(i, key, val) { setComponents((cs) => cs.map((c, idx) => idx === i ? { ...c, [key]: val } : c)); }
  function removeComponent(i) { setComponents((cs) => cs.filter((_, idx) => idx !== i)); }
  function addComponent() { setComponents((cs) => [...cs, { name: "", classification: "Carbohydrate", carbs_g: 0 }]); }

  function handleSave() {
    if (!glucoseMmol) return;
    onSave({
      id: uid(), datetime: new Date(datetime).toISOString(), glucose: glucoseMmol, readingType,
      mealType: readingType === "Post-Meal" ? mealType : null,
      food: food.trim(), components, netCarbs,
      basalDose: basalDose !== "" ? parseFloat(basalDose) : (readingType === "Fasting" && basalSuggestion ? basalSuggestion.dose : null),
      bolusGiven: bolusGiven !== "" ? parseFloat(bolusGiven) : null,
      notes: notes.trim(),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-stretch sm:items-center justify-center sm:p-4" style={{ background: "rgba(21,32,37,0.35)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="gt-body w-full sm:max-w-lg sm:rounded-2xl overflow-y-auto gt-scroll" style={{ background: C.surface, maxHeight: "100vh", height: "100%" }}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-4" style={{ background: C.surface, borderBottom: `1px solid ${C.line}` }}>
          <h2 className="gt-display text-base font-semibold" style={{ color: C.ink }}>New log entry</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/[0.05]"><X size={18} color={C.muted} /></button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date & time"><input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} style={inputStyle} /></Field>
            <Field label={`Glucose reading (${unitLabel(unit)})`}><input type="number" step="0.1" value={glucoseInput} onChange={(e) => setGlucoseInput(e.target.value)} placeholder={unit === "mmol" ? "e.g. 6.4" : "e.g. 115"} style={inputStyle} /></Field>
          </div>

          <Field label="Reading type">
            <div className="flex gap-2">
              {["Fasting", "Post-Meal"].map((t) => (
                <button key={t} type="button" onClick={() => setReadingType(t)} className="flex-1 py-2 rounded-lg text-sm font-medium border"
                  style={readingType === t ? { background: C.accentSoft, borderColor: C.accent, color: C.accentDark } : { borderColor: C.line, color: C.muted }}>{t}</button>
              ))}
            </div>
          </Field>

          {readingType === "Post-Meal" && (
            <Field label="Meal">
              <div className="flex gap-2 flex-wrap">
                {["Breakfast", "Lunch", "Dinner", "Snack"].map((m) => {
                  const mc = MEAL_COLORS[m];
                  const active = mealType === m;
                  return (
                    <button key={m} type="button" onClick={() => setMealType(m)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                      style={active ? { background: mc.bg, borderColor: mc.fg, color: mc.fg } : { borderColor: C.line, color: C.muted }}>{m}</button>
                  );
                })}
              </div>
            </Field>
          )}

          <Field label="Food / meal description" hint="Describe what was eaten — AI will split it into components.">
            <textarea value={food} onChange={(e) => setFood(e.target.value)} rows={2} placeholder="e.g. Grilled chicken with brown rice and broccoli" style={{ ...inputStyle, resize: "vertical" }} />
          </Field>

          <button type="button" onClick={handleClassify} disabled={!food.trim() || classifying}
            className="w-full mb-3 rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ background: C.accent, color: "#fff" }}>
            {classifying ? <Loader2 size={14} className="gt-spin" /> : <Sparkles size={14} />} {classifying ? "Classifying…" : "Classify with AI"}
          </button>

          {classifyError && <div className="flex items-start gap-1.5 mb-3 text-xs" style={{ color: C.warn }}><AlertTriangle size={13} className="mt-0.5 shrink-0" />{classifyError}</div>}

          {components.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {components.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input value={c.name} onChange={(e) => updateComponent(i, "name", e.target.value)} placeholder="Component" style={{ ...inputStyle, flex: 1, padding: "6px 9px" }} />
                  <button type="button" onClick={() => updateComponent(i, "classification", c.classification === "Carbohydrate" ? "Non-Carbohydrate" : "Carbohydrate")}
                    className="px-2 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap"
                    style={{ color: c.classification === "Carbohydrate" ? C.carb : C.noncarb, background: c.classification === "Carbohydrate" ? C.carbSoft : C.noncarbSoft }}>
                    {c.classification === "Carbohydrate" ? "Carb" : "Non-carb"}
                  </button>
                  <input type="number" value={c.carbs_g} onChange={(e) => updateComponent(i, "carbs_g", e.target.value)} style={{ ...inputStyle, width: 60, padding: "6px 8px" }} />
                  <span className="text-xs" style={{ color: C.faint }}>g</span>
                  <button type="button" onClick={() => removeComponent(i)} className="p-1 rounded hover:bg-black/[0.05]"><X size={13} color={C.faint} /></button>
                </div>
              ))}
              <button type="button" onClick={addComponent} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md hover:bg-black/[0.03]" style={{ color: C.accentDark }}>
                <Plus size={12} /> Add component
              </button>
            </div>
          )}

          <Field label="Calculated net carbs (g)" hint="Auto-summed from Carbohydrate components — override if needed.">
            <input type="number" value={netCarbs} onChange={(e) => setNetCarbsOverride(parseFloat(e.target.value) || 0)} style={inputStyle} />
          </Field>

          {readingType === "Fasting" ? (
            <Field label="Basal insulin dose (U)" hint={basalSuggestion ? `Suggested from your tiers: ${basalSuggestion.dose} U${basalSuggestion.note ? " (out of configured range)" : ""}` : "Enter a glucose reading to see a suggestion."}>
              <input type="number" step="0.5" value={basalDose} onChange={(e) => setBasalDose(e.target.value)} placeholder={basalSuggestion ? String(basalSuggestion.dose) : ""} style={inputStyle} />
            </Field>
          ) : (
            <Field label="Bolus given (U)" hint={bolusPreview ? `Suggested: ${round1(bolusPreview.total)} U (${round1(bolusPreview.correction)} correction + ${round1(bolusPreview.carbBolus)} carb)` : "Enter a glucose reading to see a suggestion."}>
              <input type="number" step="0.5" value={bolusGiven} onChange={(e) => setBolusGiven(e.target.value)} placeholder={bolusPreview ? String(round1(bolusPreview.total)) : ""} style={inputStyle} />
            </Field>
          )}

          <Field label="Notes"><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" style={inputStyle} /></Field>

          <div className="flex items-start gap-1.5 mb-4 text-xs" style={{ color: C.faint }}>
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            Suggested doses come from the formula and tiers in Settings — not medical advice. Confirm changes with your care team.
          </div>

          <button onClick={handleSave} disabled={!glucoseInput} className="w-full rounded-lg py-2.5 text-sm font-semibold disabled:opacity-40" style={{ background: C.ink, color: "#fff" }}>Save entry</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toolbar                                                             */
/* ------------------------------------------------------------------ */
function Toolbar({ role, onAdd, onExport, monthLabel }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-1 flex items-center justify-between gap-2">
      <div>
        <h2 className="gt-display text-sm font-semibold tracking-wide" style={{ color: C.muted }}>{monthLabel.toUpperCase()} — NEWEST FIRST</h2>
        <p className="gt-body text-[11px] mt-0.5" style={{ color: C.faint }}>This table renews each month — past months move to History automatically.</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onExport} className="inline-flex items-center gap-1.5 text-xs font-medium gt-body px-3 py-1.5 rounded-lg border hover:bg-black/[0.02]" style={{ borderColor: C.line, color: C.ink }}>Export CSV</button>
        {role === "patient" && <button onClick={onAdd} className="inline-flex items-center gap-1.5 text-xs font-semibold gt-body px-3 py-1.5 rounded-lg" style={{ background: C.accent, color: "#fff" }}><Plus size={14} /> Add entry</button>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings page                                                       */
/* ------------------------------------------------------------------ */
function SettingsPage({ settings, setSettings, logs, familyEmails, setFamilyEmails, showToast, onResetData, penRemaining, penUsedSinceBaseline }) {
  const [newEmail, setNewEmail] = useState("");
  const [inviteLink] = useState(`https://glucotrack.app/share/${uid()}`);
  const [adjustValue, setAdjustValue] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  function update(key, val) { setSettings((s) => ({ ...s, [key]: val })); }
  function updateTier(id, key, val) { setSettings((s) => ({ ...s, basalTiers: s.basalTiers.map((t) => t.id === id ? { ...t, [key]: parseFloat(val) || 0 } : t) })); }
  function addTier() { setSettings((s) => { const last = s.basalTiers[s.basalTiers.length - 1]; return { ...s, basalTiers: [...s.basalTiers, { id: uid(), low: last.high, high: last.high + 1, dose: last.dose + 2 }] }; }); }
  function removeTier(id) { setSettings((s) => ({ ...s, basalTiers: s.basalTiers.filter((t) => t.id !== id) })); }
  function addEmail() { if (!newEmail.trim() || !newEmail.includes("@")) return; setFamilyEmails((e) => [...e, newEmail.trim()]); setNewEmail(""); showToast(`Invite sent to ${newEmail.trim()} (simulated)`); }
  function copyLink() { navigator.clipboard?.writeText(inviteLink).catch(() => {}); showToast("Invite link copied to clipboard"); }
  function applyAdjust() {
    const val = parseFloat(adjustValue);
    if (isNaN(val) || val < 0) return;
    setSettings((s) => ({ ...s, penBaselineRemaining: val, penBaselineDate: new Date().toISOString() }));
    setAdjustValue("");
    showToast(`Pen level set to ${val} U — future doses will subtract automatically`);
  }
  function startNewPen() {
    setSettings((s) => ({ ...s, penBaselineRemaining: s.penCapacity, penBaselineDate: new Date().toISOString() }));
    showToast("New pen started — counter reset to full");
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 gt-body">
      <h1 className="gt-display text-xl font-semibold mb-1" style={{ color: C.ink }}>Settings</h1>
      <p className="text-sm mb-8" style={{ color: C.muted }}>Configure the numbers behind your dosing calculations and manage family access.</p>

      <section className="rounded-xl p-5 mb-5" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
        <h3 className="gt-display text-sm font-semibold mb-4" style={{ color: C.ink }}>Medical parameters</h3>
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="Target fasting glucose — low (mmol/L)"><input type="number" step="0.1" value={settings.targetLow} onChange={(e) => update("targetLow", parseFloat(e.target.value))} style={inputStyle} /></Field>
          <Field label="Target fasting glucose — high (mmol/L)"><input type="number" step="0.1" value={settings.targetHigh} onChange={(e) => update("targetHigh", parseFloat(e.target.value))} style={inputStyle} /></Field>
          <Field label="Hypoglycemia threshold (mmol/L)" hint="Readings below this are flagged red."><input type="number" step="0.1" value={settings.hypoThreshold} onChange={(e) => update("hypoThreshold", parseFloat(e.target.value))} style={inputStyle} /></Field>
          <Field label="Post-meal high threshold (mmol/L)" hint="Readings above this are flagged dark blue."><input type="number" step="0.1" value={settings.postMealHigh} onChange={(e) => update("postMealHigh", parseFloat(e.target.value))} style={inputStyle} /></Field>
          <Field label="Carb-to-insulin ratio (g per unit)"><input type="number" step="1" value={settings.cir} onChange={(e) => update("cir", parseFloat(e.target.value))} style={inputStyle} /></Field>
          <Field label="Insulin sensitivity factor (mmol/L per unit)" hint="Used for the correction bolus."><input type="number" step="0.1" value={settings.isf} onChange={(e) => update("isf", parseFloat(e.target.value))} style={inputStyle} /></Field>
        </div>
        <div className="rounded-lg p-3 gt-mono text-xs mt-1" style={{ background: C.bg, color: C.muted }}>Total suggested bolus = (reading − target) ÷ ISF &nbsp;+&nbsp; total carbs ÷ CIR</div>
      </section>

      <section className="rounded-xl p-5 mb-5" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
        <h3 className="gt-display text-sm font-semibold mb-1" style={{ color: C.ink }}>Basal dosing tiers</h3>
        <p className="text-xs mb-4" style={{ color: C.muted }}>Suggests that night's basal dose from the morning fasting reading.</p>
        <div className="space-y-2">
          {settings.basalTiers.map((t) => (
            <div key={t.id} className="flex items-center gap-2 flex-wrap">
              <span className="text-xs" style={{ color: C.muted }}>If fasting is</span>
              <input type="number" step="0.1" value={t.low} onChange={(e) => updateTier(t.id, "low", e.target.value)} style={{ ...inputStyle, width: 72 }} />
              <span className="text-xs" style={{ color: C.muted }}>to</span>
              <input type="number" step="0.1" value={t.high} onChange={(e) => updateTier(t.id, "high", e.target.value)} style={{ ...inputStyle, width: 72 }} />
              <span className="text-xs" style={{ color: C.muted }}>mmol/L → give</span>
              <input type="number" step="0.5" value={t.dose} onChange={(e) => updateTier(t.id, "dose", e.target.value)} style={{ ...inputStyle, width: 72 }} />
              <span className="text-xs" style={{ color: C.muted }}>U</span>
              <button onClick={() => removeTier(t.id)} className="ml-auto p-1.5 rounded-md hover:bg-black/[0.04]"><Trash2 size={14} color={C.hypo} /></button>
            </div>
          ))}
        </div>
        <button onClick={addTier} className="mt-3 inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md border hover:bg-black/[0.02]" style={{ borderColor: C.line, color: C.accentDark }}><Plus size={13} /> Add tier</button>
      </section>

      <section className="rounded-xl p-5 mb-5" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
        <h3 className="gt-display text-sm font-semibold mb-4" style={{ color: C.ink }}>Insulin pen tracker</h3>
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="Pen capacity (units)"><input type="number" value={settings.penCapacity} onChange={(e) => update("penCapacity", parseFloat(e.target.value) || 0)} style={inputStyle} /></Field>
          <div>
            <span className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>Remaining right now</span>
            <div className="gt-mono text-lg font-semibold" style={{ color: C.ink }}>{Math.max(0, Math.round(penRemaining))} U <span className="text-sm font-normal" style={{ color: C.faint }}>of {settings.penCapacity} U</span></div>
            <div className="gt-body text-[11px]" style={{ color: C.faint }}>{penUsedSinceBaseline} U logged since last calibration</div>
          </div>
        </div>
        <div className="w-full h-2 rounded-full mt-1 mb-4 overflow-hidden" style={{ background: C.lineSoft }}>
          <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, (penRemaining / settings.penCapacity) * 100))}%`, background: penRemaining / settings.penCapacity < 0.15 ? C.warn : C.accent }} />
        </div>

        <div className="rounded-lg p-3.5 mb-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
          <div className="text-xs font-semibold mb-2" style={{ color: C.muted }}>Already used part of this pen? Set the level you actually have left</div>
          <div className="flex items-center gap-2">
            <input type="number" step="1" value={adjustValue} onChange={(e) => setAdjustValue(e.target.value)} placeholder={`e.g. ${Math.round(settings.penCapacity / 2)}`} style={{ ...inputStyle, flex: 1 }} />
            <span className="text-xs shrink-0" style={{ color: C.muted }}>U remaining</span>
            <button onClick={applyAdjust} className="px-3 py-2 rounded-lg text-xs font-semibold shrink-0" style={{ background: C.ink, color: "#fff" }}>Set level</button>
          </div>
          <div className="text-[11px] mt-1.5" style={{ color: C.faint }}>From this moment, every basal dose you log will subtract from this number automatically.</div>
        </div>

        <button onClick={startNewPen} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border hover:bg-black/[0.02]" style={{ borderColor: C.line, color: C.ink }}><PenTool size={13} /> Start brand new pen (full)</button>
      </section>

      <section className="rounded-xl p-5 mb-5" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
        <h3 className="gt-display text-sm font-semibold mb-1" style={{ color: C.ink }}>Family access</h3>
        <p className="text-xs mb-4" style={{ color: C.muted }}>Invite family members to a read-only view of your log.</p>
        <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg" style={{ background: C.bg }}>
          <LinkIcon size={14} color={C.muted} />
          <span className="gt-mono text-xs truncate flex-1" style={{ color: C.muted }}>{inviteLink}</span>
          <button onClick={copyLink} className="p-1.5 rounded-md hover:bg-black/[0.05]"><Copy size={14} color={C.accentDark} /></button>
        </div>
        <div className="flex gap-2 mb-3">
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="family@email.com" style={inputStyle} />
          <button onClick={addEmail} className="px-3 rounded-lg text-sm font-medium flex items-center gap-1 shrink-0" style={{ background: C.accent, color: "#fff" }}><Mail size={14} /> Invite</button>
        </div>
        {familyEmails.length > 0 && (
          <div className="space-y-1.5">
            {familyEmails.map((em) => (
              <div key={em} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg" style={{ background: C.bg }}>
                <span style={{ color: C.ink }}>{em}</span>
                <button onClick={() => setFamilyEmails((es) => es.filter((x) => x !== em))} className="p-1 rounded hover:bg-black/[0.05]"><X size={13} color={C.faint} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
        <h3 className="gt-display text-sm font-semibold mb-1" style={{ color: C.ink }}>Data</h3>
        <p className="text-xs mb-3" style={{ color: C.muted }}>Your log is saved automatically in local browser storage.</p>
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border hover:bg-black/[0.02]" style={{ borderColor: C.line, color: C.hypo }}><RotateCcw size={13} /> Reset all data</button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: C.hypo }}>Erase all entries and settings? This can't be undone.</span>
            <button onClick={() => { onResetData(); setConfirmReset(false); }} className="px-2.5 py-1.5 rounded-md text-xs font-semibold" style={{ background: C.hypo, color: "#fff" }}>Yes, reset</button>
            <button onClick={() => setConfirmReset(false)} className="px-2.5 py-1.5 rounded-md text-xs font-medium border" style={{ borderColor: C.line, color: C.muted }}>Cancel</button>
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */
function MonthPanel({ monthKeyValue, logs, unit, settings, expandedId, setExpandedId, role, onDelete, onOpenDay }) {
  const [open, setOpen] = useState(false);
  const sorted = [...logs].sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
  const avg = sorted.length ? sorted.reduce((s, l) => s + l.glucose, 0) / sorted.length : 0;
  const totalBasal = sorted.reduce((s, l) => s + (l.basalDose || 0), 0);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 gt-body hover:bg-black/[0.015]" style={{ background: C.surface }}>
        <span className="flex items-center gap-2">
          {open ? <ChevronDown size={15} color={C.muted} /> : <ChevronRight size={15} color={C.muted} />}
          <span className="text-sm font-semibold" style={{ color: C.ink }}>{monthLabelOf(monthKeyValue)}</span>
        </span>
        <span className="text-xs gt-mono" style={{ color: C.faint }}>{sorted.length} entries · avg {fromMmol(avg, unit)} {unitLabel(unit)} · {totalBasal}U basal</span>
      </button>
      {open && (
        <div className="p-3" style={{ background: C.bg, borderTop: `1px solid ${C.line}` }}>
          <DataGrid logs={sorted} unit={unit} settings={settings} expandedId={expandedId} setExpandedId={setExpandedId} role={role} onDelete={onDelete} onOpenDay={onOpenDay} />
        </div>
      )}
    </div>
  );
}
function YearPanel({ year, months, unit, settings, expandedId, setExpandedId, role, onDelete, onOpenDay, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const monthKeys = Object.keys(months).sort().reverse();
  const allLogs = monthKeys.flatMap((mk) => months[mk]);
  const avg = allLogs.length ? allLogs.reduce((s, l) => s + l.glucose, 0) / allLogs.length : 0;
  return (
    <div className="mb-3">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-1 py-2 gt-body">
        <span className="flex items-center gap-2">
          {open ? <ChevronDown size={16} color={C.ink} /> : <ChevronRight size={16} color={C.ink} />}
          <span className="gt-display text-base font-semibold" style={{ color: C.ink }}>{year}</span>
        </span>
        <span className="text-xs gt-mono" style={{ color: C.faint }}>{allLogs.length} entries · year avg {fromMmol(avg, unit)} {unitLabel(unit)}</span>
      </button>
      {open && (
        <div className="space-y-2 mt-1">
          {monthKeys.map((mk) => (
            <MonthPanel key={mk} monthKeyValue={mk} logs={months[mk]} unit={unit} settings={settings}
              expandedId={expandedId} setExpandedId={setExpandedId} role={role} onDelete={onDelete} onOpenDay={onOpenDay} />
          ))}
        </div>
      )}
    </div>
  );
}
function HistoryPage({ logs, unit, settings, expandedId, setExpandedId, role, onDelete, onOpenDay }) {
  const thisMonth = currentMonthKey();
  const past = logs.filter((l) => monthKeyOf(l.datetime) !== thisMonth);
  const byYear = {};
  past.forEach((l) => {
    const y = yearOf(l.datetime), mk = monthKeyOf(l.datetime);
    byYear[y] = byYear[y] || {};
    byYear[y][mk] = byYear[y][mk] || [];
    byYear[y][mk].push(l);
  });
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 gt-body">
      <h1 className="gt-display text-xl font-semibold mb-1" style={{ color: C.ink }}>History</h1>
      <p className="text-sm mb-6" style={{ color: C.muted }}>Past months archived automatically — organized by year, then month.</p>
      {years.length === 0 ? (
        <div className="text-center py-16" style={{ color: C.faint }}>
          <Droplet size={28} className="mx-auto mb-3" />
          <p className="text-sm">No past months yet. Once a new month starts, last month's entries will show up here.</p>
        </div>
      ) : (
        years.map((y, i) => (
          <YearPanel key={y} year={y} months={byYear[y]} unit={unit} settings={settings}
            expandedId={expandedId} setExpandedId={setExpandedId} role={role} onDelete={onDelete} onOpenDay={onOpenDay} defaultOpen={i === 0} />
        ))
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main App Component                                                  */
/* ------------------------------------------------------------------ */
export default function GlucoTrackApp() {
  const [screen, setScreen] = useState("login");
  const [role, setRole] = useState("patient");
  const [tab, setTab] = useState("dashboard");
  const [unit, setUnit] = useState("mmol");
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [familyEmails, setFamilyEmails] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [dayViewDate, setDayViewDate] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [loaded, setLoaded] = useState(false);
  const toastTimer = useRef(null);

  function showToast(msg) { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 2600); }

  /* Load persisted data on mount */
  useEffect(() => {
    let storedLogs = storageGet(K_LOGS);
    let storedSettings = storageGet(K_SETTINGS);
    let storedEmails = storageGet(K_EMAILS);

    if (!storedLogs) { storedLogs = seedLogs(); storageSet(K_LOGS, storedLogs); }
    if (!storedSettings) { storedSettings = defaultSettings(); storageSet(K_SETTINGS, storedSettings); }
    if (!storedEmails) { storedEmails = ["mom@example.com"]; storageSet(K_EMAILS, storedEmails); }

    setLogs(storedLogs);
    setSettings(storedSettings);
    setFamilyEmails(storedEmails);
    setLoaded(true);
  }, []);

  /* Synchronize data to localStorage on changes */
  useEffect(() => { if (loaded) storageSet(K_LOGS, logs); }, [logs, loaded]);
  useEffect(() => { if (loaded) storageSet(K_SETTINGS, settings); }, [settings, loaded]);
  useEffect(() => { if (loaded) storageSet(K_EMAILS, familyEmails); }, [familyEmails, loaded]);

  const sortedLogs = useMemo(() => [...logs].sort((a, b) => new Date(b.datetime) - new Date(a.datetime)), [logs]);
  const thisMonthKey = currentMonthKey();
  const monthLogs = useMemo(() => sortedLogs.filter((l) => monthKeyOf(l.datetime) === thisMonthKey), [sortedLogs, thisMonthKey]);
  const currentMonthLabel = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const penUsedSinceBaseline = useMemo(
    () => logs.filter((l) => l.basalDose && new Date(l.datetime) >= new Date(settings.penBaselineDate)).reduce((s, l) => s + l.basalDose, 0),
    [logs, settings.penBaselineDate]
  );
  const penRemaining = settings.penBaselineRemaining - penUsedSinceBaseline;

  function handleAddLog(entry) { setLogs((ls) => [entry, ...ls]); showToast("Entry saved"); }
  function handleDelete(id) { setLogs((ls) => ls.filter((l) => l.id !== id)); setExpandedId(null); showToast("Entry deleted"); }
  function handleResetData() {
    const s = seedLogs(), st = defaultSettings(), e = ["mom@example.com"];
    setLogs(s); setSettings(st); setFamilyEmails(e); showToast("Data reset to demo defaults");
  }
  function handleExport() {
    const headers = ["Date & Time", `Glucose (${unitLabel(unit)})`, "Reading Type", "Meal", "Food / Meal", "Classification", "Net Carbs (g)", "Basal (U)", "Notes"];
    const rows = sortedLogs.map((l) => [
      new Date(l.datetime).toLocaleString(), fromMmol(l.glucose, unit), l.readingType, l.mealType || "",
      (l.food || "").replace(/,/g, ";"), l.components.map((c) => `${c.name}:${c.classification}`).join(" | ").replace(/,/g, ";"),
      l.netCarbs || 0, l.basalDose ?? "", (l.notes || "").replace(/,/g, ";"),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "glucotrack-log.csv"; a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported");
  }

  if (screen === "login") {
    return (<>{FONTS}<LoginScreen onSelectRole={(r) => { setRole(r); setScreen("app"); setTab("dashboard"); }} /></>);
  }

  const dayEntries = dayViewDate ? logs.filter((l) => dayKey(l.datetime) === dayViewDate) : [];

  return (
    <div className="min-h-screen gt-body" style={{ background: C.bg }}>
      {FONTS}
      <Header role={role} tab={tab} setTab={setTab} unit={unit} setUnit={setUnit} onLogout={() => { setScreen("login"); setExpandedId(null); }} />

      {!loaded ? (
        <div className="flex flex-col items-center justify-center gap-2 py-24" style={{ color: C.muted }}>
          <Loader2 size={22} className="gt-spin" />
          <span className="gt-body text-sm">Loading your data…</span>
        </div>
      ) : tab === "dashboard" ? (
        <>
          <SummaryBar logs={sortedLogs} unit={unit} settings={settings} penRemaining={penRemaining} />
          <Toolbar role={role} onAdd={() => setAddOpen(true)} onExport={handleExport} monthLabel={currentMonthLabel} />
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 pb-4 flex gap-3 text-xs gt-body" style={{ color: C.muted }}>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: C.hyper }} /> High</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: C.hypo }} /> Low</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: C.normal }} /> In range</span>
            <span className="ml-auto italic" style={{ color: C.faint }}>Tip: click a date or meal tag to see that whole day</span>
          </div>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
            <DataGrid logs={monthLogs} unit={unit} settings={settings} expandedId={expandedId} setExpandedId={setExpandedId} role={role} onDelete={handleDelete} onOpenDay={setDayViewDate} />
          </div>
        </>
      ) : tab === "history" ? (
        <HistoryPage logs={logs} unit={unit} settings={settings} expandedId={expandedId} setExpandedId={setExpandedId} role={role} onDelete={handleDelete} onOpenDay={setDayViewDate} />
      ) : (
        <SettingsPage settings={settings} setSettings={setSettings} logs={logs} familyEmails={familyEmails} setFamilyEmails={setFamilyEmails}
          showToast={showToast} onResetData={handleResetData} penRemaining={penRemaining} penUsedSinceBaseline={penUsedSinceBaseline} />
      )}

      <QuickAddPanel open={addOpen} onClose={() => setAddOpen(false)} onSave={handleAddLog} settings={settings} unit={unit} />
      <DayViewModal dateKeyValue={dayViewDate} entries={dayEntries} unit={unit} settings={settings} onClose={() => setDayViewDate(null)} />
      <Toast toast={toast} />
    </div>
  );
}