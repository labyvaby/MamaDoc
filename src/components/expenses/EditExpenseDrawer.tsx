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
import { useInvalidate, useUpdate } from "@refinedev/core";
import { deleteExpensePhotoByUrl, uploadExpensePhoto } from "../../services/storage";
import { supabase } from "../../utility/supabaseClient";
import { fetchEmployees } from "../../services/employees";
import type { Expense, ExpenseFormValues, EmployeesRow } from "../../pages/expenses/types";

type EditExpenseDrawerProps = {
  open: boolean;
  onClose: () => void;
  record: Expense;
  onUpdated?: (record: Expense) => void;
};

type ExpenseCategory = {
  id: string;
  name: string;
};

const computeTotal = (cash: number, cashless: number, provided: number) => {
  if (Number.isFinite(provided) && provided > 0) return provided;
  return (Number.isFinite(cash) ? cash : 0) + (Number.isFinite(cashless) ? cashless : 0);
};

// Сжатие изображения перед загрузкой для ускорения upload
const maybeCompressPhoto = async (file: File, maxDim = 1280, quality = 0.8): Promise<File> => {
  try {
    if (!file.type.startsWith("image/")) return file;
    // пропускаем мелкие файлы
    if (file.size <= 200 * 1024) return file;

    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = dataUrl;
    });

    let w = img.width;
    let h = img.height;
    if (w > h && w > maxDim) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else if (h >= w && h > maxDim) {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
    );

    if (!blob) return file;
    const base = file.name.replace(/\.(png|jpg|jpeg|webp|gif|bmp|heic)$/i, "");
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
};

// Helpers: типобезопасное извлечение id/ФИО без any
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

export const EditExpenseDrawer: React.FC<EditExpenseDrawerProps> = ({
  open,
  onClose,
  record,
  onUpdated,
}) => {
  const initialValues: ExpenseFormValues = React.useMemo(
    () => ({
      employee_id: record.employee_id,
      name: record.name,
      cash_amount: record.cash_amount,
      cashless_amount: record.cashless_amount,
      total_amount: record.total_amount,
      comment: record.comment ?? "",
      category: record.category ?? "",
      photo: record.photo ?? null,
      photoFile: null,
    }),
    [record]
  );

  const [values, setValues] = React.useState<ExpenseFormValues>(initialValues);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [busyUpload, setBusyUpload] = React.useState(false);
  const [busySave, setBusySave] = React.useState(false);
  const [removeExistingPhoto, setRemoveExistingPhoto] = React.useState(false);

  const [employees, setEmployees] = React.useState<EmployeesRow[]>([]);
  const [employeesLoading, setEmployeesLoading] = React.useState<boolean>(false);
  const [categories, setCategories] = React.useState<ExpenseCategory[]>([]);

  const { mutateAsync: updateAsync } = useUpdate<Expense>();
  const invalidate = useInvalidate();

  // load employees + categories
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setEmployeesLoading(true);
      try {
        // Fast path via service
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
          // fallback below
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
          const id = getIdFrom(r);
          if (!id || seen.has(id)) return;
          const name = getNameFrom(r);
          mergedEmployees.push({ id, full_name: name || id });
          seen.add(id);
        };

        if (Array.isArray(empRes1?.data)) for (const e of empRes1.data as unknown[]) pushEmp(e);
        if (Array.isArray(empRes2?.data)) for (const e of empRes2.data as unknown[]) pushEmp(e);

        const cats: ExpenseCategory[] = [];
        if (Array.isArray(catRes?.data)) {
          for (const c of catRes.data as unknown[]) {
            if (typeof c === "object" && c !== null) {
              const r = c as Record<string, unknown>;
              const idRaw = r["id"];
              const nameRaw = r["name"];
              if ((typeof idRaw === "string" || typeof idRaw === "number") && typeof nameRaw === "string") {
                cats.push({ id: typeof idRaw === "string" ? idRaw : String(idRaw), name: nameRaw });
              }
            }
          }
        }

        if (!cancelled) {
          setEmployees(mergedEmployees);
          setCategories(cats);
        }
      } finally {
        if (!cancelled) setEmployeesLoading(false);
      }
    };

    if (open) load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  React.useEffect(() => {
    if (open) {
      setValues(initialValues);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setBusyUpload(false);
      setBusySave(false);
      setRemoveExistingPhoto(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record]);

  const handleChange =
    (field: keyof ExpenseFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (field === "cash_amount" || field === "cashless_amount" || field === "total_amount") {
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
      setRemoveExistingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setValues((s) => ({ ...s, photoFile: null, photo: null }));
    setRemoveExistingPhoto(true);
  };

  const handleSubmit = async () => {
    try {
      setBusyUpload(true);
      setBusySave(true);
      let newPublicUrl: string | null = null;
      const hadOldPhoto = Boolean(record.photo);

      if (values.photoFile) {
        const fileForUpload = await maybeCompressPhoto(values.photoFile);
        const { publicUrl } = await uploadExpensePhoto(fileForUpload);
        newPublicUrl = publicUrl;
      }

      const payload = {
        employee_id: values.employee_id,
        name: values.name,
        cash_amount: values.cash_amount ?? 0,
        cashless_amount: values.cashless_amount ?? 0,
        total_amount: computeTotal(values.cash_amount ?? 0, values.cashless_amount ?? 0, values.total_amount ?? 0),
        comment: values.comment ?? null,
        category: values.category ?? null,
        photo: removeExistingPhoto ? null : (newPublicUrl ?? record.photo ?? null),
      };

      const updated = await updateAsync({
        resource: "expenses",
        id: record.id,
        values: payload,
      });

      if (values.photoFile && hadOldPhoto && record.photo) {
        await deleteExpensePhotoByUrl(record.photo);
      } else if (removeExistingPhoto && hadOldPhoto && record.photo) {
        await deleteExpensePhotoByUrl(record.photo);
      }


      await invalidate({
        resource: "expenses",
        invalidates: ["list", "detail"],
      });

      if (updated?.data && onUpdated) onUpdated(updated.data as Expense);
      onClose();
    } catch (e: unknown) {
      // eslint-disable-next-line no-console
      console.error("Update expense failed:", e);
    } finally {
      setBusySave(false);
      setBusyUpload(false);
    }
  };

  const busy = busyUpload || busySave;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={busy ? undefined : onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 420, md: "30vw" }, maxWidth: "100vw", overflowX: "hidden", boxSizing: "border-box", mx: 0 } }}
    >
      <Box sx={{ width: 1, minWidth: 0 }} role="presentation">
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          p={{ xs: 1.5, md: 2 }}
          sx={{ borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}
        >
          <Typography variant="h6">Редактировать расход</Typography>
          <IconButton onClick={busy ? undefined : onClose} aria-label="Закрыть">
            <CloseOutlined />
          </IconButton>
        </Stack>

        <Divider sx={{ my: { xs: 1.5, md: 2 } }} />

        <Box p={{ xs: 1.5, md: 2 }}>
          <Stack spacing={2}>
            <Grid container spacing={{ xs: 1, md: 2 }}>
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

              <Grid item xs={12}>
                <TextField
                  label="Итого"
                  type="number"
                  value={computeTotal(values.cash_amount ?? 0, values.cashless_amount ?? 0, values.total_amount ?? 0)}
                  disabled
                  helperText="Итого рассчитывается: наличные + безнал"
                  fullWidth
                  inputProps={{ min: 0, step: "0.01" }}
                />
              </Grid>

              <Grid item xs={12}>
                <Autocomplete<string, false, false, false>
                  options={categories.map((c) => c.name)}
                  noOptionsText={employeesLoading ? "Загрузка…" : "Нет вариантов"}
                  value={values.category && values.category.length > 0 ? values.category : null}
                  onChange={(_e, newValue) => setValues((s) => ({ ...s, category: newValue ?? null }))}
                  renderInput={(params) => <TextField {...params} label="Категория" fullWidth />}
                />
              </Grid>

              <Grid item xs={12}>
                <Autocomplete<EmployeesRow, false, false, false>
                  options={employees}
                  loading={employeesLoading}
                  loadingText="Загрузка…"
                  noOptionsText={employeesLoading ? "Загрузка…" : "Нет вариантов"}
                  getOptionLabel={(option) => option.full_name || option.id}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  value={employees.find((e) => e.id === values.employee_id) ?? null}
                  onChange={(_e, newValue) => setValues((s) => ({ ...s, employee_id: newValue?.id ?? null }))}
                  renderInput={(params) => <TextField {...params} label="Сотрудник" fullWidth />}
                />
              </Grid>

              <Grid item xs={12}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Button variant="outlined" component="label" disabled={busy}>
                    Выбрать новое фото
                    <input type="file" hidden accept="image/*" onChange={handleFileChange} />
                  </Button>
                  {previewUrl ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar variant="rounded" src={previewUrl} sx={{ width: 64, height: 64 }} />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" color="text.secondary">Новое фото</Typography>
                        <Button size="small" color="error" onClick={handleRemovePhoto}>
                          Удалить фото
                        </Button>
                      </Stack>
                    </Stack>
                  ) : record.photo ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar variant="rounded" src={record.photo} sx={{ width: 64, height: 64 }} />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" color="text.secondary">Текущее фото</Typography>
                        <Button size="small" color="error" onClick={handleRemovePhoto}>
                          Удалить фото
                        </Button>
                      </Stack>
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">Фото отсутствует</Typography>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        </Box>

        <Divider sx={{ my: { xs: 1.5, md: 2 } }} />

        <Box p={{ xs: 1.5, md: 2 }} display="flex" justifyContent="flex-end" gap={1.5}>
          <Button onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={busy}>
            {busy ? (
              <Stack direction="row" alignItems="center" spacing={1}>
                <CircularProgress size={18} />
                <span>Сохранение…</span>
              </Stack>
            ) : (
              "Сохранить"
            )}
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
};

export default EditExpenseDrawer;
