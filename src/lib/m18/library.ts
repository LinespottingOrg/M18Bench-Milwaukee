import type { DecodedRow } from "@/lib/m18/decode";
import type { HealthReport } from "@/lib/m18/health";

const BATTERY_KEY = "m18-bench-batteries-v2";
const LEGACY_KEY = "m18-bench-v1";
const SESSION_KEY = "m18-bench-sessions-v1";
const MAX_BATTERIES = 40;
const MAX_READS = 30;
const MAX_SESSIONS = 15;

export interface BatteryRead {
  id: string;
  at: string;
  atIso: string;
  report: HealthReport;
  rows: (DecodedRow | null)[];
}

export interface NamedBattery {
  id: string;
  name: string;
  eSerial: number | null;
  typeCode: number | null;
  typeName: string;
  createdAt: string;
  updatedAt: string;
  reads: BatteryRead[];
}

export interface SessionLog {
  id: string;
  atIso: string;
  at: string;
  platform: string;
  port: string;
  text: string;
}

export function cleanName(input: string): string {
  const name = input.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 40);
  if (!name) throw new Error("Give the battery a name.");
  return name;
}

export function suggestName(report: Pick<HealthReport, "typeName" | "eSerial">): string {
  const head = report.typeName.split("(")[0]?.trim() || "Pack";
  const short = head.startsWith("No ") || head.startsWith("Unknown") ? "Pack" : head.split(" ").slice(0, 2).join(" ");
  if (report.eSerial != null) return `${short} ${report.eSerial}`.slice(0, 40);
  return short.slice(0, 40) || "Pack";
}

export function fileSlug(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "battery";
}

export function recordRead(
  list: NamedBattery[],
  report: HealthReport,
  rows: (DecodedRow | null)[],
): { list: NamedBattery[]; battery: NamedBattery; created: boolean } {
  const now = report.readAtIso || new Date().toISOString();
  const read: BatteryRead = {
    id: String(Date.parse(now) || Date.now()),
    at: report.readAtLabel,
    atIso: now,
    report,
    rows,
  };
  const match = report.eSerial != null ? list.find((item) => item.eSerial === report.eSerial) : undefined;
  if (match) {
    const battery: NamedBattery = {
      ...match,
      typeCode: report.typeCode ?? match.typeCode,
      typeName: report.typeName || match.typeName,
      updatedAt: now,
      reads: [read, ...match.reads.filter((item) => item.id !== read.id)].slice(0, MAX_READS),
    };
    return {
      list: [battery, ...list.filter((item) => item.id !== battery.id)].slice(0, MAX_BATTERIES),
      battery,
      created: false,
    };
  }
  const battery: NamedBattery = {
    id: `b-${read.id}`,
    name: uniqueName(list, suggestName(report)),
    eSerial: report.eSerial,
    typeCode: report.typeCode,
    typeName: report.typeName,
    createdAt: now,
    updatedAt: now,
    reads: [read],
  };
  return { list: [battery, ...list].slice(0, MAX_BATTERIES), battery, created: true };
}

export function renameBattery(list: NamedBattery[], id: string, name: string): NamedBattery[] {
  const clean = cleanName(name);
  const at = new Date().toISOString();
  return list.map((item) => (item.id === id ? { ...item, name: clean, updatedAt: at } : item));
}

export function deleteBattery(list: NamedBattery[], id: string): NamedBattery[] {
  return list.filter((item) => item.id !== id);
}

export function loadBatteries(): NamedBattery[] {
  const current = readJson(BATTERY_KEY);
  if (Array.isArray(current)) {
    return current.map(coerceBattery).filter((item): item is NamedBattery => item != null).slice(0, MAX_BATTERIES);
  }
  const legacy = readJson(LEGACY_KEY);
  if (!Array.isArray(legacy)) return [];
  let list: NamedBattery[] = [];
  for (const item of legacy) {
    const loose = item as { title?: unknown; report?: HealthReport; rows?: (DecodedRow | null)[] };
    if (!loose || typeof loose !== "object" || !loose.report) continue;
    const recorded = recordRead(list, loose.report, Array.isArray(loose.rows) ? loose.rows : []);
    if (recorded.created && typeof loose.title === "string") {
      try {
        list = renameBattery(recorded.list, recorded.battery.id, loose.title);
      } catch {
        list = recorded.list;
      }
    } else {
      list = recorded.list;
    }
  }
  if (list.length) writeJson(BATTERY_KEY, list);
  return list;
}

export function saveBatteries(list: NamedBattery[]) {
  writeJson(BATTERY_KEY, list.slice(0, MAX_BATTERIES));
}

export function loadSessions(): SessionLog[] {
  const raw = readJson(SESSION_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceSession).filter((item): item is SessionLog => item != null).slice(0, MAX_SESSIONS);
}

export function rememberSession(list: SessionLog[], session: SessionLog): SessionLog[] {
  if (!session.text.trim()) return list;
  if (list[0]?.text === session.text) return list;
  const next = [session, ...list.filter((item) => item.id !== session.id)].slice(0, MAX_SESSIONS);
  writeJson(SESSION_KEY, next);
  return next;
}

export function deleteSession(list: SessionLog[], id: string): SessionLog[] {
  const next = list.filter((item) => item.id !== id);
  writeJson(SESSION_KEY, next);
  return next;
}

export function batteriesToJson(list: NamedBattery[]): string {
  return JSON.stringify({ app: "M18 Bench", exportedAt: new Date().toISOString(), batteries: list }, null, 2);
}

export function batteriesToCsv(list: NamedBattery[]): string {
  const lines = [
    "name,e_serial,type_code,type_name,read_at,verdict,pack_v,imbalance_mv,cell_mv,discharge_ah,cycles,charges,redlink,dumb,thermistor_c,forge_c,pack_note,reasons",
  ];
  for (const battery of list) {
    for (const read of battery.reads) {
      const report = read.report;
      lines.push(
        [
          battery.name,
          report.eSerial ?? "",
          report.typeCode ?? "",
          report.typeName ?? "",
          report.readAtIso ?? "",
          report.verdict ?? "",
          report.packV ?? "",
          report.imbalanceMv ?? "",
          report.cellsMv ? report.cellsMv.join(" ") : "",
          report.dischargeAh ?? "",
          report.cycles ?? "",
          report.totalCharges ?? "",
          report.redlinkCharges ?? "",
          report.dumbCharges ?? "",
          report.thermistorC ?? "",
          report.forgeC ?? "",
          report.note ?? "",
          (report.reasons ?? []).join(" | "),
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

export function parseBatteryFile(text: string): NamedBattery[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file is not JSON.");
  }
  const batteries = extractList(data).map(coerceBattery).filter((item): item is NamedBattery => item != null);
  if (!batteries.length) throw new Error("No battery logs were in that file.");
  return batteries;
}

export function mergeBatteries(current: NamedBattery[], incoming: NamedBattery[]): NamedBattery[] {
  let list = current.slice();
  for (const item of incoming) {
    const byId = list.find((row) => row.id === item.id);
    const bySerial = item.eSerial != null ? list.find((row) => row.eSerial === item.eSerial) : undefined;
    const match = byId ?? bySerial;
    if (!match) {
      list = [{ ...item, name: uniqueName(list, item.name) }, ...list];
      continue;
    }
    const seen = new Set<string>();
    const reads: BatteryRead[] = [];
    for (const read of [...item.reads, ...match.reads]) {
      if (seen.has(read.id)) continue;
      seen.add(read.id);
      reads.push(read);
    }
    reads.sort((a, b) => (a.atIso < b.atIso ? 1 : a.atIso > b.atIso ? -1 : 0));
    const merged: NamedBattery = {
      ...match,
      name: match.name || item.name,
      eSerial: match.eSerial ?? item.eSerial,
      typeCode: match.typeCode ?? item.typeCode,
      typeName: match.typeName || item.typeName,
      updatedAt: reads[0]?.atIso ?? match.updatedAt,
      reads: reads.slice(0, MAX_READS),
    };
    list = [merged, ...list.filter((row) => row.id !== match.id)];
  }
  return list.slice(0, MAX_BATTERIES);
}

export function formatTrace(
  lines: readonly { at?: string; dir: string; text: string }[],
  meta: { platform: string; port: string },
): string {
  const body = lines
    .map((line) => `${line.at ?? ""} ${line.dir.toUpperCase().padEnd(4, " ")} ${line.text}`.trim())
    .join("\n");
  return `# M18 Bench wire log\n# ${meta.platform}\n# ${meta.port}\n${body}\n`;
}

function uniqueName(list: NamedBattery[], base: string): string {
  const names = new Set(list.map((item) => item.name));
  if (!names.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const next = `${base} ${n}`.slice(0, 40);
    if (!names.has(next)) return next;
  }
  return base.slice(0, 40);
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function extractList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.batteries)) return obj.batteries;
  if (obj.report && typeof obj.report === "object") {
    const stamp = new Date().toISOString();
    return [
      {
        id: `import-${stamp}`,
        name: "Imported pack",
        createdAt: stamp,
        updatedAt: stamp,
        reads: [
          {
            id: `r-${stamp}`,
            at: "",
            atIso: stamp,
            report: obj.report,
            rows: Array.isArray(obj.rows) ? obj.rows : [],
          },
        ],
      },
    ];
  }
  return [];
}

function coerceBattery(value: unknown): NamedBattery | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<NamedBattery>;
  if (!Array.isArray(item.reads) || item.reads.length === 0) return null;
  const reads = item.reads.map(coerceRead).filter((read): read is BatteryRead => read != null).slice(0, MAX_READS);
  if (!reads.length) return null;
  const first = reads[0];
  if (!first) return null;
  const name = typeof item.name === "string" && item.name.trim() ? cleanNameSafe(item.name) : suggestName(first.report);
  return {
    id: typeof item.id === "string" && item.id ? item.id : `b-${first.id}`,
    name,
    eSerial: typeof item.eSerial === "number" ? item.eSerial : first.report.eSerial ?? null,
    typeCode: typeof item.typeCode === "number" ? item.typeCode : first.report.typeCode ?? null,
    typeName: typeof item.typeName === "string" && item.typeName ? item.typeName : first.report.typeName,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : first.atIso,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : first.atIso,
    reads,
  };
}

function coerceRead(value: unknown): BatteryRead | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<BatteryRead>;
  const report = item.report;
  if (!report || typeof report !== "object" || typeof report.readAtIso !== "string") return null;
  const atIso = typeof item.atIso === "string" ? item.atIso : report.readAtIso;
  return {
    id: typeof item.id === "string" && item.id ? item.id : String(Date.parse(atIso) || atIso),
    at: typeof item.at === "string" && item.at ? item.at : report.readAtLabel,
    atIso,
    report,
    rows: Array.isArray(item.rows) ? item.rows : [],
  };
}

function coerceSession(value: unknown): SessionLog | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<SessionLog>;
  if (typeof item.id !== "string" || typeof item.text !== "string" || typeof item.atIso !== "string") return null;
  return {
    id: item.id,
    atIso: item.atIso,
    at: typeof item.at === "string" ? item.at : item.atIso,
    platform: typeof item.platform === "string" ? item.platform : "Pack bench",
    port: typeof item.port === "string" ? item.port : "",
    text: item.text,
  };
}

function cleanNameSafe(input: string): string {
  return input.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 40) || "Pack";
}

function readJson(key: string): unknown {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* the bench still works for this session if storage is full */
  }
}
