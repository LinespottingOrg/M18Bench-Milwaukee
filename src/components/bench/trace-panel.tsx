import { useEffect, useRef } from "react";
import { Download, Trash2 } from "lucide-react";
import type { SessionLog } from "@/lib/m18/library";
import { downloadText, stampForFile } from "@/lib/m18/logs";
import type { TraceLine } from "@/lib/m18/port";
import { QuietButton } from "@/components/bench/ui";

export function TracePanel({
  lines,
  sessions,
  onDownload,
  onDeleteSession,
}: {
  lines: TraceLine[];
  sessions: SessionLog[];
  onDownload: () => void;
  onDeleteSession: (id: string) => void;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [lines.length]);

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-xs tracking-widest text-muted uppercase">Wire trace</h2>
            <p className="mt-1 text-sm text-muted">Logical bytes, before the bit reverse that goes out on the wire.</p>
          </div>
          <QuietButton disabled={lines.length === 0} onClick={onDownload}>
            <Download className="size-4" aria-hidden="true" />
            Download log
          </QuietButton>
        </div>
        <div className="max-h-[32rem] overflow-auto p-4 font-mono text-xs leading-5">
          {lines.length === 0 ? (
            <p className="text-muted">No traffic yet. A sample pack does not use the wire.</p>
          ) : (
            lines.map((line) => (
              <p key={line.id} className={line.dir === "info" ? "text-muted" : "text-fg"}>
                <span className="mr-3 text-muted">{line.dir.toUpperCase()}</span>
                {line.text}
              </p>
            ))
          )}
          <div ref={endRef} />
        </div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs tracking-widest text-muted uppercase">Saved wire logs</h2>
        <p className="mt-1 text-sm text-muted">Kept on this device when you download a trace or disconnect. Newest first.</p>
        {sessions.length === 0 ? (
          <p className="mt-3 text-sm">No saved wire logs yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {sessions.map((session) => (
              <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-2">
                <div>
                  <p className="text-sm font-semibold">{session.at}</p>
                  <p className="font-mono text-xs text-muted">
                    {session.platform} · {session.port}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <QuietButton
                    onClick={() => downloadText(`m18-trace-${stampForFile(new Date(session.atIso))}.log`, session.text)}
                  >
                    <Download className="size-4" aria-hidden="true" />
                    Download
                  </QuietButton>
                  <QuietButton onClick={() => onDeleteSession(session.id)} aria-label={`Remove log from ${session.at}`}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    Remove
                  </QuietButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
