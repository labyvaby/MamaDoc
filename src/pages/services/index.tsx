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
  IconButton,
  Tooltip,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import { supabase } from "../../utility/supabaseClient";
import AddServiceDrawer from "../../components/services/AddServiceDrawer";
import EditServiceDrawer from "../../components/services/EditServiceDrawer";

const importMetaEnv =
  ((import.meta as unknown) as { env?: Record<string, string | undefined> })
    .env || {};
const SERVICES_TABLE: string =
  importMetaEnv.VITE_SERVICES_TABLE || "FullAppointmentsView";
const SERVICES_WRITE: string =
  importMetaEnv.VITE_SERVICES_WRITE_TABLE || "Services";

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

/** Single-range fetch helper (one request only) */
async function fetchRange(
  table: string,
  ctrl: AbortController | null,
  from: number,
  to: number
) {
  const base = supabase.schema("public").from(table).select("*").range(from, to);
  const { data, error } = ctrl ? await base.abortSignal(ctrl.signal) : await base;
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

type ServiceRow = {
  // Grid row identity
  id: string;
  // Display fields
  name: string;
  category: string;
  price: number;
  // Optional write-table linkage and employee data (only for items created in this UI)
  writeId?: string | number | null;
  employee_id?: string | null;
  employee_name?: string | null;
  photo_url?: string | null;
};

const ServicesPage: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [rowsAll, setRowsAll] = React.useState<Array<Record<string, unknown>>>(
    []
  );

  // Drawer states
  const [addOpen, setAddOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);

  // Locally added/edited rows (originating from write-table)
  const [added, setAdded] = React.useState<ServiceRow[]>([]);
  const [writeServices, setWriteServices] = React.useState<ServiceRow[]>([]);
  // Paged loading control for SERVICES_TABLE (avoid multiple parallel large requests)
  const PAGE_SIZE = 200;
  const [pageIndex, setPageIndex] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);

  // Date filter (yyyy-MM-dd)
  const [date, setDate] = React.useState<string>("");
  const debouncedDate = date;
  const loadedRef = React.useRef(false);

  // Extra filters
  const [filterName, setFilterName] = React.useState("");
  const [filterCategory, setFilterCategory] = React.useState("");
  const [minPrice, setMinPrice] = React.useState<string>("");
  const [maxPrice, setMaxPrice] = React.useState<string>("");
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmRow, setConfirmRow] = React.useState<ServiceRow | null>(null);

  // Record for editing (only for rows with writeId)
  const [editingRec, setEditingRec] = React.useState<{
    id: string | number;
    name: string;
    price: number;
    employee_id: string | null;
    employee_name?: string | null;
    photo_url?: string | null;
  } | null>(null);

  const FiltersContent = (
    <Stack spacing={2}>
      <TextField
        label="Дата"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        InputLabelProps={{ shrink: true }}
        size="small"
      />
      <TextField
        label="Фильтр по названию"
        value={filterName}
        onChange={(e) => setFilterName(e.target.value)}
        size="small"
      />
      <TextField
        label="Фильтр по категории"
        value={filterCategory}
        onChange={(e) => setFilterCategory(e.target.value)}
        size="small"
      />
      <TextField
        label="Мин. цена"
        value={minPrice}
        onChange={(e) => setMinPrice(e.target.value.replace(/[^\d]/g, ""))}
        size="small"
        inputMode="numeric"
      />
      <TextField
        label="Макс. цена"
        value={maxPrice}
        onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d]/g, ""))}
        size="small"
        inputMode="numeric"
      />
    </Stack>
  );

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

        // Load FIRST page only for aggregated view (avoid multi-offset flood)
        const first = await fetchRange(SERVICES_TABLE, ctrl, 0, PAGE_SIZE - 1);
        // Load first page from write table (usually small)
        const writeFirst = await fetchRange(SERVICES_WRITE, ctrl, 0, 499);

        if (!ctrl.signal.aborted) {
          setRowsAll(first);
          setPageIndex(0);
          setHasMore(first.length === PAGE_SIZE);
          const wr: ServiceRow[] = (writeFirst ?? [])
            .map((r) => {
              const get = (k: string) => (r as Record<string, unknown>)[k];
              const wid = (get("id") ?? get("ID")) as
                | string
                | number
                | null
                | undefined;
              const sid = String(wid ?? "");
              if (!sid) return null;

              const name = String(
                get("service_name") ?? get("Название услуги") ?? ""
              );
              const employee_name =
                (get("employee_name") as string | null) ?? null;
              const employee_id =
                (get("employee_id") as string | null) ??
                (get("Сотрудник ID") as string | null) ??
                null;
              const category = employee_name ?? "";
              const priceVal =
                (get("price") ??
                  get("price_som") ??
                  get("Стоимость, сом")) as
                  | number
                  | string
                  | null
                  | undefined;
              const price = Number(priceVal ?? 0);
              const photo_url =
                (get("photo_url") as string | null) ??
                (get("Картинка") as string | null) ??
                null;

              return {
                id: sid,
                name: name,
                category,
                price,
                writeId: wid ?? null,
                employee_id,
                employee_name,
                photo_url,
              } as ServiceRow;
            })
            .filter(Boolean) as ServiceRow[];
          setWriteServices(wr);
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

  // Load next page on demand (triggered by user)
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = pageIndex + 1;
      const from = next * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const chunk = await fetchRange(SERVICES_TABLE, null, from, to);
      setRowsAll((prev) => [...prev, ...chunk]);
      setPageIndex(next);
      setHasMore(chunk.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  };

  // Build services from rowsAll (date filtered) into map of id -> ServiceRow
  const services = React.useMemo(() => {
    const filteredRows = debouncedDate
      ? rowsAll.filter((r) =>
          rowMatchesDate(r as Record<string, unknown>, debouncedDate)
        )
      : rowsAll;

    const map = new Map<string, ServiceRow>();
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
        get("Название услуги") ?? get("Услуга") ?? get("service_name") ?? ""
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

      const photo =
        (get("photo_url") as string | null) ??
        (get("Картинка") as string | null) ??
        null;

      const prev = map.get(sid);
      if (!prev) {
        map.set(sid, {
          id: sid,
          name,
          category,
          price,
          writeId: null,
          photo_url: photo,
        });
      } else {
        if (!prev.name && name) prev.name = name;
        if (!prev.category && category) prev.category = category;
        if (!prev.price && price) prev.price = price;
        if (!prev.photo_url && photo) (prev as ServiceRow).photo_url = photo;
      }
    }

    return Array.from(map.values());
  }, [rowsAll, debouncedDate]);

  // Merge server-derived services with locally added/edited (by write id)
  const mergedServices = React.useMemo(() => {
    const map = new Map<string, ServiceRow>();
    for (const s of services) map.set(s.id, s);
    for (const s of writeServices) map.set(s.id, s);
    for (const s of added) map.set(s.id, s);
    return Array.from(map.values());
  }, [services, writeServices, added]);

  // Apply UI filters on merged list
  const filteredServices = React.useMemo(() => {
    const min = minPrice ? Number(minPrice) : -Infinity;
    const max = maxPrice ? Number(maxPrice) : Infinity;

    return mergedServices.filter((s) => {
      const nameOk = filterName
        ? s.name.toLowerCase().includes(filterName.toLowerCase())
        : true;
      const catOk = filterCategory
        ? s.category.toLowerCase().includes(filterCategory.toLowerCase())
        : true;
      const priceOk =
        Number.isFinite(s.price) &&
        s.price >= (Number.isFinite(min) ? min : -Infinity) &&
        s.price <= (Number.isFinite(max) ? max : Infinity);

      return nameOk && catOk && priceOk;
    });
  }, [mergedServices, filterName, filterCategory, minPrice, maxPrice]);

  const handleEdit = (row: ServiceRow) => {
    if (row.writeId === null || typeof row.writeId === "undefined") {
      alert("Эту запись нельзя редактировать (нет ID в таблице изменений).");
      return;
    }
    setEditingRec({
      id: row.writeId,
      name: row.name,
      price: Number(row.price || 0),
      employee_id: row.employee_id ?? null,
      employee_name: (row.employee_name ?? row.category) ?? null,
      photo_url: row.photo_url ?? null,
    });
    setEditOpen(true);
  };

  const handleDelete = async (row: ServiceRow) => {
    if (row.writeId === null || typeof row.writeId === "undefined") {
      alert("Эту запись нельзя удалить (нет ID в таблице изменений).");
      return;
    }
    try {
      const idVal =
        typeof row.writeId === "number" || typeof row.writeId === "string"
          ? row.writeId
          : String(row.writeId ?? "");
      const { error } = await supabase
        .from(SERVICES_WRITE)
        .delete()
        .eq("ID", idVal);
      if (error) throw error;

      // Удаляем из локальных списков
      setWriteServices((prev) => prev.filter((x) => x.writeId !== row.writeId));
      setAdded((prev) => prev.filter((x) => x.writeId !== row.writeId));
    } catch (e) {
      console.error("Delete service failed:", e);
      alert("Не удалось удалить услугу. Проверьте права RLS.");
    }
  };

  const columns = React.useMemo<GridColDef<ServiceRow>[]>(
    () => [
      {
        field: "photo_url",
        headerName: "Картинка",
        width: 120,
        sortable: false,
        filterable: false,
        renderCell: (params: GridRenderCellParams<ServiceRow, string>) => {
          const src = params.row.photo_url;
          return src ? (
            <Box
              component="img"
              src={src}
              alt=""
              sx={{ width: 100, height: 100, objectFit: "cover", borderRadius: 1 }}
            />
          ) : (
            <Box sx={{ width: 100, height: 100, bgcolor: "action.hover", borderRadius: 1 }} />
          );
        },
      },
      { field: "name", headerName: "Название услуги", flex: 1, minWidth: 180 },
      {
        field: "category",
        headerName: "Категория",
        flex: 1,
        minWidth: 140,
        renderCell: (params: GridRenderCellParams<ServiceRow, string>) =>
          params.row.category || "—",
      },
      {
        field: "price",
        headerName: "Стоимость, сом",
        type: "number",
        minWidth: 130,
        renderCell: (p: GridRenderCellParams<ServiceRow, number>) =>
          Number.isFinite(Number(p.value)) ? String(p.value ?? 0) : "0",
      },
      {
        field: "actions",
        headerName: "Действия",
        minWidth: 140,
        sortable: false,
        filterable: false,
        renderCell: (params: GridRenderCellParams<ServiceRow>) => {
          const canEdit = params.row.writeId !== null && typeof params.row.writeId !== "undefined";
          return (
            <Stack direction="row" spacing={1}>
              <Tooltip title={canEdit ? "Редактировать" : "Нельзя редактировать"}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => handleEdit(params.row)}
                    disabled={!canEdit}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={canEdit ? "Удалить" : "Нельзя удалить"}>
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => {
                      setConfirmRow(params.row);
                      setConfirmOpen(true);
                    }}
                    disabled={!canEdit}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
    ],
    []
  );

  return (
    <Box sx={{ p: 0, width: 1, display: "flex", gap: 0, alignItems: "flex-start" }}>
      <Drawer
        anchor="right"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        PaperProps={{ sx: { width: "100vw", maxWidth: "100vw" } }}
      >
        <Box sx={{ p: 2 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1 }}
          >
            <Typography variant="h6">Фильтры</Typography>
            <Button onClick={() => setFiltersOpen(false)}>Закрыть</Button>
          </Stack>
          {FiltersContent}
        </Box>
      </Drawer>

      <Card variant="outlined" sx={{ flex: 1, width: 1 }}>
        <CardHeader
          title="Услуги"
          subheader={ruDateFromInput ? `Дата: ${ruDateFromInput}` : "Все даты"}
          action={
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                onClick={() => setFiltersOpen(true)}
              >
                Фильтры
              </Button>
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                onClick={() => setAddOpen(true)}
              >
                Добавить
              </Button>
            </Stack>
          }
        />
        <Divider />
        <CardContent>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Найдено: {filteredServices.length}
            </Typography>
          </Stack>

          {loading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : errorMsg ? (
            <Typography color="error">{errorMsg}</Typography>
          ) : (
              <div style={{ width: "100%" }}>
                <DataGrid
                  autoHeight
                  density="compact"
                  rows={filteredServices}
                  columns={columns}
                  getRowId={(r) => r.id}
                  pageSizeOptions={[10, 25, 50, 100]}
                  initialState={{
                    pagination: { paginationModel: { pageSize: 10 } },
                  }}
                />
                <Stack alignItems="center" sx={{ mt: 1 }}>
                  {hasMore && (
                    <Button
                      variant="outlined"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? "Загрузка…" : "Загрузить ещё"}
                    </Button>
                  )}
                </Stack>
              </div>
          )}
        </CardContent>
      </Card>

      <AddServiceDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(rec) => {
          const item: ServiceRow = {
            id: String(rec.id ?? Date.now()),
            name: rec.name,
            category: rec.employee_name ?? "",
            price: Number(rec.price ?? 0),
            writeId: rec.id ?? null,
            employee_id: rec.employee_id ?? null,
            employee_name: rec.employee_name ?? null,
            photo_url: rec.photo_url ?? null,
          };
          setAdded((prev) => [item, ...prev]);
          setWriteServices((prev) => [item, ...prev]);
        }}
      />

      {editingRec && (
        <EditServiceDrawer
          open={editOpen}
          onClose={() => {
            setEditOpen(false);
            setEditingRec(null);
          }}
          record={editingRec}
          onUpdated={(rec) => {
            const mapUpdate = (x: ServiceRow) =>
              x.writeId === rec.id
                ? {
                    ...x,
                    name: rec.name,
                    category: rec.employee_name ?? "",
                    price: Number(rec.price ?? 0),
                    employee_id: rec.employee_id ?? null,
                    employee_name: rec.employee_name ?? null,
                    photo_url: rec.photo_url ?? null,
                  }
                : x;

            setAdded((prev) => prev.map(mapUpdate));
            setWriteServices((prev) => prev.map(mapUpdate));
          }}
        />
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Удалить услугу</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить услугу "{confirmRow?.name}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Отмена</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (confirmRow) {
                (async () => {
                  await handleDelete(confirmRow);
                  setConfirmOpen(false);
                  setConfirmRow(null);
                })();
              } else {
                setConfirmOpen(false);
              }
            }}
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ServicesPage;
