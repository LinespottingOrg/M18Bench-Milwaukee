import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { PrimaryButton, QuietButton } from "@/components/bench/ui";
import {
  baudPreview,
  browserChipSteps,
  formatChipTest,
  runChipTest,
  type ChipTestReport,
  type ProbeStep,
} from "@/lib/m18/chip-test";
import { downloadText } from "@/lib/m18/logs";
import { detectPlatform } from "@/lib/m18/platform";
import {
  DEFAULT_CHIP_SETTINGS,
  FT_VARIANTS,
  loadChipSettings,
  saveChipSettings,
  variantById,
  type ChipSettings,
} from "@/lib/m18/ftdi";

const PATHS: { id: ChipSettings["path"]; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "serial", label: "Windows COM port" },
  { id: "usb", label: "USB-C WebUSB" },
];

export function DebugPanel() {
  const [settings, setSettings] = useState<ChipSettings>(DEFAULT_CHIP_SETTINGS);
  const [live, setLive] = useState<ProbeStep[]>([]);
  const [report, setReport] = useState<ChipTestReport | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setSettings(loadChipSettings());
    setLive(browserChipSteps(detectPlatform()));
  }, []);

  function update(next: ChipSettings) {
    const saved = { ...next };
    setSettings(saved);
    saveChipSettings(saved);
  }

  const variant = settings.variant === "auto" ? variantById("ft232r") : variantById(settings.variant);
  const steps = report?.steps ?? live;

  async function run() {
    setRunning(true);
    try {
      const next = await runChipTest(settings);
      setReport(next);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs tracking-widest text-muted uppercase">FT232 options</h2>
        <p className="mt-3 text-sm text-muted">
          These options are for the cable chip, not the pack. Tests read the chip and set the live baud and latency. They do not write EEPROM, so a counterfeit FT232 is not bricked.
        </p>
        <div className="mt-3 grid gap-3">
          <label className="block text-sm">
            <span className="text-xs tracking-widest text-muted uppercase">Variant</span>
            <select
              value={settings.variant}
              onChange={(event) => update({ ...settings, variant: event.target.value as ChipSettings["variant"] })}
              className="mt-1 min-h-11 w-full rounded-md border border-line bg-bg px-3"
              aria-label="FT232 variant"
            >
              <option value="auto">Auto from the USB id</option>
              {FT_VARIANTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-xs tracking-widest text-muted uppercase">Channel</span>
            <select
              value={settings.channel}
              onChange={(event) => update({ ...settings, channel: Number(event.target.value) as 0 | 1 | 2 | 3 })}
              className="mt-1 min-h-11 w-full rounded-md border border-line bg-bg px-3"
              aria-label="FTDI channel"
            >
              <option value={0}>A</option>
              <option value={1}>B</option>
              <option value={2}>C</option>
              <option value={3}>D</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-xs tracking-widest text-muted uppercase">Latency timer</span>
            <input
              type="number"
              min={1}
              max={255}
              value={settings.latencyMs}
              onChange={(event) => update({ ...settings, latencyMs: Number(event.target.value) })}
              className="mt-1 min-h-11 w-full rounded-md border border-line bg-bg px-3 font-mono"
              aria-label="Latency timer milliseconds"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs tracking-widest text-muted uppercase">Test through</span>
            <select
              value={settings.path}
              onChange={(event) => update({ ...settings, path: event.target.value as ChipSettings["path"] })}
              className="mt-1 min-h-11 w-full rounded-md border border-line bg-bg px-3"
              aria-label="Chip test path"
            >
              {PATHS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.expectLoopback}
              onChange={(event) => update({ ...settings, expectLoopback: event.target.checked })}
            />
            TX is jumpered to RX
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.probeOnConnect}
              onChange={(event) => update({ ...settings, probeOnConnect: event.target.checked })}
            />
            On connect, stop if the latency timer does not stick
          </label>
        </div>
        <p className="mt-3 text-sm">
          {settings.variant === "auto"
            ? `Auto starts as ${baudPreview(variantById("ft232r"))}. WebUSB replaces that when the chip answers.`
            : baudPreview(variant)}
        </p>
        <p className="mt-2 text-sm text-muted">{variant.detail}</p>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs tracking-widest text-muted uppercase">Communication test</h2>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton disabled={running} onClick={() => void run()}>
              {running ? "Waiting for the chip…" : "Test the FT232"}
            </PrimaryButton>
            <QuietButton
              disabled={!report}
              onClick={() => report && downloadText(`m18-ft232-test.txt`, formatChipTest(report), "text/plain")}
            >
              <Download className="size-4" aria-hidden="true" />
              Download
            </QuietButton>
          </div>
        </div>
        {report ? (
          <p className={`mt-3 text-sm font-semibold ${report.ok ? "text-fg" : "text-primary"}`}>{report.ok ? "Pass" : "Fail"}. {report.headline}</p>
        ) : (
          <p className="mt-3 text-sm text-muted">
            The rows under this are what the browser can do before a cable is chosen. iOS fails here on purpose. Windows and Android continue into the chip after you pick it.
          </p>
        )}
        <ol className="mt-3 grid gap-2">
          {steps.map((step) => (
            <li key={step.id} className="rounded-md border border-line bg-bg px-3 py-2">
              <p className="text-sm font-semibold">
                <StatusMark status={step.status} /> {step.name}
              </p>
              <p className="mt-1 text-sm text-muted">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function StatusMark({ status }: { status: ProbeStep["status"] }) {
  const label = status === "pass" ? "Pass" : status === "fail" ? "Fail" : status === "warn" ? "Check" : "Skip";
  return <span className={status === "fail" ? "text-primary" : "text-muted"}>{label}</span>;
}

