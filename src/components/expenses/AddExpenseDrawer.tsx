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
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { useCreate, useInvalidate, useNotification } from "@refinedev/core";
import { uploadExpensePhoto } from "../../services/storage";
import type { Expense, ExpenseFormValues } from "../../pages/expenses/types";

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
  }, [open]);

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
      // eslint-disable-next-line no-console
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
                <TextField
                  label="Категория"
                  value={values.category ?? ""}
                  onChange={handleChange("category")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Сотрудник"
                  value={values.employee_id ?? ""}
                  onChange={handleChange("employee_id")}
                  fullWidth
                  placeholder="ID сотрудника из таблицы employees"
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
