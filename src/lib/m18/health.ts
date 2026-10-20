import { HEALTH_INDEXES, REGISTERS } from "@/lib/m18/catalog";
import { localStamp, utcStamp, type DecodedRow } from "@/lib/m18/decode";

export type Verdict = "serviceable" | "watch" | "retire";

export interface Bucket {
  label: string;
  seconds: number;
}

export interface HealthReport {
  demo: boolean;
  partial: boolean;
  readAtIso: string;
  readAtLabel: string;
  verdict: Verdict;
  reasons: string[];
  typeCode: number | null;
  typeName: string;
  nominalAh: number;
  eSerial: number | null;
  note: string | null;
  cellType: number | null;
  manufactured: string | null;
  packClock: string | null;
  daysSinceFirst: number | null;
  daysSinceTool: number | null;
  daysSinceCharge: number | null;
  cellsMv: number[] | null;
  packV: number | null;
  imbalanceMv: number | null;
  thermistorC: number | null;
  forgeC: number | null;
  dischargeAh: number | null;
  cycles: number | null;
  emptyCount: number | null;
  overheat: number | null;
  overcurrent: number | null;
  lowVoltageEvents: number | null;
  lowVoltageBounce: number | null;
  redlinkCharges: number | null;
  dumbCharges: number | null;
  totalCharges: number | null;
  chargeTime: string | null;
  idleOnCharger: string | null;
  lowVoltageCharges: number | null;
  toolTimeSec: number;
  buckets: Bucket[];
}

const PACKS: Record<number, { ah: number; name: string }> = {
  36: { ah: 1.5, name: "1.5Ah CP (5s1p 18650)" },
  37: { ah: 2, name: "2Ah CP (5s1p 18650)" },
  38: { ah: 3, name: "3Ah XC (5s2p 18650)" },
  39: { ah: 4, name: "4Ah XC (5s2p 18650)" },
  40: { ah: 5, name: "5Ah XC (5s2p 18650) (<= Dec 2018)" },
  165: { ah: 5, name: "5Ah XC (5s2p 18650) (Aug 2019 - Jun 2021)" },
  306: { ah: 5, name: "5Ah XC (5s2p 18650) (Feb 2021 - Jul 2023)" },
  424: { ah: 5, name: "5Ah XC (5s2p 18650) (>= Sep 2023)" },
  46: { ah: 6, name: "6Ah XC (5s2p 18650)" },
  47: { ah: 9, name: "9Ah HD (5s3p 18650)" },
  104: { ah: 3, name: "3Ah HO (5s1p 21700)" },
  150: { ah: 6, name: "5.5Ah HO (5s2p 21700) (EU only)" },
  106: { ah: 6, name: "6Ah HO (5s2p 21700)" },
  107: { ah: 8, name: "8Ah HO (5s2p 21700)" },
  108: { ah: 12, name: "12Ah HO (5s3p 21700)" },
  383: { ah: 8, name: "8Ah Forge (5s2p 21700 tabless)" },
  384: { ah: 12, name: "12Ah Forge (5s3p 21700 tabless)" },
};

export function bucketLabel(i: number): string {
  if (i >= 19) return ">200 A";
  return `${(i + 1) * 10}–${(i + 2) * 10} A`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const ss = s % 60;
  const mm = Math.floor(s / 60) % 60;
  const hh = Math.floor(s / 3600);
  return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function rowAt(rows: readonly (DecodedRow | null)[], index: number): DecodedRow | null {
  return rows[index] ?? null;
}

function num(rows: readonly (DecodedRow | null)[], index: number): number | null {
  const row = rowAt(rows, index);
  if (!row || row.value.t !== "num") return null;
  return row.value.n;
}

function dateMs(rows: readonly (DecodedRow | null)[], index: number): number | null {
  const row = rowAt(rows, index);
  if (!row || row.value.t !== "date") return null;
  if (row.value.ms < Date.UTC(2000, 0, 1)) return null;
  return row.value.ms;
}

function daysBetween(later: number, earlier: number): number {
  return Math.floor((later - earlier) / 86_400_000);
}

function ymd(ms: number): string {
  return utcStamp(ms).slice(0, 10);
}

export function reportFromRows(
  rows: readonly (DecodedRow | null)[],
  opts: { demo: boolean; readAt: Date },
): HealthReport {
  const sn = rowAt(rows, 2);
  const typeCode = sn && sn.value.t === "sn" ? sn.value.typeCode : null;
  const eSerial = sn && sn.value.t === "sn" ? sn.value.serial : null;
  const known = typeCode != null ? PACKS[typeCode] : undefined;
  const typeName = known?.name ?? (typeCode == null ? "No type code" : "Unknown type code");
  const nominalAh = known?.ah ?? 0;

  const cellsRow = rowAt(rows, 12);
  const cellsMv = cellsRow && cellsRow.value.t === "cells" ? cellsRow.value.mv : null;
  const packV = cellsMv ? Math.round((cellsMv.reduce((a, b) => a + b, 0) / 1000) * 100) / 100 : null;
  const imbalanceMv = cellsMv ? Math.max(...cellsMv) - Math.min(...cellsMv) : null;

  const ampSec = num(rows, 29);
  const dischargeAh = ampSec == null ? null : Math.round((ampSec / 3600) * 100) / 100;
  const cycles =
    dischargeAh != null && nominalAh > 0 ? Math.round((dischargeAh / nominalAh) * 10) / 10 : null;

  const charge = rowAt(rows, 35);
  const idle = rowAt(rows, 36);
  const note = rowAt(rows, 7);
  const manufacturedMs = dateMs(rows, 4);
  const packNow = dateMs(rows, 8);
  const lastTool = dateMs(rows, 25);
  const lastCharge = dateMs(rows, 26);

  const buckets: Bucket[] = [];
  for (let i = 0; i < 20; i++) {
    buckets.push({ label: bucketLabel(i), seconds: num(rows, 44 + i) ?? 0 });
  }
  const toolTimeSec = buckets.reduce((sum, b) => sum + b.seconds, 0);

  const overheat = num(rows, 40);
  const lowVoltageEvents = num(rows, 42);
  const lowVoltageCharges = num(rows, 38);
  const partial = HEALTH_INDEXES.some((index) => {
    if (index === 13 || index === 18) return false;
    const row = rowAt(rows, index);
    return !row || row.value.t === "missing";
  });

  let level = 0;
  const reasons: string[] = [];
  if (!cellsMv || imbalanceMv == null) {
    level = 1;
    reasons.push("Cell voltages did not come back, so this is not a verdict.");
  } else {
    const weak = cellsMv.indexOf(Math.min(...cellsMv)) + 1;
    if (cellsMv.some((mv) => mv < 2500)) {
      level = 2;
      reasons.push(`Cell ${weak} is under 2.5 V.`);
    }
    if (imbalanceMv >= 150) {
      level = 2;
      reasons.push(`Cell ${weak} is low. Imbalance is ${imbalanceMv} mV.`);
    } else if (imbalanceMv >= 50) {
      level = Math.max(level, 1);
      reasons.push(`Imbalance is ${imbalanceMv} mV. Worth watching above 50 mV.`);
    }
    if (overheat != null && overheat >= 15) {
      level = 2;
      reasons.push(`${overheat} overheat events on the tool.`);
    } else if (overheat != null && overheat >= 3) {
      level = Math.max(level, 1);
      reasons.push(`${overheat} overheat events.`);
    }
    if (lowVoltageEvents != null && lowVoltageEvents >= 8) {
      level = Math.max(level, 1);
      reasons.push(`${lowVoltageEvents} low-voltage events.`);
    }
    if (lowVoltageCharges != null && lowVoltageCharges >= 5) {
      level = Math.max(level, 1);
      reasons.push(`${lowVoltageCharges} charges started with a cell under 2.5 V.`);
    }
    if (level === 0) {
      reasons.push(
        imbalanceMv < 30
          ? "Cell spread is tight and the stress counters are quiet."
          : "Nothing crossed the bench thresholds.",
      );
    }
    if (packV != null && packV < 16 && level === 0) {
      reasons.push("Pack voltage is low. Charge it before judging the cells.");
    }
    if (partial) reasons.push("Some counters did not answer. Treat this as a partial read.");
  }

  const verdict: Verdict = level === 2 ? "retire" : level === 1 ? "watch" : "serviceable";

  return {
    demo: opts.demo,
    partial,
    readAtIso: opts.readAt.toISOString(),
    readAtLabel: opts.demo ? "Sample data" : localStamp(opts.readAt),
    verdict,
    reasons,
    typeCode,
    typeName,
    nominalAh,
    eSerial,
    note: note && note.value.t === "text" && note.value.s ? note.value.s : null,
    cellType: num(rows, 0),
    manufactured: manufacturedMs == null ? null : ymd(manufacturedMs),
    packClock: packNow == null ? null : utcStamp(packNow),
    daysSinceFirst: num(rows, 28),
    daysSinceTool: packNow != null && lastTool != null ? daysBetween(packNow, lastTool) : null,
    daysSinceCharge: packNow != null && lastCharge != null ? daysBetween(packNow, lastCharge) : null,
    cellsMv,
    packV,
    imbalanceMv,
    thermistorC: num(rows, 13),
    forgeC: num(rows, 18),
    dischargeAh,
    cycles,
    emptyCount: num(rows, 39),
    overheat,
    overcurrent: num(rows, 41),
    lowVoltageEvents,
    lowVoltageBounce: num(rows, 43),
    redlinkCharges: num(rows, 33),
    dumbCharges: num(rows, 32),
    totalCharges: num(rows, 31),
    chargeTime: charge && charge.value.t === "hms" ? charge.value.text : null,
    idleOnCharger: idle && idle.value.t === "hms" ? idle.value.text : null,
    lowVoltageCharges,
    toolTimeSec,
    buckets,
  };
}

export function formatHealthText(report: HealthReport): string {
  const line = (label: string, value: string) => `${label}: ${value}`;
  const lines = [
    report.demo ? "SAMPLE PACK" : "LIVE READ",
    report.readAtLabel,
    `Verdict: ${report.verdict}`,
    ...report.reasons.map((r) => `- ${r}`),
    "",
    line("Type", `${report.typeCode ?? "—"} [${report.typeName}]`),
    line("E-serial", report.eSerial == null ? "—" : `${report.eSerial} (does NOT match the case serial)`),
    line("Note", report.note ?? "—"),
    line("Manufacture date", report.manufactured ?? "—"),
    line("Pack clock (UTC)", report.packClock ?? "—"),
    line("Days since 1st charge", fmt(report.daysSinceFirst)),
    line("Days since last tool use", fmt(report.daysSinceTool)),
    line("Days since last charge", fmt(report.daysSinceCharge)),
    line("Pack voltage", report.packV == null ? "—" : `${report.packV.toFixed(2)} V`),
    line("Cell voltages (mV)", report.cellsMv ? report.cellsMv.join(", ") : "—"),
    line("Cell imbalance (mV)", fmt(report.imbalanceMv)),
    line("Thermistor", report.thermistorC == null ? "—" : `${report.thermistorC.toFixed(2)} C`),
    line("Forge temperature", report.forgeC == null ? "—" : `${report.forgeC.toFixed(2)} C`),
    "",
    "CHARGING",
    line("Redlink / dumb / total", `${fmt(report.redlinkCharges)} / ${fmt(report.dumbCharges)} / ${fmt(report.totalCharges)}`),
    line("Total charge time", report.chargeTime ?? "—"),
    line("Idling on charger", report.idleOnCharger ?? "—"),
    line("Charges started under 2.5 V", fmt(report.lowVoltageCharges)),
    "",
    "TOOL USE",
    line("Total discharge (Ah)", report.dischargeAh == null ? "—" : report.dischargeAh.toFixed(2)),
    line("Discharge cycles", report.cycles == null ? "—" : report.cycles.toFixed(1)),
    line("Discharged to empty", fmt(report.emptyCount)),
    line("Overheat", fmt(report.overheat)),
    line("Overcurrent", fmt(report.overcurrent)),
    line("Low-voltage events", fmt(report.lowVoltageEvents)),
    line("Low-voltage bounce", fmt(report.lowVoltageBounce)),
    line("Time on tool above 10 A", formatDuration(report.toolTimeSec)),
    "",
  ];
  for (const bucket of report.buckets) {
    const pct = report.toolTimeSec > 0 ? Math.round((bucket.seconds / report.toolTimeSec) * 100) : 0;
    lines.push(`${bucket.label.padStart(8, " ")}  ${formatDuration(bucket.seconds)}  ${String(pct).padStart(2, " ")}%`);
  }
  return lines.join("\n");
}

function fmt(n: number | null): string {
  return n == null ? "—" : String(n);
}

export function toSheet(rows: readonly (DecodedRow | null)[], readAt: Date): string | null {
  if (rows.length !== REGISTERS.length) return null;
  const ordered: string[] = [localStamp(readAt)];
  for (let i = 0; i < REGISTERS.length; i++) {
    const row = rows[i];
    if (!row || row.index !== i || row.value.t === "missing") return null;
    ordered.push(row.sheet);
  }
  return ordered.join("\n");
}
