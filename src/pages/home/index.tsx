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
// import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
// import PaidOutlined from '@mui/icons-material/PaidOutlined';
// import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
// import HourglassEmptyOutlined from '@mui/icons-material/HourglassEmptyOutlined';
import Grid from "@mui/material/Grid";
import { SubHeader } from "../../components";
import { supabase } from "../../utility/supabaseClient";
// import { formatKGS } from '../../utility/format';
import AppointmentsList from "./components/AppointmentsList";
import ServicesList from "./components/ServicesList";
import type { Appointment } from "./types";

/* Simple cache (оставляем только для услуг)
   Примечание: кэш приёмов отключён, т.к. теперь грузим серверно отфильтрованные по дате данные */
// let CACHED_ALL: Appointment[] | null = null;
// let CACHED_INIT_DATE: string | null = null;

// Helper to format today like 15.11.2025
const formatRuDate = (d: Date) =>
  d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

// Debounce helper (как на странице поиска пациентов)
function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function isAbortError(e: unknown): boolean {
  if (!e) return false;
  if (typeof e === "object" && e !== null) {
    const any = e as { name?: string; code?: unknown; message?: unknown };
    const name = String(any.name ?? "");
    const code = String(any.code ?? "");
    const msg = String(any.message ?? "");
    if (name === "AbortError") return true;
    if (code === "ABORT_ERR" || code === "20") return true;
    if (
      msg.toLowerCase().includes("aborted") ||
      msg.toLowerCase().includes("abort")
    )
      return true;
  } else if (typeof e === "string") {
    const s = e.toLowerCase();
    if (s.includes("abort")) return true;
  }
  return false;
}

// Paged fetch helper to bypass 1000 row per page limit
async function fetchPagedAll(
  table: string,
  pageSize = 10,
  date = "09.02.2023"
): Promise<Appointment[]> {
  const to = pageSize + pageSize - 1;
  const { data } = await supabase
    .schema("public")
    .from(table)
    .select("*")
    .range(pageSize, to)
    .filter("Дата n8n", "in", `(${date})`);

  return data ?? [];
}

const importMetaEnv =
  (import.meta as unknown as { env?: Record<string, string | undefined> })
    .env || {};
const APPTS_TABLE: string =
  importMetaEnv.VITE_APPTS_TABLE || "FullAppointmentsView";

function toRuFromIso(iso: string): string {
  const [yyyy, mm, dd] = String(iso || "").split("-");
  if (yyyy && mm && dd) return `${dd}.${mm}.${yyyy}`;
  return "";
}

function normalizeToken10(s?: unknown): string {
  if (!s) return "";
  const str = String(s).trim();
  return str.slice(0, 10);
}

function rowMatchesDate(
  row: Record<string, unknown>,
  isoDate: string
): boolean {
  if (!isoDate) return true;
  const ru = toRuFromIso(isoDate);
  const candidatesKeys = [
    "Дата n8n",
    "Дата",
    "Дата расчета",
    "Дата приема",
    "Дата приёма",
    "Дата визита",
  ];
  for (const k of candidatesKeys) {
    const v = (row as Record<string, unknown>)[k];
    const token = normalizeToken10(v);
    if (token === ru || token === isoDate) return true;
  }
  const dv = normalizeToken10((row as Record<string, unknown>)["Дата и время"]);
  if (dv === ru || dv === isoDate) return true;
  // Try to extract dd.MM.yyyy or yyyy-MM-dd from arbitrary strings
  const str = String((row as Record<string, unknown>)["Дата и время"] ?? "");
  const ruMatch = str.match(/(\d{2}\.\d{2}\.\d{4})/);
  const isoMatch = str.match(/(\d{4}-\d{2}-\d{2})/);
  if (ruMatch && ruMatch[1] === ru) return true;
  if (isoMatch && isoMatch[1] === isoDate) return true;
  return false;
}

export const HomePage: React.FC = () => {
  // Appointments state
  const [loading, setLoading] = React.useState(true);
  const [all, setAll] = React.useState<Appointment[]>([]);

  // UI state
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  // Filters
  // Дата по умолчанию — сегодня (yyyy-MM-dd), чтобы сразу грузить серверно отфильтрованные данные
  const [date, setDate] = React.useState<string>("");
  const [status, setStatus] = React.useState<Record<string, boolean>>({
    Оплачено: true,
    Ожидаем: true,
    "Со скидкой": true,
  });
  const [onlyNight, setOnlyNight] = React.useState(false);
  const [doctorId, setDoctorId] = React.useState("");
  // const [revenueMode, setRevenueMode] = React.useState<
  //   'total' | 'cash' | 'cashless'
  // >('total');
  const [paymentType, setPaymentType] = React.useState<
    "any" | "cash" | "cashless"
  >("any");

  // Services state
  const [servicesRowsAll, setServicesRowsAll] = React.useState<
    Array<Record<string, unknown>>
  >([]);

  // Контроллеры и запомненная рабочая таблица для сокращения числа запросов
  const apptsCtrlRef = React.useRef<AbortController | null>(null);

  // Debounce по дате — чтобы ограничить частоту запросов при изменении
  const debouncedDate = useDebouncedValue(date, 300);

  // Fetch appointments (серверная фильтрация по дате, один запрос, отмена предыдущего)
  React.useEffect(() => {
    const prev = apptsCtrlRef.current;
    if (prev) prev.abort();
    const ctrl = new AbortController();
    apptsCtrlRef.current = ctrl;

    (async () => {
      try {
        setLoading(true);

        // Серверная фильтрация убрана — фильтрация по дате выполняется на клиенте

        // Пагинация, чтобы покрыть большие объёмы данных (до 5k строк)
        const dataAll: Appointment[] = await fetchPagedAll(
          APPTS_TABLE,
          10,
          "12.02.2025"
        );

        if (ctrl.signal.aborted) return;
        setAll(dataAll);
        setServicesRowsAll((dataAll ?? []) as Array<Record<string, unknown>>);
      } catch (e: unknown) {
        if (isAbortError(e)) return;
        console.error(e);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => {
      if (apptsCtrlRef.current === ctrl) apptsCtrlRef.current.abort();
    };
  }, []);

  // Derived
  const ruDateFromInput = React.useMemo(() => {
    if (!date) return "";
    const [yyyy, mm, dd] = date.split("-");
    return `${dd}.${mm}.${yyyy}`;
  }, [date]);

  const filtered = React.useMemo(() => {
    return all.filter((a) => {
      if (
        date &&
        !rowMatchesDate(a as unknown as Record<string, unknown>, date)
      )
        return false;
      if (status[a.Статус] === false) return false;
      if (onlyNight && !(a.Ночь === true || a.Ночь === "true")) return false;
      if (paymentType === "cash" && !(Number(a["Наличные"] ?? 0) > 0))
        return false;
      if (paymentType === "cashless" && !(Number(a["Безналичные"] ?? 0) > 0))
        return false;
      if (doctorId && !String(a["Доктор ФИО"]).includes(doctorId)) return false;
      return true;
    });
  }, [all, ruDateFromInput, status, onlyNight, paymentType, doctorId]);

  // React.useEffect(() => {
  //   (async () => {
  //     const { data } = await fetchPagedAll(APPTS_TABLE, 10, ruDateFromInput);
  //     console.log(data);
  //   })();
  // }, [ruDateFromInput]);

  // const appointmentsCount = React.useMemo(() => filtered.length, [filtered]);
  // const paidCount = React.useMemo(
  //   () => filtered.filter((a) => a.Статус === 'Оплачено').length,
  //   [filtered]
  // );
  // const waitingCount = React.useMemo(
  //   () => filtered.filter((a) => a.Статус === 'Ожидаем').length,
  //   [filtered]
  // );
  // const revenueSum = React.useMemo(
  //   () =>
  //     revenueMode === 'cash'
  //       ? filtered.reduce((acc, a) => acc + Number(a['Наличные'] ?? 0), 0)
  //       : revenueMode === 'cashless'
  //       ? filtered.reduce((acc, a) => acc + Number(a['Безналичные'] ?? 0), 0)
  //       : filtered.reduce(
  //           (acc, a) => acc + Number(a['Итого, сом'] ?? a['Стоимость'] ?? 0),
  //           0
  //         ),
  //   [filtered, revenueMode]
  // );

  // Services derived on client: фильтрация по дате + агрегация без дополнительных сетевых запросов
  const servicesFiltered = React.useMemo(() => {
    const rows = debouncedDate
      ? servicesRowsAll.filter((r) => rowMatchesDate(r, debouncedDate))
      : servicesRowsAll;

    type ServiceObj = {
      ID: string;
      "Название услуги": string;
      Категория: string;
      "Стоимость, сом": number;
    };

    const map = new Map<string, ServiceObj>();
    for (const r of rows) {
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
        get("Название услуги") ?? get("Услуга") ?? get("service_name") ?? sid
      );

      const category = String(
        get("Категория") ??
          get("category") ??
          get("Сотрудник ID") ??
          get("Доктор ФИО") ??
          get("Доктор") ??
          ""
      );

      const priceVal = (get("Стоимость, сом") ??
        get("Стоимость") ??
        get("Итого, сом") ??
        get("price") ??
        get("amount") ??
        get("cost")) as number | string | null | undefined;
      const price = Number(priceVal ?? 0);

      const prevSvc = map.get(sid);
      if (!prevSvc) {
        map.set(sid, {
          ID: sid,
          "Название услуги": name,
          Категория: category,
          "Стоимость, сом": price,
        });
      } else {
        if (!prevSvc["Название услуги"] && name)
          prevSvc["Название услуги"] = name;
        if (!prevSvc["Категория"] && category) prevSvc["Категория"] = category;
        if (!prevSvc["Стоимость, сом"] && price)
          prevSvc["Стоимость, сом"] = price;
      }
    }
    return Array.from(map.values()) as Array<Record<string, unknown>>;
  }, [servicesRowsAll, debouncedDate]);

  const resetFilters = () => {
    const today = new Date();
    const [dd, mm, yyyy] = formatRuDate(today).split(".");
    setDate(`${yyyy}-${mm}-${dd}`);
    setStatus({ Оплачено: true, Ожидаем: true, "Со скидкой": true });
    setOnlyNight(false);
    setDoctorId("");
  };

  return (
    <Box>
      <SubHeader title="Главная" />

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ px: 2, pt: 2, pb: 0 }}>
        <Grid item xs={12} md={4}>
            <Button
              variant="contained"
              fullWidth
              sx={{
                width: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}
            >
              + Добавить прием
            </Button>
          <Card
            variant="outlined"
            sx={{
              borderColor: "transparent",
              color: "primary.contrastText",
              background: (theme) =>
                `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.main})`,
            }}
          >
            {/* <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CalendarMonthOutlined />
              <Box>
                <Typography variant='overline' sx={{ opacity: 0.9 }}>
                  Приемов сегодня
                </Typography>
                <Typography variant='h4'>{appointmentsCount}</Typography>
                <Typography variant='caption' sx={{ opacity: 0.9 }}>
                  {ruDateFromInput || '—'}
                </Typography>
              </Box>
            </CardContent> */}
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
            {/* <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PaidOutlined />
              <Box>
                <Typography variant='overline' sx={{ opacity: 0.9 }}>
                  Доход
                </Typography>
                <Typography variant='h4'>{formatKGS(revenueSum)}</Typography>
                <Stack
                  direction='row'
                  alignItems='center'
                  spacing={1}
                  sx={{ mt: 1 }}
                >
                  <ToggleButtonGroup
                    style={{ flexWrap: 'nowrap' }}
                    size='small'
                    value={revenueMode}
                    exclusive
                    onChange={(_, val) => {
                      if (val) setRevenueMode(val);
                    }}
                    sx={{
                      '& .MuiToggleButton-root': {
                        color: '#fff',
                        borderColor: 'rgba(255,255,255,0.5)',
                      },
                      '& .MuiToggleButton-root.Mui-selected': {
                        color: '#fff',
                        backgroundColor: 'rgba(255,255,255,0.16)',
                        borderColor: 'rgba(255,255,255,0.9)',
                      },
                      '& .MuiToggleButton-root:hover': {
                        borderColor: 'rgba(255,255,255,0.9)',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                      },
                    }}
                  >
                    <ToggleButton value='total'>Итого</ToggleButton>
                    <ToggleButton value='cash'>Наличные</ToggleButton>
                    <ToggleButton value='cashless'>Безналичные</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
              </Box>
            </CardContent> */}
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
            {/* <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box>
                <Typography variant='overline' sx={{ opacity: 0.9 }}>
                  Статусы
                </Typography>
                <Stack direction='row' gap={1} alignItems='center'>
                  <CheckCircleOutlineOutlined fontSize='small' />
                  <Typography variant='h6'>{paidCount}</Typography>
                  <Typography variant='body2' sx={{ opacity: 0.9 }}>
                    оплачено
                  </Typography>
                </Stack>
                <Stack direction='row' gap={1} alignItems='center'>
                  <HourglassEmptyOutlined fontSize='small' />
                  <Typography variant='h6'>{waitingCount}</Typography>
                  <Typography variant='body2' sx={{ opacity: 0.9 }}>
                    ожидаем
                  </Typography>
                </Stack>
              </Box>
            </CardContent> */}
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
            errorMsg={null}
            items={filtered}
            onOpenFilters={() => setFiltersOpen(true)}
          />
        </Grid>

        {/* Column 2: Services */}
        <Grid item xs={12} md={4}>
          <ServicesList
            loading={loading}
            errorMsg={null}
            items={servicesFiltered}
          />
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
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1,
          }}
        >
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
                  onChange={(e) =>
                    setStatus((pr) => ({ ...pr, [s]: e.target.checked }))
                  }
                />
              }
              label={s}
            />
          ))}

          <FormControlLabel
            control={
              <Checkbox
                checked={onlyNight}
                onChange={(e) => setOnlyNight(e.target.checked)}
              />
            }
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
