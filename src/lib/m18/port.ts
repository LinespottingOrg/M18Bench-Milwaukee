import { BenchError, checksum, hex, reverseBits, sleep } from "@/lib/m18/bytes";
import { acquirePort, type ConnectMode } from "@/lib/m18/transport";
import type { SerialPortLike } from "@/lib/m18/usb";

export interface TraceLine {
  id: number;
  at: string;
  dir: "tx" | "rx" | "info";
  text: string;
}

class ByteQueue {
  private buf: number[] = [];
  private waiters: { resolve: (byte: number | null) => void; timer: ReturnType<typeof setTimeout> }[] = [];

  push(bytes: number[]) {
    for (const byte of bytes) {
      const waiter = this.waiters.shift();
      if (waiter) {
        clearTimeout(waiter.timer);
        waiter.resolve(byte);
      } else {
        this.buf.push(byte);
      }
    }
  }

  clear() {
    this.buf = [];
  }

  fail() {
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(null);
    }
    this.waiters = [];
  }

  take(deadline: number): Promise<number | null> {
    if (this.buf.length) return Promise.resolve(this.buf.shift() ?? null);
    const remaining = deadline - Date.now();
    if (remaining <= 0) return Promise.resolve(null);
    return new Promise((resolve) => {
      const waiter = {
        resolve,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((item) => item !== waiter);
          resolve(null);
        }, remaining),
      };
      this.waiters.push(waiter);
    });
  }
}

/**
 * UART link for the M18 charger contacts.
 * 4800 baud, 8 data bits, 2 stop bits, no parity.
 * Every byte is bit-reversed on the wire, matching m18.py.
 * The byte pipe is Web Serial (USB-C / COM) or WebUSB.
 */
export class SerialLink {
  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private queue = new ByteQueue();
  private acc = 0x04;
  private running = false;
  private seq = 1;
  private onTrace: (line: TraceLine) => void = () => {};
  label = "USB-C";

  setTrace(cb: (line: TraceLine) => void) {
    this.onTrace = cb;
  }

  private emit(dir: TraceLine["dir"], text: string) {
    this.onTrace({ id: this.seq++, at: new Date().toISOString(), dir, text });
  }

  async connect(mode: ConnectMode = "auto"): Promise<string> {
    const port = await acquirePort(mode);
    try {
      await port.open({
        baudRate: 4800,
        dataBits: 8,
        stopBits: 2,
        parity: "none",
        flowControl: "none",
        bufferSize: 4096,
      });
    } catch (error) {
      if (error instanceof BenchError) throw error;
      throw new BenchError(error instanceof Error ? error.message : "The serial port did not open.", "closed");
    }
    if (!port.readable || !port.writable) {
      try { await port.close(); } catch { /* ignore */ }
      throw new BenchError("The serial port did not open readable and writable.", "closed");
    }
    this.port = port;
    this.reader = port.readable.getReader();
    this.writer = port.writable.getWriter();
    this.running = true;
    this.acc = 0x04;
    const info = port.getInfo?.() ?? {};
    if (info.usbVendorId != null) {
      const vid = info.usbVendorId.toString(16).padStart(4, "0");
      const pid = (info.usbProductId ?? 0).toString(16).padStart(4, "0");
      this.label = `${port.transportName ?? "USB-C"} ${vid}:${pid}`;
    } else {
      this.label = port.transportName ?? "Serial port";
    }
    void this.pump();
    await this.idle();
    this.emit("info", `${this.label} open at 4800 8N2. TX held low.`);
    return this.label;
  }

  private async pump() {
    const reader = this.reader;
    try {
      while (this.running && reader) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value && value.length) {
          const decoded: number[] = [];
          for (const byte of value) decoded.push(reverseBits(byte));
          this.queue.push(decoded);
        }
      }
    } catch {
      this.queue.fail();
      if (this.running) this.emit("info", "Serial read stopped.");
    }
  }

  async disconnect() {
    this.running = false;
    this.queue.fail();
    this.queue.clear();
    const reader = this.reader;
    this.reader = null;
    if (reader) {
      try { await reader.cancel(); } catch { /* ignore */ }
      try { reader.releaseLock(); } catch { /* ignore */ }
    }
    const writer = this.writer;
    this.writer = null;
    if (writer) {
      try { writer.releaseLock(); } catch { /* ignore */ }
    }
    const port = this.port;
    this.port = null;
    if (port) {
      try { await port.close(); } catch { /* ignore */ }
    }
    this.emit("info", "Port closed.");
  }

  cancelPending() {
    this.queue.fail();
  }

  async idle() {
    await this.signals(true);
    this.emit("info", "TX line held low (break + DTR).");
  }

  async high() {
    await this.signals(false);
    this.emit("info", "TX line released. Held high, this can count as a dumb charge after about half a second.");
  }

  private async signals(low: boolean) {
    if (!this.port) throw new BenchError("Port is closed.", "closed");
    try {
      await this.port.setSignals({ break: low, dataTerminalReady: low });
    } catch {
      try {
        await this.port.setSignals({ dataTerminalReady: low });
        this.emit("info", "Break was rejected. DTR was still set. Fake FT232 adapters only pull TX down if DTR is wired to do that.");
      } catch {
        this.emit("info", "This adapter did not accept a line change.");
      }
    }
  }

  async reset(): Promise<boolean> {
    this.acc = 0x04;
    await this.signals(true);
    await sleep(300);
    await this.signals(false);
    await sleep(300);
    await this.sendRaw([0xaa]);
    try {
      const frame = await this.readResponse(1);
      const ok = frame[0] === 0xaa;
      this.emit("info", ok ? "Pack answered the sync byte." : `Unexpected sync reply ${hex(frame)}.`);
      return ok;
    } catch {
      this.emit("info", "No sync byte.");
      return false;
    }
  }

  async readRaw(addr: number, len: number): Promise<{ payload: Uint8Array | null; checksumOk: boolean | null }> {
    const msb = (addr >> 8) & 0xff;
    const lsb = addr & 0xff;
    await this.sendCommand([0x01, 0x04, 0x03, msb, lsb, len & 0xff]);
    const frame = await this.readResponse(len + 5);
    const checksumOk = frame.length >= 2 ? verify(frame) : false;
    if (!frame.length || frame[0] !== 0x81 || frame.length < 3 + len) {
      return { payload: null, checksumOk };
    }
    return { payload: Uint8Array.from(frame.slice(3, 3 + len)), checksumOk };
  }

  async simulate(durationMs: number, signal: AbortSignal) {
    const end = Date.now() + durationMs;
    try {
      await this.reset();
      await this.configure(2);
      await this.snap();
      await sleep(600, signal);
      await this.keepalive();
      await this.configure(1);
      await this.snap();
      while (Date.now() < end) {
        if (signal.aborted) break;
        await sleep(500, signal);
        await this.keepalive();
      }
    } finally {
      try { await this.idle(); } catch { /* leave the line alone if the port is already gone */ }
    }
  }

  async writeNote(text: string) {
    if (text.length > 20) throw new BenchError("The note is limited to 20 characters.", "note");
    if ([...text].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) > 126)) {
      throw new BenchError("Use plain English letters, numbers, and spaces.", "note");
    }
    const message = text.padEnd(20, "-");
    try {
      await this.reset();
      for (let i = 0; i < message.length; i++) {
        await this.sendCommand([0x01, 0x05, 0x03, 0x00, 0x23 + i, message.charCodeAt(i) & 0xff]);
        await this.readResponse(2);
      }
      this.emit("info", `Wrote note "${text}".`);
    } finally {
      try { await this.idle(); } catch { /* ignore */ }
    }
  }

  private async configure(state: number) {
    this.acc = 0x04;
    await this.sendCommand([0x60, this.acc, 0x08, 0x01, 0x2c, 0x17, 0x70, 0x17, 0x70, state & 0xff, 13]);
    await this.readResponse(5);
  }

  private async snap() {
    await this.sendCommand([0x61, this.acc, 0x00]);
    this.bumpAcc();
    await this.readResponse(8);
  }

  private async keepalive() {
    await this.sendCommand([0x62, this.acc, 0x00]);
    await this.readResponse(9);
  }

  private bumpAcc() {
    const values = [0x04, 0x0c, 0x1c];
    const index = values.indexOf(this.acc);
    this.acc = values[(index + 1) % values.length] ?? 0x04;
  }

  private async sendCommand(payload: number[]) {
    const sum = checksum(payload);
    await this.sendRaw([...payload, (sum >> 8) & 0xff, sum & 0xff]);
  }

  private async sendRaw(bytes: number[]) {
    if (!this.writer) throw new BenchError("Port is closed.", "closed");
    this.queue.clear();
    this.emit("tx", hex(bytes));
    const wire = Uint8Array.from(bytes.map((byte) => reverseBits(byte)));
    await this.writer.write(wire);
  }

  private async readResponse(size: number): Promise<number[]> {
    const deadline = Date.now() + 1500;
    const first = await this.queue.take(deadline);
    if (first == null) {
      this.emit("info", "RX timeout");
      throw new BenchError("Empty response", "empty");
    }
    const total = first === 0x82 ? 2 : size;
    const frame = [first];
    while (frame.length < total) {
      const byte = await this.queue.take(deadline);
      if (byte == null) break;
      frame.push(byte);
    }
    this.emit("rx", hex(frame));
    await sleep(50);
    return frame;
  }
}

function verify(frame: number[]): boolean {
  if (frame.length < 2) return false;
  const body = frame.slice(0, -2);
  const got = ((frame[frame.length - 2] ?? 0) << 8) | (frame[frame.length - 1] ?? 0);
  return checksum(body) === got;
}
