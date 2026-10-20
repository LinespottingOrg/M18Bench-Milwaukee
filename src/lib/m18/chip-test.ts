import { BenchError } from "./bytes.ts";
import { detectPlatform, type PlatformInfo } from "./platform.ts";
import {
  ftdiBaudWords,
  hex4,
  identifyFtdi,
  resolveFtVariant,
  type ChipSettings,
  type FtVariant,
} from "./ftdi.ts";
import { probeFtdiUsb, type ProbeStep } from "./usb.ts";

export type { ProbeStep };

export interface ChipTestReport {
  at: string;
  platform: string;
  path: "webusb" | "webserial" | "none";
  ok: boolean;
  headline: string;
  steps: ProbeStep[];
}

export function browserChipSteps(info: Pick<PlatformInfo, "id" | "serial" | "usb">): ProbeStep[] {
  const ios = info.id === "ios";
  return [
    {
      id: "platform",
      name: "Platform",
      status: "pass",
      detail:
        info.id === "ios"
          ? "iOS app. The checks below are the communication test. The phone still hides the cable."
          : info.id === "android"
            ? "Android app. WebUSB is the FT232 test. Chrome can also open a serial port."
            : info.id === "windows"
              ? "Windows app. Edge or Chrome can open the COM port, and WebUSB can talk to the FT232 registers."
              : `${info.id} app.`,
    },
    {
      id: "webserial",
      name: "Web Serial",
      status: info.serial ? "pass" : "fail",
      detail: info.serial
        ? "This browser can open a COM port at 4800 8N2."
        : ios
          ? "Missing, and iOS does not add it for a home-screen app either."
          : "Missing. On Windows use Edge or Chrome in its own window. On Android use Chrome.",
    },
    {
      id: "webusb",
      name: "WebUSB",
      status: info.usb ? "pass" : ios ? "fail" : "warn",
      detail: info.usb
        ? "This browser can send FT232 vendor requests: baud, latency, modem status, EEPROM read."
        : ios
          ? "Missing. iPhone and iPad do not hand the USB-C port to the app."
          : "Missing. The COM-port test can still open the cable, but it cannot name the FT232 variant from bcdDevice.",
    },
  ];
}

export function baudPreview(variant: FtVariant): string {
  const words = ftdiBaudWords(4800, variant.clockHz);
  return `${variant.label} divisor ${hex4(words.value)} at 4800 baud, from a ${variant.clockHz / 1_000_000} MHz clock.`;
}

export function formatChipTest(report: ChipTestReport): string {
  const lines = [
    `M18 Bench FT232 test ${report.at}`,
    report.headline,
    `Platform ${report.platform}, path ${report.path}, ${report.ok ? "PASS" : "FAIL"}`,
    ...report.steps.map((step) => `${step.status.toUpperCase()}  ${step.name}  ${step.detail}`),
  ];
  return lines.join("\n");
}

export async function runChipTest(settings: ChipSettings): Promise<ChipTestReport> {
  const platform = detectPlatform();
  const steps = browserChipSteps(platform);
  const at = new Date().toISOString();
  if (!platform.serial && !platform.usb) {
    return {
      at,
      platform: platform.kicker,
      path: "none",
      ok: false,
      headline:
        platform.id === "ios"
          ? "No communication to an FT232 from this iOS app. Web Serial and WebUSB are both missing, so the test stops before the chooser."
          : "This browser cannot open an FT232. Use Edge or Chrome on Windows, or Chrome on Android.",
      steps,
    };
  }

  const wantUsb = settings.path === "usb" || (settings.path === "auto" && !platform.serial && platform.usb);
  if (wantUsb && !platform.usb) {
    steps.push({
      id: "path",
      name: "WebUSB path",
      status: "fail",
      detail: "WebUSB was selected, and this browser does not have it.",
    });
    return finish(platform, "none", steps, at);
  }
  if (!wantUsb && settings.path === "serial" && !platform.serial) {
    steps.push({
      id: "path",
      name: "COM path",
      status: "fail",
      detail: "Web Serial was selected, and this browser does not have it.",
    });
    return finish(platform, "none", steps, at);
  }

  try {
    if (wantUsb || (!platform.serial && platform.usb)) {
      steps.push(...(await probeFtdiUsb(settings)));
      return finish(platform, "webusb", steps, at);
    }
    steps.push(...(await probeSerial(settings)));
    return finish(platform, "webserial", steps, at);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The chip test failed.";
    const cancelled = error instanceof BenchError && error.code === "cancelled";
    steps.push({
      id: "open",
      name: cancelled ? "Chooser" : "Chip test",
      status: "fail",
      detail: message,
    });
    return {
      at,
      platform: platform.kicker,
      path: wantUsb ? "webusb" : "webserial",
      ok: false,
      headline: cancelled ? "Chooser closed. Nothing was tested on the chip." : message,
      steps,
    };
  }
}

function finish(platform: PlatformInfo, path: ChipTestReport["path"], steps: ProbeStep[], at: string): ChipTestReport {
  const failed = steps.filter((step) => step.status === "fail");
  const ok = failed.length === 0;
  const chip = steps.find((step) => step.id === "identify");
  const headline = ok
    ? chip
      ? `Chip answered. ${chip.detail}`
      : "The browser checks passed. Pick a cable to test the chip itself."
    : failed[0]?.detail ?? "The chip test failed.";
  return { at, platform: platform.kicker, path, ok, headline, steps };
}

async function probeSerial(settings: ChipSettings): Promise<ProbeStep[]> {
  const steps: ProbeStep[] = [];
  const api = (navigator as Navigator & { serial?: { requestPort: () => Promise<SerialPort> } }).serial;
  if (!api) {
    steps.push({ id: "open", name: "COM port", status: "fail", detail: "Web Serial disappeared before the chooser opened." });
    return steps;
  }
  let port: SerialPort;
  try {
    port = await api.requestPort();
  } catch (error) {
    if (error instanceof DOMException && (error.name === "NotFoundError" || error.name === "AbortError")) {
      throw new BenchError("Port chooser closed. Nothing was changed.", "cancelled");
    }
    throw new BenchError("The browser blocked the COM port. Open this app in its own Edge or Chrome window.", "blocked");
  }
  const info = port.getInfo?.() ?? {};
  const identity = identifyFtdi({ vendorId: info.usbVendorId, productId: info.usbProductId, bcdDevice: null });
  steps.push({
    id: "identify",
    name: "Identify",
    status: identity.ftdi ? (identity.confidence === "none" ? "warn" : "pass") : "fail",
    detail: identity.ftdi
      ? `${identity.variant?.label ?? "FTDI"} from ${identity.vid == null ? "no USB id" : `${hex4(identity.vid)}:${hex4(identity.pid ?? 0)}`}. ${identity.warnings[0] ?? "COM ports do not show bcdDevice."}`
      : (identity.warnings[0] ?? "Not an FTDI chip."),
  });
  if (!identity.ftdi) return steps;

  let variant: FtVariant;
  try {
    variant = resolveFtVariant(settings, identity).variant;
  } catch (error) {
    steps.push({
      id: "override",
      name: "Variant override",
      status: "fail",
      detail: error instanceof Error ? error.message : "The override does not match the chip.",
    });
    return steps;
  }
  const words = ftdiBaudWords(4800, variant.clockHz);
  steps.push({
    id: "baud",
    name: "4800 baud divisor",
    status: "pass",
    detail: `${variant.label} divisor ${hex4(words.value)}. Windows applies this inside the COM driver, not from this page.`,
  });

  try {
    await port.open({ baudRate: 4800, dataBits: 8, stopBits: 2, parity: "none", flowControl: "none" });
  } catch (error) {
    steps.push({
      id: "open",
      name: "Open 4800 8N2",
      status: "fail",
      detail: error instanceof Error ? error.message : "The COM port did not open.",
    });
    return steps;
  }

  steps.push({ id: "open", name: "Open 4800 8N2", status: "pass", detail: "The COM port accepted 4800 8N2, which is the M18 line." });
  try {
    try {
      await port.setSignals({ break: true, dataTerminalReady: true });
      await port.setSignals({ break: false, dataTerminalReady: false });
      steps.push({
        id: "line",
        name: "Break and DTR",
        status: "pass",
        detail: "The COM port accepted break and DTR. That is what holds the M18 TX line low.",
      });
    } catch {
      try {
        await port.setSignals({ dataTerminalReady: true });
        steps.push({
          id: "line",
          name: "Break and DTR",
          status: "warn",
          detail: "Break was rejected. DTR still moved. Fake FT232 adapters often only pull TX down through DTR.",
        });
      } catch {
        steps.push({
          id: "line",
          name: "Break and DTR",
          status: "fail",
          detail: "The adapter refused both break and DTR. The chip is open, but the M18 line cannot be held low.",
        });
      }
    }
    if (settings.expectLoopback) {
      steps.push(await serialEcho(port));
    } else {
      steps.push({
        id: "echo",
        name: "TX to RX echo",
        status: "skip",
        detail: "Turn on the jumper option and tie the adapter TX to RX to test the wires.",
      });
    }
    steps.push({
      id: "vendor",
      name: "FT232 registers",
      status: "skip",
      detail: "A COM port cannot read the latency timer or EEPROM. Run the same test through WebUSB for that.",
    });
  } finally {
    try {
      await port.close();
    } catch {
      /* already closed */
    }
  }
  return steps;
}

async function serialEcho(port: SerialPort): Promise<ProbeStep> {
  const writer = port.writable?.getWriter();
  const reader = port.readable?.getReader();
  if (!writer || !reader) {
    return { id: "echo", name: "TX to RX echo", status: "fail", detail: "The COM port has no read or write pipe." };
  }
  try {
    await writer.write(new Uint8Array([0x55]));
    const read = reader.read();
    const hit = await Promise.race([read.then((value) => value), wait(400).then(() => null)]);
    if (!hit || hit.done || !hit.value?.length) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      return {
        id: "echo",
        name: "TX to RX echo",
        status: "fail",
        detail: "Wrote 55 and nothing came back. Jumper TX to RX, or the chip is not moving the wires.",
      };
    }
    const echoed = Array.from(hit.value).includes(0x55);
    return {
      id: "echo",
      name: "TX to RX echo",
      status: echoed ? "pass" : "warn",
      detail: echoed ? "Read 55 back. TX and RX are talking." : `Read ${Array.from(hit.value, (b) => b.toString(16)).join(" ")}, not 55.`,
    };
  } catch (error) {
    return { id: "echo", name: "TX to RX echo", status: "fail", detail: error instanceof Error ? error.message : "Echo failed." };
  } finally {
    try {
      writer.releaseLock();
    } catch {
      /* ignore */
    }
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SerialPort {
  open: (options: Record<string, unknown>) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  setSignals: (signals: { break?: boolean; dataTerminalReady?: boolean }) => Promise<void>;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
}
