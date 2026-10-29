import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Plus, ChevronDown, ChevronRight, Droplet, Syringe, LogOut, Check, X, AlertTriangle,
  Sparkles, Trash2, Copy, Mail, Gauge, PenTool, TrendingUp, Link as LinkIcon, Users,
  Loader2, RotateCcw, Pencil, Activity, MessageSquare, Send, Bot, User, Maximize2, Minimize2, Square, Download, ShieldCheck, Database, Calendar as CalendarIcon, Clock, BookOpen
} from "lucide-react";
import { subscribeToDoc, saveToDoc } from "./firebase";
import { GoogleGenAI } from "@google/genai";

/* ------------------------------------------------------------------ */
/* Design tokens & Theme configuration                                 */
/* ------------------------------------------------------------------ */
const C = {
  bg: "#F4F7F7",
  surface: "#FFFFFF",
  ink: "#101820",
  muted: "#52676E",
  faint: "#82959B",
  accent: "#0D6B6D",
  accentDark: "#08494A",
  accentSoft: "#E0EFEF",
  line: "#D2E1E3",
  lineSoft: "#E5ECEE",
  hyper: "#1D4ED8",
  hyperSoft: "#EFF6FF",
  hypo: "#DC2626",
  hypoSoft: "#FEF2F2",
  normal: "#15803D",
  normalSoft: "#F0FDF4",
  warn: "#B45309",
  warnSoft: "#FFFBEB",
  carb: "#B45309",
  carbSoft: "#FEF3E0",
  noncarb: "#0D746E",
  noncarbSoft: "#E1F4F1",
};

const MEAL_COLORS = {
  Breakfast: { fg: "#B45309", bg: "#FEF3E0" },
  Lunch: { fg: "#0D746E", bg: "#E1F4F1" },
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
    input[type="datetime-local"]::-webkit-calendar-picker-indicator { opacity:0.6; cursor:pointer; }
    @keyframes gt-spin { to { transform: rotate(360deg); } }
    .gt-spin { animation: gt-spin 0.85s linear infinite; }
    @keyframes fadeInScale { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
    .gt-modal-anim { animation: fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  `}</style>
);

/* ------------------------------------------------------------------ */
/* Storage keys & Default College Menu Presets                         */
/* ------------------------------------------------------------------ */
const K_LOGS = "gt-logs-v4";
const K_SETTINGS = "gt-settings-v4";
const K_EMAILS = "gt-family-emails-v4";
const K_COLLEGE_MENU = "gt-college-menu-v1";

const DEFAULT_COLLEGE_MENU = {
  Monday: {
    Breakfast: "1 bowl kueyteow, cherry tomatoes, blueberries, 2 sausage",
    Lunch: "1 bowl rice, 2 chicken, cabbage, papadam",
    Dinner: "1 bowl rice, 1 fish, 1 chicken, cabbage"
  },
  Tuesday: {
    Breakfast: "1 bowl fried rice, eggs, cherry tomatoes, blueberries",
    Lunch: "1 bowl rice, 2 taukuapok, vegetable, 2 chicken",
    Dinner: "1 bowl rice, 2 chicken, tauge, cabbage, baked potatoes"
  },
  Wednesday: {
    Breakfast: "Nasi himpit, cabbage, pasta, cherry tomatoes, blueberries, sausage, baked beans, eggs",
    Lunch: "1 bowl rice, 1 chicken, 1 fish, salad, vegetable, fishball",
    Dinner: "Pasta, 2 chicken, salad, mash potato, fries, chicken chop"
  },
  Thursday: {
    Breakfast: "1 bowl mee goreng, cherry tomatoes, blueberries",
    Lunch: "1 bowl rice, broccoli, 2 chicken",
    Dinner: "1 bowl rice, 2 chicken, cabbage"
  },
  Friday: {
    Breakfast: "Porridge, roti jala, ikan bilis, chives, peanuts",
    Lunch: "1 bowl rice, 2 chicken, tomato, salad, tauge",
    Dinner: "1 bowl rice, 2 chicken, vegetable"
  },
  Saturday: {
    Breakfast: "1 bowl beehoon, cherry tomato, blueberries",
    Lunch: "1 bowl rice, 1/2 chicken, mutton, cabbage",
    Dinner: "1 bowl rice, 2 chicken, cabbage, 1 bowl beehoon"
  },
  Sunday: {
    Breakfast: "1 bowl nasi lemak, eggs, kacang, ikan bilis, sambal sotong",
    Lunch: "1 bowl rice, 2 chicken, vegetable",
    Dinner: "1 bowl fried rice, 2 chicken, tomato, cabbage"
  }
};

function storageGet(key, fallback = null) {
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (err) {
    console.error(`Storage read error for key [${key}]:`, err);
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`Storage write error for key [${key}]:`, err);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Gemini AI Client Helper                                             */
/* ------------------------------------------------------------------ */
function getGeminiClient() {
  const apiKey = (typeof process !== "undefined" && process.env && process.env.REACT_APP_GEMINI_API_KEY)
    || (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY)
    || "";
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

/* ------------------------------------------------------------------ */
/* Advanced Date, Unit & Calculation Helpers                           */
/* ------------------------------------------------------------------ */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const toMmol = (value, unit) => (unit === "mgdl" ? Number((value / 18).toFixed(2)) : Number(value));
const fromMmol = (mmol, unit) => (unit === "mgdl" ? Math.round(mmol * 18) : Number(mmol.toFixed(1)));
const unitLabel = (unit) => (unit === "mgdl" ? "mg/dL" : "mmol/L");

function calcHbA1c(avgGlucoseMmol) {
  if (!avgGlucoseMmol || avgGlucoseMmol <= 0) return null;
  const hba1cPct = (avgGlucoseMmol + 2.594) / 1.594;
  const hba1cIfcc = (hba1cPct - 2.15) * 10.929;
  return {
    pct: Math.round(hba1cPct * 10) / 10,
    ifcc: Math.round(hba1cIfcc)
  };
}

const MYT_TZ = "Asia/Kuala_Lumpur";
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const pad2 = (n) => String(n).padStart(2, "0");

function toMYTWallClock(date) {
  return new Date(date.getTime() + MYT_OFFSET_MS);
}
function mytDatetimeLocalValue(isoOrDate) {
  const base = isoOrDate ? new Date(isoOrDate) : new Date();
  const d = toMYTWallClock(base);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}
function mytLocalStringToISO(localStr) {
  const [datePart, timePart] = localStr.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = (timePart || "00:00").split(":").map(Number);
  const asUTC = Date.UTC(y, m - 1, d, hh, mm, 0);
  return new Date(asUTC - MYT_OFFSET_MS).toISOString();
}
const dayKey = (iso) => { const d = toMYTWallClock(new Date(iso)); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; };
const monthKeyOf = (iso) => { const d = toMYTWallClock(new Date(iso)); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`; };
const yearOf = (iso) => toMYTWallClock(new Date(iso)).getUTCFullYear();
const monthLabelOf = (monthKey) => { const [y, m] = monthKey.split("-"); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-MY", { month: "long", year: "numeric" }); };
function currentMonthKey() { return monthKeyOf(new Date().toISOString()); }

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString("en-MY", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: MYT_TZ });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", timeZone: MYT_TZ });
}
function fmtDateOnly(iso) {
  return new Date(iso).toLocaleDateString("en-MY", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: MYT_TZ });
}

function glucoseStatus(mmol, type, settings) {
  if (mmol == null) return "normal";
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
  if (reading == null || !tiers || !tiers.length) return { dose: 0, note: "No basal tiers configured or glucose missing." };
  const sorted = [...tiers].sort((a, b) => a.low - b.low);
  const tier = sorted.find((t) => reading >= t.low && reading < t.high);
  if (tier) return { dose: tier.dose, note: null };
  if (reading < sorted[0].low) return { dose: Math.max(0, sorted[0].dose - 2), note: "Below configured range — consult medical team." };
  const last = sorted[sorted.length - 1];
  const steps = Math.ceil(reading - last.high);
  return { dose: last.dose + steps * 2, note: "Above configured range — consult medical team." };
}

function calcBolus(reading, settings, carbs) {
  if (reading == null) return { target: 0, correction: 0, carbBolus: carbs > 0 ? carbs / settings.cir : 0, total: carbs > 0 ? carbs / settings.cir : 0 };
  const target = (settings.targetLow + settings.targetHigh) / 2;
  const correction = Math.max(0, reading - target) / settings.isf;
  const carbBolus = carbs > 0 ? carbs / settings.cir : 0;
  return { target, correction, carbBolus, total: correction + carbBolus };
}

const round1 = (n) => Math.round(n * 10) / 10;
function sortComponents(components) {
  return [...components].sort((a, b) => {
    const rank = (c) => (c.classification === "Carbohydrate" ? 0 : 1);
    return rank(a) - rank(b);
  });
}

const CARB_WORDS = ["rice", "bread", "pasta", "noodle", "potato", "roti", "chapati", "naan", "banana", "apple",
  "mango", "cereal", "oats", "corn", "beans", "lentil", "quinoa", "tortilla", "cake", "cookie", "sugar", "juice",
  "soda", "fries", "chips", "pastry", "bun", "toast", "milk", "yogurt", "grapes", "porridge", "pancake", "nasi", "beehoon", "kueyteow", "mee"];
const NONCARB_WORDS = ["chicken", "beef", "fish", "salmon", "egg", "tofu", "broccoli", "spinach", "lettuce",
  "cheese", "butter", "oil", "avocado", "nuts", "almond", "cucumber", "kale", "shrimp", "steak", "bacon", "turkey", "sotong", "kacang", "ikan bilis"];

function offlineClassify(description) {
  const parts = description.split(/,|\band\b|\+/gi).map((p) => p.trim()).filter(Boolean);
  const list = parts.length ? parts : [description];
  return list.map((name) => {
    const lower = name.toLowerCase();
    const isCarb = CARB_WORDS.some((w) => lower.includes(w));
    const isNon = NONCARB_WORDS.some((w) => lower.includes(w));
    const classification = isCarb && !isNon ? "Carbohydrate" : isNon ? "Non-Carbohydrate" : "Carbohydrate";
    return { name, classification, carbs_g: classification === "Carbohydrate" ? 35 : 3 };
  });
}

async function classifyFoodWithAI(description) {
  const ai = getGeminiClient();
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Classify the following food item into individual food components with carbohydrate count in JSON format with array key "components" containing objects with keys "name", "classification" ("Carbohydrate" or "Non-Carbohydrate"), and "carbs_g" (number): "${description}"`,
      });
      const text = response.text();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.components && Array.isArray(parsed.components)) {
          return parsed.components;
        }
      }
    } catch (err) {
      console.warn("AI classification fallback active:", err);
    }
  }
  return offlineClassify(description);
}

/* ------------------------------------------------------------------ */
/* Transparent Prediction Engine with Reference Sources                */
/* ------------------------------------------------------------------ */
async function getGlucosePrediction(netCarbs, currentGlucose, foodDescription = "", settings = {}, logs = [], readingType = "Post-Meal", mealType = "Breakfast") {
  const ai = getGeminiClient();
  const isf = settings.isf || 2.0;
  const cir = settings.cir || 15;
  const targetMean = (settings.targetLow + settings.targetHigh) / 2;

  let baseGlucose = currentGlucose;
  if (baseGlucose == null || isNaN(baseGlucose)) {
    const validLogsWithAnyGlucose = logs.filter(l => l.glucose != null || l.predictedGlucose != null);
    if (validLogsWithAnyGlucose.length > 0) {
      const recentLog = validLogsWithAnyGlucose[0];
      baseGlucose = recentLog.glucose != null ? recentLog.glucose : recentLog.predictedGlucose;
    } else {
      baseGlucose = 5.5;
    }
  }

  let referencesUsed = [];

  // Fasting prediction model with historical reference sources
  if (readingType === "Fasting") {
    const now = new Date();
    const yesterdayKey = dayKey(new Date(now.getTime() - 86400000).toISOString());
    const prevDayLogs = logs.filter(l => dayKey(l.datetime) === yesterdayKey && (l.glucose != null || l.predictedGlucose != null));
    
    let predFasting = baseGlucose;
    if (prevDayLogs.length > 0) {
      const allPrevVals = prevDayLogs.map(l => l.glucose != null ? l.glucose : l.predictedGlucose);
      const avgPrevDay = allPrevVals.reduce((a, b) => a + b, 0) / allPrevVals.length;
      const lastReading = allPrevVals[0];
      predFasting = (0.5 * avgPrevDay) + (0.3 * lastReading) + (0.2 * targetMean) - 0.2;
      referencesUsed.push(`Previous day logs average (${round1(avgPrevDay)} mmol/L from ${prevDayLogs.length} entries)`);
      referencesUsed.push(`Previous evening last recorded reading (${round1(lastReading)} mmol/L)`);
    } else {
      predFasting = targetMean;
      referencesUsed.push("Default target mean baseline (no previous day logs found)");
    }

    if (ai) {
      try {
        const prompt = `You are an advanced clinical endocrinology AI forecaster.
Predict upcoming FASTING glucose in mmol/L based on previous day logs: ${JSON.stringify(prevDayLogs.map(l => ({ type: l.readingType, glucose: l.glucose || l.predictedGlucose, time: l.datetime })))}.
Respond in valid JSON format only with keys: "predicted_glucose" (number in mmol/L) and "rationale" (short string).`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (typeof parsed.predicted_glucose === "number") {
            predFasting = parsed.predicted_glucose;
            referencesUsed.push(`AI Clinical Endocrinology Model adjustment (${parsed.rationale || "historical weight analysis"})`);
          }
        }
      } catch (err) {
        console.warn("AI fasting prediction fallback:", err);
      }
    }

    predFasting = Math.max(3.5, Math.min(15.0, predFasting));
    return {
      predicted_glucose: Math.round(predFasting * 10) / 10,
      references: referencesUsed
    };
  }

  // Post-Meal Prediction Model considering Meal Type & Exact/Similar Food Matches
  let historicalRisePerGram = isf / cir;
  const validLogs = logs.filter(l => l.glucose != null || l.predictedGlucose != null);

  // Filter logs specifically considering meal type when matching history
  const matchingMealLogs = validLogs.filter(l => l.mealType === mealType && l.food && foodDescription && l.food.toLowerCase().includes(foodDescription.toLowerCase().slice(0, 8)));
  if (matchingMealLogs.length > 0) {
    const matchVals = matchingMealLogs.filter(l => l.glucose != null).map(l => l.glucose);
    if (matchVals.length > 0) {
      const avgMatch = matchVals.reduce((a, b) => a + b, 0) / matchVals.length;
      referencesUsed.push(`Historical exact/similar ${mealType} match: "${matchingMealLogs[0].food}" (Avg actual: ${round1(avgMatch)} mmol/L from ${matchVals.length} past record(s))`);
      baseGlucose = avgMatch * 0.4 + baseGlucose * 0.6;
    } else {
      referencesUsed.push(`Historical similar ${mealType} food match found (${matchingMealLogs.length} past record(s))`);
    }
  }

  if (validLogs.length > 0) {
    const postMealLogs = validLogs.filter((l) => l.readingType === "Post-Meal" && l.mealType === mealType && l.netCarbs > 0 && l.glucose != null);
    if (postMealLogs.length > 0) {
      const similarCarbLogs = postMealLogs.filter((l) => Math.abs((l.netCarbs || 0) - netCarbs) <= 15);
      if (similarCarbLogs.length > 0) {
        const avgSimilarPeak = similarCarbLogs.reduce((sum, l) => sum + l.glucose, 0) / similarCarbLogs.length;
        historicalRisePerGram = Math.max(0.02, (avgSimilarPeak - baseGlucose) / (netCarbs || 1));
        referencesUsed.push(`Carbohydrate-rise sensitivity from ${similarCarbLogs.length} past ${mealType}(s) with ~${netCarbs}g carbs`);
      } else {
        referencesUsed.push(`Standard ISF/CIR ratio formula (${isf} / ${cir}) for ${mealType}`);
      }
    } else {
      referencesUsed.push("Default standard pharmacokinetic carb-rise formula");
    }
  } else {
    referencesUsed.push("Baseline target range and standard carbohydrate factor");
  }

  let baseCarbRise = (netCarbs || 0) * historicalRisePerGram;
  let estimatedPeak = baseGlucose + Math.max(0, baseCarbRise);

  if (ai) {
    try {
      const historicalContext = logs.slice(0, 15).map((l) => ({
        time: fmtDateTime(l.datetime),
        type: l.readingType,
        mealType: l.mealType || "N/A",
        glucose: l.glucose != null ? `${l.glucose} mmol/L (Actual)` : (l.predictedGlucose != null ? `${l.predictedGlucose} mmol/L (Predicted)` : "Not recorded"),
        carbs: l.netCarbs,
        food: l.food || "None"
      }));

      const prompt = `You are an advanced clinical endocrinology AI forecaster.
Reading Type: ${readingType}
Meal Type: ${mealType}
Base/Pre-meal glucose: ${baseGlucose} mmol/L
Net carbs: ${netCarbs}g
Food description: "${foodDescription}"
Patient ISF: ${isf} mmol/L/U, CIR: ${cir}g/U.
Patient historical logs: ${JSON.stringify(historicalContext)}

Predict the expected glucose reading / 2-hour post-meal peak in mmol/L for this ${mealType}. Respond in valid JSON format only with keys: "predicted_glucose" (number in mmol/L) and "rationale" (short string explaining the reference trend).`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      const text = response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed.predicted_glucose === "number") {
          estimatedPeak = parsed.predicted_glucose;
          if (parsed.rationale) {
            referencesUsed.push(`Gemini AI Clinical Rationale (${mealType}): ${parsed.rationale}`);
          }
        }
      }
    } catch (err) {
      console.warn("AI prediction fallback active:", err);
    }
  }

  estimatedPeak = Math.max(3.5, Math.min(22.0, estimatedPeak));
  return {
    predicted_glucose: Math.round(estimatedPeak * 10) / 10,
    references: referencesUsed
  };
}

/* ------------------------------------------------------------------ */
/* Seed Data & Default Settings                                        */
/* ------------------------------------------------------------------ */
function seedLogs() {
  return [
    {
      id: "seed-1",
      datetime: new Date(Date.now() - 3600000 * 4).toISOString(),
      glucose: 6.2,
      predictedGlucose: 6.5,
      readingType: "Fasting",
      mealType: null,
      food: "Morning routine & black coffee",
      components: [{ name: "Black coffee", classification: "Non-Carbohydrate", carbs_g: 0 }],
      netCarbs: 0,
      basalDose: 10,
      bolusGiven: null,
      notes: "Feeling great and energetic this morning."
    }
  ];
}

function defaultSettings() {
  return {
    targetLow: 4.0,
    targetHigh: 7.0,
    postMealHigh: 10.0,
    hypoThreshold: 3.9,
    cir: 15,
    isf: 2.0,
    basalTiers: [
      { id: "t1", low: 4.0, high: 5.0, dose: 8 },
      { id: "t2", low: 5.0, high: 6.0, dose: 10 },
      { id: "t3", low: 6.0, high: 7.0, dose: 12 },
    ],
    penCapacity: 300,
    penBaselineRemaining: 300,
    penBaselineDate: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* CSV Export Helper                                                   */
/* ------------------------------------------------------------------ */
function exportCSV(logsToExport, unit, filename = "glucotrack_export") {
  const headers = ["ID", "Datetime", "ReadingType", "MealType", `Glucose(${unitLabel(unit)})`, `Predicted(${unitLabel(unit)})`, "Food", "NetCarbs(g)", "Basal(U)", "Bolus(U)", "Notes"];
  const rows = logsToExport.map((l) => [
    l.id,
    l.datetime,
    l.readingType,
    l.mealType || "",
    l.glucose != null ? fromMmol(l.glucose, unit) : "",
    l.predictedGlucose != null ? fromMmol(l.predictedGlucose, unit) : "",
    `"${(l.food || "").replace(/"/g, '""')}"`,
    l.netCarbs != null ? l.netCarbs : "",
    l.basalDose != null ? l.basalDose : "",
    l.bolusGiven != null ? l.bolusGiven : "",
    `"${(l.notes || "").replace(/"/g, '""')}"`
  ]);
  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ------------------------------------------------------------------ */
/* UI Building Blocks: Toast, Chip, Field                              */
/* ------------------------------------------------------------------ */
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-2xl gt-body text-sm font-medium flex items-center gap-2.5 transition-all" style={{ background: C.ink, color: "#fff" }}>
      <Check size={16} className="text-teal-400" />
      <span>{toast}</span>
    </div>
  );
}

function Chip({ children, fg, bg, mono }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${mono ? "gt-mono" : "gt-body"}`} style={{ color: fg, background: bg }}>
      {children}
    </span>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block mb-4">
      <span className="block gt-body text-xs font-semibold mb-1.5" style={{ color: C.muted }}>{label}</span>
      {children}
      {hint && <span className="block gt-body text-[11px] mt-1 leading-normal" style={{ color: C.faint }}>{hint}</span>}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${C.line}`,
  background: "#fff",
  color: C.ink,
  fontSize: 14,
  outline: "none",
  transition: "border-color 0.15s ease"
};

/* ------------------------------------------------------------------ */
/* Expandable AI Chatbot Widget (Gemini Powered)                       */
/* ------------------------------------------------------------------ */
function AIChatbot({ logs, unit, settings }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text: "Hello! I am your advanced GlucoTrack Gemini Assistant. Ask me anything about your diabetes management, targets, or past logs."
    }
  ]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    
    setMessages((prev) => [
      ...prev,
      { sender: "user", text: userMessage },
      { sender: "ai", text: "" }
    ]);
    setLoading(true);

    const ai = getGeminiClient();
    const targetLowFmt = `${fromMmol(settings.targetLow, unit)} ${unitLabel(unit)}`;
    const targetHighFmt = `${fromMmol(settings.targetHigh, unit)} ${unitLabel(unit)}`;
    const postMealFmt = `${fromMmol(settings.postMealHigh, unit)} ${unitLabel(unit)}`;

    const contextLogs = logs.slice(0, 15).map((log) => ({
      datetime: fmtDateTime(log.datetime),
      glucose: log.glucose != null ? `${fromMmol(log.glucose, unit)} ${unitLabel(unit)}` : (log.predictedGlucose != null ? `${fromMmol(log.predictedGlucose, unit)} ${unitLabel(unit)} (Predicted)` : "Not recorded"),
      readingType: log.readingType,
      mealType: log.mealType || "N/A",
      food: log.food || "None",
      netCarbs: `${log.netCarbs || 0}g`,
      basal: log.basalDose ? `${log.basalDose}U` : "N/A",
      bolus: log.bolusGiven ? `${log.bolusGiven}U` : "N/A"
    }));

    const systemPrompt = `You are an expert, empathetic diabetes health assistant inside GlucoTrack.
Configured targets:
- Fasting Target Range: ${targetLowFmt} to ${targetHighFmt}
- Post-Meal Upper Limit: ${postMealFmt}
- Hypo Threshold: ${fromMmol(settings.hypoThreshold, unit)} ${unitLabel(unit)}

Recent logs context:
${JSON.stringify(contextLogs, null, 2)}`;

    if (!ai) {
      setTimeout(() => {
        let responseText = `Your target fasting range is **${targetLowFmt} – ${targetHighFmt}**. (Configure \`VITE_GEMINI_API_KEY\` for live AI responses).`;
        const lowerQ = userMessage.toLowerCase();
        if (lowerQ.includes("target") || lowerQ.includes("range")) {
          responseText = `Your configured fasting target range is **${targetLowFmt} – ${targetHighFmt}**. Post-meal readings should remain below **${postMealFmt}**.`;
        }
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { sender: "ai", text: responseText };
          return updated;
        });
        setLoading(false);
      }, 300);
      return;
    }

    try {
      const chatHistory = messages.map(m => ({
        role: m.sender === "user" ? "user" : "model",
        parts: [{ text: m.text }]
      }));
      chatHistory.push({ role: "user", parts: [{ text: userMessage }] });

      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: "Understood. I am ready to help." }] },
          ...chatHistory.slice(0, -1)
        ]
      });

      const result = await chat.sendMessageStream({ message: userMessage });
      let accumulatedText = "";

      for await (const chunk of result) {
        if (chunk.text) {
          accumulatedText += chunk.text;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { sender: "ai", text: accumulatedText };
            return updated;
          });
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { sender: "ai", text: `Error connecting to Gemini AI: ${err.message}` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 gt-body">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 px-4.5 py-3.5 rounded-full shadow-2xl transition-transform hover:scale-105 active:scale-95 font-semibold text-sm"
          style={{ background: C.accent, color: "#fff" }}
        >
          <Bot size={20} />
          <span>Diabetes AI Assistant</span>
        </button>
      ) : (
        <div
          className={`flex flex-col bg-white rounded-2xl shadow-2xl border transition-all duration-300 overflow-hidden gt-modal-anim ${
            isExpanded ? "w-[92vw] sm:w-[700px] h-[82vh]" : "w-[92vw] sm:w-[400px] h-[540px]"
          }`}
          style={{ borderColor: C.line, background: C.surface }}
        >
          <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ background: C.accent, color: "#fff", borderColor: C.accentDark }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot size={18} color="#fff" />
              </div>
              <div>
                <h3 className="gt-display text-sm font-semibold leading-tight">Gemini AI Assistant</h3>
                <span className="text-[11px] opacity-85 block">Live context & instant answers</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button onClick={() => { setIsOpen(false); setIsExpanded(false); }} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 gt-scroll" style={{ background: C.bg }}>
            {messages.map((msg, idx) => (
              <React.Fragment key={idx}>
                {msg.text && (
                  <div className={`flex gap-2.5 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.sender === "ai" && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm" style={{ background: C.accentSoft, color: C.accentDark }}>
                        <Bot size={14} />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                        msg.sender === "user" ? "rounded-br-xs text-white" : "rounded-bl-xs text-slate-800 border shadow-xs"
                      }`}
                      style={msg.sender === "user" ? { background: C.accent } : { background: C.surface, borderColor: C.line }}
                    >
                      {msg.text}
                    </div>
                    {msg.sender === "user" && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm" style={{ background: C.ink, color: "#fff" }}>
                        <User size={14} />
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            ))}
            {loading && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: C.accentSoft, color: C.accentDark }}>
                  <Bot size={14} />
                </div>
                <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-xs border text-xs flex items-center gap-2 shadow-xs" style={{ background: C.surface, borderColor: C.line, color: C.muted }}>
                  <Loader2 size={14} className="gt-spin" /> Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="p-3 border-t flex items-center gap-2" style={{ background: C.surface, borderColor: C.line }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your logs or targets..."
              disabled={loading}
              className="flex-1 px-3.5 py-2 rounded-xl text-xs sm:text-sm outline-none border focus:border-teal-600 transition-colors disabled:opacity-60"
              style={{ borderColor: C.line, background: C.bg, color: C.ink }}
            />
            <button type="submit" disabled={!input.trim() || loading} className="p-2 rounded-xl text-white disabled:opacity-40 transition-opacity" style={{ background: C.accent }}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Login Screen                                                       */
/* ------------------------------------------------------------------ */
function LoginScreen({ onSelectRole }) {
  return (
    <div className="min-h-screen flex items-center justify-center gt-body px-4" style={{ background: C.bg }}>
      <div className="w-full max-w-sm gt-modal-anim">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md" style={{ background: C.accent }}>
            <Droplet size={20} color="#fff" />
          </div>
          <span className="gt-display text-2xl font-bold tracking-tight" style={{ color: C.ink }}>GlucoTrack</span>
        </div>
        <div className="rounded-2xl p-6 shadow-xl border" style={{ background: C.surface, borderColor: C.line }}>
          <h1 className="gt-display text-lg font-bold mb-1" style={{ color: C.ink }}>Welcome back</h1>
          <p className="gt-body text-xs mb-6 leading-relaxed" style={{ color: C.muted }}>
            Choose your access role. Log data synchronizes live across devices via Firebase Firestore.
          </p>
          <button onClick={() => onSelectRole("patient")} className="w-full mb-3 rounded-xl px-4 py-3.5 flex items-center gap-3 text-left transition-transform hover:scale-[1.01] active:scale-[0.99] shadow-sm" style={{ background: C.accent, color: "#fff" }}>
            <Syringe size={18} />
            <div>
              <span className="block gt-body font-semibold text-sm">Continue as Patient</span>
              <span className="block gt-body text-[11px] opacity-85">Full access — log entries, dosing calculations & settings</span>
            </div>
          </button>
          <button onClick={() => onSelectRole("family")} className="w-full rounded-xl px-4 py-3.5 flex items-center gap-3 text-left border transition-colors hover:bg-black/[0.02]" style={{ borderColor: C.line, color: C.ink }}>
            <Users size={18} color={C.accent} />
            <div>
              <span className="block gt-body font-semibold text-sm">Continue as Family Viewer</span>
              <span className="block gt-body text-[11px]" style={{ color: C.muted }}>Read-only — view logs, graphs and trends</span>
            </div>
          </button>
        </div>
        <p className="gt-body text-[11px] text-center mt-6 leading-relaxed" style={{ color: C.faint }}>
          <ShieldCheck size={13} className="inline mr-1 mb-0.5" /> Dosing formulas are computed from user-defined parameters. Always verify with your clinical care team.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header Component                                                    */
/* ------------------------------------------------------------------ */
function Header({ role, tab, setTab, unit, setUnit, onLogout }) {
  return (
    <header className="sticky top-0 z-30 gt-body shadow-xs" style={{ background: C.surface, borderBottom: `1px solid ${C.line}` }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs" style={{ background: C.accent }}>
            <Droplet size={16} color="#fff" />
          </div>
          <span className="gt-display text-base font-bold hidden sm:inline" style={{ color: C.ink }}>GlucoTrack</span>
        </div>
        <nav className="flex items-center gap-1 rounded-xl p-1 border" style={{ background: C.bg, borderColor: C.lineSoft }}>
          <button onClick={() => setTab("dashboard")} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all" style={tab === "dashboard" ? { background: C.surface, color: C.ink, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { color: C.muted }}>Dashboard</button>
          <button onClick={() => setTab("history")} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all" style={tab === "history" ? { background: C.surface, color: C.ink, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { color: C.muted }}>History</button>
          {role === "patient" && <button onClick={() => setTab("settings")} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all" style={tab === "settings" ? { background: C.surface, color: C.ink, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { color: C.muted }}>Settings</button>}
        </nav>
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center rounded-lg overflow-hidden border shadow-xs" style={{ borderColor: C.line }}>
            <button onClick={() => setUnit("mmol")} className="px-2.5 py-1.5 text-xs gt-mono font-bold" style={unit === "mmol" ? { background: C.accentSoft, color: C.accentDark } : { color: C.muted }}>mmol/L</button>
            <button onClick={() => setUnit("mgdl")} className="px-2.5 py-1.5 text-xs gt-mono font-bold" style={unit === "mgdl" ? { background: C.accentSoft, color: C.accentDark } : { color: C.muted }}>mg/dL</button>
          </div>
          <Chip fg={role === "patient" ? C.accentDark : C.muted} bg={role === "patient" ? C.accentSoft : C.lineSoft}>{role === "patient" ? "Patient" : "Viewer"}</Chip>
          <button onClick={onLogout} title="Switch role" className="p-2 rounded-lg hover:bg-black/[0.04] transition-colors" style={{ color: C.muted }}><LogOut size={16} /></button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Summary Bar & Sparkline Component                                   */
/* ------------------------------------------------------------------ */
function Sparkline({ logs, settings }) {
  const validLogs = logs.filter(l => l.glucose != null);
  const points = [...validLogs].sort((a, b) => new Date(a.datetime) - new Date(b.datetime)).slice(-14);
  if (points.length < 2) return <div style={{ height: 42 }} />;
  const w = 260, h = 42, pad = 4;
  const vals = points.map((p) => p.glucose);
  const min = Math.min(...vals, settings.hypoThreshold);
  const max = Math.max(...vals, settings.postMealHigh);
  const x = (i) => pad + (i * (w - pad * 2)) / (points.length - 1);
  const y = (v) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.glucose).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={path} fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => {
        const st = glucoseStatus(p.glucose, p.readingType, settings);
        const sc = statusColors(st);
        return <circle key={p.id || i} cx={x(i)} cy={y(p.glucose)} r={st === "normal" ? 2.5 : 3.5} fill={sc.fg} stroke="#fff" strokeWidth="1" />;
      })}
    </svg>
  );
}

function SummaryBar({ logs, unit, settings, penRemaining }) {
  const [hba1cDays, setHba1cDays] = useState(90);
  const latest = logs[0];
  const validLogs = logs.filter(l => l.glucose != null);

  const last7 = validLogs.filter((l) => Date.now() - new Date(l.datetime).getTime() < 7 * 86400000);
  const avg7 = last7.length ? last7.reduce((s, l) => s + l.glucose, 0) / last7.length : 0;

  const filteredForA1c = validLogs.filter((l) => Date.now() - new Date(l.datetime).getTime() < hba1cDays * 86400000);
  const avgGlucoseForA1c = filteredForA1c.length ? filteredForA1c.reduce((s, l) => s + l.glucose, 0) / filteredForA1c.length : 0;
  const estimatedHbA1c = calcHbA1c(avgGlucoseForA1c);

  const latestStatus = latest && latest.glucose != null ? glucoseStatus(latest.glucose, latest.readingType, settings) : "normal";
  const sc = statusColors(latestStatus);
  const penPct = Math.max(0, Math.min(100, (penRemaining / settings.penCapacity) * 100));
  const penLow = penPct < 15;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="rounded-2xl p-4 shadow-xs border transition-all hover:shadow-md" style={{ background: C.surface, borderColor: C.line }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Droplet size={14} color={C.muted} />
            <span className="gt-body text-xs font-semibold" style={{ color: C.muted }}>Latest reading</span>
          </div>
          {latest ? (
            <>
              {latest.glucose != null ? (
                <div className="gt-mono text-2xl font-bold" style={{ color: sc.fg }}>
                  {fromMmol(latest.glucose, unit)}
                  <span className="text-xs ml-1 font-normal" style={{ color: C.faint }}>{unitLabel(unit)}</span>
                </div>
              ) : latest.predictedGlucose != null ? (
                <div className="gt-mono text-xl font-bold" style={{ color: C.accentDark }}>
                  {fromMmol(latest.predictedGlucose, unit)} <span className="text-xs font-normal" style={{ color: C.faint }}>(Pred)</span>
                </div>
              ) : (
                <div className="gt-mono text-2xl font-bold" style={{ color: C.faint }}>—</div>
              )}
              <div className="gt-body text-[11px] mt-1 truncate" style={{ color: C.faint }}>
                {latest.readingType}{latest.mealType ? ` · ${latest.mealType}` : ""} · {fmtDateTime(latest.datetime)}
              </div>
            </>
          ) : (
            <div className="gt-body text-xs" style={{ color: C.faint }}>No entries recorded</div>
          )}
        </div>

        <div className="rounded-2xl p-4 shadow-xs border transition-all hover:shadow-md" style={{ background: C.surface, borderColor: C.line }}>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={14} color={C.muted} />
            <span className="gt-body text-xs font-semibold" style={{ color: C.muted }}>7-day average</span>
          </div>
          <div className="gt-mono text-2xl font-bold" style={{ color: C.ink }}>
            {last7.length ? fromMmol(avg7, unit) : "—"}
            <span className="text-xs ml-1 font-normal" style={{ color: C.faint }}>{unitLabel(unit)}</span>
          </div>
          <div className="mt-1"><Sparkline logs={logs} settings={settings} /></div>
        </div>

        <div className="rounded-2xl p-4 col-span-2 sm:col-span-1 shadow-xs border transition-all hover:shadow-md" style={{ background: C.surface, borderColor: C.line }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Activity size={14} color={C.accent} />
              <span className="gt-body text-xs font-semibold" style={{ color: C.muted }}>Est. HbA1c</span>
            </div>
            <select
              value={hba1cDays}
              onChange={(e) => setHba1cDays(Number(e.target.value))}
              className="text-[11px] gt-body bg-transparent border-none outline-none cursor-pointer font-bold"
              style={{ color: C.accentDark }}
            >
              <option value={90}>90d</option>
              <option value={30}>30d</option>
              <option value={7}>7d</option>
            </select>
          </div>
          <div className="gt-mono text-2xl font-bold" style={{ color: estimatedHbA1c ? C.accentDark : C.faint }}>
            {estimatedHbA1c ? `${estimatedHbA1c.pct}%` : "—"}
            {estimatedHbA1c && <span className="text-[11px] ml-1 font-normal" style={{ color: C.faint }}>({estimatedHbA1c.ifcc})</span>}
          </div>
          <div className="gt-body text-[11px] mt-1" style={{ color: C.faint }}>
            {filteredForA1c.length ? `${filteredForA1c.length} readings analyzed` : "Need more data"}
          </div>
        </div>

        <div className="rounded-2xl p-4 shadow-xs border transition-all hover:shadow-md" style={{ background: C.surface, borderColor: C.line }}>
          <div className="flex items-center gap-1.5 mb-2">
            <PenTool size={14} color={C.muted} />
            <span className="gt-body text-xs font-semibold" style={{ color: C.muted }}>Basal pen level</span>
          </div>
          <div className="gt-mono text-2xl font-bold" style={{ color: penLow ? C.warn : C.ink }}>
            {Math.max(0, Math.round(penRemaining))}
            <span className="text-xs ml-1 font-normal" style={{ color: C.faint }}>/ {settings.penCapacity} U</span>
          </div>
          <div className="w-full h-2 rounded-full mt-2.5 overflow-hidden shadow-inner" style={{ background: C.lineSoft }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${penPct}%`, background: penLow ? C.warn : C.accent }} />
          </div>
          {penLow && <div className="gt-body text-[10px] mt-1 font-medium" style={{ color: C.warn }}>Refill recommended soon</div>}
        </div>

        <div className="rounded-2xl p-4 shadow-xs border transition-all hover:shadow-md" style={{ background: C.surface, borderColor: C.line }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Gauge size={14} color={C.muted} />
            <span className="gt-body text-xs font-semibold" style={{ color: C.muted }}>Target range</span>
          </div>
          <div className="gt-mono text-2xl font-bold" style={{ color: C.ink }}>
            {fromMmol(settings.targetLow, unit)}–{fromMmol(settings.targetHigh, unit)}
          </div>
          <div className="gt-body text-[11px] mt-1" style={{ color: C.faint }}>{unitLabel(unit)} · Fasting baseline</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Entry Detail Body & Row Expansion                                   */
/* ------------------------------------------------------------------ */
function EntryDetailBody({ log, unit, settings }) {
  const isFasting = log.readingType === "Fasting";
  const basalSuggestion = isFasting && log.glucose != null ? suggestBasal(log.glucose, settings.basalTiers) : null;
  const bolus = !isFasting ? calcBolus(log.glucose, settings, log.netCarbs || 0) : null;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <div className="gt-body text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: C.muted }}>Meal Breakdown & Components</div>
        {log.components && log.components.length ? (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {sortComponents(log.components).map((c, i) => (
              <Chip key={i} fg={c.classification === "Carbohydrate" ? C.carb : C.noncarb} bg={c.classification === "Carbohydrate" ? C.carbSoft : C.noncarbSoft}>
                {c.name} · {c.carbs_g}g
              </Chip>
            ))}
          </div>
        ) : (
          <div className="gt-body text-xs mb-3 italic" style={{ color: C.faint }}>No individual food components recorded.</div>
        )}
        {log.notes && (
          <div className="mt-3.5 pt-3 border-t" style={{ borderColor: C.lineSoft }}>
            <div className="gt-body text-xs font-bold mb-1 uppercase tracking-wide" style={{ color: C.muted }}>Notes</div>
            <p className="gt-body text-xs leading-relaxed" style={{ color: C.ink }}>{log.notes}</p>
          </div>
        )}
      </div>
      <div>
        {isFasting ? (
          <>
            <div className="gt-body text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: C.muted }}>Basal Dosing Analysis</div>
            <div className="rounded-xl p-3.5 gt-mono text-xs shadow-xs" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.ink }}>
              {log.glucose != null ? `Fasting reading ${fromMmol(log.glucose, unit)} ${unitLabel(unit)} → Suggested tier:` : "No glucose reading recorded → Suggested tier:"} <b>{basalSuggestion?.dose ?? 0} U</b>
            </div>
            {basalSuggestion?.note && (
              <div className="flex items-start gap-1.5 mt-2 gt-body text-xs" style={{ color: C.warn }}>
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>{basalSuggestion.note}</span>
              </div>
            )}
            <div className="gt-body text-xs mt-2.5" style={{ color: C.muted }}>
              Logged basal dose: <span className="gt-mono font-bold" style={{ color: C.ink }}>{log.basalDose != null ? `${log.basalDose} U` : "—"}</span>
            </div>
          </>
        ) : (
          <>
            <div className="gt-body text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: C.muted }}>Bolus Calculation Breakdown</div>
            <div className="rounded-xl p-3.5 gt-mono text-[12px] leading-relaxed shadow-xs" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.ink }}>
              {log.glucose != null ? `(${fromMmol(log.glucose, unit)} − ${fromMmol(bolus.target, unit)}) ÷ ${settings.isf} ` : "No actual glucose (Predicted used for calc) "}
              &nbsp;+&nbsp; {log.netCarbs || 0}g ÷ {settings.cir}
              <br />= {round1(bolus.correction)} U correction + {round1(bolus.carbBolus)} U carb bolus
              <br /><b>= {round1(bolus.total)} U total suggested</b>
            </div>
            <div className="gt-body text-xs mt-2.5" style={{ color: C.muted }}>
              Bolus given: <span className="gt-mono font-bold" style={{ color: C.ink }}>{log.bolusGiven != null ? `${log.bolusGiven} U` : "—"}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RowExpanded({ log, unit, settings }) {
  return (
    <tr>
      <td colSpan={12} className="p-0">
        <div className="px-6 sm:px-10 py-5 shadow-inner" style={{ background: C.bg, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
          <EntryDetailBody log={log} unit={unit} settings={settings} />
        </div>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Day View Modal                                                      */
/* ------------------------------------------------------------------ */
function DayViewModal({ dateKeyValue, entries, unit, settings, onClose }) {
  if (!dateKeyValue) return null;
  const sorted = [...entries].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  const validGlucoseEntries = sorted.filter(l => l.glucose != null);
  const avg = validGlucoseEntries.length ? validGlucoseEntries.reduce((s, l) => s + l.glucose, 0) / validGlucoseEntries.length : 0;
  const totalCarbs = sorted.reduce((s, l) => s + (l.netCarbs || 0), 0);
  const totalBasal = sorted.reduce((s, l) => s + (l.basalDose || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(16,24,32,0.45)", backdropFilter: "blur(2px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="gt-body w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border gt-modal-anim flex flex-col max-h-[90vh]" style={{ background: C.surface, borderColor: C.line }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background: C.surface, borderColor: C.line }}>
          <div>
            <div className="gt-display text-base font-bold" style={{ color: C.ink }}>{sorted.length ? fmtDateOnly(sorted[0].datetime) : dateKeyValue}</div>
            <div className="text-xs gt-body mt-0.5" style={{ color: C.muted }}>
              {sorted.length} entr{sorted.length === 1 ? "y" : "ies"} · {validGlucoseEntries.length ? <>Avg <span className="gt-mono font-bold">{fromMmol(avg, unit)} {unitLabel(unit)}</span> · </> : ""} <span className="gt-mono font-bold">{totalCarbs}g</span> carbs · <span className="gt-mono font-bold">{totalBasal}U</span> basal
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/[0.04] transition-colors"><X size={18} color={C.muted} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto gt-scroll" style={{ background: C.bg }}>
          {sorted.map((log) => {
            const status = log.glucose != null ? glucoseStatus(log.glucose, log.readingType, settings) : "normal";
            const sc = statusColors(status);
            const mc = log.mealType ? MEAL_COLORS[log.mealType] : null;
            return (
              <div key={log.id} className="rounded-xl p-4 shadow-xs border" style={{ background: C.surface, borderColor: C.line }}>
                <div className="flex items-center flex-wrap gap-2 mb-3">
                  <span className="gt-mono text-xs font-bold" style={{ color: C.faint }}><Clock size={12} className="inline mr-1" />{fmtTime(log.datetime)}</span>
                  <Chip fg={log.readingType === "Fasting" ? C.accentDark : C.muted} bg={log.readingType === "Fasting" ? C.accentSoft : C.lineSoft}>{log.readingType}</Chip>
                  {mc && <Chip fg={mc.fg} bg={mc.bg}>{log.mealType}</Chip>}
                  <div className="ml-auto flex items-center gap-2">
                    {log.glucose != null && (
                      <span className="gt-mono font-bold px-2.5 py-0.5 rounded-lg text-sm shadow-xs" style={{ color: sc.fg, background: sc.bg }}>
                        {fromMmol(log.glucose, unit)} {unitLabel(unit)}
                      </span>
                    )}
                    {log.predictedGlucose != null && (
                      <span className="gt-mono font-semibold px-2 py-0.5 rounded-lg text-xs" style={{ color: C.accentDark, background: C.accentSoft }}>
                        Pred: {fromMmol(log.predictedGlucose, unit)} {unitLabel(unit)}
                      </span>
                    )}
                  </div>
                </div>
                {log.food && <div className="gt-body text-sm font-medium mb-3" style={{ color: C.ink }}>{log.food}</div>}
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
/* Data Grid Component                                                 */
/* ------------------------------------------------------------------ */
function DataGrid({ logs, unit, settings, expandedId, setExpandedId, role, onDelete, onEdit, onOpenDay }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  if (!logs.length) {
    return (
      <div className="text-center py-20 gt-body rounded-2xl border border-dashed" style={{ borderColor: C.line, background: C.surface }}>
        <Droplet size={32} className="mx-auto mb-3 text-slate-300" />
        <p className="text-sm font-medium" style={{ color: C.muted }}>No log entries found for this period.</p>
        <p className="text-xs mt-1" style={{ color: C.faint }}>Click "Add entry" above to record your first reading.</p>
      </div>
    );
  }

  const cols = ["", "Date & Time", "Glucose", "Predicted", "Type", "Meal", "Food / Meal", "Components", "Net Carbs", "Basal (U)", "Notes", "Actions"];

  return (
    <div className="overflow-x-auto gt-scroll rounded-2xl shadow-xs border" style={{ borderColor: C.line, background: C.surface }}>
      <table className="w-full gt-body text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: C.bg }}>
            {cols.map((c, i) => (
              <th key={i} className="text-left px-4 py-3 font-semibold text-xs whitespace-nowrap tracking-wide" style={{ color: C.muted, borderBottom: `1px solid ${C.line}` }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const status = log.glucose != null ? glucoseStatus(log.glucose, log.readingType, settings) : "normal";
            const sc = statusColors(status);
            const open = expandedId === log.id;
            const componentsList = log.components || [];
            const carbCount = componentsList.filter((c) => c.classification === "Carbohydrate").length;
            const nonCount = componentsList.length - carbCount;
            const mc = log.mealType ? MEAL_COLORS[log.mealType] : null;
            const confirming = confirmDeleteId === log.id;

            return (
              <React.Fragment key={log.id}>
                <tr
                  onClick={() => setExpandedId(open ? null : log.id)}
                  className="cursor-pointer transition-colors hover:bg-black/[0.015]"
                  style={{
                    borderBottom: open ? "none" : `1px solid ${C.lineSoft}`,
                    background: open ? C.accentSoft + "30" : "transparent"
                  }}
                >
                  <td className="pl-3.5 pr-1 py-3.5" style={{ color: C.faint }}>
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </td>
                  <td
                    className="px-3.5 py-3.5 whitespace-nowrap font-medium underline decoration-dotted underline-offset-4"
                    style={{ color: C.ink }}
                    title="View full day summary"
                    onClick={(e) => { e.stopPropagation(); onOpenDay(dayKey(log.datetime)); }}
                  >
                    {fmtDateTime(log.datetime)}
                  </td>
                  <td className="px-3.5 py-3.5 whitespace-nowrap">
                    {log.glucose != null ? (
                      <span className="gt-mono font-bold px-2.5 py-1 rounded-lg shadow-xs" style={{ color: sc.fg, background: sc.bg }}>
                        {fromMmol(log.glucose, unit)}
                      </span>
                    ) : (
                      <span style={{ color: C.faint }}>—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3.5 whitespace-nowrap">
                    {log.predictedGlucose != null ? (
                      <span className="gt-mono font-semibold px-2 py-0.5 rounded-lg text-xs" style={{ color: C.accentDark, background: C.accentSoft }}>
                        {fromMmol(log.predictedGlucose, unit)}
                      </span>
                    ) : (
                      <span style={{ color: C.faint }}>—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3.5 whitespace-nowrap">
                    <Chip fg={log.readingType === "Fasting" ? C.accentDark : C.muted} bg={log.readingType === "Fasting" ? C.accentSoft : C.lineSoft}>
                      {log.readingType}
                    </Chip>
                  </td>
                  <td
                    className="px-3.5 py-3.5 whitespace-nowrap"
                    onClick={(e) => { if (mc) { e.stopPropagation(); onOpenDay(dayKey(log.datetime)); } }}
                  >
                    {mc ? <Chip fg={mc.fg} bg={mc.bg}>{log.mealType}</Chip> : <span style={{ color: C.faint }}>—</span>}
                  </td>
                  <td className="px-3.5 py-3.5 max-w-[220px] truncate font-medium" style={{ color: C.ink }}>
                    {log.food || "—"}
                  </td>
                  <td className="px-3.5 py-3.5 whitespace-nowrap">
                    {componentsList.length ? (
                      <span className="gt-body text-xs font-medium" style={{ color: C.muted }}>
                        {carbCount ? <span style={{ color: C.carb }}>{carbCount} carb</span> : null}
                        {carbCount && nonCount ? " · " : ""}
                        {nonCount ? <span style={{ color: C.noncarb }}>{nonCount} non-carb</span> : null}
                      </span>
                    ) : (
                      <span style={{ color: C.faint }}>—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3.5 gt-mono font-semibold" style={{ color: C.ink }}>
                    {log.netCarbs != null ? `${log.netCarbs}g` : "—"}
                  </td>
                  <td className="px-3.5 py-3.5 gt-mono font-semibold" style={{ color: C.ink }}>
                    {log.basalDose != null ? `${log.basalDose}U` : "—"}
                  </td>
                  <td className="px-3.5 py-3.5 max-w-[160px] truncate text-xs" style={{ color: C.muted }}>
                    {log.notes || "—"}
                  </td>
                  <td className="px-3.5 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {role !== "patient" ? (
                      <span style={{ color: C.faint }}>—</span>
                    ) : confirming ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => { onDelete(log.id); setConfirmDeleteId(null); }}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs"
                          style={{ background: C.hypo, color: "#fff" }}
                        >
                          Confirm
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} className="p-1.5 rounded-lg hover:bg-black/[0.05]">
                          <X size={14} color={C.faint} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => onEdit(log)} title="Edit entry" className="p-1.5 rounded-lg hover:bg-black/[0.05] transition-colors">
                          <Pencil size={15} color={C.muted} />
                        </button>
                        <button onClick={() => setConfirmDeleteId(log.id)} title="Delete entry" className="p-1.5 rounded-lg hover:bg-black/[0.05] transition-colors">
                          <Trash2 size={15} color={C.hypo} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                {open && <RowExpanded log={log} unit={unit} settings={settings} />}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quick Add / Edit Modal Panel with College Menu & Reference Sources  */
/* ------------------------------------------------------------------ */
function QuickAddPanel({ open, onClose, onSave, onDelete, settings, unit, initialLog, logs, collegeMenu, onUpdateCollegeMenu }) {
  const [datetime, setDatetime] = useState(() => mytDatetimeLocalValue());
  const [glucoseInput, setGlucoseInput] = useState("");
  const [readingType, setReadingType] = useState("Post-Meal");
  const [mealType, setMealType] = useState("Breakfast");
  
  // College menu selection states
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [menuSourceDay, setMenuSourceDay] = useState("Monday");
  const [isCustomFood, setIsCustomFood] = useState(false);

  const [food, setFood] = useState("");
  const [components, setComponents] = useState([]);
  const [netCarbsOverride, setNetCarbsOverride] = useState(null);
  const [classifying, setClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState("");
  const [basalDose, setBasalDose] = useState("");
  const [bolusGiven, setBolusGiven] = useState("");
  const [notes, setNotes] = useState("");

  const [predictedGlucose, setPredictedGlucose] = useState(null);
  const [predictionReferences, setPredictionReferences] = useState([]);
  const [predicting, setPredicting] = useState(false);

  // College menu editor inside modal
  const [editingMenu, setEditingMenu] = useState(false);
  const [menuEditText, setMenuEditText] = useState("");

  const isEditing = !!initialLog;

  // Auto-set current day of week on open
  useEffect(() => {
    if (!open) return;
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = days[new Date().getDay()];
    setSelectedDay(todayName);
    setMenuSourceDay(todayName);

    if (initialLog) {
      setDatetime(mytDatetimeLocalValue(initialLog.datetime));
      setGlucoseInput(initialLog.glucose != null ? String(fromMmol(initialLog.glucose, unit)) : "");
      setReadingType(initialLog.readingType);
      setMealType(initialLog.mealType || "Breakfast");
      setFood(initialLog.food || "");
      setComponents(initialLog.components || []);
      setNetCarbsOverride(initialLog.components && initialLog.components.length ? null : (initialLog.netCarbs || 0));
      setIsCustomFood(true);
      setClassifying(false);
      setClassifyError("");
      setBasalDose(initialLog.basalDose != null ? String(initialLog.basalDose) : "");
      setBolusGiven(initialLog.bolusGiven != null ? String(initialLog.bolusGiven) : "");
      setNotes(initialLog.notes || "");
      setPredictedGlucose(initialLog.predictedGlucose ?? null);
      setPredictionReferences([]);
    } else {
      setDatetime(mytDatetimeLocalValue());
      setGlucoseInput("");
      setReadingType("Post-Meal");
      setMealType("Breakfast");
      setIsCustomFood(false);
      const initialPreset = collegeMenu[todayName]?.[mealType] || "";
      setFood(initialPreset);
      setComponents([]);
      setNetCarbsOverride(null);
      setClassifying(false);
      setClassifyError("");
      setBasalDose("");
      setBolusGiven("");
      setNotes("");
      setPredictedGlucose(null);
      setPredictionReferences([]);
    }
  }, [open, initialLog, unit, collegeMenu]);

  // Update food when preset day or mealType changes (if not in custom mode)
  useEffect(() => {
    if (!open || isEditing || isCustomFood) return;
    const preset = collegeMenu[menuSourceDay]?.[mealType] || "";
    setFood(preset);
  }, [menuSourceDay, mealType, open, isEditing, isCustomFood, collegeMenu]);

  if (!open) return null;

  const glucoseMmol = glucoseInput ? toMmol(parseFloat(glucoseInput), unit) : null;
  const netCarbs = netCarbsOverride !== null ? netCarbsOverride : components.reduce((s, c) => s + (c.classification === "Carbohydrate" ? Number(c.carbs_g) || 0 : 0), 0);
  const basalSuggestion = readingType === "Fasting" && glucoseMmol != null ? suggestBasal(glucoseMmol, settings.basalTiers) : null;
  const bolusPreview = readingType === "Post-Meal" ? calcBolus(glucoseMmol ?? (predictedGlucose ?? (settings.targetLow + settings.targetHigh) / 2), settings, netCarbs) : null;

  async function handleClassify() {
    if (!food.trim()) return;
    setClassifying(true);
    setClassifyError("");
    try {
      const comps = await classifyFoodWithAI(food);
      setComponents(comps);
      setNetCarbsOverride(null);
    } catch (e) {
      setComponents(offlineClassify(food));
      setNetCarbsOverride(null);
      setClassifyError(`AI classifier fallback loaded (${e.message}).`);
    } finally {
      setClassifying(false);
    }
  }

  async function handlePredictGlucose() {
    setPredicting(true);
    try {
      const res = await getGlucosePrediction(netCarbs, glucoseMmol, food, settings, logs, readingType, mealType);
      if (res && res.predicted_glucose !== undefined) {
        setPredictedGlucose(res.predicted_glucose);
        setPredictionReferences(res.references || []);
      }
    } catch (err) {
      console.error("Prediction error:", err);
    } finally {
      setPredicting(false);
    }
  }

  function updateComponent(i, key, val) {
    setComponents((cs) => cs.map((c, idx) => (idx === i ? { ...c, [key]: val } : c)));
  }
  function removeComponent(i) {
    setComponents((cs) => cs.filter((_, idx) => idx !== i));
  }
  function addComponent() {
    setComponents((cs) => [...cs, { name: "", classification: "Carbohydrate", carbs_g: 25 }]);
  }

  async function handleSave() {
    let finalPredicted = predictedGlucose;
    let finalRefs = predictionReferences;
    if (finalPredicted == null && (food.trim() || netCarbs > 0 || readingType === "Fasting")) {
      try {
        const res = await getGlucosePrediction(netCarbs, glucoseMmol, food, settings, logs, readingType, mealType);
        if (res && res.predicted_glucose !== undefined) {
          finalPredicted = res.predicted_glucose;
          finalRefs = res.references || [];
        }
      } catch (e) {
        finalPredicted = 7.0;
      }
    }

    const finalGlucose = glucoseMmol != null ? glucoseMmol : null;
    const finalDatetime = isEditing ? new Date().toISOString() : mytLocalStringToISO(datetime);

    onSave({
      id: isEditing ? initialLog.id : uid(),
      datetime: finalDatetime,
      glucose: finalGlucose,
      predictedGlucose: finalPredicted,
      predictionReferences: finalRefs,
      readingType,
      mealType: readingType === "Post-Meal" ? mealType : null,
      food: food.trim(),
      components,
      netCarbs,
      basalDose: basalDose !== "" ? parseFloat(basalDose) : (readingType === "Fasting" && basalSuggestion ? basalSuggestion.dose : null),
      bolusGiven: bolusGiven !== "" ? parseFloat(bolusGiven) : null,
      notes: notes.trim(),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(16,24,32,0.45)", backdropFilter: "blur(2px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="gt-body w-full max-w-lg rounded-2xl overflow-y-auto gt-scroll shadow-2xl border gt-modal-anim max-h-[95vh]" style={{ background: C.surface, borderColor: C.line }}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b" style={{ background: C.surface, borderColor: C.line }}>
          <h2 className="gt-display text-base font-bold" style={{ color: C.ink }}>{isEditing ? "Edit Log Entry" : "New College Meal Log"}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/[0.04] transition-colors"><X size={18} color={C.muted} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Date & Time (Malaysia, MYT)">
              <div className="flex gap-1.5">
                <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} style={inputStyle} />
                <button type="button" onClick={() => setDatetime(mytDatetimeLocalValue())} className="px-3 rounded-xl text-xs font-semibold shrink-0 shadow-xs" style={{ background: C.accentSoft, color: C.accentDark }}>Now</button>
              </div>
            </Field>
            <Field label={`Actual Glucose (${unitLabel(unit)})`} hint="Leave blank when logging food before reading">
              <input type="number" step="0.1" value={glucoseInput} onChange={(e) => setGlucoseInput(e.target.value)} placeholder="e.g. 6.1 (optional)" style={inputStyle} />
            </Field>
          </div>

          <Field label="Reading Type">
            <div className="flex gap-2">
              {["Fasting", "Post-Meal"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setReadingType(t)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all shadow-xs"
                  style={readingType === t ? { background: C.accentSoft, borderColor: C.accent, color: C.accentDark } : { borderColor: C.line, color: C.muted }}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          {readingType === "Post-Meal" && (
            <>
              <Field label="Meal Type">
                <div className="flex gap-2 flex-wrap">
                  {["Breakfast", "Lunch", "Dinner", "Snack"].map((m) => {
                    const mc = MEAL_COLORS[m];
                    const active = mealType === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setMealType(m);
                          if (!isCustomFood) {
                            setFood(collegeMenu[menuSourceDay]?.[m] || "");
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-xs"
                        style={active ? { background: mc.bg, borderColor: mc.fg, color: mc.fg } : { borderColor: C.line, color: C.muted }}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {/* College Menu Selection Helper */}
              <div className="p-3.5 rounded-xl border space-y-3" style={{ background: C.bg, borderColor: C.line }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: C.accentDark }}>
                    <BookOpen size={14} /> College Preset Menu (Select Day)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMenu(!editingMenu);
                      setMenuEditText(collegeMenu[menuSourceDay]?.[mealType] || "");
                    }}
                    className="text-[11px] font-semibold underline"
                    style={{ color: C.accent }}
                  >
                    {editingMenu ? "Close Editor" : "Edit This Preset"}
                  </button>
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-1 gt-scroll">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setMenuSourceDay(d);
                        setIsCustomFood(false);
                        setFood(collegeMenu[d]?.[mealType] || "");
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border"
                      style={menuSourceDay === d && !isCustomFood ? { background: C.accent, color: "#fff", borderColor: C.accent } : { background: C.surface, color: C.muted, borderColor: C.line }}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                {!editingMenu ? (
                  <div className="text-xs font-medium p-2.5 rounded-lg border bg-white" style={{ borderColor: C.line, color: C.ink }}>
                    <span className="font-bold mr-1">Selected ({menuSourceDay} {mealType}):</span>
                    {collegeMenu[menuSourceDay]?.[mealType] || "No preset meal set."}
                    <button
                      type="button"
                      onClick={() => {
                        setFood(collegeMenu[menuSourceDay]?.[mealType] || "");
                        setIsCustomFood(false);
                      }}
                      className="mt-2 block w-full py-1.5 rounded-lg text-xs font-bold text-white shadow-xs text-center"
                      style={{ background: C.accent }}
                    >
                      Use This Preset
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-semibold" style={{ color: C.muted }}>Modify preset for {menuSourceDay} - {mealType}:</span>
                    <input
                      type="text"
                      value={menuEditText}
                      onChange={(e) => setMenuEditText(e.target.value)}
                      style={{ ...inputStyle, fontSize: 13 }}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateCollegeMenu(menuSourceDay, mealType, menuEditText);
                          setFood(menuEditText);
                          setEditingMenu(false);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                        style={{ background: C.accent }}
                      >
                        Save Preset & Use
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingMenu(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white"
                        style={{ borderColor: C.line, color: C.muted }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <Field label="Food Description (Eaten)" hint="Select from college presets above, or type manually / eat out.">
            <textarea
              value={food}
              onChange={(e) => { setFood(e.target.value); setIsCustomFood(true); }}
              rows={2}
              placeholder="e.g. 1 bowl nasi lemak, eggs, kacang..."
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>

          <button
            type="button"
            onClick={handleClassify}
            disabled={!food.trim() || classifying}
            className="w-full rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs transition-transform active:scale-[0.99]"
            style={{ background: C.accent, color: "#fff" }}
          >
            {classifying ? <Loader2 size={15} className="gt-spin" /> : <Sparkles size={15} />}
            {classifying ? "Analyzing food components..." : "Classify with AI"}
          </button>

          {classifyError && (
            <div className="flex items-start gap-1.5 text-xs" style={{ color: C.warn }}>
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{classifyError}</span>
            </div>
          )}

          {components.length > 0 && (
            <div className="space-y-2 p-3.5 rounded-xl border shadow-inner" style={{ background: C.bg, borderColor: C.line }}>
              <div className="text-xs font-bold mb-1 uppercase tracking-wide" style={{ color: C.muted }}>Detected Components</div>
              {components.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={c.name} onChange={(e) => updateComponent(i, "name", e.target.value)} placeholder="Component name" style={{ ...inputStyle, flex: 1, padding: "8px 10px", fontSize: 13 }} />
                  <button
                    type="button"
                    onClick={() => updateComponent(i, "classification", c.classification === "Carbohydrate" ? "Non-Carbohydrate" : "Carbohydrate")}
                    className="px-2.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shadow-xs"
                    style={{ color: c.classification === "Carbohydrate" ? C.carb : C.noncarb, background: c.classification === "Carbohydrate" ? C.carbSoft : C.noncarbSoft }}
                  >
                    {c.classification === "Carbohydrate" ? "Carb" : "Non-carb"}
                  </button>
                  <input type="number" value={c.carbs_g} onChange={(e) => updateComponent(i, "carbs_g", e.target.value)} style={{ ...inputStyle, width: 68, padding: "8px 8px", fontSize: 13 }} />
                  <span className="text-xs font-bold" style={{ color: C.faint }}>g</span>
                  <button type="button" onClick={() => removeComponent(i)} className="p-1.5 rounded-lg hover:bg-black/[0.05]"><X size={14} color={C.faint} /></button>
                </div>
              ))}
              <button type="button" onClick={addComponent} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg hover:bg-black/[0.04]" style={{ color: C.accentDark }}>
                <Plus size={13} /> Add component
              </button>
            </div>
          )}

          <Field label="Net Carbs (g)" hint="Auto-calculated from carbohydrate components. Override if necessary.">
            <input type="number" value={netCarbs} onChange={(e) => setNetCarbsOverride(parseFloat(e.target.value) || 0)} style={inputStyle} />
          </Field>

          {/* AI Glucose Forecaster with Reference Sources */}
          <div className="p-4 rounded-xl border shadow-xs space-y-2.5" style={{ background: C.bg, borderColor: C.line }}>
            <div className="flex items-center justify-between">
              <span className="gt-body text-xs font-bold uppercase tracking-wider" style={{ color: C.ink }}>AI Glucose Forecaster & References</span>
              <button
                type="button"
                onClick={handlePredictGlucose}
                disabled={predicting}
                className="px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-white disabled:opacity-40 shadow-xs"
                style={{ background: C.accent }}
              >
                {predicting ? <Loader2 size={13} className="gt-spin" /> : <Sparkles size={13} />} Predict Reading
              </button>
            </div>
            {predictedGlucose !== null ? (
              <div className="space-y-1.5">
                <div className="gt-mono text-sm font-bold" style={{ color: C.accentDark }}>
                  Predicted Reading: {fromMmol(predictedGlucose, unit)} {unitLabel(unit)}
                </div>
                {predictionReferences.length > 0 && (
                  <div className="text-[11px] rounded-lg p-2.5 border bg-white space-y-1" style={{ borderColor: C.line, color: C.muted }}>
                    <span className="font-bold block text-slate-700">Reference Sources Used:</span>
                    {predictionReferences.map((ref, idx) => (
                      <div key={idx} className="flex items-start gap-1">
                        <span className="text-teal-600 font-bold">•</span>
                        <span>{ref}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="gt-body text-xs" style={{ color: C.faint }}>
                Click "Predict Reading" to view expected glucose along with exact historical and model references.
              </div>
            )}
          </div>

          {readingType === "Fasting" ? (
            <Field label="Basal Insulin Dose (U)" hint={basalSuggestion ? `Suggested from tiers: ${basalSuggestion.dose} U${basalSuggestion.note ? " (Note: out of range)" : ""}` : "Enter glucose reading to calculate suggestion."}>
              <input type="number" step="0.5" value={basalDose} onChange={(e) => setBasalDose(e.target.value)} placeholder={basalSuggestion ? String(basalSuggestion.dose) : ""} style={inputStyle} />
            </Field>
          ) : (
            <Field label="Bolus Given (U)" hint={bolusPreview ? `Suggested: ${round1(bolusPreview.total)} U (${round1(bolusPreview.correction)} correction + ${round1(bolusPreview.carbBolus)} carb)` : "Enter or predict glucose reading to calculate suggestion."}>
              <input type="number" step="0.5" value={bolusGiven} onChange={(e) => setBolusGiven(e.target.value)} placeholder={bolusPreview ? String(round1(bolusPreview.total)) : ""} style={inputStyle} />
            </Field>
          )}

          <Field label="Notes">
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional observations or symptoms" style={inputStyle} />
          </Field>

          <button onClick={handleSave} className="w-full rounded-xl py-3 text-sm font-bold shadow-md transition-transform active:scale-[0.99]" style={{ background: C.ink, color: "#fff" }}>
            {isEditing ? "Save Changes" : "Save Entry"}
          </button>

          {isEditing && (
            <button
              onClick={() => { onDelete(initialLog.id); onClose(); }}
              className="w-full rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors hover:bg-red-50"
              style={{ borderColor: C.line, color: C.hypo }}
            >
              <Trash2 size={14} /> Delete Entry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toolbar Component                                                   */
/* ------------------------------------------------------------------ */
function Toolbar({ role, onAdd, onExport, monthLabel }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between gap-3">
      <div>
        <h2 className="gt-display text-sm font-bold uppercase tracking-wider" style={{ color: C.muted }}>{monthLabel} · Newest First</h2>
        <p className="gt-body text-[11px] mt-0.5" style={{ color: C.faint }}>Current month active view — past entries archive automatically.</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onExport} className="inline-flex items-center gap-1.5 text-xs font-semibold gt-body px-3.5 py-2 rounded-xl border shadow-xs transition-colors hover:bg-black/[0.02]" style={{ borderColor: C.line, color: C.ink }}>
          <Download size={14} /> Export CSV
        </button>
        {role === "patient" && (
          <button onClick={onAdd} className="inline-flex items-center gap-1.5 text-xs font-bold gt-body px-4 py-2 rounded-xl shadow-md transition-transform active:scale-[0.98]" style={{ background: C.accent, color: "#fff" }}>
            <Plus size={15} /> Add Entry
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings Page                                                       */
/* ------------------------------------------------------------------ */
function SettingsPage({ settings, setSettings, logs, familyEmails, setFamilyEmails, showToast, onResetData, penRemaining, penUsedSinceBaseline, collegeMenu, onUpdateCollegeMenu }) {
  const [newEmail, setNewEmail] = useState("");
  const [inviteLink] = useState(`https://glucotrack.app/share/${uid()}`);
  const [adjustValue, setAdjustValue] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [selectedConfigDay, setSelectedConfigDay] = useState("Monday");

  function update(key, val) { setSettings((s) => ({ ...s, [key]: val })); }
  function updateTier(id, key, val) { setSettings((s) => ({ ...s, basalTiers: s.basalTiers.map((t) => (t.id === id ? { ...t, [key]: parseFloat(val) || 0 } : t)) })); }
  function addTier() { setSettings((s) => { const last = s.basalTiers[s.basalTiers.length - 1] || { high: 7, dose: 12 }; return { ...s, basalTiers: [...s.basalTiers, { id: uid(), low: last.high, high: last.high + 1, dose: last.dose + 2 }] }; }); }
  function removeTier(id) { setSettings((s) => ({ ...s, basalTiers: s.basalTiers.filter((t) => t.id !== id) })); }
  function addEmail() { if (!newEmail.trim() || !newEmail.includes("@")) return; setFamilyEmails((e) => [...e, newEmail.trim()]); setNewEmail(""); showToast(`Invite sent to ${newEmail.trim()}`); }
  function copyLink() { navigator.clipboard?.writeText(inviteLink).catch(() => {}); showToast("Invite link copied to clipboard"); }
  function applyAdjust() {
    const val = parseFloat(adjustValue);
    if (isNaN(val) || val < 0) return;
    setSettings((s) => ({ ...s, penBaselineRemaining: val, penBaselineDate: new Date().toISOString() }));
    setAdjustValue("");
    showToast(`Pen level calibrated to ${val} U`);
  }
  function startNewPen() {
    setSettings((s) => ({ ...s, penBaselineRemaining: s.penCapacity, penBaselineDate: new Date().toISOString() }));
    showToast("New insulin pen started — counter reset to full");
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 gt-body space-y-6">
      <div>
        <h1 className="gt-display text-2xl font-bold mb-1" style={{ color: C.ink }}>Settings & Configuration</h1>
        <p className="text-sm" style={{ color: C.muted }}>Manage clinical target ranges, dosing formulas, college menus, and insulin pens.</p>
      </div>

      {/* College Weekly Menu Management */}
      <section className="rounded-2xl p-6 shadow-xs border" style={{ background: C.surface, borderColor: C.line }}>
        <h3 className="gt-display text-base font-bold mb-1" style={{ color: C.ink }}>College Weekly Menu Presets</h3>
        <p className="text-xs mb-4" style={{ color: C.muted }}>Modify standard daily meals served at college so they auto-fill correctly when logging.</p>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 gt-scroll">
          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedConfigDay(d)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border"
              style={selectedConfigDay === d ? { background: C.accent, color: "#fff", borderColor: C.accent } : { background: C.bg, color: C.muted, borderColor: C.line }}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="space-y-3 p-4 rounded-xl border" style={{ background: C.bg, borderColor: C.line }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.accentDark }}>{selectedConfigDay} Meals</div>
          {["Breakfast", "Lunch", "Dinner"].map((mType) => {
            const val = collegeMenu[selectedConfigDay]?.[mType] || "";
            return (
              <Field key={mType} label={mType}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    defaultValue={val}
                    onBlur={(e) => onUpdateCollegeMenu(selectedConfigDay, mType, e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </Field>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl p-6 shadow-xs border" style={{ background: C.surface, borderColor: C.line }}>
        <h3 className="gt-display text-base font-bold mb-4" style={{ color: C.ink }}>Medical Parameters</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Target Fasting Glucose — Low (mmol/L)"><input type="number" step="0.1" value={settings.targetLow} onChange={(e) => update("targetLow", parseFloat(e.target.value))} style={inputStyle} /></Field>
          <Field label="Target Fasting Glucose — High (mmol/L)"><input type="number" step="0.1" value={settings.targetHigh} onChange={(e) => update("targetHigh", parseFloat(e.target.value))} style={inputStyle} /></Field>
          <Field label="Hypoglycemia Threshold (mmol/L)" hint="Readings below this are highlighted red."><input type="number" step="0.1" value={settings.hypoThreshold} onChange={(e) => update("hypoThreshold", parseFloat(e.target.value))} style={inputStyle} /></Field>
          <Field label="Post-Meal High Threshold (mmol/L)" hint="Readings above this are highlighted dark blue."><input type="number" step="0.1" value={settings.postMealHigh} onChange={(e) => update("postMealHigh", parseFloat(e.target.value))} style={inputStyle} /></Field>
          <Field label="Carb-to-Insulin Ratio (CIR) (g / U)"><input type="number" step="1" value={settings.cir} onChange={(e) => update("cir", parseFloat(e.target.value))} style={inputStyle} /></Field>
          <Field label="Insulin Sensitivity Factor (ISF) (mmol/L / U)"><input type="number" step="0.1" value={settings.isf} onChange={(e) => update("isf", parseFloat(e.target.value))} style={inputStyle} /></Field>
        </div>
      </section>

      <section className="rounded-2xl p-6 shadow-xs border" style={{ background: C.surface, borderColor: C.line }}>
        <h3 className="gt-display text-base font-bold mb-1" style={{ color: C.ink }}>Basal Dosing Tiers</h3>
        <p className="text-xs mb-4" style={{ color: C.muted }}>Determines basal night doses automatically from morning fasting readings.</p>
        <div className="space-y-2.5">
          {settings.basalTiers.map((t) => (
            <div key={t.id} className="flex items-center gap-2 flex-wrap p-2 rounded-xl border shadow-xs" style={{ background: C.bg, borderColor: C.line }}>
              <span className="text-xs font-semibold" style={{ color: C.muted }}>If fasting</span>
              <input type="number" step="0.1" value={t.low} onChange={(e) => updateTier(t.id, "low", e.target.value)} style={{ ...inputStyle, width: 72, padding: "6px 8px" }} />
              <span className="text-xs" style={{ color: C.muted }}>to</span>
              <input type="number" step="0.1" value={t.high} onChange={(e) => updateTier(t.id, "high", e.target.value)} style={{ ...inputStyle, width: 72, padding: "6px 8px" }} />
              <span className="text-xs font-semibold" style={{ color: C.muted }}>mmol/L →</span>
              <input type="number" step="0.5" value={t.dose} onChange={(e) => updateTier(t.id, "dose", e.target.value)} style={{ ...inputStyle, width: 72, padding: "6px 8px" }} />
              <span className="text-xs font-semibold" style={{ color: C.muted }}>U</span>
              <button onClick={() => removeTier(t.id)} className="ml-auto p-1.5 rounded-lg hover:bg-black/[0.05]"><Trash2 size={15} color={C.hypo} /></button>
            </div>
          ))}
        </div>
        <button onClick={addTier} className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border shadow-xs hover:bg-black/[0.02]" style={{ borderColor: C.line, color: C.accentDark }}>
          <Plus size={14} /> Add Dosing Tier
        </button>
      </section>

      <section className="rounded-2xl p-6 shadow-xs border" style={{ background: C.surface, borderColor: C.line }}>
        <h3 className="gt-display text-base font-bold mb-4" style={{ color: C.ink }}>Insulin Pen Tracker</h3>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <Field label="Pen Capacity (Units)"><input type="number" value={settings.penCapacity} onChange={(e) => update("penCapacity", parseFloat(e.target.value) || 0)} style={inputStyle} /></Field>
          <div>
            <span className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>Estimated Remaining</span>
            <div className="gt-mono text-xl font-bold" style={{ color: C.ink }}>{Math.max(0, Math.round(penRemaining))} U <span className="text-xs font-normal" style={{ color: C.faint }}>of {settings.penCapacity} U</span></div>
            <div className="gt-body text-[11px] mt-0.5" style={{ color: C.faint }}>{penUsedSinceBaseline} U used since calibration</div>
          </div>
        </div>
        <div className="w-full h-2 rounded-full mb-5 overflow-hidden shadow-inner" style={{ background: C.lineSoft }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, (penRemaining / settings.penCapacity) * 100))}%`, background: penRemaining / settings.penCapacity < 0.15 ? C.warn : C.accent }} />
        </div>

        <div className="p-4 rounded-xl border mb-3.5 shadow-inner" style={{ background: C.bg, borderColor: C.line }}>
          <div className="text-xs font-bold mb-2" style={{ color: C.ink }}>Calibrate Pen Level</div>
          <div className="flex items-center gap-2">
            <input type="number" step="1" value={adjustValue} onChange={(e) => setAdjustValue(e.target.value)} placeholder={`e.g. 150`} style={{ ...inputStyle, flex: 1 }} />
            <span className="text-xs font-semibold shrink-0" style={{ color: C.muted }}>Units left</span>
            <button onClick={applyAdjust} className="px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 shadow-xs text-white" style={{ background: C.ink }}>Calibrate</button>
          </div>
        </div>
        <button onClick={startNewPen} className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl border shadow-xs hover:bg-black/[0.02]" style={{ borderColor: C.line, color: C.ink }}>
          <PenTool size={14} /> Start New Pen (Reset Full)
        </button>
      </section>

      <section className="rounded-2xl p-6 shadow-xs border" style={{ background: C.surface, borderColor: C.line }}>
        <h3 className="gt-display text-base font-bold mb-1" style={{ color: C.ink }}>Family View Access</h3>
        <p className="text-xs mb-4" style={{ color: C.muted }}>Share a read-only secure link with family members or caregivers.</p>
        <div className="flex items-center gap-2 mb-3.5 p-3 rounded-xl border shadow-inner" style={{ background: C.bg, borderColor: C.line }}>
          <LinkIcon size={15} color={C.muted} />
          <span className="gt-mono text-xs truncate flex-1 font-medium" style={{ color: C.muted }}>{inviteLink}</span>
          <button onClick={copyLink} className="p-2 rounded-lg hover:bg-black/[0.05] transition-colors"><Copy size={15} color={C.accentDark} /></button>
        </div>
        <div className="flex gap-2 mb-3.5">
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="caregiver@email.com" style={inputStyle} />
          <button onClick={addEmail} className="px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs text-white" style={{ background: C.accent }}>
            <Mail size={14} /> Invite
          </button>
        </div>
        {familyEmails.length > 0 && (
          <div className="space-y-2">
            {familyEmails.map((em) => (
              <div key={em} className="flex items-center justify-between text-xs font-medium px-3.5 py-2.5 rounded-xl border shadow-xs" style={{ background: C.bg, borderColor: C.line }}>
                <span style={{ color: C.ink }}>{em}</span>
                <button onClick={() => setFamilyEmails((es) => es.filter((x) => x !== em))} className="p-1 rounded-lg hover:bg-black/[0.05]"><X size={14} color={C.faint} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl p-6 shadow-xs border" style={{ background: C.surface, borderColor: C.line }}>
        <h3 className="gt-display text-base font-bold mb-1" style={{ color: C.ink }}>Data Management</h3>
        <p className="text-xs mb-4" style={{ color: C.muted }}>Your records are synchronized live via Firebase Firestore.</p>
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border shadow-xs hover:bg-red-50 transition-colors" style={{ borderColor: C.line, color: C.hypo }}>
            <RotateCcw size={14} /> Reset All Data & Settings
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap p-4 rounded-xl border shadow-inner bg-red-50" style={{ borderColor: "#FCA5A5" }}>
            <span className="text-xs font-bold text-red-700">Delete all logs and settings permanently?</span>
            <button onClick={() => { onResetData(); setConfirmReset(false); }} className="px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs text-white" style={{ background: C.hypo }}>Yes, Reset</button>
            <button onClick={() => setConfirmReset(false)} className="px-3 py-1.5 rounded-xl text-xs font-semibold border bg-white" style={{ borderColor: C.line, color: C.muted }}>Cancel</button>
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* History Views (Month & Year Panels)                                 */
/* ------------------------------------------------------------------ */
function MonthPanel({ monthKeyValue, logs, unit, settings, expandedId, setExpandedId, role, onDelete, onEdit, onOpenDay, onExport }) {
  const [open, setOpen] = useState(false);
  const sorted = [...logs].sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
  const validGlucoseLogs = sorted.filter(l => l.glucose != null);
  const avg = validGlucoseLogs.length ? validGlucoseLogs.reduce((s, l) => s + l.glucose, 0) / validGlucoseLogs.length : 0;
  const totalBasal = sorted.reduce((s, l) => s + (l.basalDose || 0), 0);

  return (
    <div className="rounded-2xl overflow-hidden shadow-xs border transition-all" style={{ background: C.surface, borderColor: C.line }}>
      <div className="w-full flex items-center justify-between px-5 py-3.5 gt-body">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 text-left flex-1 hover:opacity-80 transition-opacity">
          {open ? <ChevronDown size={16} color={C.muted} /> : <ChevronRight size={16} color={C.muted} />}
          <span className="text-sm font-bold" style={{ color: C.ink }}>{monthLabelOf(monthKeyValue)}</span>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs gt-mono hidden sm:inline" style={{ color: C.faint }}>
            {sorted.length} entries {validGlucoseLogs.length ? `· Avg ${fromMmol(avg, unit)} ${unitLabel(unit)}` : ""} · {totalBasal}U basal
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onExport(sorted, `glucotrack_${monthKeyValue}`); }}
            title="Export month data to CSV"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border shadow-xs hover:bg-black/[0.03] transition-colors shrink-0"
            style={{ borderColor: C.line, color: C.ink }}
          >
            <Download size={13} /> Export Month
          </button>
        </div>
      </div>
      {open && (
        <div className="p-4" style={{ background: C.bg, borderTop: `1px solid ${C.line}` }}>
          <DataGrid logs={sorted} unit={unit} settings={settings} expandedId={expandedId} setExpandedId={setExpandedId} role={role} onDelete={onDelete} onEdit={onEdit} onOpenDay={onOpenDay} />
        </div>
      )}
    </div>
  );
}

function YearPanel({ year, months, unit, settings, expandedId, setExpandedId, role, onDelete, onEdit, onOpenDay, defaultOpen, onExport }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const monthKeys = Object.keys(months).sort().reverse();
  const allLogs = monthKeys.flatMap((mk) => months[mk]);
  const validGlucoseLogs = allLogs.filter(l => l.glucose != null);
  const avg = validGlucoseLogs.length ? validGlucoseLogs.reduce((s, l) => s + l.glucose, 0) / validGlucoseLogs.length : 0;

  return (
    <div className="mb-5">
      <div className="w-full flex items-center justify-between px-2 py-2.5 gt-body border-b mb-3" style={{ borderColor: C.line }}>
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-left flex-1 hover:opacity-80 transition-opacity">
          {open ? <ChevronDown size={18} color={C.ink} /> : <ChevronRight size={18} color={C.ink} />}
          <span className="gt-display text-lg font-bold" style={{ color: C.ink }}>{year}</span>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs gt-mono hidden sm:inline font-medium" style={{ color: C.faint }}>
            {allLogs.length} entries {validGlucoseLogs.length ? `· Year avg ${fromMmol(avg, unit)} ${unitLabel(unit)}` : ""}
          </span>
          <button
            onClick={() => onExport(allLogs, `glucotrack_${year}`)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-xl border shadow-xs hover:bg-black/[0.03] transition-colors shrink-0"
            style={{ borderColor: C.line, color: C.ink }}
          >
            <Download size={14} /> Export Year ({year})
          </button>
        </div>
      </div>
      {open && (
        <div className="space-y-3 pl-1 sm:pl-2">
          {monthKeys.map((mk) => (
            <MonthPanel key={mk} monthKeyValue={mk} logs={months[mk]} unit={unit} settings={settings} expandedId={expandedId} setExpandedId={setExpandedId} role={role} onDelete={onDelete} onEdit={onEdit} onOpenDay={onOpenDay} onExport={onExport} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryPage({ logs, unit, settings, expandedId, setExpandedId, role, onDelete, onEdit, onOpenDay, onExport }) {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-5 border-b" style={{ borderColor: C.line }}>
        <div>
          <h1 className="gt-display text-2xl font-bold mb-1" style={{ color: C.ink }}>History & Archives</h1>
          <p className="text-sm" style={{ color: C.muted }}>Past months are archived automatically and categorized by year.</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => onExport(past, "glucotrack_archived_history")}
            disabled={!past.length}
            className="inline-flex items-center gap-2 text-xs font-semibold gt-body px-4 py-2.5 rounded-xl border shadow-xs hover:bg-black/[0.02] disabled:opacity-40 transition-colors"
            style={{ borderColor: C.line, color: C.ink }}
          >
            <Download size={15} /> Export Archived History ({past.length})
          </button>
          <button
            onClick={() => onExport(logs, "glucotrack_complete_database")}
            disabled={!logs.length}
            className="inline-flex items-center gap-2 text-xs font-bold gt-body px-4 py-2.5 rounded-xl text-white shadow-md disabled:opacity-40 transition-transform active:scale-[0.98]"
            style={{ background: C.accent }}
          >
            <Download size={15} /> Export Complete Database ({logs.length})
          </button>
        </div>
      </div>

      {years.length === 0 ? (
        <div className="text-center py-24 rounded-2xl border border-dashed" style={{ borderColor: C.line, background: C.surface }}>
          <CalendarIcon size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold" style={{ color: C.muted }}>No archived past months yet.</p>
          <p className="text-xs mt-1" style={{ color: C.faint }}>When a new calendar month begins, previous months will appear here.</p>
        </div>
      ) : (
        years.map((y, i) => (
          <YearPanel key={y} year={y} months={byYear[y]} unit={unit} settings={settings} expandedId={expandedId} setExpandedId={setExpandedId} role={role} onDelete={onDelete} onEdit={onEdit} onOpenDay={onOpenDay} defaultOpen={i === 0} onExport={onExport} />
        ))
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main GlucoTrackApp Component                                        */
/* ------------------------------------------------------------------ */
export default function GlucoTrackApp() {
  const [screen, setScreen] = useState("login");
  const [role, setRole] = useState("patient");
  const [tab, setTab] = useState("dashboard");
  const [unit, setUnit] = useState("mmol");
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [familyEmails, setFamilyEmails] = useState([]);
  const [collegeMenu, setCollegeMenu] = useState(() => storageGet(K_COLLEGE_MENU, DEFAULT_COLLEGE_MENU));

  const [expandedId, setExpandedId] = useState(null);
  const [dayViewDate, setDayViewDate] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [toast, setToast] = useState("");
  const [loaded, setLoaded] = useState(false);
  const toastTimer = useRef(null);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }

  useEffect(() => {
    const unsubLogs = subscribeToDoc("glucotrack/logs", (remoteLogs) => {
      if (remoteLogs !== null) {
        setLogs(remoteLogs);
        storageSet(K_LOGS, remoteLogs);
      } else {
        const local = storageGet(K_LOGS) || seedLogs();
        setLogs(local);
        saveToDoc("glucotrack/logs", local);
      }
      setLoaded(true);
    });

    const unsubSettings = subscribeToDoc("glucotrack/settings", (remoteSettings) => {
      if (remoteSettings !== null) {
        setSettings(remoteSettings);
        storageSet(K_SETTINGS, remoteSettings);
      } else {
        const local = storageGet(K_SETTINGS) || defaultSettings();
        setSettings(local);
        saveToDoc("glucotrack/settings", local);
      }
    });

    const unsubEmails = subscribeToDoc("glucotrack/family_emails", (remoteEmails) => {
      if (remoteEmails !== null) {
        setFamilyEmails(remoteEmails);
        storageSet(K_EMAILS, remoteEmails);
      } else {
        const local = storageGet(K_EMAILS) || [];
        setFamilyEmails(local);
        saveToDoc("glucotrack/family_emails", local);
      }
    });

    return () => {
      unsubLogs();
      unsubSettings();
      unsubEmails();
    };
  }, []);

  function handleSaveLogs(newLogs) {
    setLogs(newLogs);
    storageSet(K_LOGS, newLogs);
    saveToDoc("glucotrack/logs", newLogs);
  }

  function handleSaveSettings(newSettings) {
    const updated = typeof newSettings === "function" ? newSettings(settings) : newSettings;
    setSettings(updated);
    storageSet(K_SETTINGS, updated);
    saveToDoc("glucotrack/settings", updated);
  }

  function handleSaveEmails(newEmails) {
    const updated = typeof newEmails === "function" ? newEmails(familyEmails) : newEmails;
    setFamilyEmails(updated);
    storageSet(K_EMAILS, updated);
    saveToDoc("glucotrack/family_emails", updated);
  }

  function handleUpdateCollegeMenu(day, meal, text) {
    const updated = {
      ...collegeMenu,
      [day]: {
        ...collegeMenu[day],
        [meal]: text
      }
    };
    setCollegeMenu(updated);
    storageSet(K_COLLEGE_MENU, updated);
    showToast(`Updated college menu for ${day} ${meal}`);
  }

  const { penRemaining, penUsedSinceBaseline } = useMemo(() => {
    const baselineIso = settings.penBaselineDate || new Date(0).toISOString();
    const used = logs
      .filter((l) => new Date(l.datetime) >= new Date(baselineIso))
      .reduce((s, l) => s + (l.basalDose || 0), 0);
    const baselineLevel = settings.penBaselineRemaining ?? settings.penCapacity;
    return { penRemaining: baselineLevel - used, penUsedSinceBaseline: used };
  }, [logs, settings]);

  const currentMk = currentMonthKey();
  const currentMonthLogs = useMemo(() => {
    return logs
      .filter((l) => monthKeyOf(l.datetime) === currentMk)
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
  }, [logs, currentMk]);

  function handleAddOrUpdateLog(entry) {
    const existingIndex = logs.findIndex((l) => l.id === entry.id);
    let updated;
    if (existingIndex >= 0) {
      updated = logs.map((l) => (l.id === entry.id ? entry : l));
      showToast("Log entry successfully updated");
    } else {
      updated = [entry, ...logs];
      showToast("New log entry successfully saved");
    }
    handleSaveLogs(updated);
  }

  function handleDeleteLog(id) {
    const updated = logs.filter((l) => l.id !== id);
    handleSaveLogs(updated);
    showToast("Log entry deleted");
  }

  function handleResetData() {
    const freshLogs = seedLogs();
    const freshSettings = defaultSettings();
    setLogs(freshLogs);
    setSettings(freshSettings);
    setFamilyEmails([]);
    storageSet(K_LOGS, freshLogs);
    storageSet(K_SETTINGS, freshSettings);
    storageSet(K_EMAILS, []);
    saveToDoc("glucotrack/logs", freshLogs);
    saveToDoc("glucotrack/settings", freshSettings);
    saveToDoc("glucotrack/family_emails", []);
    showToast("All data and settings reset successfully");
  }

  const dayViewEntries = useMemo(() => {
    if (!dayViewDate) return [];
    return logs.filter((l) => dayKey(l.datetime) === dayViewDate);
  }, [logs, dayViewDate]);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center gt-body" style={{ background: C.bg }}>
        <div className="flex items-center gap-3">
          <Loader2 size={24} className="gt-spin text-teal-600" />
          <span className="text-sm font-semibold text-slate-700">Loading GlucoTrack...</span>
        </div>
      </div>
    );
  }

  if (screen === "login") {
    return <LoginScreen onSelectRole={(r) => { setRole(r); setScreen("app"); }} />;
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: C.bg, color: C.ink }}>
      {FONTS}
      <Toast toast={toast} />
      <Header role={role} tab={tab} setTab={setTab} unit={unit} setUnit={setUnit} onLogout={() => setScreen("login")} />
      <AIChatbot logs={logs} unit={unit} settings={settings} />

      {tab === "dashboard" && (
        <>
          <SummaryBar logs={currentMonthLogs} unit={unit} settings={settings} penRemaining={penRemaining} />
          <Toolbar role={role} onAdd={() => { setEditingLog(null); setAddOpen(true); }} onExport={(l, fn) => exportCSV(l || currentMonthLogs, unit, fn)} monthLabel={monthLabelOf(currentMk)} />
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <DataGrid
              logs={currentMonthLogs}
              unit={unit}
              settings={settings}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              role={role}
              onDelete={handleDeleteLog}
              onEdit={(log) => { setEditingLog(log); setAddOpen(true); }}
              onOpenDay={(d) => setDayViewDate(d)}
            />
          </div>
        </>
      )}

      {tab === "history" && (
        <HistoryPage
          logs={logs}
          unit={unit}
          settings={settings}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          role={role}
          onDelete={handleDeleteLog}
          onEdit={(log) => { setEditingLog(log); setAddOpen(true); }}
          onOpenDay={(d) => setDayViewDate(d)}
          onExport={(l, fn) => exportCSV(l, unit, fn)}
        />
      )}

      {tab === "settings" && role === "patient" && (
        <SettingsPage
          settings={settings}
          setSettings={handleSaveSettings}
          logs={logs}
          familyEmails={familyEmails}
          setFamilyEmails={handleSaveEmails}
          showToast={showToast}
          onResetData={handleResetData}
          penRemaining={penRemaining}
          penUsedSinceBaseline={penUsedSinceBaseline}
          collegeMenu={collegeMenu}
          onUpdateCollegeMenu={handleUpdateCollegeMenu}
        />
      )}

      <QuickAddPanel
        open={addOpen}
        onClose={() => { setAddOpen(false); setEditingLog(null); }}
        onSave={handleAddOrUpdateLog}
        onDelete={handleDeleteLog}
        settings={settings}
        unit={unit}
        initialLog={editingLog}
        logs={logs}
        collegeMenu={collegeMenu}
        onUpdateCollegeMenu={handleUpdateCollegeMenu}
      />

      <DayViewModal
        dateKeyValue={dayViewDate}
        entries={dayViewEntries}
        unit={unit}
        settings={settings}
        onClose={() => setDayViewDate(null)}
      />
    </div>
  );
}