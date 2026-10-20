import { HEALTH_INDEXES, MATRIX, REGISTERS } from "@/lib/m18/catalog";
import { BenchError, addrHex, isAbort, sleep } from "@/lib/m18/bytes";
import { decodePayload, type DecodedRow } from "@/lib/m18/decode";
import type { SerialLink } from "@/lib/m18/port";

export interface Progress {
  phase: string;
  done: number;
  total: number;
}

/** Health registers, plus the pack note and cell-type byte. */
export const BENCH_INDEXES: number[] = [...HEALTH_INDEXES, 7, 0];

export async function readMapped(
  port: SerialLink,
  indexes: number[],
  refresh: boolean,
  signal: AbortSignal,
  onProgress: (progress: Progress) => void,
  onRow: (row: DecodedRow) => void,
): Promise<void> {
  const steps = (refresh ? MATRIX.length : 0) + indexes.length;
  let done = 0;
  let current = 0;
  const tick = (phase: string) => onProgress({ phase, done, total: steps });
  const onAbort = () => port.cancelPending();
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    tick("Sync");
    await port.reset();
    if (refresh) {
      for (const block of MATRIX) {
        if (signal.aborted) throw abort();
        current = block.addr;
        tick("Refreshing statistics");
        await port.readRaw(block.addr, block.len);
        done += 1;
      }
      await port.idle();
      await sleep(100, signal);
      await port.reset();
    }
    for (const index of indexes) {
      if (signal.aborted) throw abort();
      const def = REGISTERS[index];
      if (!def) continue;
      current = def.addr;
      tick(`Reading ${addrHex(def.addr)}`);
      const frame = await port.readRaw(def.addr, def.len);
      onRow(decodePayload(def, frame.payload, frame.checksumOk));
      done += 1;
    }
    await port.idle();
    onProgress({ phase: "Done", done: steps, total: steps });
  } catch (error) {
    try { await port.idle(); } catch { /* keep the line safe if we still can */ }
    if (isAbort(error) || signal.aborted) throw abort();
    if (error instanceof BenchError && error.code === "empty") {
      throw new BenchError(
        `No reply at ${addrHex(current)}. Check 3.3 V TX to J2, RX to J1, GND to B−, and that the line was low before you clipped the pack on.`,
        "empty",
      );
    }
    throw error;
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

function abort(): Error {
  const error = new Error("Stopped");
  error.name = "AbortError";
  return error;
}
