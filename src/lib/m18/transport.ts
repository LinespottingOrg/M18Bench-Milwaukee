import { BenchError } from "@/lib/m18/bytes";
import { detectPlatform, usbBlockedMessage } from "@/lib/m18/platform";
import { openWebUsb, type SerialPortLike } from "@/lib/m18/usb";

export type ConnectMode = "auto" | "usb";

interface SerialApi {
  requestPort: () => Promise<SerialPortLike>;
}

function serialApi(): SerialApi | null {
  if (typeof navigator === "undefined") return null;
  const serial = (navigator as Navigator & { serial?: SerialApi }).serial;
  return serial ?? null;
}

export async function acquirePort(mode: ConnectMode): Promise<SerialPortLike> {
  const platform = detectPlatform();
  if (mode === "usb" || (mode === "auto" && !platform.serial && platform.usb)) {
    if (!platform.usb) throw new BenchError(usbBlockedMessage(platform.id, "usb"), platform.id === "ios" ? "ios-usb" : "noserial");
    return openWebUsb();
  }
  if (platform.serial) return openWebSerial();
  if (platform.usb) return openWebUsb();
  throw new BenchError(usbBlockedMessage(platform.id, mode), platform.id === "ios" ? "ios-usb" : "noserial");
}

async function openWebSerial(): Promise<SerialPortLike> {
  const api = serialApi();
  if (!api) throw new BenchError(usbBlockedMessage(detectPlatform().id, "auto"), "noserial");
  try {
    return await api.requestPort();
  } catch (error) {
    if (error instanceof DOMException && (error.name === "NotFoundError" || error.name === "AbortError")) {
      throw new BenchError("Port chooser closed. Nothing was changed.", "cancelled");
    }
    throw new BenchError(
      "The browser blocked the USB-C port. Open M18 Bench in its own Edge or Chrome window. A chat preview cannot see USB devices.",
      "blocked",
    );
  }
}
