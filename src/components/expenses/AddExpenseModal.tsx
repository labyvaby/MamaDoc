import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
  Avatar,
  CircularProgress,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import { useCreate, useInvalidate, useNotification } from "@refinedev/core";
import { uploadExpensePhoto } from "../../services/storage";
import { supabase } from "../../utility/supabaseClient";
import type { Expense, ExpenseFormValues, EmployeesRow } from "../../pages/expenses/types";

type AddExpenseModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (record: Expense) => void;
};

const defaultValues: ExpenseFormValues = {
  employee_id: null,
  name: "",
  cash_amount: 0,
  cashless_amount: 0,
  total_amount: 0,
  comment: "",
  category: "",
  photo: null,
  photoFile: null,
};

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const [values, setValues] = React.useState<ExpenseFormValues>(defaultValues);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [employees, setEmployees] = React.useState<EmployeesRow[]>([]);

  // Типобезопасные хелперы извлечения ID/ФИО (без any)
  const getIdFrom = (o: Record<string, unknown>): string => {
    const idKey =
      ("id" in o && "id") ||
      ("ID" in o && "ID") ||
      Object.keys(o).find((k) => /^id$/i.test(k));
    const idRaw = idKey ? o[idKey as keyof typeof o] : undefined;
    if (typeof idRaw === "string") return idRaw;
    if (typeof idRaw === "number") return String(idRaw);
    return "";
  };

  const getNameFrom = (o: Record<string, unknown>): string => {
    const directKeys = ["full_name", "fullName", "name", "fio", "ФИО сотрудников", "ФИО"];
    const vals: string[] = [];

    for (const k of directKeys) {
      const v = o[k as keyof typeof o];
      if (typeof v === "string" && v.trim().length > 0) vals.push(v.trim());
    }
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === "string" && /(name|fio|фио)/i.test(k) && v.trim().length > 0) {
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
  };

  const { mutateAsync: createAsync } = useCreate<Expense>();
  const [creating, setCreating] = React.useState(false);
  const invalidate = useInvalidate();
  const { open: notify } = useNotification();

  React.useEffect(() => {
    if (!open) {
      setValues(defaultValues);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setUploading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    let cancelled = false;

    const normalizeName = (o: Record<string, unknown>): string => {
      const directKeys = ["full_name", "fullName", "name", "fio", "ФИО сотрудников", "ФИО"];
      const vals: string[] = [];

      for (const k of directKeys) {
        const v = o[k as keyof typeof o];
        if (typeof v === "string" && v.trim().length > 0) vals.push(v.trim());
      }
      for (const k of Object.keys(o)) {
        const v = o[k];
        if (typeof v === "string" && /(name|fio|фио)/i.test(k) && v.trim().length > 0) vals.push(v.trim());
      }
      const fa = o["first_name"];
      const fb = o["last_name"];
      const combined = `${typeof fa === "string" ? fa.trim() : ""}${
        (typeof fa === "string" && fa && typeof fb === "string" && fb) ? " " : ""
      }${typeof fb === "string" ? fb.trim() : ""}`.trim();

      const candidate = vals.concat(combined).find((s) => s.length > 0);
      return candidate ?? "";
    };

    const load = async () => {
      try {
        // 1) основной путь через сервис (учитывает разные таблицы)
        const svc = (await import("../../services/employees")).fetchEmployees;
        const emps = await svc();
        if (!cancelled && emps.length > 0) {
          setEmployees(emps);
          return;
        }
      } catch {
        // continue to fallback
      }

      // 2) generic fallback: пробуем получить полный список из вероятных таблиц
      try {
        const tables = ["Employes", "employees", "Employee", "employee", "users", "Profiles", "profiles", "staff", "Staff", "person", "persons", "People"];
        for (const t of tables) {
          const { data } = await supabase.from(t).select("*");
          if (Array.isArray(data) && data.length > 0) {
            const seen2 = new Set<string>();
            const mapped: EmployeesRow[] = [];
            for (const rec of data as unknown[]) {
              if (typeof rec !== "object" || rec === null) continue;
              const o = rec as Record<string, unknown>;
              const id = getIdFrom(o);
              if (!id || seen2.has(id)) continue;
              const nm = getNameFrom(o);
              mapped.push({ id, full_name: nm || id });
              seen2.add(id);
            }
            if (!cancelled && mapped.length > 0) {
              setEmployees(mapped);
              return;
            }
          }
        }
      } catch {
        // ignore
      }

      // 3) fallback: собрать id из расходов и точечно вытащить имена
      try {
        const { data: expData } = await supabase.from("expenses").select("employee_id");
        const ids = Array.isArray(expData)
          ? Array.from(
              new Set(
                (expData as unknown[])
                  .map((r) => {
                    const o = r as Record<string, unknown>;
                    const v = o["employee_id"];
                    if (typeof v === "string") return v;
                    if (typeof v === "number") return String(v);
                    return "";
                  })
                  .filter((s) => typeof s === "string" && s.trim().length > 0),
              ),
            )
          : [];

        if (ids.length === 0) {
          if (!cancelled) setEmployees([]);
          return;
        }

        const tables = ["employees", "Employes", "employee", "Employee", "profiles", "Profiles", "users", "staff", "Staff", "people", "Persons", "persons", "People"];
        const collected: EmployeesRow[] = [];
        const seen = new Set<string>();

        const tryFetchName = async (table: string, id: string): Promise<string | null> => {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .or(`id.eq.${id},ID.eq.${id}`)
            .maybeSingle();
          if (!error && data && typeof data === "object") {
            const o = data as Record<string, unknown>;
            const nm = normalizeName(o);
            return nm || id;
          }
          return null;
        };

        for (const id of ids) {
          if (seen.has(id)) continue;
          let name: string | null = null;
          for (const t of tables) {
            try {
              name = await tryFetchName(t, id);
              if (name) break;
            } catch { /* next table */ }
          }
          collected.push({ id, full_name: name ?? id });
          seen.add(id);
        }

        if (!cancelled) setEmployees(collected);
      } catch {
        if (!cancelled) setEmployees([]);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const handleChange =
    (field: keyof ExpenseFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (
        field === "cash_amount" ||
        field === "cashless_amount" ||
        field === "total_amount"
      ) {
        const n = Number(raw);
        setValues((s) => ({ ...s, [field]: Number.isFinite(n) ? n : 0 }));
      } else {
        setValues((s) => ({ ...s, [field]: raw }));
      }
    };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setValues((s) => ({ ...s, photoFile: file ?? null }));
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const computeTotal = (cash: number, cashless: number, provided: number) => {
    // Prefer explicit provided value; if 0 or NaN, fall back to sum
    if (Number.isFinite(provided) && provided > 0) return provided;
    return (
      (Number.isFinite(cash) ? cash : 0) +
      (Number.isFinite(cashless) ? cashless : 0)
    );
  };

  const handleSubmit = async () => {
    try {
      setUploading(true);
      setCreating(true);
      let publicUrl: string | null = null;

      if (values.photoFile) {
        const { publicUrl: url } = await uploadExpensePhoto(values.photoFile);
        publicUrl = url;
      }

      const employeeId =
        values.employee_id && String(values.employee_id).trim() !== ""
          ? values.employee_id
          : null;
      const payload = {
        employee_id: employeeId,
        name: values.name,
        cash_amount: values.cash_amount ?? 0,
        cashless_amount: values.cashless_amount ?? 0,
        total_amount: computeTotal(
          values.cash_amount ?? 0,
          values.cashless_amount ?? 0,
          values.total_amount ?? 0
        ),
        comment: values.comment ?? null,
        category: values.category ?? null,
        photo: publicUrl,
      };

      const created = await createAsync({
        resource: "expenses",
        values: payload,
      });

      notify?.({
        type: "success",
        message: "Расход успешно создан",
        description: values.name,
      });

      // Invalidate list queries for Expenses
      await invalidate({
        resource: "expenses",
        invalidates: ["list"],
      });

      if (created?.data && onCreated) onCreated(created.data as Expense);
      onClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("Create expense failed:", e);
      notify?.({
        type: "error",
        message: "Ошибка при создании расхода",
        description: message || "Неизвестная ошибка",
      });
    } finally {
      setCreating(false);
      setUploading(false);
    }
  };

  const busy = uploading || creating;

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Добавить расход</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Категория"
                value={values.category ?? ""}
                onChange={handleChange("category")}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Название"
                value={values.name}
                onChange={handleChange("name")}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Наличные"
                type="number"
                value={values.cash_amount}
                onChange={handleChange("cash_amount")}
                fullWidth
                inputProps={{ min: 0, step: "0.01" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Безнал"
                type="number"
                value={values.cashless_amount}
                onChange={handleChange("cashless_amount")}
                fullWidth
                inputProps={{ min: 0, step: "0.01" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Итого"
                type="number"
                value={values.total_amount}
                onChange={handleChange("total_amount")}
                helperText="Если оставить 0 — будет рассчитано как наличные + безнал"
                fullWidth
                inputProps={{ min: 0, step: "0.01" }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Комментарий"
                value={values.comment ?? ""}
                onChange={handleChange("comment")}
                minRows={3}
                multiline
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete<EmployeesRow, false, false, false>
                options={employees}
                noOptionsText=""
                getOptionLabel={(option) => option.full_name || option.id}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={employees.find((e) => e.id === values.employee_id) ?? null}
                onChange={(_e, newValue) => setValues((s) => ({ ...s, employee_id: newValue?.id ?? null }))}
                renderInput={(params) => <TextField {...params} label="Сотрудник" fullWidth />}
              />
            </Grid>
            <Grid item xs={12}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Button variant="outlined" component="label" disabled={busy}>
                  Выбрать фото
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </Button>
                {previewUrl ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar
                      variant="rounded"
                      src={previewUrl}
                      sx={{ width: 64, height: 64 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Предпросмотр
                    </Typography>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Фото не выбрано
                  </Typography>
                )}
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Отмена
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={busy}>
          {busy ? (
            <Stack direction="row" alignItems="center" spacing={1}>
              <CircularProgress size={18} />
              <span>Создание…</span>
            </Stack>
          ) : (
            "Создать"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
