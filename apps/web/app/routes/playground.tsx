import {
  AlertTriangle,
  Brain,
  CircleDot,
  FlaskConical,
  Radar,
  ScrollText,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { motion } from "motion/react";
import { startTransition, useDeferredValue, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Route } from "./+types/playground";

type NoteSignal = {
  id: string;
  label: string;
  score: number;
  level: string;
};

type HotspotPair = [string, number];

type NoteReport = {
  id: string;
  title: string;
  createdAt: string;
  createdAtLabel: string;
  lang: string;
  tags: string[];
  themes: string[];
  voice: {
    label: string;
    score: number;
  };
  metrics: Record<string, number>;
  hotspots: {
    fillers: HotspotPair[];
    hedges: HotspotPair[];
    vague: HotspotPair[];
    absolutes: HotspotPair[];
    intensity: HotspotPair[];
    selfAttack: HotspotPair[];
    fear: HotspotPair[];
    apology: HotspotPair[];
    audience: HotspotPair[];
    reflection: HotspotPair[];
    action: HotspotPair[];
    structure: HotspotPair[];
    anchors: HotspotPair[];
    negativeOther: HotspotPair[];
  };
  repeatedWords: Array<{ word: string; count: number }>;
  repeatedPhrases: Array<{ phrase: string; count: number }>;
  topWords: Array<{ word: string; count: number }>;
  excerpt: string;
  openingLine: string;
  signals: NoteSignal[];
  strengths: NoteSignal[];
  dominantFinding: string;
  listenerSimulations: Array<{ persona: string; takeaway: string }>;
  coachingMoves: Array<{ title: string; focus: string; when: string }>;
};

type CompositeSummary = {
  id: string;
  label: string;
  description: string;
  average: number;
  median: number;
  p90: number;
  affectedNotes: number;
  examples: Array<{ id: string; title: string; score: number }>;
};

type Report = {
  generatedAt: string;
  source: {
    csvFile: string;
    noteCount: number;
    selfVoiceCount: number;
    mixedVoiceCount: number;
    averageWords: number;
    medianWords: number;
    dateRange: {
      start: string;
      end: string;
    };
  };
  overview: {
    topFindings: Array<{
      id: string;
      label: string;
      average: number;
      affectedNotes: number;
      examples: Array<{ id: string; title: string; score: number }>;
      summary: string;
    }>;
    strengths: Array<{
      id: string;
      label: string;
      summary: string;
      average: number;
    }>;
    dominantThemes: Array<{ theme: string; count: number }>;
    topSelfNotes: Array<{
      id: string;
      title: string;
      score: number;
      dominantSignal: string;
    }>;
  };
  aggregates: {
    composites: CompositeSummary[];
    timeline: Array<{
      bucket: string;
      noteCount: number;
      clarityDrag: number;
      confidenceLeakage: number;
      listenerDrift: number;
      emotionalAmplification: number;
    }>;
    themes: Array<{ theme: string; count: number }>;
    lexicalHotspots: {
      fillers: Array<{ label: string; count: number }>;
      hedges: Array<{ label: string; count: number }>;
      vague: Array<{ label: string; count: number }>;
    };
    voicePurity: {
      self: number;
      mixed: number;
    };
  };
  experiments: {
    active: Array<{
      id: string;
      name: string;
      why: string;
      impact: string;
    }>;
    archived: Array<{
      id: string;
      name: string;
      reason: string;
      archiveFile: string;
    }>;
    research: Array<{
      label: string;
      url: string;
      note: string;
    }>;
  };
  practiceSystems: Array<{
    id: string;
    title: string;
    when: string;
    protocol: string[];
  }>;
  notes: NoteReport[];
};

type LoaderData =
  | {
      status: "missing";
      rebuildCommand: string;
    }
  | {
      status: "ready";
      report: Report;
    };

export function meta() {
  return [
    { title: "Audora Playground | Communication Forensics Lab" },
    {
      name: "description",
      content:
        "A transcript-forensics playground for exploring recurring communication drags, listener friction, and practice systems.",
    },
  ];
}

export const links: Route.LinksFunction = () => [
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
  },
];

export async function loader(): Promise<LoaderData> {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");

  const reportPath = fileURLToPath(
    new URL("../../../../packages/playground/output/latest-analysis.json", import.meta.url)
  );

  try {
    const raw = await readFile(reportPath, "utf8");
    return {
      status: "ready",
      report: JSON.parse(raw) as Report,
    };
  } catch {
    return {
      status: "missing",
      rebuildCommand: "python3 packages/playground/scripts/build_report.py",
    };
  }
}

function scoreColor(score: number) {
  if (score >= 80) return "text-[#8a1c1c]";
  if (score >= 65) return "text-[#b5460f]";
  if (score >= 45) return "text-[#6c5b16]";
  return "text-[#295b4c]";
}

function scoreBar(score: number) {
  if (score >= 80) return "bg-[#8a1c1c]";
  if (score >= 65) return "bg-[#b5460f]";
  if (score >= 45) return "bg-[#8d7b1b]";
  return "bg-[#295b4c]";
}

function signalChip(signalId: string) {
  if (signalId === "confidence_leakage") return "bg-[#f4d8d4] text-[#7f211d] border-[#c87870]";
  if (signalId === "emotional_amplification")
    return "bg-[#f4e0c7] text-[#8e4f09] border-[#d4a061]";
  if (signalId === "clarity_drag") return "bg-[#ece3c4] text-[#6e5a12] border-[#b7a258]";
  return "bg-[#dce9e3] text-[#225445] border-[#7ba796]";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function HotspotRow({
  label,
  items,
}: {
  label: string;
  items: Array<{ label: string; count: number }>;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-[0.28em] text-[#7b7064]">{label}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={`${label}-${item.label}`}
            className="rounded-full border border-[#cabaa5] bg-[#faf4e8] px-3 py-1 text-xs text-[#493e32]"
          >
            {item.label} x{item.count}
          </span>
        ))}
      </div>
    </div>
  );
}

function SignalMeter({ signal }: { signal: NoteSignal }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#54473a]">{signal.label}</span>
        <span className={`font-semibold ${scoreColor(signal.score)}`}>{signal.score}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#e8dccd]">
        <div className={`h-full rounded-full ${scoreBar(signal.score)}`} style={{ width: `${signal.score}%` }} />
      </div>
    </div>
  );
}

export default function Playground({ loaderData }: Route.ComponentProps) {
  const data = loaderData as LoaderData;

  if (data.status === "missing") {
    return (
      <main className="flex h-screen items-center justify-center bg-[#f4eee2] px-6 text-[#2f241c]">
        <div className="max-w-xl rounded-[28px] border border-[#cdbca5] bg-[#fffaf1] p-8 shadow-[0_30px_80px_rgba(77,53,28,0.12)]">
          <div className="mb-4 flex items-center gap-3">
            <FlaskConical className="h-6 w-6 text-[#8e4f09]" />
            <h1
              className="text-3xl leading-none"
              style={{ fontFamily: '"Cormorant Garamond", serif' }}
            >
              Playground report missing
            </h1>
          </div>
          <p className="text-sm leading-7 text-[#56493c]">
            Build the transcript report first, then refresh this route.
          </p>
          <pre className="mt-5 overflow-x-auto rounded-2xl bg-[#2f241c] px-4 py-3 text-sm text-[#f9f2e6]">
            <code>{data.rebuildCommand}</code>
          </pre>
        </div>
      </main>
    );
  }

  const report = data.report;
  const [query, setQuery] = useState("");
  const [voiceFilter, setVoiceFilter] = useState<"all" | "self" | "mixed">("all");
  const [focusSignal, setFocusSignal] = useState<string>("all");
  const [selectedNoteId, setSelectedNoteId] = useState(
    report.overview.topSelfNotes[0]?.id ?? report.notes[0]?.id ?? ""
  );
  const deferredQuery = useDeferredValue(query);

  const filteredNotes = report.notes.filter((note) => {
    const matchesQuery =
      deferredQuery.trim().length === 0 ||
      `${note.title} ${note.excerpt} ${note.themes.join(" ")}`
        .toLowerCase()
        .includes(deferredQuery.toLowerCase());
    const matchesVoice = voiceFilter === "all" || note.voice.label === voiceFilter;
    const matchesSignal =
      focusSignal === "all" || note.signals.some((signal) => signal.id === focusSignal && signal.score >= 55);
    return matchesQuery && matchesVoice && matchesSignal;
  });

  useEffect(() => {
    if (!filteredNotes.length) {
      return;
    }
    const stillVisible = filteredNotes.some((note) => note.id === selectedNoteId);
    if (!stillVisible) {
      startTransition(() => {
        setSelectedNoteId(filteredNotes[0].id);
      });
    }
  }, [filteredNotes, selectedNoteId]);

  const selectedNote =
    filteredNotes.find((note) => note.id === selectedNoteId) ??
    report.notes.find((note) => note.id === selectedNoteId) ??
    report.notes[0];

  return (
    <main
      className="custom-scrollbar h-screen overflow-y-auto bg-[#f4eee2] text-[#241b14]"
      style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}
    >
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(164,83,25,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(71,112,97,0.16),_transparent_24%),linear-gradient(180deg,_#f7f1e5_0%,_#f0e7d8_48%,_#ede2d0_100%)]" />
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(84,71,58,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(84,71,58,0.06)_1px,transparent_1px)] [background-size:28px_28px]" />

        <div className="relative mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="grid gap-5 lg:grid-cols-[1.35fr_0.95fr]"
          >
            <div className="rounded-[34px] border border-[#ccb8a3] bg-[#fff8ec]/92 p-7 shadow-[0_30px_90px_rgba(66,45,24,0.12)] backdrop-blur">
              <div className="mb-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.38em] text-[#7b7064]">
                <Radar className="h-4 w-4" />
                Communication Forensics Lab
              </div>
              <div className="max-w-3xl">
                <h1
                  className="text-5xl leading-[0.95] md:text-7xl"
                  style={{ fontFamily: '"Cormorant Garamond", serif' }}
                >
                  A playground for exposing the communication habits hiding inside your transcripts.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-[#5f5244] md:text-lg">
                  This lab scores every transcript against your own corpus, filters mixed voice notes, and turns
                  recurring friction into drills you can actually practice.
                </p>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-[#d3c1ad] bg-[#fbf4e8] p-4">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-[#7b7064]">Corpus</div>
                  <div className="mt-3 text-3xl font-semibold text-[#261d16]">{report.source.noteCount}</div>
                  <div className="mt-2 text-sm text-[#5f5244]">
                    {report.source.selfVoiceCount} self-voice notes, {report.source.mixedVoiceCount} mixed notes
                  </div>
                </div>
                <div className="rounded-[24px] border border-[#d3c1ad] bg-[#fbf4e8] p-4">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-[#7b7064]">Dominant Drag</div>
                  <div className="mt-3 text-2xl font-semibold text-[#261d16]">
                    {report.overview.topFindings[0]?.label ?? "None"}
                  </div>
                  <div className="mt-2 text-sm text-[#5f5244]">
                    Average pressure {report.overview.topFindings[0]?.average ?? 0}
                  </div>
                </div>
                <div className="rounded-[24px] border border-[#d3c1ad] bg-[#fbf4e8] p-4">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-[#7b7064]">Date Range</div>
                  <div className="mt-3 text-2xl font-semibold text-[#261d16]">
                    {formatDate(report.source.dateRange.start)}
                  </div>
                  <div className="mt-2 text-sm text-[#5f5244]">through {formatDate(report.source.dateRange.end)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[34px] border border-[#bfae99] bg-[#2f241c] p-7 text-[#f9f2e6] shadow-[0_30px_90px_rgba(31,22,14,0.28)]">
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.38em] text-[#d2c2af]">
                <Target className="h-4 w-4" />
                System Readout
              </div>
              <div className="mt-5 space-y-4">
                {report.overview.topFindings.map((finding, index) => (
                  <motion.div
                    key={finding.id}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 * index }}
                    className="rounded-[22px] border border-white/10 bg-white/5 p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs ${signalChip(finding.id)}`}
                      >
                        {finding.label}
                      </span>
                      <span className="text-sm text-[#d7c7b4]">{finding.average}</span>
                    </div>
                    <p className="text-sm leading-7 text-[#f9f2e6]">{finding.summary}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>

          <section className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[30px] border border-[#ccb8a3] bg-[#fff8ec]/92 p-6 shadow-[0_24px_70px_rgba(66,45,24,0.1)]">
              <div className="mb-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-[#7b7064]">
                <Brain className="h-4 w-4" />
                Signal Pressure
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.aggregates.composites} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#e4d7c6" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#6b5e4f", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#6b5e4f", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(99, 73, 42, 0.06)" }}
                      contentStyle={{
                        background: "#2f241c",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 18,
                        color: "#f9f2e6",
                      }}
                    />
                    <Bar dataKey="average" radius={[12, 12, 0, 0]} fill="#7f211d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[30px] border border-[#ccb8a3] bg-[#fff8ec]/92 p-6 shadow-[0_24px_70px_rgba(66,45,24,0.1)]">
              <div className="mb-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-[#7b7064]">
                <Sparkles className="h-4 w-4" />
                Lexical Hotspots
              </div>
              <div className="space-y-5">
                <HotspotRow label="Fillers" items={report.aggregates.lexicalHotspots.fillers} />
                <HotspotRow label="Hedges" items={report.aggregates.lexicalHotspots.hedges} />
                <HotspotRow label="Vague Words" items={report.aggregates.lexicalHotspots.vague} />
              </div>
            </div>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-[30px] border border-[#ccb8a3] bg-[#fff8ec]/92 p-6 shadow-[0_24px_70px_rgba(66,45,24,0.1)]">
              <div className="mb-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-[#7b7064]">
                <ScrollText className="h-4 w-4" />
                Weekly Signal Drift
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.aggregates.timeline} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#e4d7c6" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="bucket" tick={{ fill: "#6b5e4f", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#6b5e4f", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "#2f241c",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 18,
                        color: "#f9f2e6",
                      }}
                    />
                    <Line type="monotone" dataKey="confidenceLeakage" stroke="#7f211d" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="emotionalAmplification" stroke="#b56b16" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="clarityDrag" stroke="#8c7a1d" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="listenerDrift" stroke="#2f6a58" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[30px] border border-[#ccb8a3] bg-[#fff8ec]/92 p-6 shadow-[0_24px_70px_rgba(66,45,24,0.1)]">
              <div className="mb-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-[#7b7064]">
                <FlaskConical className="h-4 w-4" />
                Experiment Ledger
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-[24px] border border-[#d3c1ad] bg-[#fbf4e8] p-4">
                  <div className="text-xs uppercase tracking-[0.28em] text-[#7b7064]">Active</div>
                  {report.experiments.active.map((experiment) => (
                    <div key={experiment.id} className="rounded-[18px] border border-[#d5c6b2] bg-white/70 p-3">
                      <div className="font-semibold text-[#2d221a]">{experiment.name}</div>
                      <p className="mt-2 text-sm leading-6 text-[#5f5244]">{experiment.why}</p>
                      <p className="mt-2 text-xs leading-6 uppercase tracking-[0.18em] text-[#8e4f09]">
                        {experiment.impact}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="space-y-3 rounded-[24px] border border-[#d3c1ad] bg-[#fbf4e8] p-4">
                  <div className="text-xs uppercase tracking-[0.28em] text-[#7b7064]">Archived</div>
                  {report.experiments.archived.map((experiment) => (
                    <div key={experiment.id} className="rounded-[18px] border border-dashed border-[#d5c6b2] bg-white/60 p-3">
                      <div className="font-semibold text-[#2d221a]">{experiment.name}</div>
                      <p className="mt-2 text-sm leading-6 text-[#5f5244]">{experiment.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-[32px] border border-[#ccb8a3] bg-[#fff8ec]/92 p-6 shadow-[0_24px_70px_rgba(66,45,24,0.1)]">
            <div className="mb-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-[#7b7064]">
              <CircleDot className="h-4 w-4" />
              Practice Systems
            </div>
            <div className="grid gap-4 lg:grid-cols-4">
              {report.practiceSystems.map((practice) => (
                <div key={practice.id} className="rounded-[24px] border border-[#d3c1ad] bg-[#fbf4e8] p-4">
                  <div className={`inline-flex rounded-full border px-3 py-1 text-xs ${signalChip(practice.id)}`}>
                    {practice.title}
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[#5f5244]">{practice.when}</p>
                  <div className="mt-4 space-y-2">
                    {practice.protocol.map((step) => (
                      <div key={step} className="flex items-start gap-2 text-sm leading-6 text-[#31261e]">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#8e4f09]" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
            <div className="rounded-[32px] border border-[#ccb8a3] bg-[#fff8ec]/92 p-5 shadow-[0_24px_70px_rgba(66,45,24,0.1)]">
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-[#7b7064]">
                <Search className="h-4 w-4" />
                Transcript Explorer
              </div>
              <div className="mt-5 space-y-4">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search title, themes, or excerpt"
                  className="w-full rounded-2xl border border-[#d5c6b2] bg-[#fbf4e8] px-4 py-3 text-sm text-[#281f18] placeholder:text-[#8b7f72]"
                />
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "all", label: "All voices" },
                    { value: "self", label: "Self" },
                    { value: "mixed", label: "Mixed" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setVoiceFilter(option.value as "all" | "self" | "mixed")}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        voiceFilter === option.value
                          ? "border-[#7f211d] bg-[#7f211d] text-[#fff3ee]"
                          : "border-[#cabaa5] bg-[#faf4e8] text-[#54473a]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFocusSignal("all")}
                    className={`rounded-full border px-3 py-1.5 text-xs ${
                      focusSignal === "all"
                        ? "border-[#2f241c] bg-[#2f241c] text-[#fff5e7]"
                        : "border-[#cabaa5] bg-[#faf4e8] text-[#54473a]"
                    }`}
                  >
                    All signals
                  </button>
                  {report.overview.topFindings.map((finding) => (
                    <button
                      key={finding.id}
                      type="button"
                      onClick={() => setFocusSignal(finding.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        focusSignal === finding.id
                          ? signalChip(finding.id)
                          : "border-[#cabaa5] bg-[#faf4e8] text-[#54473a]"
                      }`}
                    >
                      {finding.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="custom-scrollbar mt-5 h-[34rem] space-y-3 overflow-y-auto pr-1">
                {filteredNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() =>
                      startTransition(() => {
                        setSelectedNoteId(note.id);
                      })
                    }
                    className={`w-full rounded-[22px] border p-4 text-left transition ${
                      selectedNote?.id === note.id
                        ? "border-[#7f211d] bg-[#fff2eb] shadow-[0_16px_44px_rgba(127,33,29,0.12)]"
                        : "border-[#d5c6b2] bg-[#fbf4e8] hover:border-[#bda992]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#251c16]">{note.title}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#7b7064]">
                          {formatDate(note.createdAt)}
                        </div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] ${signalChip(note.signals[0].id)}`}>
                        {note.signals[0].score}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#5f5244]">{note.dominantFinding}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-[#cabaa5] px-2.5 py-1 text-[11px] text-[#54473a]">
                        {note.voice.label}
                      </span>
                      {note.themes.slice(0, 2).map((theme) => (
                        <span
                          key={`${note.id}-${theme}`}
                          className="rounded-full border border-[#cabaa5] px-2.5 py-1 text-[11px] text-[#54473a]"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-[#ccb8a3] bg-[#fff8ec]/92 p-6 shadow-[0_24px_70px_rgba(66,45,24,0.1)]">
              {selectedNote ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.32em] text-[#7b7064]">
                        Selected Note
                      </div>
                      <h2
                        className="mt-2 text-4xl leading-none"
                        style={{ fontFamily: '"Cormorant Garamond", serif' }}
                      >
                        {selectedNote.title}
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-[#7b7064]">
                        <span>{formatDate(selectedNote.createdAt)}</span>
                        <span>Voice: {selectedNote.voice.label}</span>
                        <span>Purity {selectedNote.voice.score}</span>
                      </div>
                    </div>
                    <div className={`rounded-full border px-4 py-2 text-sm ${signalChip(selectedNote.signals[0].id)}`}>
                      Primary pressure: {selectedNote.signals[0].label}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[24px] border border-[#d5c6b2] bg-[#fbf4e8] p-5">
                      <div className="text-[11px] uppercase tracking-[0.28em] text-[#7b7064]">Finding</div>
                      <p className="mt-3 text-base leading-8 text-[#30251d]">{selectedNote.dominantFinding}</p>
                      <div className="mt-5 rounded-[20px] border border-[#d9c9b5] bg-white/70 p-4">
                        <div className="text-[11px] uppercase tracking-[0.28em] text-[#7b7064]">Opening line</div>
                        <p className="mt-2 text-sm leading-7 text-[#5f5244]">"{selectedNote.openingLine}"</p>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[#d5c6b2] bg-[#fbf4e8] p-5">
                      <div className="mb-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-[#7b7064]">
                        <AlertTriangle className="h-4 w-4" />
                        Signal meters
                      </div>
                      <div className="space-y-4">
                        {selectedNote.signals.map((signal) => (
                          <SignalMeter key={signal.id} signal={signal} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[24px] border border-[#d5c6b2] bg-[#fbf4e8] p-5">
                      <div className="text-[11px] uppercase tracking-[0.28em] text-[#7b7064]">Listener simulations</div>
                      <div className="mt-4 space-y-3">
                        {selectedNote.listenerSimulations.map((simulation) => (
                          <div key={simulation.persona} className="rounded-[18px] border border-[#d9c9b5] bg-white/70 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-[#8e4f09]">{simulation.persona}</div>
                            <p className="mt-2 text-sm leading-7 text-[#5f5244]">{simulation.takeaway}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[#d5c6b2] bg-[#fbf4e8] p-5">
                      <div className="text-[11px] uppercase tracking-[0.28em] text-[#7b7064]">Coaching moves</div>
                      <div className="mt-4 space-y-3">
                        {selectedNote.coachingMoves.map((move) => (
                          <div key={`${move.title}-${move.focus}`} className="rounded-[18px] border border-[#d9c9b5] bg-white/70 p-4">
                            <div className="font-semibold text-[#30251d]">{move.title}</div>
                            <p className="mt-2 text-sm leading-7 text-[#5f5244]">{move.when}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-[24px] border border-[#d5c6b2] bg-[#fbf4e8] p-5">
                      <div className="text-[11px] uppercase tracking-[0.28em] text-[#7b7064]">Speech friction</div>
                      <div className="mt-4 space-y-3 text-sm text-[#5f5244]">
                        <div className="flex justify-between">
                          <span>Filler density</span>
                          <span>{selectedNote.metrics.filler_density}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Repair density</span>
                          <span>{selectedNote.metrics.repair_density}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Vague density</span>
                          <span>{selectedNote.metrics.vague_density}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Long sentence rate</span>
                          <span>{selectedNote.metrics.long_sentence_rate}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[#d5c6b2] bg-[#fbf4e8] p-5">
                      <div className="text-[11px] uppercase tracking-[0.28em] text-[#7b7064]">Authority drain</div>
                      <div className="mt-4 space-y-3 text-sm text-[#5f5244]">
                        <div className="flex justify-between">
                          <span>Hedge density</span>
                          <span>{selectedNote.metrics.hedge_density}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fear density</span>
                          <span>{selectedNote.metrics.fear_density}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Self-attack density</span>
                          <span>{selectedNote.metrics.self_attack_density}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Question density</span>
                          <span>{selectedNote.metrics.question_density}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[#d5c6b2] bg-[#fbf4e8] p-5">
                      <div className="text-[11px] uppercase tracking-[0.28em] text-[#7b7064]">Audience balance</div>
                      <div className="mt-4 space-y-3 text-sm text-[#5f5244]">
                        <div className="flex justify-between">
                          <span>Self-focus ratio</span>
                          <span>{selectedNote.metrics.self_focus_ratio}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Audience density</span>
                          <span>{selectedNote.metrics.audience_density}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Anchor density</span>
                          <span>{selectedNote.metrics.anchor_density}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Structure density</span>
                          <span>{selectedNote.metrics.structure_density}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[24px] border border-[#d5c6b2] bg-[#fbf4e8] p-5">
                      <div className="text-[11px] uppercase tracking-[0.28em] text-[#7b7064]">Hotspots in this note</div>
                      <div className="mt-4 space-y-4">
                        <HotspotRow
                          label="Top hedges"
                          items={selectedNote.hotspots.hedges.map(([label, count]) => ({ label, count }))}
                        />
                        <HotspotRow
                          label="Top fillers"
                          items={selectedNote.hotspots.fillers.map(([label, count]) => ({ label, count }))}
                        />
                        <HotspotRow
                          label="Top absolutes"
                          items={selectedNote.hotspots.absolutes.map(([label, count]) => ({ label, count }))}
                        />
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[#d5c6b2] bg-[#fbf4e8] p-5">
                      <div className="text-[11px] uppercase tracking-[0.28em] text-[#7b7064]">Repetition pattern</div>
                      <div className="mt-4 space-y-4">
                        <HotspotRow
                          label="Repeated words"
                          items={selectedNote.repeatedWords.map((item) => ({ label: item.word, count: item.count }))}
                        />
                        <HotspotRow
                          label="Repeated phrases"
                          items={selectedNote.repeatedPhrases.map((item) => ({ label: item.phrase, count: item.count }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[#d5c6b2] bg-[#fbf4e8] p-5">
                    <div className="text-[11px] uppercase tracking-[0.28em] text-[#7b7064]">Raw excerpt</div>
                    <p className="mt-3 text-sm leading-8 text-[#5f5244]">{selectedNote.excerpt}</p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[30rem] items-center justify-center text-[#5f5244]">
                  No notes matched this filter.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
