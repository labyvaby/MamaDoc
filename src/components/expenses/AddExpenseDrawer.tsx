import React from "react";
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { useCreate, useInvalidate, useNotification } from "@refinedev/core";
import { uploadExpensePhoto } from "../../services/storage";
import { supabase } from "../../utility/supabaseClient";
import { fetchEmployees } from "../../services/employees";
import type { Expense, ExpenseFormValues, EmployeesRow } from "../../pages/expenses/types";

type AddExpenseDrawerProps = {
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

export const AddExpenseDrawer: React.FC<AddExpenseDrawerProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const [values, setValues] = React.useState<ExpenseFormValues>(defaultValues);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  type ExpenseCategory = {
    id: string;
    name: string;
  };

  // Хелперы: типобезопасное извлечение id/ФИО (как на странице /expenses)
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

  const [employees, setEmployees] = React.useState<EmployeesRow[]>([]);
  const [categories, setCategories] = React.useState<ExpenseCategory[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Fast path: unified employees fetch via service
      try {
        const [emps, catRes2] = await Promise.all([
          fetchEmployees(),
          supabase.from("expense_category").select("id, name"),
        ]);
        const cats2: ExpenseCategory[] = [];
        if (Array.isArray(catRes2?.data)) {
          for (const c of catRes2.data as unknown[]) {
            if (typeof c === "object" && c !== null) {
              const r = c as { id: string | number; name?: unknown };
              const idRaw = r.id;
              const nameRaw = r.name;
              if (idRaw != null && typeof nameRaw === "string") {
                const id = typeof idRaw === "string" ? idRaw : String(idRaw);
                cats2.push({ id, name: nameRaw });
              }
            }
          }
        }
        if (!cancelled) {
          setCategories(cats2);
          if (emps.length > 0) {
            setEmployees(emps);
            return;
          }
        }
      } catch {
        // fallback to legacy code below if service fails
      }
      const [empRes1, empRes2, catRes] = await Promise.all([
        supabase.from("employees").select("*"),
        supabase.from("Employes").select("*"),
        supabase.from("expense_category").select("id, name"),
      ]);

      const mergedEmployees: EmployeesRow[] = [];
      const seen = new Set<string>();

      const pushEmp = (rec: unknown) => {
        if (typeof rec !== "object" || rec === null) return;
        const r = rec as Record<string, unknown>;

        // извлекаем id по любому из ключей: "id", "ID" (без any)
        const idKey = Object.keys(r).find((k) => /^id$/i.test(k));
        const idRaw = idKey ? r[idKey] : undefined;
        const id =
          typeof idRaw === "string"
            ? idRaw
            : typeof idRaw === "number"
            ? String(idRaw)
            : "";
        if (!id || seen.has(id)) return;

        // собираем кандидатов для имени (латиница и кириллица)
        const directKeys = ["full_name", "fullName", "name", "fio", "ФИО сотрудников", "ФИО"];
        const candidates: string[] = [];

        for (const k of directKeys) {
          const v = r[k as keyof typeof r];
          if (typeof v === "string" && v.trim().length > 0) {
            candidates.push(v.trim());
          }
        }

        // generic scan: любые поля, содержащие name/fio/фио
        for (const k of Object.keys(r)) {
          const v = r[k];
          if (typeof v === "string" && /(name|fio|фио)/i.test(k) && v.trim().length > 0) {
            candidates.push(v.trim());
          }
        }

        // first_name + last_name
        const fa = r["first_name"];
        const fb = r["last_name"];
        const combined = `${typeof fa === "string" ? fa.trim() : ""}${
          (typeof fa === "string" && fa && typeof fb === "string" && fb) ? " " : ""
        }${typeof fb === "string" ? fb.trim() : ""}`.trim();

        const name = (candidates.concat(combined).find((s) => typeof s === "string" && s.length > 0) as string | undefined) ?? "";

        mergedEmployees.push({ id, full_name: name || id });
        seen.add(id);
      };

      if (typeof empRes1?.data !== "undefined" && Array.isArray(empRes1.data)) {
        for (const e of empRes1.data as unknown[]) pushEmp(e);
      }
      if (typeof empRes2?.data !== "undefined" && Array.isArray(empRes2.data)) {
        for (const e of empRes2.data as unknown[]) pushEmp(e);
      }

      const cats: ExpenseCategory[] = [];
      const pushCat = (rec: unknown) => {
        if (typeof rec !== "object" || rec === null) return;
        const r = rec as Record<string, unknown>;
        const idRaw = r.id;
        const nameRaw = r.name;
        if (idRaw === null || idRaw === undefined || typeof nameRaw !== "string") return;
        const id = typeof idRaw === "string" ? idRaw : String(idRaw);
        cats.push({ id, name: nameRaw });
      };
      if (typeof catRes?.data !== "undefined" && Array.isArray(catRes.data)) {
        for (const c of catRes.data as unknown[]) pushCat(c);
      }

      let finalEmployees: EmployeesRow[] = mergedEmployees;
      try {
        if (finalEmployees.length === 0) {
          const { data: empAll } = await supabase
            .from("Employes")
            .select("*")
            .order("fullName", { ascending: true });
          if (Array.isArray(empAll)) {
            finalEmployees = (empAll as unknown[]).map((r) => {
              const obj = r as Record<string, unknown>;
              const idRaw = obj.id;
              const id = typeof idRaw === "string" ? idRaw : String(idRaw ?? "");
              const f1 = obj.full_name;
              const f2 = (obj as Record<string, unknown>).fullName;
              const f3 = (obj as Record<string, unknown>).name;
              const f4 = (obj as Record<string, unknown>).fio;
              const fa = (obj as Record<string, unknown>).first_name;
              const fb = (obj as Record<string, unknown>).last_name;
              const combined = `${typeof fa === "string" ? fa.trim() : ""}${
                (typeof fa === "string" && fa && typeof fb === "string" && fb) ? " " : ""
              }${typeof fb === "string" ? fb.trim() : ""}`.trim();
              const candidates = [f1, f2, f3, f4, combined].filter(
                (s): s is string => typeof s === "string" && s.trim().length > 0,
              );
              return { id, full_name: candidates[0] ?? id };
            });
          }
        }
      } catch {
        // ignore, keep mergedEmployees
      }

      // Extra generic fallback: try to discover likely employees table/columns
      try {
        if (finalEmployees.length === 0) {
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
              if (mapped.length > 0) { finalEmployees = mapped; break; }
            }
          }
        }
      } catch {
        // ignore
      }

      // Fallback: если список сотрудников пуст (например, запрет list из-за RLS),
      // пробуем собрать сотрудников точечно по employee_id из таблицы расходов.
      if (finalEmployees.length === 0) {
        try {
          const { data: expData } = await supabase.from("expenses").select("employee_id");
          if (Array.isArray(expData)) {
            const ids = Array.from(
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
            );

            const tables = ["employees", "Employes", "employee", "Employee", "profiles", "Profiles", "users", "staff", "Staff", "people", "Persons", "persons", "People"];
            const collected: EmployeesRow[] = [];
            const seenIds = new Set<string>();

            const tryFetchName = async (table: string, id: string): Promise<string | null> => {
              const { data, error } = await supabase
                .from(table)
                .select("*")
                .or(`id.eq.${id},ID.eq.${id}`)
                .maybeSingle();
              if (!error && data) {
                const d = data as Record<string, unknown>;
                const f1 = d["full_name"];
                const f2 = d["fullName"];
                const f3 = d["name"];
                const f4 = d["fio"];
                const f5 = d["ФИО сотрудников"] as unknown;
                const f6 = d["ФИО"] as unknown;
                const fa = d["first_name"];
                const fb = d["last_name"];
                const combined = `${typeof fa === "string" ? fa.trim() : ""}${
                  (typeof fa === "string" && fa && typeof fb === "string" && fb) ? " " : ""
                }${typeof fb === "string" ? fb.trim() : ""}`.trim();
                const candidates = [f1, f2, f3, f4, f5, f6, combined].filter(
                  (s): s is string => typeof s === "string" && s.trim().length > 0,
                );
                return candidates[0] ?? null;
              }
              return null;
            };

            for (const id of ids) {
              let name: string | null = null;
              for (const t of tables) {
                try {
                  name =
                    (await tryFetchName(t, id)) ??
                    null;
                  if (name) break;
                } catch {
                  // пробуем следующую таблицу
                }
              }
              if (!seenIds.has(id)) {
                collected.push({ id, full_name: name ?? id });
                seenIds.add(id);
              }
            }

            if (collected.length > 0) {
              finalEmployees = collected;
            }
          }
        } catch {
          // ignore
        }
      }

      if (!cancelled) {
        setEmployees(finalEmployees);
        setCategories(cats);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);


  const { mutateAsync: createAsync } = useCreate<Expense>();
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
      setCreating(false);
    }
  }, [open, previewUrl]);

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
    const file = e.target.files?.[0] ?? null;
    setValues((s) => ({ ...s, photoFile: file }));
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
    // Если total задан и > 0 — используем его, иначе сумма cash + cashless
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

      await invalidate({
        resource: "expenses",
        invalidates: ["list"],
      });

      if (created?.data && onCreated) onCreated(created.data as Expense);
      onClose();
    } catch (e: unknown) {
      console.error("Create expense failed:", e);
      const message = e instanceof Error ? e.message : String(e);
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
    <Drawer anchor="right" open={open} onClose={busy ? undefined : onClose}>
      <Box sx={{ width: "30vw", minWidth: 320 }} role="presentation">
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          p={2}
        >
          <Typography variant="h6">Новый расход</Typography>
          <IconButton onClick={busy ? undefined : onClose} aria-label="Закрыть">
            <CloseOutlined />
          </IconButton>
        </Stack>

        <Divider />

        <Box p={2}>
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Название"
                  value={values.name}
                  onChange={handleChange("name")}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <Autocomplete<string, false, false, false>
                  options={categories.map((c) => c.name)}
                  noOptionsText=""
                  value={values.category && values.category.length > 0 ? values.category : null}
                  onChange={(_e, newValue) => setValues((s) => ({ ...s, category: newValue ?? null }))}
                  renderInput={(params) => <TextField {...params} label="Категория" fullWidth />}
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
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Наличные"
                  type="number"
                  value={values.cash_amount}
                  onChange={handleChange("cash_amount")}
                  fullWidth
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Безнал"
                  type="number"
                  value={values.cashless_amount}
                  onChange={handleChange("cashless_amount")}
                  fullWidth
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Итого"
                  type="number"
                  value={computeTotal(
                    values.cash_amount ?? 0,
                    values.cashless_amount ?? 0,
                    values.total_amount ?? 0
                  )}
                  disabled
                  helperText="Итого рассчитывается: наличные + безнал"
                  fullWidth
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
        </Box>

        <Divider />

        <Box p={2} display="flex" justifyContent="flex-end" gap={1}>
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
        </Box>
      </Box>
    </Drawer>
  );
};

export default AddExpenseDrawer;
