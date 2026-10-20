import { BenchError } from "./bytes.ts";
import {
  bcdDeviceFromUsb,
  ftdiBaudWords,
  hex4,
  identifyFtdi,
  loadChipSettings,
  resolveFtVariant,
  type ChipSettings,
} from "./ftdi.ts";

export { ftdiBaudWords };

interface WebUsbFilter {
  vendorId?: number;
  classCode?: number;
  subclassCode?: number;
}

interface WebUsbSetup {
  requestType: "vendor" | "class";
  recipient: "device" | "interface";
  request: number;
  value: number;
  index: number;
}

interface WebUsbEndpoint {
  endpointNumber: number;
  direction: "in" | "out";
  type: "bulk" | "interrupt" | "isochronous";
  packetSize: number;
}

interface WebUsbInterface {
  interfaceNumber: number;
  alternates: { interfaceClass: number; endpoints: WebUsbEndpoint[] }[];
}

interface WebUsbDevice {
  vendorId: number;
  productId: number;
  productName?: string | null;
  deviceVersionMajor?: number;
  deviceVersionMinor?: number;
  deviceVersionSubminor?: number;
  configuration: { interfaces: WebUsbInterface[] } | null;
  configurations: { configurationValue: number }[];
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  controlTransferOut(setup: WebUsbSetup, data?: BufferSource): Promise<unknown>;
  controlTransferIn(setup: WebUsbSetup, length: number): Promise<{ data?: DataView | null }>;
  transferIn(endpointNumber: number, length: number): Promise<{ data?: DataView | null }>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<unknown>;
}

interface WebUsbApi {
  requestDevice(options: { filters: WebUsbFilter[] }): Promise<WebUsbDevice>;
}

export interface SerialPortLike {
  open: (options: Record<string, unknown>) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  setSignals: (signals: { break?: boolean; dataTerminalReady?: boolean }) => Promise<void>;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
  transportName?: string;
  chipWarning?: string | null;
}

const USB_FILTERS: WebUsbFilter[] = [
  { vendorId: 0x10c4 },
  { vendorId: 0x1a86 },
  { vendorId: 0x0403 },
  { vendorId: 0x067b },
  { classCode: 2, subclassCode: 2 },
];

type Chip = "cdc" | "cp210x" | "ch340" | "ftdi" | "pl2303";

interface EndpointPlan {
  kind: Chip;
  iface: number;
  extraIface: number | null;
  inEp: number;
  outEp: number;
  packet: number;
}

/** CH340 divisor pair. 4800 baud → a 0x6402, b 24. */
export function ch340BaudIndex(baud: number): { a: number; b: number } {
  let factor = Math.floor(1532620800 / Math.max(1, baud));
  let divisor = 3;
  while (factor > 0xfff0 && divisor > 0) {
    factor = Math.floor(factor / 8);
    divisor -= 1;
  }
  factor = 0x10000 - factor;
  const a = ((factor & 0xff00) | divisor) & 0xffff;
  const b = factor & 0xff;
  return { a, b };
}

export type ProbeStatus = "pass" | "fail" | "warn" | "skip";

export interface ProbeStep {
  id: string;
  name: string;
  status: ProbeStatus;
  detail: string;
}

export async function openWebUsb(): Promise<SerialPortLike> {
  const usb = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { usb?: WebUsbApi }).usb;
  if (!usb) throw new BenchError("This browser has no WebUSB.", "noserial");
  let device: WebUsbDevice;
  try {
    device = await usb.requestDevice({ filters: USB_FILTERS });
  } catch (error) {
    throw mapUsbError(error);
  }
  return new UsbCPort(device);
}

class UsbCPort implements SerialPortLike {
  readable: ReadableStream<Uint8Array> | null = null;
  writable: WritableStream<Uint8Array> | null = null;
  transportName = "USB-C";
  private device: WebUsbDevice;
  private readerOn = false;
  private inEp = 0;
  private outEp = 0;
  private packet = 64;
  private kind: Chip = "cdc";
  private iface = 0;
  private extraIface: number | null = null;
  private dtr = false;
  private ftdiData = 0x1008;
  private channel = 0;
  chipWarning: string | null = null;

  constructor(device: WebUsbDevice) {
    this.device = device;
  }

  getInfo() {
    return { usbVendorId: this.device.vendorId, usbProductId: this.device.productId };
  }

  async open(options: Record<string, unknown>) {
    const baud = typeof options.baudRate === "number" ? options.baudRate : 4800;
    const dataBits = options.dataBits === 7 ? 7 : 8;
    const stopBits = options.stopBits === 1 ? 1 : 2;
    const parity = options.parity === "odd" || options.parity === "even" ? options.parity : "none";
    try {
      await this.device.open();
      if (!this.device.configuration) {
        const value = this.device.configurations[0]?.configurationValue ?? 1;
        await this.device.selectConfiguration(value);
      }
      const plan = planDevice(this.device);
      this.kind = plan.kind;
      this.iface = plan.iface;
      this.extraIface = plan.extraIface;
      this.inEp = plan.inEp;
      this.outEp = plan.outEp;
      this.packet = plan.packet;
      this.transportName = `USB-C ${plan.kind}`;
      await this.device.claimInterface(plan.iface);
      if (plan.extraIface != null) await this.device.claimInterface(plan.extraIface);
      await this.initChip(baud, dataBits, stopBits, parity);
      try {
        await this.setSignals({ break: true, dataTerminalReady: true });
      } catch {
        /* SerialLink holds the line again and reports a break failure there. */
      }
      this.readerOn = true;
      const packet = this.packet;
      this.readable = new ReadableStream<Uint8Array>({
        pull: async (controller) => {
          while (this.readerOn) {
            try {
              const result = await this.device.transferIn(this.inEp, packet);
              if (!this.readerOn) {
                controller.close();
                return;
              }
              const bytes = payloadBytes(this.kind, result.data);
              if (bytes && bytes.length) {
                controller.enqueue(bytes);
                return;
              }
            } catch (error) {
              if (!this.readerOn) {
                try { controller.close(); } catch { /* already closed */ }
                return;
              }
              controller.error(error);
              return;
            }
          }
          try { controller.close(); } catch { /* already closed */ }
        },
        cancel: () => {
          this.readerOn = false;
        },
      });
      this.writable = new WritableStream<Uint8Array>({
        write: async (chunk) => {
          await this.device.transferOut(this.outEp, chunk as BufferSource);
        },
      });
    } catch (error) {
      try { await this.device.close(); } catch { /* ignore */ }
      throw mapUsbError(error);
    }
  }

  async close() {
    this.readerOn = false;
    try {
      if (this.extraIface != null && this.device.configuration) await this.device.releaseInterface(this.extraIface);
      if (this.device.configuration) await this.device.releaseInterface(this.iface);
    } catch { /* ignore */ }
    try { await this.device.close(); } catch { /* ignore */ }
  }

  async setSignals(signals: { break?: boolean; dataTerminalReady?: boolean }) {
    if (signals.dataTerminalReady != null) this.dtr = signals.dataTerminalReady;
    const wantBreak = signals.break;
    if (this.kind === "cdc") await this.cdcSignals(wantBreak);
    else if (this.kind === "cp210x") await this.cpSignals(wantBreak);
    else if (this.kind === "ch340") await this.chSignals(wantBreak);
    else if (this.kind === "ftdi") await this.ftdiSignals(wantBreak);
    else await this.plSignals(wantBreak);
  }

  private async initChip(baud: number, dataBits: number, stopBits: number, parity: string) {
    if (this.kind === "cdc") {
      await this.classOut(0x20, 0, this.iface, lineCoding(baud, dataBits, stopBits, parity));
      return;
    }
    if (this.kind === "cp210x") {
      await this.vendorOut("interface", 0x00, 0x0001, this.iface);
      const baudBytes = new ArrayBuffer(4);
      new DataView(baudBytes).setUint32(0, baud, true);
      await this.vendorOut("interface", 0x1e, 0, this.iface, baudBytes);
      await this.vendorOut("interface", 0x03, cpLine(dataBits, stopBits, parity), this.iface);
      return;
    }
    if (this.kind === "ch340") {
      try {
        await this.device.controlTransferIn(
          { requestType: "vendor", recipient: "device", request: 0x5f, value: 0, index: 0 },
          8,
        );
      } catch { /* some clones skip the version read */ }
      await this.vendorOut("device", 0xa1, 0, 0);
      const { a, b } = ch340BaudIndex(baud);
      await this.vendorOut("device", 0x9a, 0x1312, a);
      await this.vendorOut("device", 0x9a, 0x0f2c, b);
      const lcr = chLcr(dataBits, stopBits, parity);
      await this.vendorOut("device", 0x9a, (lcr << 8) | 0x18, 0);
      return;
    }
    if (this.kind === "ftdi") {
      const settings = loadChipSettings();
      const identity = identifyFtdi({
        vendorId: this.device.vendorId,
        productId: this.device.productId,
        bcdDevice: bcdDeviceFromUsb(this.device.deviceVersionMajor, this.device.deviceVersionMinor, this.device.deviceVersionSubminor),
        productName: this.device.productName,
      });
      const resolved = resolveFtVariant(settings, identity);
      const variant = resolved.variant;
      if (settings.channel > variant.channels - 1) {
        throw new BenchError(
          `${variant.label} stops at channel ${["A", "B", "C", "D"][variant.channels - 1]}. Pick that channel on Debug.`,
          "ftdi",
        );
      }
      this.channel = settings.channel;
      this.transportName = `USB-C ${variant.label}`;
      await this.vendorOut("device", 0x00, 0, this.channel);
      const words = ftdiBaudWords(baud, variant.clockHz);
      await this.vendorOut("device", 0x03, words.value, ((this.channel << 8) | words.index) & 0xffff);
      this.ftdiData = ftdiDataBits(dataBits, stopBits, parity);
      await this.vendorOut("device", 0x04, this.ftdiData, this.channel);
      await this.vendorOut("device", 0x09, settings.latencyMs, this.channel);
      const check = await this.readLatency(settings);
      const notes = [...resolved.warnings];
      if (check) notes.push(check);
      this.chipWarning = notes.length ? notes.join(" ") : null;
      if (settings.probeOnConnect && check) {
        throw new BenchError(`${variant.label}: ${check}`, "ftdi");
      }
      return;
    }
    await this.vendorOut("device", 0x20, 0, 0, lineCoding(baud, dataBits, stopBits, parity));
  }

  private async cdcSignals(wantBreak: boolean | undefined) {
    await this.classOut(0x22, this.dtr ? 1 : 0, this.iface);
    if (wantBreak != null) await this.classOut(0x23, wantBreak ? 0xffff : 0, this.iface);
  }

  private async cpSignals(wantBreak: boolean | undefined) {
    const mhs = 0x0100 | (this.dtr ? 0x0001 : 0);
    await this.vendorOut("interface", 0x07, mhs, this.iface);
    if (wantBreak != null) await this.vendorOut("interface", 0x05, wantBreak ? 1 : 0, this.iface);
  }

  private async chSignals(wantBreak: boolean | undefined) {
    const control = this.dtr ? 1 << 5 : 0;
    await this.vendorOut("device", 0xa4, (~control) & 0xffff, 0);
    if (wantBreak != null) await this.vendorOut("device", 0x9a, ((wantBreak ? 0x01 : 0) << 8) | 0x05, 0);
  }

  private async ftdiSignals(wantBreak: boolean | undefined) {
    await this.vendorOut("device", 0x01, this.dtr ? 0x0101 : 0x0100, this.channel);
    if (wantBreak != null) {
      await this.vendorOut("device", 0x04, this.ftdiData | (wantBreak ? 0x4000 : 0), this.channel);
    }
  }

  private async plSignals(wantBreak: boolean | undefined) {
    await this.vendorOut("device", 0x22, this.dtr ? 1 : 0, 0);
    if (wantBreak != null) await this.vendorOut("device", 0x23, wantBreak ? 0xffff : 0, 0);
  }

  private async readLatency(settings: ChipSettings): Promise<string | null> {
    try {
      const result = await this.device.controlTransferIn(
        { requestType: "vendor", recipient: "device", request: 0x0a, value: 0, index: this.channel },
        1,
      );
      const got = result.data?.getUint8(0);
      if (got == null) return "The latency read came back empty. Many fake FT232 chips ignore that request.";
      if (got !== settings.latencyMs) {
        return `Latency timer wrote ${settings.latencyMs} ms and the chip read ${got} ms. A clone, or the wrong channel.`;
      }
      return null;
    } catch {
      return "The chip did not answer the latency read. The cable may be a clone that only speaks COM-port requests.";
    }
  }

  private vendorOut(
    recipient: "device" | "interface",
    request: number,
    value: number,
    index: number,
    data?: BufferSource,
  ) {
    return this.device.controlTransferOut(
      { requestType: "vendor", recipient, request, value: value & 0xffff, index: index & 0xffff },
      data,
    );
  }

  private classOut(request: number, value: number, index: number, data?: BufferSource) {
    return this.device.controlTransferOut(
      { requestType: "class", recipient: "interface", request, value: value & 0xffff, index },
      data,
    );
  }
}

function lineCoding(baud: number, dataBits: number, stopBits: number, parity: string): ArrayBuffer {
  const buffer = new ArrayBuffer(7);
  const view = new DataView(buffer);
  view.setUint32(0, baud, true);
  view.setUint8(4, stopBits === 2 ? 2 : 0);
  view.setUint8(5, parity === "odd" ? 1 : parity === "even" ? 2 : 0);
  view.setUint8(6, dataBits);
  return buffer;
}

function cpLine(dataBits: number, stopBits: number, parity: string): number {
  const data = dataBits === 5 ? 0x0500 : dataBits === 6 ? 0x0600 : dataBits === 7 ? 0x0700 : 0x0800;
  const par = parity === "odd" ? 0x0010 : parity === "even" ? 0x0020 : 0;
  const stop = stopBits === 2 ? 0x0002 : 0;
  return data | par | stop;
}

function chLcr(dataBits: number, stopBits: number, parity: string): number {
  let val = 0xc0;
  val |= dataBits === 5 ? 0 : dataBits === 6 ? 1 : dataBits === 7 ? 2 : 3;
  if (stopBits === 2) val |= 0x04;
  if (parity === "odd" || parity === "even") {
    val |= 0x08;
    if (parity === "even") val |= 0x10;
  }
  return val;
}

function ftdiDataBits(dataBits: number, stopBits: number, parity: string): number {
  const par = parity === "odd" ? 1 << 8 : parity === "even" ? 2 << 8 : 0;
  const stop = stopBits === 2 ? 2 << 11 : 0;
  return (dataBits & 0xff) | par | stop;
}

function planDevice(device: WebUsbDevice): EndpointPlan {
  const config = device.configuration;
  if (!config) throw new BenchError("The USB-C device has no configuration.", "usb");
  const cdcControl = findClass(config.interfaces, 2);
  const cdcData = findClass(config.interfaces, 10);
  if (cdcControl && cdcData) {
    const eps = bulkEndpoints(cdcData);
    if (eps) {
      return { kind: "cdc", iface: cdcControl.interfaceNumber, extraIface: cdcData.interfaceNumber, ...eps };
    }
  }
  if (cdcControl) {
    const eps = bulkEndpoints(cdcControl);
    if (eps) return { kind: "cdc", iface: cdcControl.interfaceNumber, extraIface: null, ...eps };
  }
  const first = config.interfaces[0];
  if (!first) throw new BenchError("The USB-C device has no interfaces.", "usb");
  const eps = bulkEndpoints(first);
  if (!eps) throw new BenchError("The USB-C device has no bulk in and out endpoints.", "usb");
  const kind = chipForVendor(device.vendorId);
  if (!kind) {
    throw new BenchError(
      "That USB device is not a supported serial adapter. Use a CP210x, CH340, FTDI, PL2303, or CDC-ACM cable at 3.3 V.",
      "usb",
    );
  }
  return { kind, iface: first.interfaceNumber, extraIface: null, ...eps };
}

function chipForVendor(vendorId: number): Chip | null {
  if (vendorId === 0x10c4) return "cp210x";
  if (vendorId === 0x1a86) return "ch340";
  if (vendorId === 0x0403) return "ftdi";
  if (vendorId === 0x067b) return "pl2303";
  return null;
}

function findClass(interfaces: WebUsbInterface[], classCode: number): WebUsbInterface | null {
  return interfaces.find((iface) => iface.alternates[0]?.interfaceClass === classCode) ?? null;
}

function bulkEndpoints(iface: WebUsbInterface): { inEp: number; outEp: number; packet: number } | null {
  const alt = iface.alternates[0];
  if (!alt) return null;
  const incoming = alt.endpoints.find((endpoint) => endpoint.direction === "in" && endpoint.type === "bulk");
  const outgoing = alt.endpoints.find((endpoint) => endpoint.direction === "out" && endpoint.type === "bulk");
  if (!incoming || !outgoing) return null;
  return {
    inEp: incoming.endpointNumber,
    outEp: outgoing.endpointNumber,
    packet: Math.max(incoming.packetSize || 0, 64),
  };
}

function payloadBytes(kind: Chip, data: DataView | null | undefined): Uint8Array | null {
  if (!data || data.byteLength === 0) return null;
  const strip = kind === "ftdi" ? 2 : 0;
  if (data.byteLength <= strip) return null;
  return new Uint8Array(data.buffer.slice(data.byteOffset + strip, data.byteOffset + data.byteLength));
}

export async function probeFtdiUsb(settings: ChipSettings): Promise<ProbeStep[]> {
  const usb = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { usb?: WebUsbApi }).usb;
  if (!usb) throw new BenchError("This browser has no WebUSB.", "noserial");
  let device: WebUsbDevice;
  try {
    device = await usb.requestDevice({ filters: [{ vendorId: 0x0403 }] });
  } catch (error) {
    throw mapUsbError(error);
  }
  const steps: ProbeStep[] = [];
  try {
    await device.open();
    if (!device.configuration) {
      await device.selectConfiguration(device.configurations[0]?.configurationValue ?? 1);
    }
    const identity = identifyFtdi({
      vendorId: device.vendorId,
      productId: device.productId,
      bcdDevice: bcdDeviceFromUsb(device.deviceVersionMajor, device.deviceVersionMinor, device.deviceVersionSubminor),
      productName: device.productName,
    });
    const idText = `${hex4(device.vendorId)}:${hex4(device.productId)}${identity.bcdDevice == null ? "" : ` bcd ${hex4(identity.bcdDevice)}`}`;
    steps.push({
      id: "identify",
      name: "Identify",
      status: identity.ftdi ? (identity.confidence === "bcd" && identity.warnings.length === 0 ? "pass" : "warn") : "fail",
      detail: identity.ftdi
        ? `${identity.variant?.label ?? "FTDI"} ${idText}. ${identity.warnings[0] ?? identity.variant?.detail ?? ""}`.trim()
        : (identity.warnings[0] ?? `${idText} is not FTDI.`),
    });
    if (!identity.ftdi || !identity.variant) return steps;

    let variant;
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
    if (settings.channel > variant.channels - 1) {
      steps.push({
        id: "channel",
        name: "Channel",
        status: "fail",
        detail: `${variant.label} has channel ${channelName(variant.channels - 1)} as its last channel. ${channelName(settings.channel)} is not on this chip.`,
      });
      return steps;
    }
    const channel = settings.channel;
    const plan = planDevice(device);
    await device.claimInterface(plan.iface);
    if (plan.extraIface != null) await device.claimInterface(plan.extraIface);

    const vendor = (request: number, value: number, index: number, data?: BufferSource) =>
      device.controlTransferOut(
        { requestType: "vendor", recipient: "device", request, value: value & 0xffff, index: index & 0xffff },
        data,
      );
    const vendorIn = async (request: number, index: number, length: number) => {
      const result = await device.controlTransferIn(
        { requestType: "vendor", recipient: "device", request, value: 0, index: index & 0xffff },
        length,
      );
      const data = result.data;
      if (!data || data.byteLength === 0) return new Uint8Array();
      return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    };

    await vendor(0x00, 0, channel);
    steps.push({ id: "reset", name: "Reset", status: "pass", detail: "The chip accepted the FTDI reset on this channel." });

    const words = ftdiBaudWords(4800, variant.clockHz);
    await vendor(0x03, words.value, ((channel << 8) | words.index) & 0xffff);
    steps.push({
      id: "baud",
      name: "Set 4800 baud",
      status: "pass",
      detail: `${variant.label} took divisor ${hex4(words.value)} from its ${variant.clockHz / 1_000_000} MHz clock.`,
    });

    const line = ftdiDataBits(8, 2, "none");
    await vendor(0x04, line, channel);
    steps.push({ id: "linecode", name: "Set 8N2", status: "pass", detail: "Data bits, parity, and two stop bits were accepted. That is the M18 frame." });

    await vendor(0x09, settings.latencyMs, channel);
    try {
      const latency = await vendorIn(0x0a, channel, 1);
      if (!latency.length) {
        steps.push({
          id: "latency",
          name: "Latency timer",
          status: "fail",
          detail: "The latency read was empty. The chip is not answering vendor request 0x0A.",
        });
      } else if (latency[0] !== settings.latencyMs) {
        steps.push({
          id: "latency",
          name: "Latency timer",
          status: "fail",
          detail: `Wrote ${settings.latencyMs} ms and read ${latency[0]} ms. Wrong channel, or a clone that ignores the timer.`,
        });
      } else {
        steps.push({
          id: "latency",
          name: "Latency timer",
          status: "pass",
          detail: `Read back ${latency[0]} ms. The chip is answering vendor requests.`,
        });
      }
    } catch {
      steps.push({
        id: "latency",
        name: "Latency timer",
        status: "fail",
        detail: "The latency read failed. Communication to the FT232 registers stopped after baud was set.",
      });
    }

    try {
      const modem = await vendorIn(0x05, channel, 2);
      steps.push({
        id: "modem",
        name: "Modem status",
        status: modem.length >= 2 ? "pass" : "fail",
        detail:
          modem.length >= 2
            ? `Status bytes ${hex4(modem[0]).slice(2)} ${hex4(modem[1]).slice(2)}. The chip returned its line flags.`
            : "The modem-status read was short. The bulk pipe may be up while vendor reads are not.",
      });
    } catch {
      steps.push({
        id: "modem",
        name: "Modem status",
        status: "fail",
        detail: "The chip refused the modem-status read.",
      });
    }

    try {
      const word = await vendorIn(0x90, 0, 2);
      steps.push({
        id: "eeprom",
        name: "EEPROM read",
        status: word.length === 2 ? "pass" : "warn",
        detail:
          word.length === 2
            ? `Word 0 is ${hex4(word[0] | (word[1] << 8))}. Read only. Nothing was written, so a counterfeit is not bricked.`
            : "EEPROM word 0 came back empty. Some clones have no EEPROM. The UART may still work.",
      });
    } catch {
      steps.push({
        id: "eeprom",
        name: "EEPROM read",
        status: "warn",
        detail: "EEPROM read failed. Common on fake FT232 parts. The test did not write anything.",
      });
    }

    try {
      await vendor(0x01, 0x0101, channel);
      await vendor(0x04, line | 0x4000, channel);
      await vendor(0x04, line, channel);
      await vendor(0x01, 0x0100, channel);
      steps.push({
        id: "break",
        name: "Break and DTR",
        status: "pass",
        detail: "Break and DTR were set and released. That is the M18 idle line.",
      });
    } catch {
      steps.push({
        id: "break",
        name: "Break and DTR",
        status: "fail",
        detail: "The chip accepted baud but refused break or DTR. The pack line cannot be held low through this cable.",
      });
    }

    if (settings.expectLoopback) {
      steps.push(await usbEcho(device, plan));
    } else {
      steps.push({
        id: "echo",
        name: "TX to RX echo",
        status: "skip",
        detail: "Turn on the jumper option and tie adapter TX to RX if you want a wire test.",
      });
    }
    return steps;
  } catch (error) {
    steps.push({
      id: "open",
      name: "Open chip",
      status: "fail",
      detail: mapUsbError(error).message,
    });
    return steps;
  } finally {
    try {
      await device.close();
    } catch {
      /* ignore */
    }
  }
}

async function usbEcho(device: WebUsbDevice, plan: EndpointPlan): Promise<ProbeStep> {
  try {
    await device.transferOut(plan.outEp, new Uint8Array([0x55]));
    const incoming = device.transferIn(plan.inEp, Math.max(plan.packet, 64));
    const hit = await Promise.race([incoming.then((result) => result.data ?? null), wait(400).then(() => null)]);
    if (!hit || hit.byteLength <= 2) {
      return {
        id: "echo",
        name: "TX to RX echo",
        status: "fail",
        detail: "Wrote 55 and nothing came back. Jumper TX to RX, or the pins are not moving.",
      };
    }
    const bytes = new Uint8Array(hit.buffer.slice(hit.byteOffset, hit.byteOffset + hit.byteLength));
    const echoed = Array.from(bytes.slice(2)).includes(0x55);
    return {
      id: "echo",
      name: "TX to RX echo",
      status: echoed ? "pass" : "warn",
      detail: echoed ? "Read 55 back after the FTDI status bytes. TX and RX are talking." : "Bytes came back, but 55 was not in them.",
    };
  } catch (error) {
    return {
      id: "echo",
      name: "TX to RX echo",
      status: "fail",
      detail: error instanceof Error ? error.message : "The echo transfer failed.",
    };
  }
}

function channelName(channel: number): string {
  return ["A", "B", "C", "D"][channel] ?? String(channel);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapUsbError(error: unknown): Error {
  if (error instanceof BenchError) return error;
  if (error instanceof DOMException) {
    if (error.name === "NotFoundError" || error.name === "AbortError") {
      return new BenchError("USB-C chooser closed. Nothing was changed.", "cancelled");
    }
    if (error.name === "SecurityError") {
      return new BenchError(
        "The browser blocked USB-C. Open M18 Bench in its own window. A chat preview cannot see USB devices.",
        "blocked",
      );
    }
    if (error.name === "NetworkError" || /claim|access denied|busy|protected/i.test(error.message)) {
      return new BenchError(
        "Could not claim that USB-C adapter. If it already has a COM port, use Connect USB-C instead of WebUSB.",
        "usb",
      );
    }
  }
  if (error instanceof Error && error.message) return new BenchError(error.message, "usb");
  return new BenchError("The USB-C adapter did not open.", "usb");
}
