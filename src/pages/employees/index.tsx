import React from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  IconButton,
  Button,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  InputAdornment,
} from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { supabase } from "../../utility/supabaseClient";

/**
 * EMPLOYEES CRUD PAGE
 * - Список сотрудников с поиском
 * - Drawer: Добавить / Редактировать
 * - Dialog: Удаление
 * - Drawer: Детали сотрудника
 *
 * Таблица: по умолчанию "employees". Можно переопределить через VITE_EMPLOYEES_TABLE
 */

const importMetaEnv = ((import.meta as unknown) as { env?: Record<string, string | undefined> }).env || {};
// Read source (view) and write (base table) can be different:
// - VITE_EMPLOYEES_SOURCE or VITE_EMPLOYEES_TABLE for reading (fallback to EmployeesView)
// - VITE_EMPLOYEES_WRITE_TABLE for writes (fallback to 'employees')
const EMPLOYEES_SOURCE: string = importMetaEnv.VITE_EMPLOYEES_SOURCE || importMetaEnv.VITE_EMPLOYEES_TABLE || "EmployeesView";
const EMPLOYEES_WRITE: string = importMetaEnv.VITE_EMPLOYEES_WRITE_TABLE || "employees";

type EmployeeRow = {
  id: string;
  full_name: string;
  phone?: string | null;
  role?: string | null; // "doctor" | "admin" | string
  [key: string]: unknown;
};

// Helpers
function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function isAbortError(e: unknown): boolean {
  if (!e) return false;
  if (typeof e === "object" && e !== null) {
    const any = e as { name?: string; code?: unknown; message?: unknown };
    if (any.name === "AbortError") return true;
    if (String(any.code).toLowerCase().includes("abort")) return true;
    if (String(any.message).toLowerCase().includes("abort")) return true;
  } else if (typeof e === "string" && e.toLowerCase().includes("abort")) {
    return true;
  }
  return false;
}

function getIdFrom(o: Record<string, unknown>): string {
  // Common id fields across various views
  const idKeys = [
    "id", "ID",
    "employee_id", "Employee_ID", "Employee ID",
    "doctor_id", "Doctor_ID", "Doctor ID",
    "staff_id", "Staff_ID", "Staff ID",
    "Сотрудник ID", "Доктор ID",
  ];
  for (const k of idKeys) {
    const v = o[k as keyof typeof o];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
    if (typeof v === "number") return String(v);
  }
  // Fallbacks
  const anyIdKey = Object.keys(o).find((k) => /^id$/i.test(k));
  const anyId = anyIdKey ? o[anyIdKey as keyof typeof o] : undefined;
  if (typeof anyId === "string" && anyId.trim().length > 0) return anyId.trim();
  if (typeof anyId === "number") return String(anyId);
  // Use name as last-resort stable key
  const nm = getNameFrom(o);
  if (nm) return nm;
  return "";
}

function getNameFrom(o: Record<string, unknown>): string {
  const directKeys = [
    "full_name", "fullName", "name", "fio", "ФИО сотрудников", "ФИО",
    "doctor_name", "employee_name", "Сотрудник", "Доктор ФИО", "Доктор",
  ];
  const vals: string[] = [];

  for (const k of directKeys) {
    const v = o[k as keyof typeof o];
    if (typeof v === "string" && v.trim().length > 0) vals.push(v.trim());
  }
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === "string" && /(name|fio|фио|сотрудник|доктор)/i.test(k) && v.trim().length > 0) {
      vals.push(v.trim());
    }
  }
  const fa = o["first_name"];
  const fb = o["last_name"];
  const combined = `${typeof fa === "string" ? fa.trim() : ""}${
    (typeof fa === "string" && fa && typeof fb === "string" && fb) ? " " : ""
  }${typeof fb === "string" ? fb.trim() : ""}`.trim();

  const candidate = vals.concat(combined).find((s) => s.length > 0);
  return candidate ?? "";
}

function getPhoneFrom(o: Record<string, unknown>): string | null {
  const keys = ["phone", "phone_number", "mobile", "Телефон", "номер", "Номер"];
  for (const k of keys) {
    const v = o[k as keyof typeof o];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === "string" && /(phone|телефон|mobile)/i.test(k) && v.trim().length > 0) {
      return v.trim();
    }
  }
  return null;
}

function getRoleFrom(o: Record<string, unknown>): string | null {
  const keys = ["role", "Роль", "position", "должность", "type"];
  for (const k of keys) {
    const v = o[k as keyof typeof o];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  // boolean hints
  if (o["is_doctor"] === true || o["isDoctor"] === true) return "doctor";
  if (o["is_admin"] === true || o["isAdmin"] === true) return "admin";
  return null;
}

/**
 * Телефон (KG): фиксированный международный префикс +996 и 9 локальных цифр.
 */
const PHONE_CC = "+996";
const LOCAL_LEN = 9;

function sanitizeKGLocal(input: string): string {
  // Оставляем только цифры, режем до 9 символов
  return input.replace(/\D/g, "").slice(0, LOCAL_LEN);
}
function isKGLocalValid(local: string): boolean {
  return local.length === LOCAL_LEN;
}
function composeKGPhone(local: string): string | null {
  const l = local.trim();
  return l.length ? `${PHONE_CC}${l}` : null;
}
function parseKGLocalFrom(input: string | null | undefined): string {
  if (!input) return "";
  const digits = String(input).replace(/\D/g, "");
  // Если начинается с 996 — берём оставшиеся 9 цифр как локальную часть
  if (digits.startsWith("996")) {
    return digits.slice(3, 3 + LOCAL_LEN).slice(0, LOCAL_LEN);
  }
  // Иначе берём последние 9 цифр как локальную часть
  return digits.slice(-LOCAL_LEN);
}

function mapAnyToEmployee(o: Record<string, unknown>): EmployeeRow | null {
  const id = getIdFrom(o);
  if (!id) return null;
  const full_name = getNameFrom(o) || id;
  const phone = getPhoneFrom(o);
  const role = getRoleFrom(o);
  return { id, full_name, phone, role, ...o };
}

// Deduplicate by 'id' (or by 'full_name' as fallback)
function dedupeEmployees(arr: EmployeeRow[]): EmployeeRow[] {
  const seen = new Set<string>();
  const out: EmployeeRow[] = [];
  for (const e of arr) {
    const key = e.id || e.full_name;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export const EmployeesPage: React.FC = () => {
  const [items, setItems] = React.useState<EmployeeRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");
  const qDebounced = useDebounced(q, 300);

  const [addOpen, setAddOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState<null | EmployeeRow>(null);
  const [detailsOpen, setDetailsOpen] = React.useState<null | EmployeeRow>(null);
  const [deleteOpen, setDeleteOpen] = React.useState<null | EmployeeRow>(null);

  const ctrlRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const prev = ctrlRef.current;
    if (prev) prev.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // Single-request strategy (avoid multiple parallel ilike queries):
        // 1) забираем одну выборку (limit 2000)
        // 2) маппим + дедуп
        // 3) при наличии запроса — фильтруем на клиенте по имени/телефону/роле
        const { data, error } = await supabase
          .from(EMPLOYEES_SOURCE)
          .select("*")
          .limit(2000)
          .abortSignal(ctrl.signal);
        const base = !error && Array.isArray(data) ? (data as unknown[]) : [];
        let mapped: EmployeeRow[] = base
          .map((r) => (typeof r === "object" && r !== null ? mapAnyToEmployee(r as Record<string, unknown>) : null))
          .filter((x): x is EmployeeRow => !!x);
        if (qDebounced.trim()) {
          const ql = qDebounced.toLowerCase();
          mapped = mapped.filter((e) => {
            if ((e.full_name || e.id).toLowerCase().includes(ql)) return true;
            if ((e.phone ?? "").toLowerCase().includes(ql)) return true;
            if ((e.role ?? "").toLowerCase().includes(ql)) return true;
            return false;
          });
        }

        if (ctrl.signal.aborted) return;
        setItems(dedupeEmployees(mapped));
      } catch (e: unknown) {
        if (isAbortError(e)) return;
        console.error(e);
        setErrorMsg("Не удалось загрузить сотрудников");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => {
      if (ctrlRef.current === ctrl) ctrlRef.current.abort();
    };
  }, [qDebounced]);

  const filtered = React.useMemo(() => {
    if (!qDebounced.trim()) return items;
    const ql = qDebounced.toLowerCase();
    return items.filter((e) => {
      if ((e.full_name || e.id).toLowerCase().includes(ql)) return true;
      if ((e.phone ?? "").toLowerCase().includes(ql)) return true;
      if ((e.role ?? "").toLowerCase().includes(ql)) return true;
      return false;
    });
  }, [items, qDebounced]);

  return (
    <Box px={2} py={2}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" spacing={1.5} mb={2}>
        <Typography variant="h5">Сотрудники</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            placeholder="Поиск по имени, телефону, роли"
            value={q}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
          />
          <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setAddOpen(true)}>
            Добавить
          </Button>
        </Stack>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      {loading ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress />
        </Stack>
      ) : errorMsg ? (
        <Typography color="error">{errorMsg}</Typography>
      ) : filtered.length === 0 ? (
        <Typography color="text.secondary">Нет записей</Typography>
      ) : (
        <List sx={{ py: 0 }}>
          {filtered.map((e) => (
            <ListItem key={e.id} disableGutters divider sx={{ alignItems: "flex-start" }} secondaryAction={
              <Stack direction="row" spacing={1}>
                <IconButton aria-label="Подробнее" onClick={() => setDetailsOpen(e)}>
                  <InfoOutlined />
                </IconButton>
                <IconButton aria-label="Редактировать" onClick={() => setEditOpen(e)}>
                  <EditOutlined />
                </IconButton>
                <IconButton aria-label="Удалить" onClick={() => setDeleteOpen(e)}>
                  <DeleteOutline />
                </IconButton>
              </Stack>
            }>
              <ListItemText
                sx={{ minWidth: 0, pr: 1 }}
                primaryTypographyProps={{ sx: { whiteSpace: "normal", wordBreak: "break-word" } }}
                secondaryTypographyProps={{ component: "div" }}
                primary={e.full_name || e.id}
                secondary={
                  <Stack direction="column" spacing={0.5} sx={{ minWidth: 0 }}>
                    <Typography variant="body2" component="div" sx={{ wordBreak: "break-word" }}>
                      {e.role ? (e.role === "doctor" ? "Доктор" : e.role === "admin" ? "Администратор" : e.role) : "—"}
                    </Typography>
                    <Typography variant="body2" component="div" sx={{ wordBreak: "break-word" }}>
                      {e.phone ?? "—"}
                    </Typography>
                  </Stack>
                }
              />
            </ListItem>
          ))}
        </List>
      )}

      {/* Drawers & Dialogs */}
      <AddEmployeeDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(rec) => setItems((pr) => [rec, ...pr])}
      />

      <EditEmployeeDrawer
        record={editOpen}
        onClose={() => setEditOpen(null)}
        onUpdated={(rec) => setItems((pr) => pr.map((x) => (x.id === rec.id ? rec : x)))}
      />

      <EmployeeDetailsDrawer record={detailsOpen} onClose={() => setDetailsOpen(null)} />

      <DeleteEmployeeDialog
        record={deleteOpen}
        onClose={() => setDeleteOpen(null)}
        onDeleted={(id) => setItems((pr) => pr.filter((x) => x.id !== id))}
      />
    </Box>
  );
};

const roleOptions = [
  { value: "doctor", label: "Доктор" },
  { value: "admin", label: "Администратор" },
];

type DrawerBaseProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  busy?: boolean;
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
};

const DrawerBase: React.FC<DrawerBaseProps> = ({ open, title, onClose, children, busy, onSubmit, submitLabel = "Сохранить", submitDisabled }) => {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={busy ? undefined : onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 420, md: "36vw" }, maxWidth: "100vw" } }}
    >
      <Box sx={{ width: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" px={2} py={1.5}>
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={busy ? undefined : onClose}><CloseOutlined /></IconButton>
        </Stack>
        <Divider />
        <Box px={2} py={2}>
          {children}
        </Box>
        <Divider />
        <Box px={2} py={1.5} display="flex" justifyContent="flex-end" gap={1.5}>
          <Button onClick={onClose} disabled={busy}>Отмена</Button>
          {onSubmit && (
            <Button onClick={onSubmit} variant="contained" disabled={busy || submitDisabled}>
              {busy ? (
                <Stack direction="row" alignItems="center" spacing={1}><CircularProgress size={18} /><span>Сохранение…</span></Stack>
              ) : submitLabel}
            </Button>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

type AddEmployeeDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (rec: EmployeeRow) => void;
};

const AddEmployeeDrawer: React.FC<AddEmployeeDrawerProps> = ({ open, onClose, onCreated }) => {
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [phoneError, setPhoneError] = React.useState(false);
  const [role, setRole] = React.useState<"doctor" | "admin" | "">("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setFullName("");
      setPhone("");
      setRole("");
      setBusy(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (phone.trim().length > 0 && !isKGLocalValid(phone)) {
      setPhoneError(true);
      return;
    }
    try {
      setBusy(true);
      // Пытаемся вставить универсальные поля; если схема другая — может потребоваться адаптация колонок
      const payload: Record<string, unknown> = {
        full_name: fullName.trim(),
        phone: composeKGPhone(phone),
        role: role || null,
      };
      const { data, error } = await supabase.from(EMPLOYEES_WRITE).insert(payload).select("*").single();
      if (error) throw error;
      const mapped = data && typeof data === "object" ? mapAnyToEmployee(data as Record<string, unknown>) : null;
      if (mapped) onCreated(mapped);
      onClose();
    } catch (e) {
      console.error("Add employee failed:", e);
      alert("Не удалось создать сотрудника. Проверьте схему таблицы или переменную VITE_EMPLOYEES_TABLE.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerBase open={open} title="Новый сотрудник" onClose={onClose} busy={busy} onSubmit={handleSubmit} submitLabel="Создать" submitDisabled={phone.trim().length > 0 && phoneError}>
      <Stack spacing={2}>
        <TextField
          label="ФИО"
          value={fullName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label="Телефон"
          value={phone}
          placeholder="XXX XXX XXX"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const v = sanitizeKGLocal(e.target.value);
            setPhone(v);
            setPhoneError(v.length > 0 && !isKGLocalValid(v));
          }}
          error={phone.trim().length > 0 && phoneError}
          helperText={
            phone.trim().length > 0 && phoneError
              ? "Введите 9 цифр. Формат: +996 XXX XXX XXX"
              : "Формат: +996 XXX XXX XXX"
          }
          fullWidth
          InputProps={{ startAdornment: <InputAdornment position="start">🇰🇬 {PHONE_CC}</InputAdornment> }}
          inputProps={{ inputMode: "tel", pattern: "[0-9]*", maxLength: 9 }}
        />
        <TextField
          label="Роль"
          select
          value={role}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRole((e.target.value as "doctor" | "admin" | ""))}
          fullWidth
        >
          <MenuItem value="">—</MenuItem>
          {roleOptions.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>
      </Stack>
    </DrawerBase>
  );
};

type EditEmployeeDrawerProps = {
  record: EmployeeRow | null;
  onClose: () => void;
  onUpdated: (rec: EmployeeRow) => void;
};

const EditEmployeeDrawer: React.FC<EditEmployeeDrawerProps> = ({ record, onClose, onUpdated }) => {
  const open = Boolean(record);
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [phoneError, setPhoneError] = React.useState(false);
  const [role, setRole] = React.useState<"doctor" | "admin" | "">("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (record) {
      setFullName(record.full_name || "");
      setPhone(parseKGLocalFrom(record.phone ?? ""));
      setRole((record.role === "doctor" || record.role === "admin") ? record.role : "");
      setBusy(false);
    }
  }, [record]);

  const handleSubmit = async () => {
    if (!record) return;
    if (phone.trim().length > 0 && !isKGLocalValid(phone)) {
      setPhoneError(true);
      return;
    }
    try {
      setBusy(true);
      const payload: Record<string, unknown> = {
        full_name: fullName.trim(),
        phone: composeKGPhone(phone),
        role: role || null,
      };
      const { data, error } = await supabase
        .from(EMPLOYEES_WRITE)
        .update(payload)
        .eq("id", record.id)
        .select("*")
        .single();
      if (error) throw error;
      const mapped = data && typeof data === "object" ? mapAnyToEmployee(data as Record<string, unknown>) : null;
      if (mapped) onUpdated(mapped);
      onClose();
    } catch (e) {
      console.error("Update employee failed:", e);
      alert("Не удалось сохранить изменения. Проверьте схему таблицы.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerBase open={open} title="Редактирование" onClose={onClose} busy={busy} onSubmit={handleSubmit} submitLabel="Сохранить" submitDisabled={phone.trim().length > 0 && phoneError}>
      <Stack spacing={2}>
        <TextField label="ФИО" value={fullName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)} required fullWidth />
        <TextField
          label="Телефон"
          value={phone}
          placeholder="XXX XXX XXX"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const v = sanitizeKGLocal(e.target.value);
            setPhone(v);
            setPhoneError(v.length > 0 && !isKGLocalValid(v));
          }}
          error={phone.trim().length > 0 && phoneError}
          helperText={
            phone.trim().length > 0 && phoneError
              ? "Введите 9 цифр. Формат: +996 XXX XXX XXX"
              : "Формат: +996 XXX XXX XXX"
          }
          fullWidth
          InputProps={{ startAdornment: <InputAdornment position="start">🇰🇬 {PHONE_CC}</InputAdornment> }}
          inputProps={{ inputMode: "tel", pattern: "[0-9]*", maxLength: 9 }}
        />
        <TextField
          label="Роль"
          select
          value={role}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRole((e.target.value as "doctor" | "admin" | ""))}
          fullWidth
        >
          <MenuItem value="">—</MenuItem>
          {roleOptions.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>
      </Stack>
    </DrawerBase>
  );
};

type EmployeeDetailsDrawerProps = {
  record: EmployeeRow | null;
  onClose: () => void;
};

const EmployeeDetailsDrawer: React.FC<EmployeeDetailsDrawerProps> = ({ record, onClose }) => {
  const open = Boolean(record);
  const rec = record;

  return (
    <DrawerBase open={open} title="Детали сотрудника" onClose={onClose}>
      {!rec ? null : (
        <Stack spacing={1.25}>
          <Row label="ID" value={rec.id} />
          <Row label="ФИО" value={rec.full_name} />
          <Row label="Телефон" value={rec.phone ?? "—"} />
          <Row label="Роль" value={rec.role ? (rec.role === "doctor" ? "Доктор" : rec.role === "admin" ? "Администратор" : rec.role) : "—"} />
        </Stack>
      )}
    </DrawerBase>
  );
};

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => {
  return (
    <Stack direction="row" spacing={1}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>{label}</Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
};

type DeleteEmployeeDialogProps = {
  record: EmployeeRow | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
};

const DeleteEmployeeDialog: React.FC<DeleteEmployeeDialogProps> = ({ record, onClose, onDeleted }) => {
  const open = Boolean(record);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  const handleDelete = async () => {
    if (!record) return;
    try {
      setBusy(true);
      const { error } = await supabase.from(EMPLOYEES_WRITE).delete().eq("id", record.id);
      if (error) throw error;
      onDeleted(record.id);
      onClose();
    } catch (e) {
      console.error("Delete employee failed:", e);
      alert("Не удалось удалить сотрудника. Проверьте RLS и схему таблицы.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Удалить сотрудника</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          Действительно удалить сотрудника "{record?.full_name || record?.id}"?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Отмена</Button>
        <Button onClick={handleDelete} color="error" variant="contained" disabled={busy}>
          {busy ? <CircularProgress size={18} /> : "Удалить"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EmployeesPage;
