import { supabase } from "../utility/supabaseClient";
import type { EmployeesRow } from "../pages/expenses/types";

const normalizeName = (o: Record<string, unknown>): string => {
  // Directly check common latin and cyrillic keys
  const directKeys = ["full_name", "fullName", "name", "fio", "ФИО сотрудников", "ФИО"];
  const values: unknown[] = [];
  for (const k of directKeys) {
    if (k in o) values.push(o[k as keyof typeof o]);
  }
  // Generic scan: any key that looks like "name"/"fio"/"фио"
  for (const k of Object.keys(o)) {
    const v = (o as Record<string, unknown>)[k];
    if (typeof v === "string" && /(^|\s)(name|fio|фио)(\s|$)/i.test(k)) {
      values.push(v);
    }
  }
  const fna = o["first_name"];
  const fnb = o["last_name"];
  const combined =
    `${typeof fna === "string" ? fna.trim() : ""}${(typeof fna === "string" && fna && typeof fnb === "string" && fnb) ? " " : ""}${typeof fnb === "string" ? fnb.trim() : ""}`.trim();

  const candidates = [...values, combined].filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );
  return candidates[0] ?? "";
};

const mapRows = (data: unknown[]): EmployeesRow[] => {
  const out: EmployeesRow[] = [];
  const seen = new Set<string>();
  for (const rec of data) {
    if (typeof rec !== "object" || rec === null) continue;
    const o = rec as Record<string, unknown>;

    // Try to detect ID field among "id", "ID" or case-insensitive "id"
    const idKey =
      ("id" in o && "id") ||
      ("ID" in o && "ID") ||
      Object.keys(o).find((k) => /^id$/i.test(k));
    const idRaw = idKey ? (o as Record<string, unknown>)[idKey] as unknown : undefined;
    const id =
      typeof idRaw === "string"
        ? idRaw
        : typeof idRaw === "number"
        ? String(idRaw)
        : "";
    if (!id || seen.has(id)) continue;

    const name = normalizeName(o);
    out.push({ id, full_name: name || id });
    seen.add(id);
  }
  // client-side sort for stability irrespective of available columns in DB
  out.sort((a, b) =>
    (a.full_name || a.id).localeCompare(b.full_name || b.id, "ru", { sensitivity: "base" }),
  );
  return out;
};

const selectColumns = "*";

const fetchFrom = async (table: string): Promise<EmployeesRow[]> => {
  try {
    const { data, error } = await supabase.from(table).select(selectColumns);
    if (error || !Array.isArray(data)) return [];
    return mapRows(data as unknown[]);
  } catch {
    return [];
  }
};

/**
 * Пытается получить сотрудников из наиболее вероятных таблиц.
 * Возвращает первый ненулевой список.
 */
export const fetchEmployees = async (): Promise<EmployeesRow[]> => {
  const candidates = [
    "employees",
    "Employes",
    "employee",
    "Employee",
    "staff",
    "Staff",
    "profiles",
    "Profiles",
    "users",
    "people",
    "Persons",
    "persons",
    "People",
  ];

  for (const t of candidates) {
    const rows = await fetchFrom(t);
    if (rows.length > 0) return rows;
  }
  return [];
};
