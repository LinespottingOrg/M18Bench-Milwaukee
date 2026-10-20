import { useState } from "react";
import type { PlatformInfo } from "@/lib/m18/platform";
import { QuietButton } from "@/components/bench/ui";

export function SetupPanel({
  connected,
  busy,
  line,
  device,
  onConnectUsb,
  onIdle,
  onHigh,
  onSimulate,
  onWriteNote,
}: {
  connected: boolean;
  busy: boolean;
  line: "low" | "high";
  device: PlatformInfo | null;
  onConnectUsb: () => void;
  onIdle: () => void;
  onHigh: () => void;
  onSimulate: (seconds: number) => void;
  onWriteNote: (note: string) => void;
}) {
  const [armed, setArmed] = useState(false);
  const [seconds, setSeconds] = useState(5);
  const [note, setNote] = useState("");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-line bg-surface p-4 lg:col-span-2">
        <h2 className="text-xs tracking-widest text-muted uppercase">USB-C on Windows, Android, and iOS</h2>
        <p className="mt-3 text-sm">
          The phone or PC USB-C port talks to a 3.3 V USB-serial adapter. It does not plug into the M18 pack. Clip the adapter to J1, J2, and B− after the line is held low.
        </p>
        <p className="mt-2 text-sm text-muted">
          This device: {device ? device.kicker : "checking…"}.
          {device?.serial ? " Web Serial is available." : " Web Serial is not in this browser."}
          {device?.usb ? " WebUSB is available." : " WebUSB is not in this browser."}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <PlatformCard
            title="Windows app"
            body="Edge or Chrome, then menu → Apps → Install. Connect USB-C opens the COM port for a USB-C serial adapter or any other serial port. Logs and battery names stay in that installed app."
          />
          <PlatformCard
            title="Android app"
            body="Chrome can open USB-C serial (Chrome 148 and later) and, if that chooser misses the cable, WebUSB for CP210x, CH340, FTDI, PL2303, and CDC-ACM. Install from the Chrome menu. Use a USB-C OTG data cable, not charge-only."
          />
          <PlatformCard
            title="iOS app"
            body="Add to Home Screen from Safari. The USB-C button is in the app and tries Web Serial, then WebUSB. iPhone and iPad still do not hand the port to any browser, including the home-screen app. Names and downloaded logs work. Import a log from Windows or Android."
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <QuietButton disabled={connected || busy} onClick={onConnectUsb}>
            USB-C via WebUSB
          </QuietButton>
        </div>
        <p className="mt-2 text-sm text-muted">
          Use WebUSB when the serial chooser does not list the cable. On Windows, if the adapter already has a COM port, Connect USB-C is the one that works. FT232 variant, latency, and the chip communication test are on Debug.
        </p>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs tracking-widest text-muted uppercase">Line</h2>
        <p className="mt-3 text-sm text-muted">
          Live link: {connected ? `open, TX line ${line === "low" ? "held low" : "released"}` : "not connected"}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <QuietButton disabled={!connected || busy} onClick={onIdle}>
            Hold line low
          </QuietButton>
          <QuietButton disabled={!connected || busy} onClick={onHigh}>
            Release line
          </QuietButton>
        </div>
        <p className="mt-2 text-sm text-muted">Releasing the line can count as a dumb charge if J2 stays above about 7 V for half a second.</p>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs tracking-widest text-muted uppercase">Clip</h2>
        <div className="mt-3 grid gap-2 font-mono text-sm">
          <Wire left="Adapter TX" right="J2, next to B−" />
          <Wire left="Adapter RX" right="J1, next to B+" />
          <Wire left="Adapter GND" right="B−" />
        </div>
        <ul className="mt-4 grid gap-2 text-sm text-muted">
          <li>3.3 V logic only. A 5 V adapter can damage the pack electronics.</li>
          <li>The app sets 4800 baud, 8 data bits, 2 stop bits, no parity, and bit-reverses every byte. Same settings on USB-C Web Serial and WebUSB.</li>
          <li>Do not connect anything to B+.</li>
        </ul>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs tracking-widest text-muted uppercase">If it will not talk</h2>
        <p className="mt-3 text-sm">Measure from B−. Idle should be J2 under 1 V and J1 under 1 V. Released, J2 over 8 V and J1 over 2 V.</p>
        <p className="mt-2 text-sm text-muted">
          Fake FT232 chips cannot make a serial break. This bench also asserts DTR, which only helps if your cable uses DTR to pull TX down.
        </p>
        <p className="mt-2 text-sm text-muted">A health read releases the line while it talks, then idles it again. That is the same sequence as the command-line tool.</p>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs tracking-widest text-muted uppercase">Charger talk</h2>
        <p className="mt-3 text-sm">These write to the pack. Leave them alone unless you mean to.</p>
        <label className="mt-3 flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 size-4" checked={armed} onChange={(event) => setArmed(event.target.checked)} />
          <span>I know this can add to the pack's charge counters or overwrite the 20-character note.</span>
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            max={30}
            value={seconds}
            onChange={(event) => setSeconds(Number(event.target.value))}
            className="min-h-11 w-20 rounded-md border border-line bg-bg px-3 font-mono text-sm"
            aria-label="Seconds to simulate a charger"
          />
          <QuietButton disabled={!connected || busy || !armed} onClick={() => onSimulate(Math.min(30, Math.max(1, seconds || 1)))}>
            Simulate charger
          </QuietButton>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={note}
            maxLength={20}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Pack note, 20 characters"
            className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-bg px-3 text-sm"
            aria-label="Pack note"
          />
          <QuietButton disabled={!connected || busy || !armed || note.length === 0} onClick={() => onWriteNote(note)}>
            Write note
          </QuietButton>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4 lg:col-span-2">
        <h2 className="text-xs tracking-widest text-muted uppercase">Logs</h2>
        <p className="mt-3 text-sm">
          Battery names and wire logs stay on this device. Download JSON or CSV from Batteries, and the wire log from Trace. Import that JSON on the Windows app, the Android app, or this iOS app.
        </p>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4 lg:col-span-2">
        <h2 className="text-xs tracking-widest text-muted uppercase">Where the map came from</h2>
        <p className="mt-3 text-sm">
          Unofficial bench for Milwaukee M18 packs. The register names and the byte order come from the community project{" "}
          <a className="underline" href="https://github.com/mnh-jansson/m18-protocol" target="_blank" rel="noreferrer">
            mnh-jansson/m18-protocol
          </a>
          . It is not Milwaukee software.
        </p>
        <p className="mt-2 text-sm">
          After a full map read, copy the column into their{" "}
          <a
            className="underline"
            href="https://docs.google.com/spreadsheets/d/1rZZ3mtU2uwuo_uMv7O7hi5kyPA9AXUDU5CBsHKWMi-U/"
            target="_blank"
            rel="noreferrer"
          >
            spreadsheet template
          </a>
          . Make a copy. Do not request edit access.
        </p>
      </section>
    </div>
  );
}

function PlatformCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md bg-raised px-3 py-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}

function Wire({ left, right }: { left: string; right: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <span className="rounded-md bg-raised px-3 py-2">{left}</span>
      <span className="text-muted">→</span>
      <span className="rounded-md bg-raised px-3 py-2">{right}</span>
    </div>
  );
}
