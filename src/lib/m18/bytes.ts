export function reverseBits(byte: number): number {
  let out = 0;
  for (let i = 0; i < 8; i++) out = (out << 1) | ((byte >> i) & 1);
  return out & 0xff;
}

/** Sum of bytes, truncated to 16 bits. Same as m18.py checksum(). */
export function checksum(bytes: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) sum = (sum + (bytes[i] & 0xff)) & 0xffff;
  return sum;
}

export function hex(bytes: ArrayLike<number>, limit = 48): string {
  const n = Math.min(bytes.length, limit);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push(bytes[i].toString(16).toUpperCase().padStart(2, "0"));
  if (bytes.length > limit) parts.push("...");
  return parts.join(" ");
}

export function intBE(bytes: ArrayLike<number>): number {
  let n = 0;
  for (let i = 0; i < bytes.length; i++) n = n * 256 + (bytes[i] & 0xff);
  return n;
}

export function addrHex(addr: number): string {
  return `0x${addr.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function abortError(): Error {
  const error = new Error("Stopped");
  error.name = "AbortError";
  return error;
}

export class BenchError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "BenchError";
    this.code = code;
  }
}
