import React from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
  Checkbox,
  FormControlLabel,
  Button,
} from "@mui/material";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import PaidOutlined from "@mui/icons-material/PaidOutlined";
import CheckCircleOutlineOutlined from "@mui/icons-material/CheckCircleOutlineOutlined";
import HourglassEmptyOutlined from "@mui/icons-material/HourglassEmptyOutlined";
import Grid from "@mui/material/Grid";
import { SubHeader } from "../../components";
import { supabase } from "../../utility/supabaseClient";
import { formatKGS } from "../../utility/format";
import AppointmentsList from "./components/AppointmentsList";
import ServicesList from "./components/ServicesList";
import type { Appointment } from "./types";

// Simple module-level cache to avoid refetching on every navigation
let CACHED_ALL: Appointment[] | null = null;
let CACHED_SERVICES: Array<Record<string, unknown>> | null = null;
let CACHED_INIT_DATE: string | null = null;

// Helper to format today like 15.11.2025
const formatRuDate = (d: Date) =>
  d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

function parseRuDate(s: string): Date | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (!m) return null;
  const [, d, mth, y] = m;
  return new Date(Number(y), Number(mth) - 1, Number(d));
}

/**
 * Parse numbers from mixed formats safely:
 * - Handles: "1 200", "1,200.50", "1.200,50", "1200 сом", etc.
 * - Returns 0 if not parsable
 */
function parseNumberSafe(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const raw = String(v)
    .replace(/\s+/g, "")
    .replace(/[^\d.,-]/g, "");
  const hasDot = raw.includes(".");
  const hasComma = raw.includes(",");
  let norm = raw;
  if (hasDot && hasComma) {
    const lastDot = raw.lastIndexOf(".");
    const lastComma = raw.lastIndexOf(",");
    if (lastComma > lastDot) {
      norm = raw.replace(/\./g, "").replace(",", ".");
    } else {
      norm = raw.replace(/,/g, "");
    }
  } else {
    norm = hasComma ? raw.replace(",", ".") : raw;
  }
  const n = parseFloat(norm);
  return Number.isFinite(n) ? n : 0;
}

type RuAppointmentRow = {
  "ID": string | number;
  "Дата и время": string | null;
  "Дата n8n": string | null;
  "Доктор ФИО": string | null;
  "Пациент ФИО": string | null;
  // возможные альтернативные поля в представлении/запросе
  "Доктор": string | null;
  "Доктор Имя": string | null;
  "Доктор Фамилия": string | null;
  "Пациент": string | null;
  "Пациент Имя": string | null;
  "Пациент Фамилия": string | null;

  "Прием ID"?: string | number | null;
  "Appointment ID"?: string | number | null;
  "Appointment_Id"?: string | number | null;
  "Запись ID"?: string | number | null;
  "Запись"?: string | number | null;
  "id"?: string | number | null;

  "Статус": string | null;
  "Ночь": boolean | string | null;
  "Стоимость": number | string | null;
  "Итого, сом": number | string | null;
  "Скидка": number | string | null;
  "Наличные": number | string | null;
  "Безналичные": number | string | null;
  "Долг": number | string | null;
};

export const HomePage: React.FC = () => {
  // Appointments state
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [all, setAll] = React.useState<Appointment[]>([]);

  // UI state
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  // Filters
  const [date, setDate] = React.useState<string>("");
  const [status, setStatus] = React.useState<Record<string, boolean>>({
    "Оплачено": true,
    "Ожидаем": true,
    "Со скидкой": true,
  });
  const [onlyNight, setOnlyNight] = React.useState(false);
  const [doctorId, setDoctorId] = React.useState("");
  const [revenueMode, setRevenueMode] = React.useState<"total" | "cash" | "cashless">("total");
  const [paymentType, setPaymentType] = React.useState<"any" | "cash" | "cashless">("any");

  // Services state
  const [servicesLoading, setServicesLoading] = React.useState(true);
  const [servicesError, setServicesError] = React.useState<string | null>(null);
  const [services, setServices] = React.useState<Array<Record<string, unknown>>>([]);

// Fetch appointments
  React.useEffect(() => {
    (async () => {
      if (CACHED_ALL) {
        setAll(CACHED_ALL);
        if (CACHED_INIT_DATE) setDate(CACHED_INIT_DATE);
        setLoading(false);
        return;
      }
      try {
        // Query Appointments view using Russian column names
        const selectClause = "*";
        let rows: RuAppointmentRow[] | null = null;
        let lastError: unknown = null;
        for (const tableName of ["FullAppointmentsView", "AppointmentsView", "Appointments"]) {
          const { data, error } = await supabase
            .schema("public")
            .from(tableName)
            .select(selectClause);
          if (!error) {
            rows = data as RuAppointmentRow[] | null;
            lastError = null;
            break;
          }
          lastError = error;
        }
        if (lastError) throw lastError;

        const mapped: Appointment[] = (rows ?? []).map((r: RuAppointmentRow) => ({
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
          "Дата и время": r["Дата и время"] ?? "",
          "Дата n8n": r["Дата n8n"] ?? "",
          "Доктор ФИО":
            r["Доктор ФИО"] ??
            r["Доктор"] ??
            [r["Доктор Фамилия"], r["Доктор Имя"]].filter(Boolean).join(" ") ??
            "",
          "Пациент ФИО":
            r["Пациент ФИО"] ??
            r["Пациент"] ??
            [r["Пациент Фамилия"], r["Пациент Имя"]].filter(Boolean).join(" ") ??
            "",
          Статус: r["Статус"] ?? "",
          Ночь: r["Ночь"] ?? false,
          Стоимость: parseNumberSafe(r["Стоимость"]),
          "Итого, сом": r["Итого, сом"] != null ? parseNumberSafe(r["Итого, сом"]) : undefined,
          "Наличные": r["Наличные"] != null ? parseNumberSafe(r["Наличные"]) : undefined,
          "Безналичные": r["Безналичные"] != null ? parseNumberSafe(r["Безналичные"]) : undefined,
          "Долг": r["Долг"] != null ? parseNumberSafe(r["Долг"]) : undefined,
        }));

        setAll(mapped);
        CACHED_ALL = mapped;

        // Initialize date filter to latest by "Дата n8n"
        const latestRu = mapped
          .map((a) => a["Дата n8n"]) // dd.MM.yyyy
          .filter(Boolean)
          .sort((a, b) => {
            const da = parseRuDate(a);
            const db = parseRuDate(b);
            const ta = da ? da.getTime() : -Infinity;
            const tb = db ? db.getTime() : -Infinity;
            return tb - ta;
          })[0];
        if (latestRu) {
          const [dd, mm, yyyy] = latestRu.split(".");
          const iso = `${yyyy}-${mm}-${dd}`;
          setDate(iso);
          CACHED_INIT_DATE = iso;
        }
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
  }, []);

  // Build Services from FullAppointmentsView/AppointmentsView (no separate Services table needed)
  React.useEffect(() => {
    (async () => {
      if (CACHED_SERVICES) {
        setServices(CACHED_SERVICES as Array<Record<string, unknown>>);
        setServicesLoading(false);
        setServicesError(null);
        return;
      }
      try {
        setServicesLoading(true);
        setServicesError(null);

        let rows: Array<Record<string, unknown>> | null = null;
        let lastError: unknown = null;
        for (const tableName of ["FullAppointmentsView", "AppointmentsView"]) {
          const { data, error } = await supabase
            .schema("public")
            .from(tableName)
            .select("*");
          if (!error) {
            rows = (data ?? []) as Array<Record<string, unknown>>;
            lastError = null;
            break;
          }
          lastError = error;
        }
        if (lastError) throw lastError;

        type ServiceObj = {
          ID: string;
          "Название услуги": string;
          "Категория": string;
          "Стоимость, сом": number;
        };

        const map = new Map<string, ServiceObj>();
        for (const r of rows ?? []) {
          const get = (k: string) => (r as Record<string, unknown>)[k];

          const sid =
            String(
              get("Услуга ID") ??
                get("Service ID") ??
                get("service_id") ??
                get("serviceId") ??
                get("Услуга") ??
                get("Название услуги") ??
                get("service_name") ??
                get("ID") ??
                ""
            ) || "";
          if (!sid) continue;

          const name = String(
            get("Название услуги") ??
              get("Услуга") ??
              get("service_name") ??
              sid
          );

          const category = String(
            get("Категория") ??
              get("category") ??
              get("Сотрудник ID") ??
              get("Доктор ФИО") ??
              get("Доктор") ??
              ""
          );

          const priceVal =
            (get("Стоимость, сом") ??
              get("Стоимость") ??
              get("Итого, сом") ??
              get("price") ??
              get("amount") ??
              get("cost")) as number | string | null | undefined;
          const price = Number(priceVal ?? 0);

          const prev = map.get(sid);
          if (!prev) {
            map.set(sid, {
              ID: sid,
              "Название услуги": name,
              "Категория": category,
              "Стоимость, сом": price,
            });
          } else {
            if (!prev["Название услуги"] && name) prev["Название услуги"] = name;
            if (!prev["Категория"] && category) prev["Категория"] = category;
            if (!prev["Стоимость, сом"] && price) prev["Стоимость, сом"] = price;
          }
        }

        const servicesArr = Array.from(map.values()) as Array<Record<string, unknown>>;
        setServices(servicesArr);
        CACHED_SERVICES = servicesArr;
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
        setServicesError(msg);
      } finally {
        setServicesLoading(false);
      }
    })();
  }, []);

  // Derived
  const ruDateFromInput = React.useMemo(() => {
    if (!date) return "";
    const [yyyy, mm, dd] = date.split("-");
    return `${dd}.${mm}.${yyyy}`;
  }, [date]);

  const filtered = React.useMemo(() => {
    return all.filter((a) => {
      if (ruDateFromInput && a["Дата n8n"] !== ruDateFromInput) return false;
      if (status[a.Статус] === false) return false;
      if (onlyNight && !(a.Ночь === true || a.Ночь === "true")) return false;
      if (paymentType === "cash" && !(Number(a["Наличные"] ?? 0) > 0)) return false;
      if (paymentType === "cashless" && !(Number(a["Безналичные"] ?? 0) > 0)) return false;
      if (doctorId && !String(a["Доктор ФИО"]).includes(doctorId)) return false;
      return true;
    });
  }, [all, ruDateFromInput, status, onlyNight, paymentType, doctorId]);

  const appointmentsCount = React.useMemo(() => filtered.length, [filtered]);
  const paidCount = React.useMemo(() => filtered.filter((a) => a.Статус === "Оплачено").length, [filtered]);
  const waitingCount = React.useMemo(() => filtered.filter((a) => a.Статус === "Ожидаем").length, [filtered]);
  const revenueSum = React.useMemo(
    () =>
      revenueMode === "cash"
        ? filtered.reduce((acc, a) => acc + Number(a["Наличные"] ?? 0), 0)
        : revenueMode === "cashless"
        ? filtered.reduce((acc, a) => acc + Number(a["Безналичные"] ?? 0), 0)
        : filtered.reduce((acc, a) => acc + Number(a["Итого, сом"] ?? a["Стоимость"] ?? 0), 0),
    [filtered, revenueMode]
  );

  const resetFilters = () => {
    const today = new Date();
    const [dd, mm, yyyy] = formatRuDate(today).split(".");
    setDate(`${yyyy}-${mm}-${dd}`);
    setStatus({ "Оплачено": true, "Ожидаем": true, "Со скидкой": true });
    setOnlyNight(false);
    setDoctorId("");
  };

  return (
    <Box>
      <SubHeader title="Главная" />

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ px: 2, pt: 2, pb: 0 }}>
        <Grid item xs={12} md={4}>
          <Card
            variant="outlined"
            sx={{
              borderColor: "transparent",
              color: "primary.contrastText",
              background: (theme) =>
                `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.main})`,
            }}
          >
            <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <CalendarMonthOutlined />
              <Box>
                <Typography variant="overline" sx={{ opacity: 0.9 }}>
                  Приемов сегодня
                </Typography>
                <Typography variant="h4">{appointmentsCount}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  {ruDateFromInput || "—"}
                </Typography>
              </Box>
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
                `linear-gradient(135deg, ${theme.palette.success.light}, ${theme.palette.success.main})`,
            }}
          >
            <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <PaidOutlined />
              <Box>
                <Typography variant="overline" sx={{ opacity: 0.9 }}>
                  Доход
                </Typography>
                <Typography variant="h4">{formatKGS(revenueSum)}</Typography>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                  <ToggleButtonGroup
                    style={{ flexWrap: "nowrap" }}
                    size="small"
                    value={revenueMode}
                    exclusive
                    onChange={(_, val) => {
                      if (val) setRevenueMode(val);
                    }}
                    sx={{
                      "& .MuiToggleButton-root": {
                        color: "#fff",
                        borderColor: "rgba(255,255,255,0.5)",
                      },
                      "& .MuiToggleButton-root.Mui-selected": {
                        color: "#fff",
                        backgroundColor: "rgba(255,255,255,0.16)",
                        borderColor: "rgba(255,255,255,0.9)",
                      },
                      "& .MuiToggleButton-root:hover": {
                        borderColor: "rgba(255,255,255,0.9)",
                        backgroundColor: "rgba(255,255,255,0.1)",
                      },
                    }}
                  >
                    <ToggleButton value="total">Итого</ToggleButton>
                    <ToggleButton value="cash">Наличные</ToggleButton>
                    <ToggleButton value="cashless">Безналичные</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
              </Box>
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
            <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Box>
                <Typography variant="overline" sx={{ opacity: 0.9 }}>
                  Статусы
                </Typography>
                <Stack direction="row" gap={1} alignItems="center">
                  <CheckCircleOutlineOutlined fontSize="small" />
                  <Typography variant="h6">{paidCount}</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    оплачено
                  </Typography>
                </Stack>
                <Stack direction="row" gap={1} alignItems="center">
                  <HourglassEmptyOutlined fontSize="small" />
                  <Typography variant="h6">{waitingCount}</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    ожидаем
                  </Typography>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Columns */}
      <Grid container spacing={2} sx={{ p: 2 }}>
        {/* Column 1: Appointments */}
        <Grid item xs={12} md={4}>
          <AppointmentsList
            titleDate={ruDateFromInput}
            loading={loading}
            errorMsg={errorMsg}
            items={filtered}
            onOpenFilters={() => setFiltersOpen(true)}
          />
        </Grid>

        {/* Column 2: Services */}
        <Grid item xs={12} md={4}>
          <ServicesList loading={servicesLoading} errorMsg={servicesError} items={services} />
        </Grid>

        {/* Column 3: Placeholder for future */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardHeader title="Продажи" />
            <Divider />
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Скоро…
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters Drawer (right) */}
      <Drawer
        anchor="right"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: 320, sm: 380 },
            zIndex: (theme) => theme.zIndex.drawer + 10,
          },
        }}
        ModalProps={{
          slotProps: {
            backdrop: {
              sx: {
                // Keep header visible (not dimmed) while backdrop is shown
                zIndex: (theme) => theme.zIndex.appBar - 1,
              },
            },
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1 }}>
          <Typography variant="h6">Фильтры приемов</Typography>
          <IconButton onClick={() => setFiltersOpen(false)}>
            <CloseOutlined />
          </IconButton>
        </Box>
        <Divider />
        <Stack spacing={2} sx={{ p: 2 }}>
          <TextField
            label="Дата"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          <Typography variant="subtitle2">Статус</Typography>
          {Object.keys(status).map((s) => (
            <FormControlLabel
              key={s}
              control={
                <Checkbox
                  checked={status[s]}
                  onChange={(e) => setStatus((pr) => ({ ...pr, [s]: e.target.checked }))}
                />
              }
              label={s}
            />
          ))}

          <FormControlLabel
            control={<Checkbox checked={onlyNight} onChange={(e) => setOnlyNight(e.target.checked)} />}
            label="Только ночные"
          />

          <Typography variant="subtitle2">Тип оплаты</Typography>
          <ToggleButtonGroup
            size="small"
            value={paymentType}
            exclusive
            onChange={(_, val) => {
              if (val) setPaymentType(val);
            }}
          >
            <ToggleButton value="any">Любой</ToggleButton>
            <ToggleButton value="cash">Наличные</ToggleButton>
            <ToggleButton value="cashless">Безналичные</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            label="Доктор"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            fullWidth
          />

          <Stack direction="row" gap={1}>
            <Button variant="contained" onClick={() => setFiltersOpen(false)}>
              Применить
            </Button>
            <Button variant="text" onClick={resetFilters}>
              Сбросить
            </Button>
          </Stack>
        </Stack>
      </Drawer>
    </Box>
  );
};

export default HomePage;
