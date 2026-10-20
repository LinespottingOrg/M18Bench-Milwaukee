import { groupFor, type Kind, type RegDef, type RegGroup } from "@/lib/m18/catalog";
import { intBE } from "@/lib/m18/bytes";

export interface Frame {
  payload: Uint8Array | null;
  checksumOk: boolean | null;
}

export type DecodedValue =
  | { t: "num"; n: number }
  | { t: "date"; ms: number }
  | { t: "text"; s: string }
  | { t: "sn"; typeCode: number; serial: number }
  | { t: "cells"; mv: number[] }
  | { t: "hms"; seconds: number; text: string }
  | { t: "missing" };

export interface DecodedRow {
  index: number;
  addr: number;
  len: number;
  kind: Kind;
  label: string;
  group: RegGroup;
  raw: number[] | null;
  text: string;
  sheet: string;
  checksumOk: boolean | null;
  value: DecodedValue;
}

/** ADC thermistor curve copied from m18.py. Constants there are estimates. */
export function calculateTemperature(adc: number): number {
  const r1 = 10e3;
  const r2 = 20e3;
  const t1 = 50;
  const t2 = 35;
  const adc1 = 0x0180;
  const adc2 = 0x022e;
  const m = (t2 - t1) / (r2 - r1);
  const b = t1 - m * r1;
  const resistance = r1 + ((adc - adc1) * (r2 - r1)) / (adc2 - adc1);
  return Math.round((m * resistance + b) * 100) / 100;
}

export function utcStamp(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

export function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function hmsText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const ss = s % 60;
  const mm = Math.floor(s / 60) % 60;
  const hh = Math.floor(s / 3600);
  return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function missing(def: RegDef, checksumOk: boolean | null): DecodedRow {
  return {
    index: def.index,
    addr: def.addr,
    len: def.len,
    kind: def.kind,
    label: def.label,
    group: groupFor(def.addr),
    raw: null,
    text: "------",
    sheet: "------",
    checksumOk,
    value: { t: "missing" },
  };
}

export function decodePayload(def: RegDef, payload: Uint8Array | null, checksumOk: boolean | null): DecodedRow {
  if (!payload || payload.length < def.len) return missing(def, checksumOk);
  const rawBytes = payload.subarray(0, def.len);
  const raw = Array.from(rawBytes);
  const base = {
    index: def.index,
    addr: def.addr,
    len: def.len,
    kind: def.kind,
    label: def.label,
    group: groupFor(def.addr),
    raw,
    checksumOk,
  };

  switch (def.kind) {
    case "uint": {
      const n = intBE(rawBytes);
      return { ...base, text: new Intl.NumberFormat("en-US").format(n), sheet: String(n), value: { t: "num", n } };
    }
    case "date": {
      const ms = intBE(rawBytes) * 1000;
      const text = utcStamp(ms);
      return { ...base, text, sheet: text, value: { t: "date", ms } };
    }
    case "ascii": {
      const s = raw.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "")).join("").trim();
      return { ...base, text: s || "—", sheet: `"${s}"`, value: { t: "text", s } };
    }
    case "sn": {
      const typeCode = intBE(rawBytes.subarray(0, 2));
      const serial = intBE(rawBytes.subarray(2, 5));
      return {
        ...base,
        text: `Type ${typeCode} · e-serial ${serial}`,
        sheet: `${typeCode}\n${serial}`,
        value: { t: "sn", typeCode, serial },
      };
    }
    case "adc_t": {
      const adc = intBE(rawBytes);
      if (adc === 0) return { ...missing(def, checksumOk), raw };
      const n = calculateTemperature(adc);
      return { ...base, text: `${n.toFixed(2)} °C`, sheet: n.toFixed(2), value: { t: "num", n } };
    }
    case "dec_t": {
      if (raw[0] === 0 && raw[1] === 0) return { ...missing(def, checksumOk), raw };
      const n = Math.round((raw[0] + raw[1] / 256) * 100) / 100;
      return { ...base, text: `${n.toFixed(2)} °C`, sheet: n.toFixed(2), value: { t: "num", n } };
    }
    case "cell_v": {
      const mv: number[] = [];
      for (let i = 0; i < 10; i += 2) mv.push(intBE(rawBytes.subarray(i, i + 2)));
      if (mv.every((v) => v === 0)) return { ...missing(def, checksumOk), raw };
      return {
        ...base,
        text: mv.map((v) => v.toString()).join(" · "),
        sheet: mv.map((v) => String(v).padStart(4, " ")).join("\n"),
        value: { t: "cells", mv },
      };
    }
    case "hhmmss": {
      const seconds = intBE(rawBytes);
      const text = hmsText(seconds);
      return { ...base, text, sheet: text, value: { t: "hms", seconds, text } };
    }
    default:
      return missing(def, checksumOk);
  }
}
