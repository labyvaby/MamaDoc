import React from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
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
import FilterListOutlined from "@mui/icons-material/FilterListOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import Grid from "@mui/material/Grid";
import { SubHeader } from "../../components";

// Helper to format today like 15.11.2025
const formatRuDate = (d: Date) =>
  d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

// Load JSON with Vite-friendly URL
const appointmentsUrl = new URL("../../mock/appointments.json", import.meta.url).toString();

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
};

export const HomePage: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [all, setAll] = React.useState<Appointment[]>([]);
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

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch(appointmentsUrl);
        const json: Appointment[] = await res.json();
        setAll(json);
        // Pick the latest available date from the dataset as default
        const latestRu = json
          .map((a) => a["Дата n8n"]) // dd.MM.yyyy
          .filter(Boolean)
          .sort((a, b) => {
            const [da, ma, ya] = a.split(".").map(Number);
            const [db, mb, yb] = b.split(".").map(Number);
            return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
          })[0];
        if (latestRu) {
          const [dd, mm, yyyy] = latestRu.split(".");
          setDate(`${yyyy}-${mm}-${dd}`);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const ruDateFromInput = React.useMemo(() => {
    if (!date) return "";
    const [yyyy, mm, dd] = date.split("-");
    return `${dd}.${mm}.${yyyy}`;
  }, [date]);

  const filtered = React.useMemo(() => {
    return all.filter((a) => {
      // Date filter: equals selected date
      if (ruDateFromInput && a["Дата n8n"] !== ruDateFromInput) return false;

      // Status filter
      if (!status[a.Статус]) return false;

      // Night filter
      if (onlyNight && !(a.Ночь === true || a.Ночь === "true")) return false;

      // Doctor filter contains
      if (doctorId && !String(a["Доктор ID"]).includes(doctorId)) return false;

      return true;
    });
  }, [all, ruDateFromInput, status, onlyNight, doctorId]);

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

      <Grid container spacing={2} sx={{ p: 2 }}>
        {/* Column 1: Appointments */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardHeader
              title={
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography variant="subtitle1">Приемы сегодня ({ruDateFromInput})</Typography>
                  <Chip size="small" label={filtered.length} />
                </Stack>
              }
              action={
                <IconButton onClick={() => setFiltersOpen(true)} aria-label="Фильтры">
                  <FilterListOutlined />
                </IconButton>
              }
            />
            <Divider />
            <CardContent sx={{ p: 0 }}>
              {loading ? (
                <Typography sx={{ p: 2 }} variant="body2">Загрузка…</Typography>
              ) : filtered.length === 0 ? (
                <Typography sx={{ p: 2 }} variant="body2">Нет записей</Typography>
              ) : (
                <Stack divider={<Divider flexItem />}>
                  {filtered.map((a) => (
                    <Box key={a.ID} sx={{ px: 2, py: 1.25 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                        <Stack>
                          <Typography variant="subtitle2">{a["Дата и время"]}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Пациент: {a["Пациент ID"]} · Доктор: {a["Доктор ID"]}
                          </Typography>
                        </Stack>
                        <Stack alignItems="flex-end">
                          <Chip label={a.Статус} size="small" color={
                            a.Статус === "Оплачено" ? "success" : a.Статус === "Ожидаем" ? "warning" : "default"
                          } variant={a.Статус === "Со скидкой" ? "outlined" : "filled"} />
                          <Typography variant="body2" color="text.secondary">
                            {a["Итого, сом"] ?? a["Стоимость"]} сом
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Placeholder columns 2 and 3 for later */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardHeader title="Процедуры в этом месяце" />
            <Divider />
            <CardContent>
              <Typography variant="body2" color="text.secondary">Скоро…</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardHeader title="Продажи" />
            <Divider />
            <CardContent>
              <Typography variant="body2" color="text.secondary">Скоро…</Typography>
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
              control={<Checkbox checked={status[s]} onChange={(e) => setStatus((pr) => ({ ...pr, [s]: e.target.checked }))} />}
              label={s}
            />
          ))}

          <FormControlLabel
            control={<Checkbox checked={onlyNight} onChange={(e) => setOnlyNight(e.target.checked)} />}
            label="Только ночные"
          />

          <TextField
            label="Доктор ID"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            fullWidth
          />

          <Stack direction="row" gap={1}>
            <Button variant="contained" onClick={() => setFiltersOpen(false)}>Применить</Button>
            <Button variant="text" onClick={resetFilters}>Сбросить</Button>
          </Stack>
        </Stack>
      </Drawer>
    </Box>
  );
};

export default HomePage;
