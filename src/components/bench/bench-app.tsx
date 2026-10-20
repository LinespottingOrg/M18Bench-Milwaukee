import { useEffect, useRef, useState } from "react";
import { ClipboardCopy, Download } from "lucide-react";
import { BatteriesPanel } from "@/components/bench/batteries-panel";
import { HealthPanel } from "@/components/bench/health-panel";
import { RegisterPanel } from "@/components/bench/register-panel";
import { SetupPanel } from "@/components/bench/setup-panel";
import { TracePanel } from "@/components/bench/trace-panel";
import { Mark, PrimaryButton, QuietButton } from "@/components/bench/ui";
import { REGISTERS } from "@/lib/m18/catalog";
import { isAbort } from "@/lib/m18/bytes";
import { localStamp } from "@/lib/m18/decode";
import { PROFILE_LIST, samplePack, type ProfileId } from "@/lib/m18/demo";
import type { DecodedRow } from "@/lib/m18/decode";
import { formatHealthText, reportFromRows, toSheet, type HealthReport } from "@/lib/m18/health";
import {
  batteriesToCsv,
  batteriesToJson,
  cleanName,
  deleteBattery,
  deleteSession,
  fileSlug,
  formatTrace,
  loadBatteries,
  loadSessions,
  mergeBatteries,
  recordRead,
  rememberSession,
  renameBattery,
  saveBatteries,
  type NamedBattery,
  type SessionLog,
} from "@/lib/m18/library";
import { downloadText, stampForFile } from "@/lib/m18/logs";
import { detectPlatform, type PlatformInfo } from "@/lib/m18/platform";
import { SerialLink, type TraceLine } from "@/lib/m18/port";
import { BENCH_INDEXES, readMapped, type Progress } from "@/lib/m18/session";
import type { ConnectMode } from "@/lib/m18/transport";

type Tab = "health" | "batteries" | "registers" | "trace" | "setup";
type Busy = "connect" | "health" | "full" | "sim" | "note" | "line";

type View =
  | { kind: "sample"; profile: ProfileId; rows: DecodedRow[]; report: HealthReport }
  | { kind: "live" | "saved"; rows: (DecodedRow | null)[]; report: HealthReport | null; readAt: string; batteryId: string | null };

const TABS: { id: Tab; label: string }[] = [
  { id: "health", label: "Health" },
  { id: "batteries", label: "Batteries" },
  { id: "registers", label: "Registers" },
  { id: "trace", label: "Trace" },
  { id: "setup", label: "Setup" },
];

function initialView(): View {
  const sample = samplePack("healthy");
  return { kind: "sample", profile: "healthy", rows: sample.rows, report: sample.report };
}

export function BenchApp() {
  const linkRef = useRef<SerialLink | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const batteriesRef = useRef<NamedBattery[]>([]);
  const sessionsRef = useRef<SessionLog[]>([]);
  const traceRef = useRef<TraceLine[]>([]);
  const platformRef = useRef<PlatformInfo | null>(null);
  const [view, setView] = useState<View>(initialView);
  const [tab, setTab] = useState<Tab>("health");
  const [busy, setBusy] = useState<Busy | null>(null);
  const [connected, setConnected] = useState(false);
  const [portLabel, setPortLabel] = useState<string | null>(null);
  const [line, setLine] = useState<"low" | "high">("low");
  const [banner, setBanner] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [trace, setTrace] = useState<TraceLine[]>([]);
  const [batteries, setBatteries] = useState<NamedBattery[]>([]);
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [device, setDevice] = useState<PlatformInfo | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  batteriesRef.current = batteries;
  sessionsRef.current = sessions;
  traceRef.current = trace;
  platformRef.current = device;

  function link() {
    if (!linkRef.current) linkRef.current = new SerialLink();
    return linkRef.current;
  }

  useEffect(() => {
    link().setTrace((entry) => {
      setTrace((prev) => [...prev, entry].slice(-300));
    });
    setBatteries(loadBatteries());
    setSessions(loadSessions());
    setDevice(detectPlatform());
  }, []);

  const activeId = view.kind === "sample" ? null : view.batteryId;
  const active = batteries.find((item) => item.id === activeId) ?? null;

  useEffect(() => {
    setNameDraft(active?.name ?? "");
  }, [active?.id, active?.name]);

  function commitBatteries(next: NamedBattery[]) {
    batteriesRef.current = next;
    setBatteries(next);
    saveBatteries(next);
  }

  function showSample(id: ProfileId) {
    const sample = samplePack(id);
    setView({ kind: "sample", profile: id, rows: sample.rows, report: sample.report });
    setBanner(null);
    setTab("health");
  }

  function archiveTrace(port: string | null) {
    const lines = traceRef.current;
    if (lines.length === 0) return;
    const at = new Date();
    const platform = platformRef.current?.kicker ?? "Pack bench";
    const text = formatTrace(lines, { platform, port: port ?? "not connected" });
    const next = rememberSession(sessionsRef.current, {
      id: String(at.getTime()),
      atIso: at.toISOString(),
      at: localStamp(at),
      platform,
      port: port ?? "not connected",
      text,
    });
    sessionsRef.current = next;
    setSessions(next);
  }

  async function connect(mode: ConnectMode = "auto") {
    setBusy("connect");
    setBanner(null);
    try {
      const label = await link().connect(mode);
      setConnected(true);
      setPortLabel(label);
      setLine("low");
      setView({
        kind: "live",
        rows: Array.from({ length: REGISTERS.length }, () => null),
        report: null,
        readAt: new Date().toISOString(),
        batteryId: null,
      });
      setTab("health");
      setBanner("Line held low. Clip the pack on, then read health.");
    } catch (error) {
      setBanner(error instanceof Error ? error.message : "Could not open USB-C.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    abortRef.current?.abort();
    archiveTrace(portLabel);
    await link().disconnect();
    setConnected(false);
    setPortLabel(null);
    setBanner("Adapter closed. The last reading stays on this page.");
  }

  async function startRead(kind: "health" | "full") {
    if (!connected) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const readAt = new Date();
    const slots: (DecodedRow | null)[] = Array.from({ length: REGISTERS.length }, () => null);
    setBusy(kind);
    setBanner(null);
    setTab(kind === "full" ? "registers" : "health");
    setView({ kind: "live", rows: slots, report: null, readAt: readAt.toISOString(), batteryId: activeId });
    try {
      await readMapped(
        link(),
        kind === "health" ? BENCH_INDEXES : REGISTERS.map((reg) => reg.index),
        true,
        ac.signal,
        setProgress,
        (row) => {
          slots[row.index] = row;
          setView({ kind: "live", rows: slots.slice(), report: null, readAt: readAt.toISOString(), batteryId: activeId });
        },
      );
      const report = reportFromRows(slots, { demo: false, readAt });
      const rows = slots.slice();
      const kept = keepBattery(report, rows);
      setView({ kind: "live", rows, report, readAt: readAt.toISOString(), batteryId: kept?.id ?? null });
      setLine("low");
      if (kept) {
        setBanner(kept.created ? `Saved as ${kept.battery.name}. Rename it here or under Batteries.` : `Added to ${kept.battery.name}.`);
      }
    } catch (error) {
      setLine("low");
      if (!isAbort(error)) setBanner(error instanceof Error ? error.message : "The read failed.");
      else setBanner("Stopped. The line was returned to idle.");
      const report = slots.some((row) => row && row.value.t !== "missing")
        ? reportFromRows(slots, { demo: false, readAt })
        : null;
      const kept = report?.cellsMv ? keepBattery(report, slots.slice()) : null;
      setView({
        kind: "live",
        rows: slots.slice(),
        report,
        readAt: readAt.toISOString(),
        batteryId: kept?.id ?? activeId,
      });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  function keepBattery(report: HealthReport, rows: (DecodedRow | null)[]) {
    if (report.demo || !report.cellsMv) return null;
    const recorded = recordRead(batteriesRef.current, report, rows);
    commitBatteries(recorded.list);
    return { id: recorded.battery.id, battery: recorded.battery, created: recorded.created };
  }

  async function withLine(action: "low" | "high") {
    if (!connected) return;
    setBusy("line");
    setBanner(null);
    try {
      if (action === "low") await link().idle();
      else await link().high();
      setLine(action);
    } catch (error) {
      setBanner(error instanceof Error ? error.message : "Could not change the line.");
    } finally {
      setBusy(null);
    }
  }

  async function simulate(seconds: number) {
    if (!connected) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy("sim");
    setBanner("Talking like a charger. Stop if you did not mean to.");
    setTab("trace");
    try {
      await link().simulate(seconds * 1000, ac.signal);
      setLine("low");
      setBanner("Charger talk finished. Line is low.");
    } catch (error) {
      setLine("low");
      setBanner(isAbort(error) ? "Charger talk stopped. Line is low." : error instanceof Error ? error.message : "Charger talk failed.");
    } finally {
      setBusy(null);
    }
  }

  async function writeNote(note: string) {
    if (!connected) return;
    setBusy("note");
    setBanner(null);
    try {
      await link().writeNote(note);
      setLine("low");
      setBanner("Note written. Read health again to confirm it.");
    } catch (error) {
      setBanner(error instanceof Error ? error.message : "Could not write the note.");
    } finally {
      setBusy(null);
    }
  }

  function saveName() {
    if (!active) return;
    try {
      const name = cleanName(nameDraft);
      commitBatteries(renameBattery(batteriesRef.current, active.id, name));
      setBanner(`Saved as ${name}.`);
    } catch (error) {
      setBanner(error instanceof Error ? error.message : "Could not save the name.");
    }
  }

  function openRead(batteryId: string, readId: string) {
    const battery = batteriesRef.current.find((item) => item.id === batteryId);
    const read = battery?.reads.find((item) => item.id === readId) ?? battery?.reads[0];
    if (!battery || !read) return;
    setView({ kind: "saved", rows: read.rows, report: read.report, readAt: read.atIso, batteryId });
    setBanner(`${battery.name} · ${read.at}. Not live.`);
    setTab("health");
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setBanner("Could not copy from this window. Use Download instead.");
    }
  }

  function downloadReport() {
    if (!view.report) return;
    const payload = active
      ? batteriesToJson([active])
      : JSON.stringify({ report: view.report, rows: view.rows }, null, 2);
    const name = active ? `m18-${fileSlug(active.name)}-${stampForFile()}.json` : `m18-bench-${stampForFile()}.json`;
    downloadText(name, payload, "application/json");
  }

  function downloadTrace() {
    const port = portLabel ?? "not connected";
    const platform = device?.kicker ?? "Pack bench";
    const text = formatTrace(traceRef.current, { platform, port });
    downloadText(`m18-trace-${stampForFile()}.log`, text);
    archiveTrace(port);
  }

  const report = view.report;
  const sheet = report && view.kind !== "sample" ? toSheet(view.rows, new Date(report.readAtIso)) : view.kind === "sample" ? toSheet(view.rows, new Date(report?.readAtIso ?? Date.now())) : null;
  const sampleMeta = view.kind === "sample" ? PROFILE_LIST.find((item) => item.id === view.profile) : null;
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const idle = device?.idle ?? "USB-C on Windows, Android, and iOS. Sample packs until a pack is connected.";

  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="h-1 bg-primary" />
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4">
          <Mark />
          <div className="min-w-0 flex-1">
            <p className="text-xs tracking-widest text-muted uppercase">{device?.kicker ?? "Pack bench"}</p>
            <h1 className="text-2xl font-semibold leading-tight">M18 Bench</h1>
            <p className="text-sm text-muted">
              {connected ? `${portLabel} · line ${line === "low" ? "low" : "released"}` : idle}
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {busy === "health" || busy === "full" || busy === "sim" ? (
              <QuietButton className="w-full sm:w-auto" onClick={() => abortRef.current?.abort()}>
                Stop
              </QuietButton>
            ) : connected ? (
              <PrimaryButton className="w-full sm:w-auto" onClick={() => void startRead("health")}>
                Read health
              </PrimaryButton>
            ) : (
              <PrimaryButton className="w-full sm:w-auto" disabled={busy != null} onClick={() => void connect("auto")}>
                {busy === "connect" ? "Opening…" : "Connect USB-C"}
              </PrimaryButton>
            )}
            {connected ? (
              <QuietButton className="w-full sm:w-auto" disabled={busy != null} onClick={() => void disconnect()}>
                Disconnect
              </QuietButton>
            ) : null}
          </div>
        </div>
      </header>

      {progress ? (
        <div className="mx-auto max-w-6xl px-4 pt-3">
          <div className="flex items-center justify-between font-mono text-xs text-muted">
            <span>{progress.phase}</span>
            <span>
              {progress.done}/{progress.total}
            </span>
          </div>
          <div className="mt-1 h-1 bg-raised">
            <div className="bar h-1 bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-4">
        {view.kind === "sample" ? (
          <div className="border-l-4 border-primary bg-surface px-4 py-3 text-sm">
            <span className="font-semibold text-primary">Sample pack.</span> {sampleMeta?.blurb}. These numbers are not from a battery. Connect a 3.3 V USB-serial adapter to read yours.
          </div>
        ) : null}
        {banner ? (
          <p role="alert" className="rounded-md border border-line bg-surface px-4 py-3 text-sm">
            {banner}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {PROFILE_LIST.map((item) => {
            const pressed = view.kind === "sample" && view.profile === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={connected || busy != null}
                aria-pressed={pressed}
                onClick={() => showSample(item.id)}
                className={`min-h-11 rounded-md border px-3 text-sm ${pressed ? "border-primary bg-surface text-fg" : "border-line bg-bg text-muted"} disabled:opacity-50`}
              >
                {item.name}
              </button>
            );
          })}
        </div>

        <div role="tablist" aria-label="Bench sections" className="flex gap-1 overflow-x-auto border-b border-line">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-semibold ${tab === item.id ? "border-primary text-fg" : "border-transparent text-muted"}`}
            >
              {item.id === "batteries" && batteries.length > 0 ? `Batteries (${batteries.length})` : item.label}
            </button>
          ))}
        </div>

        {tab === "health" ? (
          <div className="grid gap-4">
            {active ? (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveName();
                }}
              >
                <label className="min-w-0 flex-1">
                  <span className="text-xs tracking-widest text-muted uppercase">Battery name</span>
                  <input
                    value={nameDraft}
                    maxLength={40}
                    onChange={(event) => setNameDraft(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-md border border-line bg-surface px-3 text-sm font-semibold"
                    aria-label="Battery name"
                  />
                </label>
                <QuietButton type="submit">Save name</QuietButton>
              </form>
            ) : null}
            <HealthPanel report={report} awaiting={view.kind !== "sample"} />
            {report ? (
              <div className="flex flex-wrap gap-2">
                <QuietButton onClick={() => void copy(formatHealthText(report), "report")}>
                  <ClipboardCopy className="size-4" aria-hidden="true" />
                  {copied === "report" ? "Copied" : "Copy report"}
                </QuietButton>
                <QuietButton onClick={downloadReport}>
                  <Download className="size-4" aria-hidden="true" />
                  {active ? "Download log" : "Download JSON"}
                </QuietButton>
                {active ? (
                  <QuietButton onClick={() => downloadText(`m18-${fileSlug(active.name)}-${stampForFile()}.csv`, batteriesToCsv([active]), "text/csv")}>
                    <Download className="size-4" aria-hidden="true" />
                    Download CSV
                  </QuietButton>
                ) : null}
                <QuietButton disabled={!sheet} onClick={() => sheet && void copy(sheet, "sheet")}>
                  {copied === "sheet" ? "Copied" : "Copy sheet column"}
                </QuietButton>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "batteries" ? (
          <BatteriesPanel
            batteries={batteries}
            activeId={activeId}
            onOpenRead={openRead}
            onRename={(id, name) => {
              try {
                const clean = cleanName(name);
                commitBatteries(renameBattery(batteriesRef.current, id, clean));
                setBanner(`Saved as ${clean}.`);
              } catch (error) {
                setBanner(error instanceof Error ? error.message : "Could not save the name.");
              }
            }}
            onDelete={(id) => {
              const next = deleteBattery(batteriesRef.current, id);
              commitBatteries(next);
              if (activeId === id && view.kind !== "sample") {
                setView({ ...view, batteryId: null });
              }
              setBanner("Battery removed from this device.");
            }}
            onImport={(incoming) => {
              const next = mergeBatteries(batteriesRef.current, incoming);
              commitBatteries(next);
              setBanner(`Imported ${incoming.length === 1 ? "1 battery" : `${incoming.length} batteries`}.`);
            }}
          />
        ) : null}

        {tab === "registers" ? (
          <RegisterPanel
            rows={view.rows}
            connected={connected}
            busy={busy != null}
            onFullRead={() => void startRead("full")}
          />
        ) : null}
        {tab === "trace" ? (
          <TracePanel
            lines={trace}
            sessions={sessions}
            onDownload={downloadTrace}
            onDeleteSession={(id) => setSessions(deleteSession(sessionsRef.current, id))}
          />
        ) : null}
        {tab === "setup" ? (
          <SetupPanel
            connected={connected}
            busy={busy != null}
            line={line}
            device={device}
            onConnectUsb={() => void connect("usb")}
            onIdle={() => void withLine("low")}
            onHigh={() => void withLine("high")}
            onSimulate={(seconds) => void simulate(seconds)}
            onWriteNote={(note) => void writeNote(note)}
          />
        ) : null}

        <p className="text-xs text-muted">
          Read at {report ? report.readAtLabel : "—"} · Windows, Android, and iOS · unofficial M18 UART bench
        </p>
      </main>
    </div>
  );
}
