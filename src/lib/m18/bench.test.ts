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
  });
});
