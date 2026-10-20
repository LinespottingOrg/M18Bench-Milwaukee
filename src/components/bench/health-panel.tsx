import { useState } from "react";
import type { HealthReport } from "@/lib/m18/health";
import { formatDuration } from "@/lib/m18/health";
import { Metric, verdictClass } from "@/components/bench/ui";

const VERDICT_LABEL: Record<HealthReport["verdict"], string> = {
  serviceable: "Serviceable",
  watch: "Watch",
  retire: "Retire",
};

export function HealthPanel({
  report,
  awaiting,
}: {
  report: HealthReport | null;
  awaiting: boolean;
}) {
  if (!report) {
    return (
      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="text-xl font-semibold">{awaiting ? "Waiting for the pack" : "No reading yet"}</h2>
        <ol className="mt-4 grid gap-3 text-sm">
          <li>1. Connect a 3.3 V USB-serial adapter on the USB-C port and press Connect USB-C.</li>
          <li>2. The bench holds TX low. Clip on after that, not before.</li>
          <li>3. TX goes to J2 (next to B−), RX to J1 (next to B+), GND to B−.</li>
          <li>4. Press Read health. The pack is saved so you can name it. A pass takes several seconds at 4800 baud.</li>
        </ol>
      </section>
    );
  }

  const temp = report.forgeC ?? report.thermistorC;
  const tempDetail =
    report.forgeC != null && report.thermistorC != null
      ? `Thermistor ${report.thermistorC.toFixed(1)} °C`
      : report.forgeC != null
        ? "Forge sensor"
        : report.thermistorC != null
          ? "Thermistor"
          : undefined;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="grid gap-4 lg:col-span-5">
          <section className={verdictClass(report.verdict)}>
            <p className="text-xs tracking-widest uppercase opacity-80">Bench reading</p>
            <h2 className={`mt-1 text-3xl font-semibold ${report.verdict === "watch" ? "text-primary" : ""}`}>
              {VERDICT_LABEL[report.verdict]}
            </h2>
            <p className="mt-1 text-sm opacity-80">Thresholds for the bench, not a warranty test.</p>
            <ul className="mt-3 grid gap-1 text-sm">
              {(report.reasons ?? []).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-lg border border-line bg-surface p-4">
            <p className="text-xs tracking-widest text-muted uppercase">Identity</p>
            <p className="mt-2 text-lg font-semibold leading-snug">{report.typeName}</p>
            <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted">Type code</dt>
              <dd className="font-mono">{report.typeCode ?? "—"}</dd>
              <dt className="text-muted">E-serial</dt>
              <dd className="font-mono">{report.eSerial ?? "—"}</dd>
              <dt className="text-muted">Made</dt>
              <dd className="font-mono">{report.manufactured ?? "—"}</dd>
              <dt className="text-muted">Pack clock</dt>
              <dd className="font-mono">{report.packClock ?? "—"}</dd>
              <dt className="text-muted">Since first charge</dt>
              <dd className="font-mono">{report.daysSinceFirst == null ? "—" : `${report.daysSinceFirst} days`}</dd>
              <dt className="text-muted">Last tool use</dt>
              <dd className="font-mono">{report.daysSinceTool == null ? "—" : `${report.daysSinceTool} days ago`}</dd>
              <dt className="text-muted">Last charge</dt>
              <dd className="font-mono">{report.daysSinceCharge == null ? "—" : `${report.daysSinceCharge} days ago`}</dd>
              <dt className="text-muted">Note</dt>
              <dd className="font-mono">{report.note ?? "—"}</dd>
            </dl>
            <p className="mt-3 text-sm text-muted">The e-serial does not match the number on the case.</p>
          </section>
        </div>
        <section className="rounded-lg border border-line bg-surface p-4 lg:col-span-7">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs tracking-widest text-muted uppercase">Pack</p>
              <p className="mt-1 font-mono text-4xl leading-none">
                {report.packV == null ? "—" : report.packV.toFixed(2)}
                <span className="ml-2 text-lg text-muted">V</span>
              </p>
            </div>
            <p className="text-right font-mono text-sm text-muted">
              Imbalance
              <span className="mt-1 block text-lg text-fg">
                {report.imbalanceMv == null ? "—" : `${report.imbalanceMv} mV`}
              </span>
            </p>
          </div>
          <div className="mt-5 grid gap-3">
            {(report.cellsMv ?? []).map((mv, index) => (
              <CellBar key={index} index={index} mv={mv} cells={report.cellsMv ?? []} imbalance={report.imbalanceMv} />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Bars run from 3.00 V to 4.20 V. A short bar is a low cell, not a styling trick.</p>
        </section>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Discharge"
          value={report.dischargeAh == null ? "—" : `${report.dischargeAh.toFixed(1)} Ah`}
          detail={report.cycles == null ? undefined : `${report.cycles.toFixed(1)} cycles at nameplate`}
        />
        <Metric
          label="Charges"
          value={report.totalCharges == null ? "—" : String(report.totalCharges)}
          detail={`${report.redlinkCharges ?? "—"} UART · ${report.dumbCharges ?? "—"} dumb`}
        />
        <Metric
          label="Temperature"
          value={temp == null ? "—" : `${temp.toFixed(1)} °C`}
          detail={tempDetail}
        />
        <Metric
          label="On the tool"
          value={formatDuration(report.toolTimeSec ?? 0)}
          detail="Time spent above 10 A"
        />
        <Metric label="Overheat" value={dash(report.overheat)} detail="Must be over 10 A to count" />
        <Metric label="Overcurrent" value={dash(report.overcurrent)} />
        <Metric label="Low voltage" value={dash(report.lowVoltageEvents)} detail={`${dash(report.lowVoltageBounce)} bounce events`} />
        <Metric label="Run to empty" value={dash(report.emptyCount)} detail={report.chargeTime ? `Charge time ${report.chargeTime}` : undefined} />
      </div>

      <Histogram report={report} />
    </div>
  );
}

function dash(n: number | null): string {
  return n == null ? "—" : String(n);
}

function CellBar({
  index,
  mv,
  cells,
  imbalance,
}: {
  index: number;
  mv: number;
  cells: number[];
  imbalance: number | null;
}) {
  const min = Math.min(...cells);
  const max = Math.max(...cells);
  const extreme = imbalance != null && imbalance >= 50 && (mv === min || mv === max);
  const pct = Math.max(0, Math.min(100, ((mv - 3000) / 1200) * 100));
  return (
    <div className="grid grid-cols-[2.5rem_1fr_4.75rem] items-center gap-3">
      <span className="font-mono text-sm text-muted">C{index + 1}</span>
      <div className="h-3 rounded-full bg-raised">
        <div className={`bar h-3 rounded-full ${extreme ? "bg-primary" : "bg-fg"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-right font-mono text-sm">{(mv / 1000).toFixed(3)}</span>
    </div>
  );
}

function Histogram({ report }: { report: HealthReport }) {
  const [showEmpty, setShowEmpty] = useState(false);
  const buckets = report.buckets ?? [];
  const toolTime = report.toolTimeSec ?? 0;
  const active = buckets.filter((bucket) => bucket.seconds > 0);
  const rows = showEmpty ? buckets : active;
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs tracking-widest text-muted uppercase">Discharge above 10 A</h2>
        {active.length !== buckets.length ? (
          <button type="button" className="min-h-11 text-sm text-fg underline" onClick={() => setShowEmpty((v) => !v)}>
            {showEmpty ? "Hide empty buckets" : `Show empty buckets (${buckets.length - active.length})`}
          </button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No time recorded above 10 A.</p>
      ) : (
        <div className="mt-4 grid gap-2">
          {rows.map((bucket) => {
            const pct = toolTime > 0 ? Math.round((bucket.seconds / toolTime) * 100) : 0;
            return (
              <div key={bucket.label} className="grid grid-cols-[5.5rem_1fr_6.5rem] items-center gap-3 text-sm">
                <span className="font-mono text-muted">{bucket.label}</span>
                <div className="h-2 rounded-full bg-raised">
                  <div className="bar h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-right font-mono">
                  {formatDuration(bucket.seconds)} {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}
      {report.idleOnCharger ? (
        <p className="mt-4 text-sm text-muted">Time idling full on a charger: {report.idleOnCharger}. Low-voltage charges: {dash(report.lowVoltageCharges)}.</p>
      ) : null}
    </section>
  );
}
