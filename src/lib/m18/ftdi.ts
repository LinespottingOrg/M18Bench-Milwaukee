import { BenchError } from "./bytes.ts";

/** Fractional nibbles from the FTDI baud divisor. Same table as the kernel driver. */
const DIVFRAC = [0, 3, 2, 4, 1, 5, 6, 7];

export type FtVariantId = "ft232r" | "ft232h" | "ft2232h" | "ft4232h" | "ft2232c" | "ft232b" | "ft232bm" | "ftx";

export interface FtVariant {
  id: FtVariantId;
  label: string;
  clockHz: number;
  channels: 1 | 2 | 4;
  detail: string;
}

export const FT_VARIANTS: FtVariant[] = [
  {
    id: "ft232r",
    label: "FT232R",
    clockHz: 48_000_000,
    channels: 1,
    detail: "48 MHz. Usual single-channel cable. PID 6001 and bcdDevice 0600.",
  },
  {
    id: "ft232h",
    label: "FT232H",
    clockHz: 120_000_000,
    channels: 1,
    detail: "120 MHz. PID 6014, or 6001 with bcdDevice 0900. A 48 MHz divisor makes 4800 baud wrong.",
  },
  {
    id: "ft2232h",
    label: "FT2232H",
    clockHz: 120_000_000,
    channels: 2,
    detail: "120 MHz, channels A and B. PID 6010 on a H revision.",
  },
  {
    id: "ft4232h",
    label: "FT4232H",
    clockHz: 120_000_000,
    channels: 4,
    detail: "120 MHz, channels A to D. PID 6011.",
  },
  {
    id: "ft2232c",
    label: "FT2232C/D",
    clockHz: 48_000_000,
    channels: 2,
    detail: "48 MHz dual channel. Older PID 6010.",
  },
  {
    id: "ft232b",
    label: "FT232B",
    clockHz: 48_000_000,
    channels: 1,
    detail: "48 MHz. PID 6001, bcdDevice 0200.",
  },
  {
    id: "ft232bm",
    label: "FT232BM",
    clockHz: 48_000_000,
    channels: 1,
    detail: "48 MHz. PID 6001, bcdDevice 0400.",
  },
  {
    id: "ftx",
    label: "FT-X",
    clockHz: 48_000_000,
    channels: 1,
    detail: "FT230X, FT231X, or FT234X. 48 MHz. PID 6015, or 6001 with bcdDevice 1000.",
  },
];

const BY_ID = new Map(FT_VARIANTS.map((variant) => [variant.id, variant]));

export function variantById(id: FtVariantId): FtVariant {
  const found = BY_ID.get(id);
  if (!found) throw new BenchError(`Unknown FTDI variant ${id}.`, "ftdi");
  return found;
}

export type FtConfidence = "bcd" | "pid" | "none";

export interface FtIdentity {
  variant: FtVariant | null;
  confidence: FtConfidence;
  vid: number | null;
  pid: number | null;
  bcdDevice: number | null;
  warnings: string[];
  ftdi: boolean;
}

export interface ChipSettings {
  variant: "auto" | FtVariantId;
  channel: 0 | 1 | 2 | 3;
  latencyMs: number;
  path: "auto" | "serial" | "usb";
  expectLoopback: boolean;
  probeOnConnect: boolean;
}

export const DEFAULT_CHIP_SETTINGS: ChipSettings = {
  variant: "auto",
  channel: 0,
  latencyMs: 16,
  path: "auto",
  expectLoopback: false,
  probeOnConnect: true,
};

const SETTINGS_KEY = "m18-chip-settings-v1";
const VARIANT_IDS = new Set(FT_VARIANTS.map((variant) => variant.id));

export function bcdDeviceFromUsb(major?: number, minor?: number, sub?: number): number | null {
  if (major == null || Number.isNaN(major)) return null;
  return ((major & 0xff) << 8) | (((minor ?? 0) & 0x0f) << 4) | ((sub ?? 0) & 0x0f);
}

/** FTDI divisor. 4800 baud at 48 MHz is 625. At 120 MHz it is 17946. */
export function ftdiDivisor(baud: number, clockHz: number): number {
  const divisor3 = Math.round(clockHz / (2 * Math.max(1, baud)));
  let divisor = divisor3 >> 3;
  divisor |= (DIVFRAC[divisor3 & 0x7] ?? 0) << 14;
  if (divisor === 1) divisor = 0;
  else if (divisor === 0x4001) divisor = 1;
  return divisor >>> 0;
}

export function ftdiBaudWords(baud: number, clockHz = 48_000_000): { value: number; index: number } {
  const divisor = ftdiDivisor(baud, clockHz);
  return { value: divisor & 0xffff, index: (divisor >> 16) & 0xffff };
}

export function identifyFtdi(input: {
  vendorId?: number | null;
  productId?: number | null;
  bcdDevice?: number | null;
  productName?: string | null;
}): FtIdentity {
  const vid = input.vendorId ?? null;
  const pid = input.productId ?? null;
  const bcd = input.bcdDevice ?? null;
  const warnings: string[] = [];
  if (vid != null && vid !== 0x0403) {
    warnings.push(`USB id ${hex4(vid)}:${hex4(pid ?? 0)} is not an FTDI chip. FTDI is vendor 0403.`);
    return { variant: null, confidence: "none", vid, pid, bcdDevice: bcd, warnings, ftdi: false };
  }
  if (vid == null) {
    warnings.push("No USB vendor id. Auto keeps the FT232R 48 MHz clock. WebUSB can read the real variant.");
    return { variant: variantById("ft232r"), confidence: "none", vid, pid, bcdDevice: bcd, warnings, ftdi: true };
  }

  const fromBcd = bcd == null ? null : variantFromBcd(bcd);
  const fromPid = variantFromPid(pid, bcd);
  if (fromBcd && fromPid && fromBcd.id !== fromPid.id && fromBcd.clockHz !== fromPid.clockHz) {
    warnings.push(`PID ${hex4(pid ?? 0)} says ${fromPid.label}, but bcdDevice ${hex4(bcd ?? 0)} says ${fromBcd.label}. Using the version word.`);
  }
  const variant = fromBcd ?? fromPid;
  if (!variant) {
    warnings.push(`PID ${hex4(pid ?? 0)} is an FTDI device this bench does not know. Auto uses the FT232R 48 MHz clock.`);
    return { variant: variantById("ft232r"), confidence: "none", vid, pid, bcdDevice: bcd, warnings, ftdi: true };
  }
  if (bcd == null && pid === 0x6001) {
    warnings.push("PID 6001 is shared by FT232R, FT232B, and some clones. bcdDevice was hidden, so this is only a PID guess. Run the WebUSB test.");
  }
  const name = input.productName ?? "";
  if (/232\s*H/i.test(name) && variant.id !== "ft232h") {
    warnings.push(`The product name says FT232H, but the ids look like ${variant.label}.`);
  }
  return {
    variant,
    confidence: fromBcd ? "bcd" : "pid",
    vid,
    pid,
    bcdDevice: bcd,
    warnings,
    ftdi: true,
  };
}

export function resolveFtVariant(settings: ChipSettings, identity: FtIdentity): { variant: FtVariant; warnings: string[] } {
  if (!identity.ftdi) {
    throw new BenchError(identity.warnings[0] ?? "That device is not an FTDI chip.", "ftdi");
  }
  if (settings.variant === "auto") {
    return { variant: identity.variant ?? variantById("ft232r"), warnings: identity.warnings };
  }
  const forced = variantById(settings.variant);
  if (
    identity.variant &&
    identity.confidence !== "none" &&
    forced.id !== identity.variant.id &&
    forced.clockHz !== identity.variant.clockHz
  ) {
    throw new BenchError(
      `Override ${forced.label} (${forced.clockHz / 1_000_000} MHz) does not match ${identity.variant.label} (${identity.variant.clockHz / 1_000_000} MHz). 4800 baud would be wrong.`,
      "ftdi",
    );
  }
  const warnings = [...identity.warnings];
  if (identity.variant && forced.id !== identity.variant.id) {
    warnings.push(`Using the ${forced.label} override. The cable looks like ${identity.variant.label}, and the clocks match.`);
  }
  return { variant: forced, warnings };
}

export function loadChipSettings(): ChipSettings {
  if (typeof localStorage === "undefined") return { ...DEFAULT_CHIP_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_CHIP_SETTINGS };
    return sanitizeChipSettings(JSON.parse(raw) as Partial<ChipSettings>);
  } catch {
    return { ...DEFAULT_CHIP_SETTINGS };
  }
}

export function saveChipSettings(settings: ChipSettings): void {
  const clean = sanitizeChipSettings(settings);
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(clean));
}

export function sanitizeChipSettings(input: Partial<ChipSettings> | null | undefined): ChipSettings {
  const variant = input?.variant === "auto" || (input?.variant && VARIANT_IDS.has(input.variant)) ? input.variant : "auto";
  const channel = input?.channel === 1 || input?.channel === 2 || input?.channel === 3 ? input.channel : 0;
  const latency = Number(input?.latencyMs);
  const latencyMs = Number.isFinite(latency) ? Math.min(255, Math.max(1, Math.round(latency))) : 16;
  const path = input?.path === "serial" || input?.path === "usb" ? input.path : "auto";
  return {
    variant,
    channel,
    latencyMs,
    path,
    expectLoopback: Boolean(input?.expectLoopback),
    probeOnConnect: input?.probeOnConnect !== false,
  };
}

export function hex4(value: number): string {
  return (value & 0xffff).toString(16).padStart(4, "0");
}

function variantFromPid(pid: number | null, bcd: number | null): FtVariant | null {
  if (pid === 0x6014) return variantById("ft232h");
  if (pid === 0x6011) return variantById("ft4232h");
  if (pid === 0x6015) return variantById("ftx");
  if (pid === 0x6010) return (bcd ?? 0) >= 0x0700 ? variantById("ft2232h") : variantById("ft2232c");
  if (pid === 0x6001) return variantFromBcd(bcd) ?? variantById("ft232r");
  return null;
}

function variantFromBcd(bcd: number | null): FtVariant | null {
  if (bcd == null) return null;
  if (bcd === 0x0200) return variantById("ft232b");
  if (bcd === 0x0400) return variantById("ft232bm");
  if (bcd === 0x0500) return variantById("ft2232c");
  if (bcd === 0x0600) return variantById("ft232r");
  if (bcd === 0x0700) return variantById("ft2232h");
  if (bcd === 0x0800) return variantById("ft4232h");
  if (bcd === 0x0900) return variantById("ft232h");
  if (bcd === 0x1000) return variantById("ftx");
  return null;
}
