import { useEffect, useRef, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import {
  batteriesToCsv,
  batteriesToJson,
  cleanName,
  fileSlug,
  parseBatteryFile,
  type NamedBattery,
} from "@/lib/m18/library";
import { downloadText, stampForFile } from "@/lib/m18/logs";
import { QuietButton } from "@/components/bench/ui";

export function BatteriesPanel({
  batteries,
  activeId,
  onOpenRead,
  onRename,
  onDelete,
  onImport,
}: {
  batteries: NamedBattery[];
  activeId: string | null;
  onOpenRead: (batteryId: string, readId: string) => void;
  onRename: (batteryId: string, name: string) => void;
  onDelete: (batteryId: string) => void;
  onImport: (incoming: NamedBattery[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function downloadAll(kind: "json" | "csv") {
    const stamp = stampForFile();
    if (kind === "json") downloadText(`m18-logs-${stamp}.json`, batteriesToJson(batteries), "application/json");
    else downloadText(`m18-logs-${stamp}.csv`, batteriesToCsv(batteries), "text/csv");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      onImport(parseBatteryFile(text));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not import that file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xs tracking-widest text-muted uppercase">Named batteries</h2>
            <p className="mt-1 text-sm text-muted">
              A health read is saved on this device. Name it once. The same name sticks to that e-serial on the next read.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <QuietButton disabled={batteries.length === 0} onClick={() => downloadAll("json")}>
              <Download className="size-4" aria-hidden="true" />
              All logs JSON
            </QuietButton>
            <QuietButton disabled={batteries.length === 0} onClick={() => downloadAll("csv")}>
              <Download className="size-4" aria-hidden="true" />
              All logs CSV
            </QuietButton>
            <QuietButton onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" aria-hidden="true" />
              Import logs
            </QuietButton>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Import battery log JSON"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-primary">{error}</p> : null}
        {batteries.length === 0 ? (
          <p className="mt-4 text-sm">No packs saved yet. Read a live pack, or import a log from the Windows or Android app.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {batteries.map((battery) => (
              <BatteryCard
                key={battery.id}
                battery={battery}
                active={battery.id === activeId}
                pendingDelete={pendingDelete === battery.id}
                onOpenRead={onOpenRead}
                onRename={onRename}
                onAskDelete={() => setPendingDelete(battery.id)}
                onCancelDelete={() => setPendingDelete(null)}
                onDelete={() => {
                  setPendingDelete(null);
                  onDelete(battery.id);
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BatteryCard({
  battery,
  active,
  pendingDelete,
  onOpenRead,
  onRename,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  battery: NamedBattery;
  active: boolean;
  pendingDelete: boolean;
  onOpenRead: (batteryId: string, readId: string) => void;
  onRename: (batteryId: string, name: string) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(battery.name);
  const latest = battery.reads[0];
  const verdict = latest?.report.verdict;

  useEffect(() => {
    setName(battery.name);
  }, [battery.name]);

  function commitName() {
    try {
      const next = cleanName(name);
      if (next === battery.name) {
        setName(next);
        return;
      }
      onRename(battery.id, next);
    } catch {
      setName(battery.name);
    }
  }

  function download(kind: "json" | "csv") {
    const stamp = stampForFile();
    const slug = fileSlug(battery.name);
    if (kind === "json") downloadText(`m18-${slug}-${stamp}.json`, batteriesToJson([battery]), "application/json");
    else downloadText(`m18-${slug}-${stamp}.csv`, batteriesToCsv([battery]), "text/csv");
  }

  return (
    <article className={`rounded-lg border p-4 ${active ? "border-primary" : "border-line"}`}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="text-xs tracking-widest text-muted uppercase">Name</span>
          <input
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitName();
              }
            }}
            className="mt-1 min-h-11 w-full rounded-md border border-line bg-bg px-3 text-sm font-semibold"
            aria-label={`Name for ${battery.name}`}
          />
        </label>
        <QuietButton onClick={commitName}>Save name</QuietButton>
      </div>
      <p className="mt-3 text-sm">
        <span className="font-semibold">{battery.typeName}</span>
        <span className="text-muted"> · e-serial {battery.eSerial ?? "—"}</span>
        {verdict ? <span className="text-muted"> · {verdict}</span> : null}
        {latest?.report.packV != null ? <span className="text-muted"> · {latest.report.packV.toFixed(2)} V</span> : null}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {battery.reads.slice(0, 6).map((read) => (
          <button
            key={read.id}
            type="button"
            className="min-h-11 rounded-md border border-line px-3 text-left text-sm"
            onClick={() => onOpenRead(battery.id, read.id)}
          >
            <span className="block font-semibold">{read.report.verdict}</span>
            <span className="font-mono text-xs text-muted">{read.at}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <QuietButton onClick={() => download("json")}>
          <Download className="size-4" aria-hidden="true" />
          Log JSON
        </QuietButton>
        <QuietButton onClick={() => download("csv")}>
          <Download className="size-4" aria-hidden="true" />
          Log CSV
        </QuietButton>
        {pendingDelete ? (
          <>
            <QuietButton onClick={onDelete}>
              <Trash2 className="size-4" aria-hidden="true" />
              Confirm remove
            </QuietButton>
            <QuietButton onClick={onCancelDelete}>Keep</QuietButton>
          </>
        ) : (
          <QuietButton onClick={onAskDelete}>
            <Trash2 className="size-4" aria-hidden="true" />
            Remove
          </QuietButton>
        )}
      </div>
      {battery.reads.length > 6 ? (
        <p className="mt-2 text-xs text-muted">{battery.reads.length} reads in the downloaded log.</p>
      ) : null}
    </article>
  );
}
