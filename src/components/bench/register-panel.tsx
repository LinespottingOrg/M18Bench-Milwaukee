import { useMemo, useState } from "react";
import { GROUP_ORDER, type RegGroup } from "@/lib/m18/catalog";
import { addrHex } from "@/lib/m18/bytes";
import type { DecodedRow } from "@/lib/m18/decode";
import { QuietButton } from "@/components/bench/ui";

export function RegisterPanel({
  rows,
  connected,
  busy,
  onFullRead,
}: {
  rows: readonly (DecodedRow | null)[];
  connected: boolean;
  busy: boolean;
  onFullRead: () => void;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<RegGroup | "All">("All");
  const present = useMemo(
    () => rows.filter((row): row is DecodedRow => row != null),
    [rows],
  );
  const mismatches = present.filter((row) => row.checksumOk === false).length;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return present.filter((row) => {
      if (group !== "All" && row.group !== group) return false;
      if (!q) return true;
      return `${row.label} ${addrHex(row.addr)} ${row.text}`.toLowerCase().includes(q);
    });
  }, [present, query, group]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search address or label"
          className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-sm text-fg"
          aria-label="Search registers"
        />
        <select
          value={group}
          onChange={(event) => setGroup(event.target.value as RegGroup | "All")}
          className="min-h-11 rounded-md border border-line bg-surface px-3 text-sm text-fg"
          aria-label="Register group"
        >
          <option value="All">All groups</option>
          {GROUP_ORDER.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <QuietButton disabled={!connected || busy} onClick={onFullRead}>
          Read full map
        </QuietButton>
      </div>
      <p className="text-sm text-muted">
        {present.length} registers loaded
        {mismatches > 0 ? ` · ${mismatches} checksum mismatches` : ""}. A full map matches the community spreadsheet column.
      </p>
      {filtered.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
          {present.length === 0 ? "Nothing read yet. Health reads the summary registers. Full map reads all 184." : "No registers match."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-raised text-xs tracking-widest text-muted uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Addr</th>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {GROUP_ORDER.map((name) => {
                const groupRows = filtered.filter((row) => row.group === name);
                if (groupRows.length === 0) return null;
                return (
                  <GroupRows key={name} name={name} rows={groupRows} />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GroupRows({ name, rows }: { name: string; rows: DecodedRow[] }) {
  return (
    <>
      <tr className="bg-surface">
        <td colSpan={3} className="px-3 py-2 text-xs tracking-widest text-muted uppercase">
          {name}
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.index} className="border-t border-line">
          <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-muted">{addrHex(row.addr)}</td>
          <td className="px-3 py-2">{row.label}</td>
          <td className={`px-3 py-2 font-mono ${row.checksumOk === false ? "text-primary" : ""}`}>{row.text}</td>
        </tr>
      ))}
    </>
  );
}
