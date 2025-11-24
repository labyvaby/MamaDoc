import React from "react";
import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardHeader,
  CardContent,
  Chip,
  Divider,
  Grid,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
} from "@mui/material";
import InputAdornment from "@mui/material/InputAdornment";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import PersonAddAltOutlined from "@mui/icons-material/PersonAddAltOutlined";
import EventAvailableOutlined from "@mui/icons-material/EventAvailableOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import LocalPhoneOutlined from "@mui/icons-material/LocalPhoneOutlined";
import PersonOutlineOutlined from "@mui/icons-material/PersonOutlineOutlined";
import MedicalServicesOutlined from "@mui/icons-material/MedicalServicesOutlined";
import NotesOutlined from "@mui/icons-material/NotesOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import Avatar from "@mui/material/Avatar";
import Pagination from "@mui/material/Pagination";

import { Link as RouterLink } from "react-router";
import { SubHeader } from "../../components";
import { supabase } from "../../utility/supabaseClient";
import { formatKGS } from "../../utility/format";

// Types with flexible Russian/English columns mapping
type Patient = {
  id: string;
  fio: string;
  phone?: string;
};

type HistoryRow = {
  ID: string;
  "Дата и время": string;
  "Дата n8n"?: string;
  "Доктор ФИО"?: string;
  "Пациент ФИО"?: string;
  "Услуга"?: string;
  "Услуга ID"?: string;
  Статус?: string;
  Стоимость?: number;
  "Итого, сом"?: number;
  "Жалобы при обращении"?: string;
  "Комментарий администратора"?: string;
};

const PATIENTS_CACHE_KEY = "patientSearch.patients.v1";
const HISTORY_CACHE_PREFIX = "patientSearch.history.v1.";
const PATIENTS_SRC_KEY = "patientSearch.src.v1";

const PER_PAGE = 40;
const NAME_COLS = ["ФИО", "Пациент ФИО", "full_name", "Full Name", "name"];
const PHONE_COLS = ["Телефон", "phone", "Номер телефона", "mobile", "phone_number", "mobile_phone", "tel", "Телефон 1", "Телефон пациента"];

type PatientsCache = { ts: number; patients: Patient[]; selectedId?: string | null };
type HistoryCache = { ts: number; items: HistoryRow[] };

// Utilities
function normalizeFio(row: Record<string, unknown>): string {
  const fio =
    (row["ФИО"] as string) ??
    (row["Пациент ФИО"] as string) ??
    (row["Пациент"] as string) ??
    (row["full_name"] as string) ??
    (row["Full Name"] as string) ??
    (row["name"] as string) ??
    [
      (row["Фамилия"] as string) ?? (row["Пациент Фамилия"] as string) ?? (row["last_name"] as string) ?? (row["surname"] as string),
      (row["Имя"] as string) ?? (row["Пациент Имя"] as string) ?? (row["first_name"] as string) ?? (row["given_name"] as string),
      (row["Отчество"] as string) ?? (row["Пациент Отчество"] as string) ?? (row["middle_name"] as string),
    ]
      .filter(Boolean)
      .join(" ");
  return fio || "";
}
function normalizePhone(row: Record<string, unknown>): string | undefined {
  const p =
    (row["Телефон"] as string) ??
    (row["phone"] as string) ??
    (row["Номер телефона"] as string) ??
    (row["mobile"] as string) ??
    (row["phone_number"] as string) ??
    (row["mobile_phone"] as string) ??
    (row["tel"] as string) ??
    (row["Телефон 1"] as string) ??
    (row["Телефон пациента"] as string);
  return p || undefined;
}
function normalizePatientId(row: Record<string, unknown>): string {
  const id =
    String(
      row["ID"] ??
        row["Пациент ID"] ??
        row["patient_id"] ??
        row["patientId"] ??
        row["id"] ??
        ""
    ) || "";
  return id;
}

// UI helpers
function getInitials(fullName?: string): string {
  if (!fullName) return "—";
  const parts = String(fullName).trim().split(/\s+/);
  const a = (parts[0] || "").charAt(0);
  const b = (parts[1] || "").charAt(0);
  const c = (parts[2] || "").charAt(0);
  return (a + (b || c) || a || "—").toUpperCase();
}

export const PatientSearchPage: React.FC = () => {
  // Patients data
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const isSearching = deferredQuery.trim().length > 0;

  // Selection and history
  const [selected, setSelected] = React.useState<Patient | null>(null);
  const [history, setHistory] = React.useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState<string | null>(null);

  // Dialogs: Add patient / Create appointment
  const [addOpen, setAddOpen] = React.useState(false);
  const [newFio, setNewFio] = React.useState("");
  const [newPhone, setNewPhone] = React.useState("");

  const [visitOpen, setVisitOpen] = React.useState(false);
  const [visitDateTime, setVisitDateTime] = React.useState("");
  const [visitDoctor, setVisitDoctor] = React.useState("");
  const [visitService, setVisitService] = React.useState("");
  const [visitPrice, setVisitPrice] = React.useState<number | "">("");

  // Вкладки: 0 - Пациенты, 1 - История, 2 - Карточка
  const [activeTab, setActiveTab] = React.useState<number>(0);

  // Постраничная подгрузка пациентов (не загружаем всё сразу)
  const [patientsSrc, setPatientsSrc] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  // Reload tick to re-run initial effect when user clicks "Обновить"
  const [reloadTick, setReloadTick] = React.useState(0);
  // legacy pagination removed

  const handleManualRefresh = React.useCallback(() => {
    try {
      localStorage.removeItem(PATIENTS_CACHE_KEY);
      localStorage.removeItem(PATIENTS_SRC_KEY);
      if (selected) {
        try {
          localStorage.removeItem(HISTORY_CACHE_PREFIX + selected.id);
        } catch { void 0; }
      }
    } catch { void 0; }
    // reset local state and re-run effect
    setSelected(null);
    setPatients([]);
    setHistory([]);
    setQuery("");
    setPatientsSrc(null);
    setPage(1);
    setTotal(0);
    setReloadTick((x) => x + 1);
  }, [selected]);

  // Fetch patients from Supabase
  React.useEffect(() => {
    if (activeTab !== 0 || isSearching) {
      // загружать пациентов только когда активна вкладка "Пациенты" и нет глобального поиска
      return;
    }
    const ctrl = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // Try cache first for patients to avoid refetch on revisits
        try {
          const raw = localStorage.getItem(PATIENTS_CACHE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as PatientsCache;
            const list = Array.isArray(parsed.patients) ? (parsed.patients as Patient[]) : [];
            setPatients(list);
            const prefSel =
              (parsed.selectedId && list.find((p) => p.id === parsed.selectedId)) || (list[0] ?? null);
            setSelected(prefSel);
            setLoading(false);
            return;
          }
        } catch {
          // ignore cache parse errors
          void 0;
        }

        let rows: Array<Record<string, unknown>> | null = null;
        let lastError: unknown = null;
        let usedSrc: string | null = null;
        let knownSrc: string | null = patientsSrc ?? null;
        if (!knownSrc) {
          try {
            const saved = localStorage.getItem(PATIENTS_SRC_KEY);
            knownSrc = saved && saved.length > 0 ? saved : null;
          } catch {
            knownSrc = null;
          }
        }

        // Prefer direct Patients-like tables, then fallback to appointments views
        const candidates = (knownSrc ? [knownSrc] : []).concat(
          [
            "Patients",
            "patients",
            "Пациенты",
            "profiles",
            "Profiles",
            "users",
            "Users",
            "clients",
            "Clients",
            "customers",
            "Customers",
            "patient",
            "patients_view",
            "patient_view",
            "FullAppointmentsView",
            "AppointmentsView",
          ].filter((t) => t !== knownSrc)
        );
        // Параллельная быстрая детекция источника: запрашиваем по 1 записи из всех кандидатов и берём первый ответивший
        const controllers: AbortController[] = [];
        let chosen: string | null = null;

        await Promise.all(
          candidates.map((tableName, idx) => (async () => {
            const c = new AbortController();
            controllers[idx] = c;
            try {
              const { data, error } = await supabase
                .schema("public")
                .from(tableName)
                .select("*")
                .range(0, 0) // минимальная нагрузка — только 1 запись для детекции
                .abortSignal(c.signal);
              if (!error && Array.isArray(data) && data.length > 0 && !chosen) {
                chosen = tableName;
                // Отменяем остальные детекции, чтобы не ждать их завершения
                controllers.forEach((ac, i) => {
                  if (i !== idx) {
                    try { ac.abort(); } catch { /* ignore */ }
                  }
                });
              }
            } catch {
              /* ignore каждый промис сам по себе */
            }
          })()),
        );

        if (chosen) {
          usedSrc = chosen;

          // 1) Общий total (для пагинации)
          const totalHead = await supabase
            .schema("public")
            .from(chosen)
            .select("*", { count: "exact", head: true })
            .abortSignal(ctrl.signal);
          const totalAll = (totalHead as unknown as { count?: number }).count ?? 0;
          setTotal(totalAll);

          // Сэмпл колонок источника (для безопасной работы с разными схемами)
          const sample = await supabase
            .schema("public")
            .from(chosen)
            .select("*")
            .range(0, 0)
            .abortSignal(ctrl.signal);
          const sampleCols = Array.isArray(sample.data) && sample.data[0]
            ? Object.keys(sample.data[0] as Record<string, unknown>)
            : [];
          const nameColsAvail = NAME_COLS.filter((c) => sampleCols.includes(c));

          // Построим выражение OR только по реально доступным колонкам
          const nameNonEmptyExpr = nameColsAvail.length > 0
            ? nameColsAvail.map((c) => `${c.includes(" ") ? `"${c}"` : c}.neq.""`).join(",")
            : "";

          // 2) Считаем количество "named" (с непустыми ФИО; приблизительно — не NULL)
          let namedTotal = 0;
          if (nameNonEmptyExpr) {
            const namedHead = await supabase
              .schema("public")
              .from(chosen)
              .select("*", { count: "exact", head: true })
              .or(nameNonEmptyExpr)
              .abortSignal(ctrl.signal);
            namedTotal = (namedHead as unknown as { count?: number }).count ?? 0;
          } else {
            // нет явных колонок имени — считаем, что все "без имени"
            namedTotal = 0;
          }

          // Вычисляем, какую часть страницы брать из named/unnamed
          const off = (page - 1) * PER_PAGE;
          const limit = PER_PAGE;
          let partA: Array<Record<string, unknown>> = []; // named
          let partB: Array<Record<string, unknown>> = []; // unnamed

          if (!nameNonEmptyExpr) {
            // Нет доступных полей имени — обычная страничная выборка без разделения
            const fromAny = off;
            const toAny = off + limit - 1;
            const resAny = await supabase
              .schema("public")
              .from(chosen)
              .select("*")
              .range(fromAny, toAny)
              .abortSignal(ctrl.signal);
            rows = (resAny.data ?? []) as Array<Record<string, unknown>>;
            lastError = null;
          } else if (off < namedTotal) {
            const takeA = Math.min(limit, namedTotal - off);
            const fromA = off;
            const toA = fromA + takeA - 1;
            const resA = await supabase
              .schema("public")
              .from(chosen)
              .select("*")
              .or(nameNonEmptyExpr)
              .range(fromA, toA)
              .abortSignal(ctrl.signal);
            partA = (resA.data ?? []) as Array<Record<string, unknown>>;

            const remainder = limit - partA.length;
            if (remainder > 0) {
              // добираем из unnamed с самого начала
              let unnamedQ = supabase.schema("public").from(chosen).select("*").abortSignal(ctrl.signal);
              for (const col of nameColsAvail) {
                const colExpr = col.includes(" ") ? `"${col}"` : col;
                unnamedQ = unnamedQ.or(`${colExpr}.is.null,${colExpr}.eq.""`);
              }
              const resB = await unnamedQ.range(0, remainder - 1);
              partB = (resB.data ?? []) as Array<Record<string, unknown>>;
            }
          } else {
            // Страница целиком из unnamed
            const unnamedOff = off - namedTotal;
            let unnamedQ = supabase.schema("public").from(chosen).select("*").abortSignal(ctrl.signal);
            for (const col of nameColsAvail) {
              const colExpr = col.includes(" ") ? `"${col}"` : col;
              unnamedQ = unnamedQ.or(`${colExpr}.is.null,${colExpr}.eq.""`);
            }
            const resB = await unnamedQ.range(unnamedOff, unnamedOff + limit - 1);
            partB = (resB.data ?? []) as Array<Record<string, unknown>>;
          }

          rows = [...partA, ...partB];
          lastError = null;
        }
        // If nothing found yet, one more attempt in auth schema (supabase auth users)
        if ((!rows || rows.length === 0)) {
          try {
            const { data: authUsers, error: authErr } = await supabase
              .schema("auth")
              .from("users")
              .select("*")
              .abortSignal(ctrl.signal);
            if (!authErr) {
              rows = (authUsers ?? []) as Array<Record<string, unknown>>;
              lastError = null;
            } else {
              lastError = authErr;
            }
          } catch {
            // ignore, will handle below
            void 0;
          }
        }

        if (lastError && (!rows || rows.length === 0)) throw lastError;

        // Build unique patients map
        const map = new Map<string, Patient>();
        for (const r of rows ?? []) {
          const id = normalizePatientId(r);
          const fio = normalizeFio(r);
          const phone = normalizePhone(r);

          // skip empty rows
          if (!id && !fio) continue;

          const key = id || `${fio}|${phone ?? ""}`;
          const prev = map.get(key);
          if (!prev) {
            map.set(key, { id: id || key, fio, phone });
          } else {
            // backfill phone if missing
            if (!prev.phone && phone) prev.phone = phone;
          }
        }

        const list = Array.from(map.values()).sort((a, b) => {
          const aEmpty = !a.fio || a.fio.trim() === "";
          const bEmpty = !b.fio || b.fio.trim() === "";
          if (aEmpty && !bEmpty) return 1; // пустые в конец
          if (!aEmpty && bEmpty) return -1;
          return a.fio.localeCompare(b.fio, "ru");
        });
        if (ctrl.signal.aborted) return;
        setPatients(list);
        if (usedSrc) {
          setPatientsSrc(usedSrc);
          try { localStorage.setItem(PATIENTS_SRC_KEY, usedSrc); } catch { /* ignore */ }
        }

        // Preselect the first patient if any
        if (!selected && list.length > 0) {
          setSelected(list[0]);
        }
        // Save to browser cache so subsequent visits are instant
        try {
          const finalSelectedId = (selected?.id) ?? (list[0]?.id ?? null);
          const payload: PatientsCache = { ts: Date.now(), patients: list, selectedId: finalSelectedId };
          localStorage.setItem(PATIENTS_CACHE_KEY, JSON.stringify(payload));
        } catch { void 0; }
      } catch (e: unknown) {
        console.error(e);
        const errObj = (typeof e === "object" && e !== null ? e : {}) as {
          message?: string;
          error_description?: string;
          hint?: string;
          details?: string;
          code?: string;
        };
        const msg =
          errObj.message ??
          errObj.error_description ??
          errObj.hint ??
          errObj.details ??
          (typeof e === "object" ? JSON.stringify(e) : String(e));
        setErrorMsg(msg);
      } finally {
        setLoading(false);
      }
    })();
  return () => { ctrl.abort(); };
  }, [reloadTick, activeTab, page, patientsSrc, isSearching]);

  // Сбрасываем страницу при изменении поискового запроса
  React.useEffect(() => {
    setPage(1);
  }, [deferredQuery]);

  // Глобальный поиск по БД c пагинацией
  React.useEffect(() => {
    if (activeTab !== 0) return;
    const q = deferredQuery.trim();
    if (!q) return;

    const ctrl = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // Берём известный источник или из localStorage
        let src: string | null = patientsSrc ?? null;
        if (!src) {
          try { src = localStorage.getItem(PATIENTS_SRC_KEY) || null; } catch { src = null; }
        }
        if (!src) {
          // fallback — попробуем "Patients"
          src = "Patients";
        }

        // Паттерн для ilike
        const patt = `%${q}%`;

        // Вычисляем доступные колонки на основании сэмпла
        const sample = await supabase
          .schema("public")
          .from(src)
          .select("*")
          .range(0, 0)
          .abortSignal(ctrl.signal);
        const sampleCols = Array.isArray(sample.data) && sample.data[0]
          ? Object.keys(sample.data[0] as Record<string, unknown>)
          : [];
        const usable = [...NAME_COLS, ...PHONE_COLS].filter((c) => sampleCols.includes(c));
        if (usable.length === 0) {
          setTotal(0);
          setPatients([]);
          setLoading(false);
          return;
        }
        const orExpr = usable
          .map((c) => `${c.includes(" ") ? `"${c}"` : c}.ilike.${patt}`)
          .join(",");

        const from = (page - 1) * PER_PAGE;
        const to = from + PER_PAGE - 1;

        const res = await supabase
          .schema("public")
          .from(src)
          .select("*", { count: "exact" })
          .or(orExpr)
          .range(from, to)
          .abortSignal(ctrl.signal);

        if (res.error) throw res.error;

        setTotal((res as unknown as { count?: number }).count ?? 0);

        // Нормализация и сортировка (без имени в конец видимой выдачи)
        const data = (res.data ?? []) as Array<Record<string, unknown>>;
        let mapped: Patient[] = [];
        const map = new Map<string, Patient>();
        for (const r of data) {
          const id = normalizePatientId(r);
          const fio = normalizeFio(r);
          const phone = normalizePhone(r);
          if (!id && !fio) continue;
          const key = id || `${fio}|${phone ?? ""}`;
          if (!map.has(key)) map.set(key, { id: id || key, fio, phone });
        }
        mapped = Array.from(map.values()).sort((a, b) => {
          const aEmpty = !a.fio || a.fio.trim() === "";
          const bEmpty = !b.fio || b.fio.trim() === "";
          if (aEmpty && !bEmpty) return 1;
          if (!aEmpty && bEmpty) return -1;
          return a.fio.localeCompare(b.fio, "ru");
        });

        setPatients(mapped);
        // preselect
        if (!selected && mapped.length > 0) setSelected(mapped[0]);

      } catch (e: unknown) {
        console.error(e);
        const errObj = (typeof e === "object" && e !== null ? e : {}) as { message?: string; error_description?: string; hint?: string; details?: string; code?: string; };
        const msg =
          errObj.message ??
          errObj.error_description ??
          errObj.hint ??
          errObj.details ??
          (typeof e === "object" ? JSON.stringify(e) : String(e));
        setErrorMsg(msg);
      } finally {
        setLoading(false);
      }
    })();
    return () => { ctrl.abort(); };
  }, [activeTab, deferredQuery, page, patientsSrc]);

  // Fetch history when selected patient changes
  React.useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        if (!selected || !(activeTab === 1 || activeTab === 2)) return;
        setHistoryLoading(true);
        setHistoryError(null);

        // Try cache first for this patient's history
        try {
          const raw = localStorage.getItem(HISTORY_CACHE_PREFIX + selected.id);
          if (raw) {
            const parsed = JSON.parse(raw) as HistoryCache;
            setHistory(parsed.items || []);
            setHistoryLoading(false);
            return;
          }
        } catch { void 0; }

        let rows: Array<Record<string, unknown>> | null = null;
        let lastError: unknown = null;

        // Try to query by patient id from the views/tables; fallback to client filter
        for (const tableName of ["FullAppointmentsView", "AppointmentsView", "Appointments"]) {
          // Prefer server-side filter if column exists; we can't introspect, so try ID first then FIO
          let data: Array<Record<string, unknown>> | null = null;
          let error: unknown = null;

          // Attempt by "Пациент ID"
          const resById = await supabase
            .schema("public")
            .from(tableName)
            .select("*")
            .eq("Пациент ID", selected.id)
            .abortSignal(ctrl.signal);
          if (!resById.error) {
            data = (resById.data ?? []) as Array<Record<string, unknown>>;
          } else {
            // Attempt by "ID" equals selected.id (if table is Patients-like)
            const resById2 = await supabase
              .schema("public")
              .from(tableName)
              .select("*")
              .eq("ID", selected.id)
              .abortSignal(ctrl.signal);
            if (!resById2.error) {
              data = (resById2.data ?? []) as Array<Record<string, unknown>>;
            } else {
              // Last try: fetch and filter by FIO client-side
              const resAll = await supabase
                .schema("public")
                .from(tableName)
                .select("*")
                .abortSignal(ctrl.signal);
              if (!resAll.error) {
                const all = (resAll.data ?? []) as Array<Record<string, unknown>>;
                data = all.filter(
                  (r) =>
                    normalizePatientId(r) === selected.id ||
                    normalizeFio(r).toLowerCase().trim() === selected.fio.toLowerCase().trim()
                );
              } else {
                error = resAll.error;
              }
            }
          }

          if (!error && data) {
            rows = data;
            lastError = null;
            break;
          }
          lastError = error ?? lastError;
        }
        if (lastError) throw lastError;

        const hist: HistoryRow[] = (rows ?? [])
          .map((r) => ({
            ID: String(
              (r["ID"] ??
                r["Прием ID"] ??
                r["Appointment ID"] ??
                r["Appointment_Id"] ??
                r["Запись ID"] ??
                r["Запись"] ??
                r["id"] ??
                "") as string | number
            ),
            "Дата и время": String(r["Дата и время"] ?? ""),
            "Дата n8n": (r["Дата n8n"] as string) ?? undefined,
            "Доктор ФИО": (r["Доктор ФИО"] as string) ?? (r["Доктор"] as string) ?? undefined,
            "Пациент ФИО": normalizeFio(r) || undefined,
            "Услуга": (r["Название услуги"] as string) ?? (r["Услуга"] as string) ?? undefined,
            "Услуга ID": (r["Услуга ID"] as string) ?? undefined,
            Статус: (r["Статус"] as string) ?? undefined,
            Стоимость: r["Стоимость"] != null ? Number(r["Стоимость"]) : undefined,
            "Итого, сом": r["Итого, сом"] != null ? Number(r["Итого, сом"]) : undefined,
            "Жалобы при обращении": (r["Жалобы при обращении"] as string) ?? undefined,
            "Комментарий администратора": (r["Комментарий администратора"] as string) ?? undefined,
          }))
          .filter((r) => r["Дата и время"]) // valid rows
          .sort((a, b) => {
            // dd.MM.yyyy HH:mm or similar; fallback to string compare
            const ax = a["Дата и время"];
            const bx = b["Дата и время"];
            return ax < bx ? 1 : ax > bx ? -1 : 0;
          });

        setHistory(hist);
        // Save to cache for subsequent visits to this patient
        try {
          const payload: HistoryCache = { ts: Date.now(), items: hist };
          localStorage.setItem(HISTORY_CACHE_PREFIX + selected.id, JSON.stringify(payload));
        } catch { void 0; }
      } catch (e: unknown) {
        console.error(e);
        const errObj = (typeof e === "object" && e !== null ? e : {}) as {
          message?: string;
          error_description?: string;
          hint?: string;
          details?: string;
          code?: string;
        };
        const msg =
          errObj.message ??
          errObj.error_description ??
          errObj.hint ??
          errObj.details ??
          (typeof e === "object" ? JSON.stringify(e) : String(e));
        setHistoryError(msg);
      } finally {
        setHistoryLoading(false);
      }
    })();
  return () => { ctrl.abort(); };
  }, [selected, activeTab]);

  const filteredPatients = React.useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.fio.toLowerCase().includes(q) ||
        (p.phone ? p.phone.toLowerCase().includes(q) : false) ||
        p.id.toLowerCase().includes(q)
    );
  }, [patients, deferredQuery]);

  // Visible patients: show all loaded (server-paged via "Загрузить ещё")
  const visiblePatients = filteredPatients;

  // Add patient
  const handleAddPatient = async () => {
    try {
      if (!newFio.trim()) return;
      const fio = newFio.trim();
      const phone = newPhone.trim() || null;

      let insertedId: string | null = null;
      let lastErr: unknown = null;

      // Try variations of column names
      const attempts: Array<Record<string, unknown>> = [
        { "ФИО": fio, "Телефон": phone },
        { "Пациент ФИО": fio, "Телефон": phone },
        { "Имя": fio.split(" ")[1] ?? fio, "Фамилия": fio.split(" ")[0] ?? "", "Телефон": phone },
        { "name": fio, "phone": phone },
      ];

      for (const tableName of ["Patients", "patients"]) {
        for (const payload of attempts) {
          const { data, error } = await supabase
            .schema("public")
            .from(tableName)
            .insert(payload as Record<string, unknown>)
            .select();
          if (!error && data && data.length > 0) {
            const d0 = data[0] as Record<string, unknown>;
            insertedId = String((d0["ID"] ?? d0["id"] ?? "") as string);
            lastErr = null;
            break;
          }
          lastErr = error ?? lastErr;
        }
        if (insertedId) break;
      }

      if (!insertedId && lastErr) throw lastErr;

      // Refresh patients list
      setAddOpen(false);
      setNewFio("");
      setNewPhone("");
      // simple refetch
      setSelected(null);
      setPatients([]);
      setHistory([]);
      setQuery("");
      // re-run initial effect
      (async () => {
        try {
          setLoading(true);
          setErrorMsg(null);

          let rows: Array<Record<string, unknown>> | null = null;
          let lastError: unknown = null;
          for (const tableName of ["Patients", "patients", "FullAppointmentsView", "AppointmentsView"]) {
            const { data, error } = await supabase.schema("public").from(tableName).select("*");
            if (!error) {
              rows = (data ?? []) as Array<Record<string, unknown>>;
              lastError = null;
              break;
            }
            lastError = error;
          }
          if (lastError) throw lastError;

          const map = new Map<string, Patient>();
          for (const r of rows ?? []) {
            const id = normalizePatientId(r);
            const f = normalizeFio(r);
            const ph = normalizePhone(r);
            if (!id && !f && !ph) continue;
            const key = id || `${f}|${ph ?? ""}`;
            if (!map.has(key)) map.set(key, { id: id || key, fio: f, phone: ph });
          }
          const list = Array.from(map.values()).sort((a, b) => {
            const aEmpty = !a.fio || a.fio.trim() === "";
            const bEmpty = !b.fio || b.fio.trim() === "";
            if (aEmpty && !bEmpty) return 1; // пустые в конец
            if (!aEmpty && bEmpty) return -1;
            return a.fio.localeCompare(b.fio, "ru");
          });
          setPatients(list);
          const sel =
            insertedId && list.find((p) => p.id === insertedId) ? list.find((p) => p.id === insertedId)! : list[0] ?? null;
          setSelected(sel);
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      })();
    } catch (e: unknown) {
      console.error(e);
      {
        const msg =
          typeof e === "object" && e !== null && "message" in e
            ? String((e as { message?: unknown }).message)
            : typeof e === "object"
            ? JSON.stringify(e)
            : String(e);
        alert("Не удалось добавить пациента: " + msg);
      }
    }
  };

  // Create appointment
  const handleCreateVisit = async () => {
    try {
      if (!selected) return;
      if (!visitDateTime) return;

      const payloadCandidates: Array<Record<string, unknown>> = [
        {
          "Пациент ID": selected.id,
          "Дата и время": visitDateTime.replace("T", " "),
          "Статус": "Ожидаем",
          "Доктор ФИО": visitDoctor || null,
          "Услуга ID": visitService || null,
          "Стоимость": visitPrice ? Number(visitPrice) : null,
        },
        {
          "Пациент ID": selected.id,
          "Дата": visitDateTime.split("T")[0],
          "Статус": "Ожидаем",
          "Доктор": visitDoctor || null,
          "Услуга": visitService || null,
          "Стоимость": visitPrice ? Number(visitPrice) : null,
        },
      ];

      let success = false;
      let lastErr: unknown = null;
      for (const tableName of ["Appointments", "appointments"]) {
        for (const payload of payloadCandidates) {
          const { error } = await supabase
            .schema("public")
            .from(tableName)
            .insert(payload as Record<string, unknown>);
          if (!error) {
            success = true;
            lastErr = null;
            break;
          }
          lastErr = error ?? lastErr;
        }
        if (success) break;
      }
      if (!success && lastErr) throw lastErr;

      setVisitOpen(false);
      setVisitDateTime("");
      setVisitDoctor("");
      setVisitService("");
      setVisitPrice("");

      // invalidate cached history for this patient
      try { localStorage.removeItem(HISTORY_CACHE_PREFIX + selected.id); } catch { void 0; }
      // refresh history quickly
      setHistory([]);
      setHistoryLoading(true);
      setTimeout(() => {
        // trigger effect by re-setting selected
        setSelected((prev) => (prev ? { ...prev } : prev));
      }, 50);
    } catch (e: unknown) {
      console.error(e);
      {
        const msg =
          typeof e === "object" && e !== null && "message" in e
            ? String((e as { message?: unknown }).message)
            : typeof e === "object"
            ? JSON.stringify(e)
            : String(e);
        alert("Не удалось создать прием: " + msg);
      }
    }
  };

  return (
    <Box>
      <SubHeader
        title="Поиск пациента"
        actions={
          <Stack direction="row" gap={1}>
            <Button variant="contained" startIcon={<PersonAddAltOutlined />} onClick={() => setAddOpen(true)}>
              Добавить пациента
            </Button>
            <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={handleManualRefresh}>
              Обновить
            </Button>
            <Button
              variant="outlined"
              startIcon={<EventAvailableOutlined />}
              disabled={!selected}
              onClick={() => setVisitOpen(true)}
            >
              Прием
            </Button>
          </Stack>
        }
      />

      <Box sx={{ px: 2, py: 2 }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link component={RouterLink} to="/home" underline="hover" color="inherit">
            Главная
          </Link>
          <Typography color="text.primary">Поиск пациента</Typography>
        </Breadcrumbs>

        <Tabs
          value={activeTab}
          onChange={(_e, val) => setActiveTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2 }}
        >
          <Tab label="Пациенты" />
          <Tab label="История" />
          <Tab label="Карточка" />
        </Tabs>

        <Grid container spacing={2}>
          {/* Left column: Patients */}
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardHeader
                title={
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Typography variant="subtitle1">Пациенты</Typography>
                    <Chip size="small" label={patients.length} />
                  </Stack>
                }
                action={
                  <Stack direction="row" gap={1} alignItems="center" sx={{ width: { xs: 1, md: "auto" } }}>
                    <TextField
                      size="small"
                      placeholder="Поиск ФИО/телефон"
                      InputProps={{ startAdornment: (
                        <InputAdornment position="start">
                          <SearchOutlined fontSize="small" />
                        </InputAdornment>
                      ) }}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </Stack>
                }
              />
              <Divider />
              <CardContent sx={{ p: 0, maxHeight: "53vh", overflowY: "auto" }}>
                {loading ? (
                  <Typography sx={{ p: 2 }} variant="body2">
                    Загрузка…
                  </Typography>
                ) : errorMsg ? (
                  <Typography sx={{ p: 2 }} variant="body2" color="error">
                    Ошибка: {errorMsg}
                  </Typography>
                ) : filteredPatients.length === 0 ? (
                  <Typography sx={{ p: 2 }} variant="body2">
                    Нет пациентов
                  </Typography>
                ) : (
                  <>
                  <List disablePadding>
                    {visiblePatients.map((p) => {
                      const active = selected?.id === p.id || selected?.fio === p.fio;
                      return (
                        <React.Fragment key={`${p.id}-${p.fio}`}>
                          <ListItemButton
                            selected={active}
                            onClick={() => setSelected(p)}
                            sx={{
                              px: 2,
                              py: 1.25,
                              my: "5px", // 10px между элементами (5px сверху и снизу)
                              border: "1px solid transparent",
                              borderRadius: 1,
                              "&.Mui-selected": {
                                borderColor: (theme) => theme.palette.primary.main,
                                bgcolor: (theme) => theme.palette.action.selected,
                              },
                            }}
                          >
                            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ width: 1 }}>
                              <Avatar sx={{ width: 28, height: 28, bgcolor: (theme) => theme.palette.primary.main, fontSize: 12 }}>
                                {getInitials(p.fio)}
                              </Avatar>
                              <ListItemText
                                primary={
                                  <Typography variant="subtitle2" noWrap>
                                    {p.fio || "Без имени"}
                                  </Typography>
                                }
                                secondary={
                                  <Stack direction="row" alignItems="center" gap={0.75}>
                                    <LocalPhoneOutlined fontSize="inherit" />
                                    <Typography variant="caption" color="text.secondary" noWrap>
                                      {p.phone || "—"}
                                    </Typography>
                                  </Stack>
                                }
                              />
                            </Stack>
                          </ListItemButton>
                        </React.Fragment>
                      );
                    })}
                  </List>
                  <Box sx={{ px: 2, py: 1.25, display: "flex", justifyContent: "center" }}>
                    <Pagination
                      count={Math.max(1, Math.ceil(total / PER_PAGE))}
                      page={page}
                      onChange={(_e, val) => setPage(val)}
                      size="small"
                      showFirstButton
                      showLastButton
                    />
                  </Box>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Middle column: History */}
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardHeader
                title={
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Typography variant="subtitle1">История приемов</Typography>
                    <Chip size="small" label={history.length} />
                  </Stack>
                }
              />
              <Divider />
              <CardContent sx={{ p: 0, maxHeight: "53vh", overflowY: "auto" }}>
                {selected == null ? (
                  <Typography sx={{ p: 2 }} variant="body2">
                    Выберите пациента слева
                  </Typography>
                ) : historyLoading ? (
                  <Typography sx={{ p: 2 }} variant="body2">
                    Загрузка…
                  </Typography>
                ) : historyError ? (
                  <Typography sx={{ p: 2 }} variant="body2" color="error">
                    Ошибка: {historyError}
                  </Typography>
                ) : history.length === 0 ? (
                  <Typography sx={{ p: 2 }} variant="body2">
                    История пуста
                  </Typography>
                ) : (
                  <Stack divider={<Divider flexItem />}>
                    {history.map((h) => (
                      <Box
                        key={h.ID}
                        component={RouterLink}
                        to={`/home/appointments/${h.ID}`}
                        sx={{
                          px: 2,
                          py: 1.25,
                          textDecoration: "none",
                          color: "inherit",
                          "&:hover": { bgcolor: (theme) => theme.palette.action.hover },
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                          <Stack>
                            <Typography variant="subtitle2">{h["Дата и время"]}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              Доктор: {h["Доктор ФИО"] || "—"}
                            </Typography>
                            {h["Услуга"] && (
                              <Typography variant="body2" color="text.secondary">
                                Услуга: {h["Услуга"]}
                              </Typography>
                            )}
                          </Stack>
                          <Stack alignItems="flex-end">
                            {typeof h["Итого, сом"] !== "undefined" || typeof h["Стоимость"] !== "undefined" ? (
                              <Typography variant="body2" color="text.secondary">
                                Сумма: {formatKGS(h["Итого, сом"] ?? h["Стоимость"] ?? 0)}
                              </Typography>
                            ) : null}
                            {h.Статус && (
                              <Chip
                                label={h.Статус}
                                size="small"
                                color={
                                  h.Статус === "Оплачено"
                                    ? "success"
                                    : h.Статус === "Ожидаем"
                                    ? "warning"
                                    : "default"
                                }
                                variant={h.Статус === "Со скидкой" ? "outlined" : "filled"}
                              />
                            )}
                          </Stack>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card
              variant="outlined"
              sx={{
                borderColor: "transparent",
                color: "primary.contrastText",
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.palette.info.light}, ${theme.palette.info.main})`,
              }}
            >
              <CardHeader
                title={
                  <Stack direction="row" alignItems="center" gap={1.25}>
                    <PersonOutlineOutlined />
                    <Typography variant="h6">Карточка пациента</Typography>
                  </Stack>
                }
              />
              <Divider sx={{ borderColor: "rgba(255,255,255,0.35)" }} />
              <CardContent>
                {selected ? (
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle1">{selected.fio}</Typography>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <LocalPhoneOutlined />
                      <Typography variant="body2">{selected.phone || "—"}</Typography>
                    </Stack>
                    <Divider sx={{ borderColor: "rgba(255,255,255,0.35)" }} />
                    <Stack direction="row" alignItems="center" gap={1}>
                      <CalendarMonthOutlined />
                      <Typography variant="body2">
                        Последний прием: {history[0]?.["Дата и время"] || "—"}
                      </Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <MedicalServicesOutlined />
                      <Typography variant="body2">Последняя услуга: {history[0]?.["Услуга"] || "—"}</Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <NotesOutlined />
                      <Typography variant="body2">
                        Жалобы: {history[0]?.["Жалобы при обращении"] || "—"}
                      </Typography>
                    </Stack>
                  </Stack>
                ) : (
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Выберите пациента слева
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Dialog: Add Patient */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Добавить пациента</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="ФИО"
              value={newFio}
              onChange={(e) => setNewFio(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label="Телефон"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Отмена</Button>
          <Button onClick={handleAddPatient} variant="contained">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Create Appointment */}
      <Dialog open={visitOpen} onClose={() => setVisitOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Создать прием</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Дата и время"
              type="datetime-local"
              value={visitDateTime}
              onChange={(e) => setVisitDateTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Доктор (ФИО или ID)"
              value={visitDoctor}
              onChange={(e) => setVisitDoctor(e.target.value)}
              fullWidth
            />
            <TextField
              label="Услуга (ID или название)"
              value={visitService}
              onChange={(e) => setVisitService(e.target.value)}
              fullWidth
            />
            <TextField
              label="Стоимость"
              type="number"
              value={visitPrice}
              onChange={(e) => setVisitPrice(e.target.value === "" ? "" : Number(e.target.value))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVisitOpen(false)}>Отмена</Button>
          <Button onClick={handleCreateVisit} variant="contained" disabled={!selected}>
            Создать
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PatientSearchPage;
