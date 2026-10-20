import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  batteriesToCsv,
  cleanName,
  formatTrace,
  mergeBatteries,
  parseBatteryFile,
  recordRead,
  renameBattery,
  suggestName,
} from "./library.ts";
import { usbBlockedMessage } from "./platform.ts";
import { ch340BaudIndex, ftdiBaudWords } from "./usb.ts";
import { browserChipSteps } from "./chip-test.ts";
import { ftdiBaudWords as ftdiWords, identifyFtdi, resolveFtVariant, sanitizeChipSettings, DEFAULT_CHIP_SETTINGS } from "./ftdi.ts";
import type { HealthReport } from "./health.ts";

function report(over: Partial<HealthReport> = {}): HealthReport {
  return {
    readAtIso: "2026-10-20T01:02:03.000Z",
    readAtLabel: "2026-10-20 03:02:03",
    eSerial: 4242,
    typeCode: 40,
    typeName: "5Ah XC (5s2p 18650)",
    verdict: "serviceable",
    reasons: ["Cell spread is tight."],
    packV: 18.4,
    imbalanceMv: 12,
    cellsMv: [4100, 4102, 4098, 4101, 4099],
    dischargeAh: 12.5,
    cycles: 2.5,
    totalCharges: 40,
    redlinkCharges: 30,
    dumbCharges: 10,
    thermistorC: 22,
    forgeC: null,
    note: "saw, bay",
    demo: false,
    ...over,
  } as HealthReport;
}

describe("battery library", () => {
  it("names a pack from the type and e-serial", () => {
    assert.equal(suggestName(report()), "5Ah XC 4242");
    assert.equal(suggestName(report({ eSerial: null, typeName: "Unknown type code" })), "Pack");
  });

  it("keeps a custom name when the same e-serial is read again", () => {
    const first = recordRead([], report(), []);
    const named = renameBattery(first.list, first.battery.id, "Van pack");
    const second = recordRead(named, report({ readAtIso: "2026-10-21T01:02:03.000Z", readAtLabel: "later" }), []);
    assert.equal(second.created, false);
    assert.equal(second.battery.name, "Van pack");
    assert.equal(second.battery.reads.length, 2);
    assert.equal(second.list.length, 1);
  });

  it("rejects an empty name", () => {
    assert.throws(() => cleanName("   "), /name/i);
  });

  it("exports csv with quoted commas and round-trips json", () => {
    const saved = recordRead([], report(), []);
    const renamed = renameBattery(saved.list, saved.battery.id, "Saw, bay");
    const csv = batteriesToCsv(renamed);
    assert.match(csv, /"Saw, bay"/);
    assert.match(csv, /saw, bay/);
    const parsed = parseBatteryFile(JSON.stringify({ batteries: renamed }));
    assert.equal(parsed[0]?.name, "Saw, bay");
    assert.equal(parsed[0]?.eSerial, 4242);
  });

  it("merges an import onto the same e-serial", () => {
    const local = recordRead([], report(), []).list;
    const incoming = recordRead([], report({ readAtIso: "2026-11-01T00:00:00.000Z" }), []).battery;
    incoming.id = "other-id";
    incoming.name = "Imported name";
    const merged = mergeBatteries(local, [incoming]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.name, local[0]?.name);
    assert.equal(merged[0]?.reads.length, 2);
  });

  it("formats a wire log with a header", () => {
    const text = formatTrace(
      [{ at: "2026-10-20T00:00:00.000Z", dir: "tx", text: "AA" }],
      { platform: "Windows app", port: "USB-C cp210x 10c4:ea60" },
    );
    assert.match(text, /Windows app/);
    assert.match(text, /TX\s+AA/);
  });
});

describe("usb-c", () => {
  it("explains that iOS still blocks the port", () => {
    const text = usbBlockedMessage("ios", "auto");
    assert.match(text, /iPhone/);
    assert.match(text, /log/i);
    assert.match(usbBlockedMessage("android", "auto"), /Chrome/);
    assert.match(usbBlockedMessage("windows", "usb"), /COM port/);
  });

  it("encodes 4800 baud for CH340 and FTDI", () => {
    assert.deepEqual(ch340BaudIndex(4800), { a: 0x6402, b: 0x18 });
    assert.deepEqual(ftdiBaudWords(4800), { value: 625, index: 0 });
    assert.deepEqual(ftdiWords(4800, 120_000_000), { value: 17946, index: 0 });
  });

  it("names FT232 variants from the USB id", () => {
    assert.equal(identifyFtdi({ vendorId: 0x0403, productId: 0x6001, bcdDevice: 0x0600 }).variant?.id, "ft232r");
    assert.equal(identifyFtdi({ vendorId: 0x0403, productId: 0x6014 }).variant?.id, "ft232h");
    assert.equal(identifyFtdi({ vendorId: 0x0403, productId: 0x6015 }).variant?.id, "ftx");
    assert.equal(identifyFtdi({ vendorId: 0x0403, productId: 0x6010, bcdDevice: 0x0700 }).variant?.id, "ft2232h");
    assert.equal(identifyFtdi({ vendorId: 0x0403, productId: 0x6011 }).variant?.id, "ft4232h");
    assert.equal(identifyFtdi({ vendorId: 0x0403, productId: 0x6001, bcdDevice: 0x0400 }).variant?.id, "ft232bm");
    assert.equal(identifyFtdi({ vendorId: 0x10c4, productId: 0xea60 }).ftdi, false);
  });

  it("rejects an FT232H override on an FT232R", () => {
    const identity = identifyFtdi({ vendorId: 0x0403, productId: 0x6001, bcdDevice: 0x0600 });
    assert.throws(
      () => resolveFtVariant({ ...DEFAULT_CHIP_SETTINGS, variant: "ft232h" }, identity),
      /4800 baud would be wrong/,
    );
    const settings = sanitizeChipSettings({ latencyMs: 0, channel: 9 as 0, variant: "nope" as "auto" });
    assert.equal(settings.latencyMs, 1);
    assert.equal(settings.channel, 0);
    assert.equal(settings.variant, "auto");
  });

  it("shows that iOS cannot reach an FT232 and Windows can", () => {
    const ios = browserChipSteps({ id: "ios", serial: false, usb: false });
    assert.equal(ios.find((step) => step.id === "webserial")?.status, "fail");
    assert.equal(ios.find((step) => step.id === "webusb")?.status, "fail");
    const windows = browserChipSteps({ id: "windows", serial: true, usb: true });
    assert.equal(windows.find((step) => step.id === "webserial")?.status, "pass");
    assert.equal(windows.find((step) => step.id === "webusb")?.status, "pass");
    const play = browserChipSteps({ id: "android", serial: false, usb: true });
    assert.equal(play.find((step) => step.id === "webusb")?.status, "pass");
  });
});
