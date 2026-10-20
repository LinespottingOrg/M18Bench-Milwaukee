import { REGISTERS } from "@/lib/m18/catalog";
import { decodePayload, type DecodedRow } from "@/lib/m18/decode";
import { reportFromRows, type HealthReport } from "@/lib/m18/health";

export type ProfileId = "healthy" | "tired" | "sag";

export interface ProfileMeta {
  id: ProfileId;
  name: string;
  blurb: string;
}

export const PROFILE_LIST: ProfileMeta[] = [
  { id: "healthy", name: "Healthy 5Ah XC", blurb: "Tight cells, light site use" },
  { id: "tired", name: "Tired 8Ah HO", blurb: "High cycles, heat and low-voltage counts" },
  { id: "sag", name: "Sagging 12Ah Forge", blurb: "Young pack, one cell down" },
];

interface Spec {
  typeCode: number;
  serial: number;
  cellType: number;
  note: string;
  manufactured: string;
  packNow: string;
  daysSinceFirst: number;
  lastToolDays: number;
  lastChargeDays: number;
  cells: number[];
  thermistorC: number | null;
  forgeC: number | null;
  dischargeAh: number;
  emptyCount: number;
  overheat: number;
  overcurrent: number;
  lowVoltageEvents: number;
  bounce: number;
  redlink: number;
  dumb: number;
  totalCharges: number;
  chargeTimeSec: number;
  idleChargerSec: number;
  lowVoltageCharges: number;
  buckets: number[];
}

const SPECS: Record<ProfileId, Spec> = {
  healthy: {
    typeCode: 424,
    serial: 1842291,
    cellType: 5,
    note: "SITE VAN 2",
    manufactured: "2024-03-02T08:00:00Z",
    packNow: "2026-10-18T07:30:00Z",
    daysSinceFirst: 500,
    lastToolDays: 4,
    lastChargeDays: 1,
    cells: [4118, 4124, 4110, 4122, 4108],
    thermistorC: 22,
    forgeC: null,
    dischargeAh: 420,
    emptyCount: 4,
    overheat: 0,
    overcurrent: 1,
    lowVoltageEvents: 0,
    bounce: 2,
    redlink: 148,
    dumb: 6,
    totalCharges: 160,
    chargeTimeSec: 148 * 48 * 60,
    idleChargerSec: 11 * 3600,
    lowVoltageCharges: 0,
    buckets: [480, 2100, 1600, 420, 90, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  tired: {
    typeCode: 107,
    serial: 662104,
    cellType: 5,
    note: "HIRE FLEET",
    manufactured: "2021-11-08T08:00:00Z",
    packNow: "2026-10-18T07:30:00Z",
    daysSinceFirst: 1400,
    lastToolDays: 40,
    lastChargeDays: 38,
    cells: [4010, 3980, 3940, 3990, 3960],
    thermistorC: 28.5,
    forgeC: null,
    dischargeAh: 6400,
    emptyCount: 86,
    overheat: 6,
    overcurrent: 14,
    lowVoltageEvents: 11,
    bounce: 9,
    redlink: 210,
    dumb: 40,
    totalCharges: 260,
    chargeTimeSec: 920 * 3600,
    idleChargerSec: 240 * 3600,
    lowVoltageCharges: 7,
    buckets: [200, 800, 2400, 3000, 1800, 900, 400, 120, 40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  sag: {
    typeCode: 384,
    serial: 2201884,
    cellType: 5,
    note: "FORGE DEMO",
    manufactured: "2025-08-01T08:00:00Z",
    packNow: "2026-10-18T07:30:00Z",
    daysSinceFirst: 80,
    lastToolDays: 1,
    lastChargeDays: 1,
    cells: [4100, 4090, 3880, 4088, 4070],
    thermistorC: null,
    forgeC: 36.5,
    dischargeAh: 900,
    emptyCount: 2,
    overheat: 1,
    overcurrent: 0,
    lowVoltageEvents: 1,
    bounce: 0,
    redlink: 54,
    dumb: 1,
    totalCharges: 56,
    chargeTimeSec: 40 * 3600,
    idleChargerSec: 3 * 3600,
    lowVoltageCharges: 0,
    buckets: [300, 900, 400, 80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
};

function putUint(mem: Uint8Array, addr: number, len: number, value: number) {
  let rest = Math.max(0, Math.floor(value));
  for (let i = len - 1; i >= 0; i--) {
    mem[addr + i] = rest % 256;
    rest = Math.floor(rest / 256);
  }
}

function putDate(mem: Uint8Array, addr: number, iso: string) {
  putUint(mem, addr, 4, Math.floor(Date.parse(iso) / 1000));
}

function putAscii(mem: Uint8Array, addr: number, len: number, text: string) {
  for (let i = 0; i < len; i++) mem[addr + i] = i < text.length ? text.charCodeAt(i) : 0x20;
}

function putCells(mem: Uint8Array, addr: number, cells: number[]) {
  cells.forEach((mv, i) => putUint(mem, addr + i * 2, 2, mv));
}

function adcForCelsius(celsius: number): number {
  const r1 = 10e3;
  const r2 = 20e3;
  const t1 = 50;
  const t2 = 35;
  const adc1 = 0x0180;
  const adc2 = 0x022e;
  const m = (t2 - t1) / (r2 - r1);
  const b = t1 - m * r1;
  const resistance = (celsius - b) / m;
  return Math.round(adc1 + ((resistance - r1) * (adc2 - adc1)) / (r2 - r1));
}

function putDec(mem: Uint8Array, addr: number, celsius: number) {
  let whole = Math.floor(celsius);
  let frac = Math.round((celsius - whole) * 256);
  if (frac >= 256) {
    whole += 1;
    frac = 0;
  }
  mem[addr] = whole & 0xff;
  mem[addr + 1] = frac & 0xff;
}

function shiftDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) - days * 86_400_000).toISOString();
}

function buildMemory(spec: Spec): Uint8Array {
  const mem = new Uint8Array(0xa010);
  putUint(mem, 0x0000, 2, spec.cellType);
  putUint(mem, 0x0004, 2, spec.typeCode);
  putUint(mem, 0x0006, 3, spec.serial);
  putUint(mem, 0x000d, 4, 0x4d3138);
  putDate(mem, 0x0011, spec.manufactured);
  const first = shiftDays(spec.packNow, spec.daysSinceFirst);
  putDate(mem, 0x0015, first);
  putDate(mem, 0x0019, shiftDays(spec.packNow, spec.lastChargeDays));
  putAscii(mem, 0x0023, 20, spec.note);
  putDate(mem, 0x0037, spec.packNow);
  putUint(mem, 0x0069, 2, 2);
  putCells(mem, 0x400a, spec.cells);
  if (spec.thermistorC != null) putUint(mem, 0x4014, 2, adcForCelsius(spec.thermistorC));
  if (spec.forgeC != null) putDec(mem, 0x401f, spec.forgeC);
  putDate(mem, 0x9000, first);
  putDate(mem, 0x9004, shiftDays(spec.packNow, spec.lastToolDays));
  putDate(mem, 0x9008, shiftDays(spec.packNow, spec.lastChargeDays));
  putUint(mem, 0x9010, 2, spec.daysSinceFirst);
  const ampSec = Math.round(spec.dischargeAh * 3600);
  putUint(mem, 0x9012, 4, ampSec);
  putUint(mem, 0x9016, 4, ampSec * 18);
  putUint(mem, 0x901a, 4, spec.totalCharges);
  putUint(mem, 0x901e, 2, spec.dumb);
  putUint(mem, 0x9020, 2, spec.redlink);
  putUint(mem, 0x9022, 2, spec.redlink);
  putUint(mem, 0x9024, 4, spec.chargeTimeSec);
  putUint(mem, 0x9028, 4, spec.idleChargerSec);
  putUint(mem, 0x902e, 2, spec.lowVoltageCharges);
  putUint(mem, 0x9030, 2, spec.emptyCount);
  putUint(mem, 0x9032, 2, spec.overheat);
  putUint(mem, 0x9034, 2, spec.overcurrent);
  putUint(mem, 0x9036, 2, spec.lowVoltageEvents);
  putUint(mem, 0x9038, 2, spec.bounce);
  spec.buckets.forEach((seconds, i) => putUint(mem, 0x903a + i * 2, 2, seconds));
  return mem;
}

export function samplePack(id: ProfileId, readAt = new Date()): { rows: DecodedRow[]; report: HealthReport } {
  const mem = buildMemory(SPECS[id]);
  const rows = REGISTERS.map((def) => decodePayload(def, mem.subarray(def.addr, def.addr + def.len), null));
  return { rows, report: reportFromRows(rows, { demo: true, readAt }) };
}
