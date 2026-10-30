import { format } from "date-fns";
import { supabase } from "@/lib/supabase";

/**
 * S59: raw export of everything the user created — free in every plan
 * (GDPR art. 20 data portability, docs/MONETIZATION.md §10). Device tokens
 * (widget, push) are left out: they are credentials, not the user's content.
 */
const TABLES = [
  "dreams",
  "goals",
  "habits",
  "habit_progress",
  "habit_subitems",
  "habit_subitem_progress",
  "rewards",
  "events",
] as const;

async function readAll(table: string, userId: string) {
  const rows: unknown[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < page) break;
  }
  return rows;
}

export async function exportUserData(userId: string, email: string | undefined): Promise<void> {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await readAll(t, userId);

  const json = JSON.stringify(
    { app: "Northstar", exported_at: new Date().toISOString(), account: email ?? null, data },
    null,
    2,
  );
  const name = `northstar-export-${format(new Date(), "yyyy-MM-dd")}.json`;
  const file = new File([json], name, { type: "application/json" });

  // Android WebView can't download blobs; hand the file to the share sheet
  // (save to Files / Drive / e-mail) where that's supported.
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: "Northstar data export" });
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
