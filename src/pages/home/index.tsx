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

// Helper to format today like 15.11.2025
const formatRuDate = (d: Date) =>
  d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

function parseRuDate(s: string): Date | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (!m) return null;
  const [, d, mth, y] = m;
  return new Date(Number(y), Number(mth) - 1, Number(d));
}

// Keep local Appointment type for state/filters in this file
type Appointment = {
  ID: string;
  "Дата и время": string;
  "Дата n8n": string; // dd.MM.yyyy
  "Доктор ID": string;
  "Пациент ID": string;
  Статус: "Оплачено" | "Ожидаем" | "Со скидкой" | string;
  Ночь: boolean | string;
  Стоимость: number;
  "Итого, сом"?: number;
  "Наличные"?: number;
  "Безналичные"?: number;
  "Долг"?: number;
};

type RuAppointmentRow = {
  "ID": string | number;
  "Дата и время": string | null;
  "Дата n8n": string | null;
  "Доктор ID": string | null;
  "Пациент ID": string | null;
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
      try {
        // Query Appointments view using Russian column names
        const selectClause =
          '"ID","Дата и время","Дата n8n","Доктор ID","Пациент ID","Статус","Ночь","Стоимость","Итого, сом","Скидка","Наличные","Безналичные","Долг"';
        let rows: RuAppointmentRow[] | null = null;
        let lastError: unknown = null;
        for (const tableName of ["Appointments"]) {
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
          ID: String(r["ID"]),
          "Дата и время": r["Дата и время"] ?? "",
          "Дата n8n": r["Дата n8n"] ?? "",
          "Доктор ID": r["Доктор ID"] ?? "",
          "Пациент ID": r["Пациент ID"] ?? "",
          Статус: r["Статус"] ?? "",
          Ночь: r["Ночь"] ?? false,
          Стоимость: Number(r["Стоимость"] ?? 0),
          "Итого, сом": r["Итого, сом"] != null ? Number(r["Итого, сом"]) : undefined,
          "Наличные": r["Наличные"] != null ? Number(r["Наличные"]) : undefined,
          "Безналичные": r["Безналичные"] != null ? Number(r["Безналичные"]) : undefined,
          "Долг": r["Долг"] != null ? Number(r["Долг"]) : undefined,
        }));

        setAll(mapped);

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
          setDate(`${yyyy}-${mm}-${dd}`);
        }
      } catch (e: unknown) {
        console.error(e);
        setErrorMsg(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Fetch Services from Supabase (try both "Services" and "services")
  React.useEffect(() => {
    (async () => {
      try {
        setServicesLoading(true);
        setServicesError(null);

        let rows: Array<Record<string, unknown>> | null = null;
        let lastError: unknown = null;
        for (const tableName of ["Services", "services"]) {
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

        setServices(rows ?? []);
      } catch (e: unknown) {
        console.error(e);
        setServicesError(e instanceof Error ? e.message : String(e));
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
      if (doctorId && !String(a["Доктор ID"]).includes(doctorId)) return false;
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
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    по отфильтрованным
                  </Typography>
                  <ToggleButtonGroup
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
            label="Доктор ID"
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
