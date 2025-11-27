import React from "react";
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Button,
  Divider,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import { supabase } from "../../utility/supabaseClient";
import AddIcon from "@mui/icons-material/Add";
import AddServiceDrawer from "../../components/services/AddServiceDrawer";


const importMetaEnv = ((import.meta as unknown) as { env?: Record<string, string | undefined> }).env || {};
const SERVICES_TABLE: string = importMetaEnv.VITE_SERVICES_TABLE || "FullAppointmentsView";

// Helpers copied/adapted from homepage to unify date handling
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


function rowMatchesDate(row: Record<string, unknown>, isoDate: string): boolean {
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

  const str = String((row as Record<string, unknown>)["Дата и время"] ?? "");
  const ruMatch = str.match(/(\d{2}\.\d{2}\.\d{4})/);
  const isoMatch = str.match(/(\d{4}-\d{2}-\d{2})/);
  if (ruMatch && ruMatch[1] === ru) return true;
  if (isoMatch && isoMatch[1] === isoDate) return true;
  return false;
}

// Paged fetch helper (to support large data sets)
async function fetchPagedAll(table: string, ctrl: AbortController, pageSize = 1000, maxPages = 5) {
  const acc: Array<Record<string, unknown>> = [];
  for (let p = 0; p < maxPages; p++) {
    const from = p * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .schema("public")
      .from(table)
      .select("*")
      .range(from, to)
      .abortSignal(ctrl.signal);
    if (error) break;
    const chunk = (data ?? []) as Array<Record<string, unknown>>;
    acc.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return acc;
}

type ServiceObj = {
  ID: string;
  "Название услуги": string;
  "Категория": string;
  "Стоимость, сом": number;
};

const ServicesPage: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [rowsAll, setRowsAll] = React.useState<Array<Record<string, unknown>>>([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [added, setAdded] = React.useState<ServiceObj[]>([]);

  // дата фильтра (yyyy-MM-dd), автоподстановка последней доступной даты
  const [date, setDate] = React.useState<string>("");
  const debouncedDate = date;
  const loadedRef = React.useRef(false);

  const ctrlRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const prev = ctrlRef.current;
    if (prev) prev.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // грузим весь список (с пагинацией до 5k записей)
        const rowsAll = await fetchPagedAll(SERVICES_TABLE, ctrl, 1000, 5);


        // сохраняем сырой массив единожды (без авто-изменения выбранной даты)
        if (!ctrl.signal.aborted) {
          setRowsAll(rowsAll);
        }
      } catch (e: unknown) {
        if (!ctrl.signal.aborted) {
          console.error(e);
          const msg = e instanceof Error ? e.message : "Ошибка загрузки";
          setErrorMsg(msg);
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => {
      if (ctrlRef.current === ctrl) ctrlRef.current.abort();
    };
  }, []);


  const ruDateFromInput = React.useMemo(() => {
    if (!date) return "";
    const [yyyy, mm, dd] = date.split("-");
    return `${dd}.${mm}.${yyyy}`;
  }, [date]);

  // Услуги считаются на клиенте из rowsAll (без повторных сетевых запросов)
  const services = React.useMemo(() => {
    const filteredRows = debouncedDate
      ? rowsAll.filter((r) => rowMatchesDate(r as Record<string, unknown>, debouncedDate))
      : rowsAll;

    const map = new Map<string, ServiceObj>();
    for (const r of filteredRows) {
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

      const priceVal =
        (get("Стоимость, сом") ??
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
          "Категория": category,
          "Стоимость, сом": price,
        });
      } else {
        if (!prevSvc["Название услуги"] && name) prevSvc["Название услуги"] = name;
        if (!prevSvc["Категория"] && category) prevSvc["Категория"] = category;
        if (!prevSvc["Стоимость, сом"] && price) prevSvc["Стоимость, сом"] = price;
      }
    }

    return Array.from(map.values());
  }, [rowsAll, debouncedDate]);

  const mergedServices = React.useMemo(() => {
    const map = new Map<string, ServiceObj>();
    for (const s of services) map.set(s.ID, s);
    for (const s of added) map.set(s.ID, s);
    return Array.from(map.values());
  }, [services, added]);

  return (
    <Box sx={{ p: 2 }}>
      <Card variant="outlined">
        <CardHeader
          title="Услуги"
          subheader={ruDateFromInput ? `Дата: ${ruDateFromInput}` : "Все даты"}
          action={
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => setAddOpen(true)}>
              Добавить
            </Button>
          }
        />
        <Divider />
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <TextField
              label="Дата"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <Box sx={{ flex: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Найдено: {mergedServices.length}
            </Typography>
          </Stack>

          {loading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : errorMsg ? (
            <Typography color="error">{errorMsg}</Typography>
          ) : mergedServices.length === 0 ? (
            <Typography color="text.secondary">Нет данных.</Typography>
          ) : (
            <List dense>
              {mergedServices.map((s) => (
                <ListItem key={s.ID} disablePadding sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={s["Название услуги"] || "—"}
                    secondary={
                      <>
                        {s["Категория"] ? `Категория: ${s["Категория"]}` : "Категория: —"}
                        {` • `}
                        {`Стоимость: ${Number.isFinite(s["Стоимость, сом"]) ? s["Стоимость, сом"] : 0}`}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
      <AddServiceDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(rec) => {
          setAdded((prev) => {
            const item: ServiceObj = {
              ID: String(rec.id ?? Date.now()),
              "Название услуги": rec.name,
              "Категория": rec.employee_name ?? "",
              "Стоимость, сом": Number(rec.price ?? 0),
            };
            return [item, ...prev];
          });
        }}
      />
    </Box>
  );
};

export default ServicesPage;
