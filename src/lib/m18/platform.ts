export type PlatformId = "windows" | "android" | "ios" | "mac" | "linux" | "other";

export interface PlatformInfo {
  id: PlatformId;
  kicker: string;
  idle: string;
  serial: boolean;
  usb: boolean;
}

const KICKER: Record<PlatformId, string> = {
  windows: "Windows app",
  android: "Android app",
  ios: "iOS app",
  mac: "Mac app",
  linux: "Linux app",
  other: "Pack bench",
};

const IDLE: Record<PlatformId, string> = {
  windows: "USB-C and COM ports in Edge or Chrome. Install from the browser menu for a taskbar app.",
  android: "USB-C in Chrome, with an OTG data cable. Install from the Chrome menu for the home-screen app.",
  ios: "USB-C connect is in this app. iPhone and iPad still hide the port. Names and logs work.",
  mac: "USB-C serial in Chrome or Edge. Install from the browser menu if you want a dock app.",
  linux: "USB-C serial in Chrome or Edge. The browser has to be allowed to open the device.",
  other: "USB-C connect is in this app. Sample packs stay on screen until a pack is connected.",
};

export function detectPlatform(): PlatformInfo {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const ua = nav?.userAgent ?? "";
  const serial = !!(nav && "serial" in nav && (nav as Navigator & { serial?: unknown }).serial);
  const usb = !!(nav && "usb" in nav && (nav as Navigator & { usb?: unknown }).usb);
  const appleTouch =
    !!nav &&
    nav.platform === "MacIntel" &&
    nav.maxTouchPoints > 1;
  const ios = /iPad|iPhone|iPod/.test(ua) || appleTouch;
  const android = /Android/i.test(ua);
  const id: PlatformId = ios
    ? "ios"
    : android
      ? "android"
      : /Windows/i.test(ua)
        ? "windows"
        : /Mac/i.test(ua)
          ? "mac"
          : /Linux/i.test(ua)
            ? "linux"
            : "other";
  return { id, kicker: KICKER[id], idle: IDLE[id], serial, usb };
}

export function usbBlockedMessage(id: PlatformId, mode: "auto" | "usb"): string {
  if (id === "ios") {
    return "USB-C is in this iOS app, but iPhone and iPad do not give a website or a home-screen app the USB-C port. Web Serial and WebUSB are both missing, so the button cannot open the cable. Naming batteries and downloading logs still work. Read the pack on the Android or Windows app, then import the log here.";
  }
  if (id === "android") {
    return mode === "usb"
      ? "This Android browser has no WebUSB. Open M18 Bench in Chrome and connect the USB-C adapter again."
      : "This Android browser cannot open a USB-C serial port. Use Chrome, then install the app from the Chrome menu.";
  }
  if (mode === "usb") {
    return "This browser has no WebUSB. Use Connect USB-C in Edge or Chrome so the operating system hands over the COM port.";
  }
  return "This browser cannot open a serial port. Use Microsoft Edge or Chrome, in its own window. A chat preview cannot see USB devices.";
}
