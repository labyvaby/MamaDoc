import React from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  Avatar,
  Tooltip,
  Checkbox,
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import PhotoCameraOutlined from "@mui/icons-material/PhotoCameraOutlined";
import PersonAddAltOutlined from "@mui/icons-material/PersonAddAltOutlined";
import { supabase } from "../../utility/supabaseClient";
import { fetchEmployees } from "../../services/employees";
import type { EmployeesRow } from "../../pages/expenses/types";
import { uploadServicePhoto } from "../../services/storage";
import Autocomplete from "@mui/material/Autocomplete";

const importMetaEnv =
  (import.meta as unknown as { env?: Record<string, string | undefined> })
    .env || {};
const SERVICES_WRITE: string =
  importMetaEnv.VITE_SERVICES_WRITE_TABLE || "Services";

export type CreatedService = {
  id?: string | number;
  name: string; // Это то, что вы показываете в UI
  price: number; // Это то, что вы показываете в UI
  // НОВЫЕ ПОЛЯ, которые возвращает база
  service_name: string;
  price_som: number;
  employee_id: string | null;
  employee_name?: string | null;
  photo_url?: string | null;
  // ...
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (rec: CreatedService) => void;
};

const fileToDataUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(f);
  });

const DrawerBase: React.FC<{
  open: boolean;
  title: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: () => void;
  submitDisabled?: boolean;
  children?: React.ReactNode;
}> = ({ open, title, busy, onClose, onSubmit, submitDisabled, children }) => {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={busy ? undefined : onClose}
      PaperProps={{
        sx: { width: { xs: "100%", sm: 420, md: "36vw" }, maxWidth: "100vw" },
      }}
    >
      <Box sx={{ width: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          px={2}
          py={1.5}
        >
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={busy ? undefined : onClose} aria-label="Закрыть">
            <CloseOutlined />
          </IconButton>
        </Stack>
        <Divider />
        <Box px={2} py={2}>
          {children}
        </Box>
        <Divider />
        <Box px={2} py={1.5} display="flex" justifyContent="flex-end" gap={1.5}>
          <Button onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button
            onClick={onSubmit}
            variant="contained"
            disabled={busy || !!submitDisabled}
          >
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

const AddServiceDrawer: React.FC<Props> = ({ open, onClose, onCreated }) => {
  // Form state
  const [employeeId, setEmployeeId] = React.useState<string | null>(null);
  const [selectedEmps, setSelectedEmps] = React.useState<EmployeesRow[]>([]);
  const [name, setName] = React.useState("");
  const [price, setPrice] = React.useState<string>("");
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);

  // Employees list
  const [employees, setEmployees] = React.useState<EmployeesRow[]>([]);
  const [loadingEmps, setLoadingEmps] = React.useState(false);

  // Busy flag for submit
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (!open) return;

    const load = async () => {
      try {
        setLoadingEmps(true);
        const emps = await fetchEmployees();
        if (!cancelled) setEmployees(emps);
      } finally {
        if (!cancelled) setLoadingEmps(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setEmployeeId(null);
      setSelectedEmps([]);
      setName("");
      setPrice("");
      setPhotoFile(null);
      setPhotoPreview(null);
      setBusy(false);
    }
  }, [open]);

  const onPickPhoto = async (f: File | null) => {
    setPhotoFile(f);
    if (f) {
      try {
        const url = await fileToDataUrl(f);
        setPhotoPreview(url);
      } catch {
        setPhotoPreview(null);
      }
    } else {
      setPhotoPreview(null);
    }
  };

  const handleSubmit = async () => {
    // Basic validation
    const priceNum = Number(price);
    if (!name.trim() || !price || !Number.isFinite(priceNum) || priceNum <= 0) {
      alert("Заполните название и положительную стоимость услуги");
      return;
    }

    try {
      setBusy(true);

      // 1) upload photo if present
      let photoUrl: string | null = null;
      if (photoFile) {
        try {
          const { publicUrl } = await uploadServicePhoto(photoFile);
          photoUrl = publicUrl || null;
        } catch {
          // ignore upload error
        }
      }

      // 2) insert service to DB (try with english columns first)
      const primaryPayload: Record<string, unknown> = {
        // Новые, чистые имена столбцов
        service_name: name.trim(), // <--- Используйте service_name вместо name
        price_som: Number(price),
        employee_id: employeeId,
        photo_url: photoUrl, // <--- Используйте photo_url вместо photo
      };

      const tryInsert = async (payload: Record<string, unknown>) => {
        const { data, error } = await supabase
          .from(SERVICES_WRITE)
          .insert(payload)
          .select("*")
          .single();
        if (error) throw error;
        return data as Record<string, unknown>;
      };

      let inserted: Record<string, unknown> | null;
      try {
        inserted = await tryInsert(primaryPayload);
      } catch {
        // fallback to cyrillic columns if schema differs
        const altPayload: Record<string, unknown> = {
          "Название услуги": name.trim(),
          "Стоимость, сом": Number(price),
          "Сотрудник ID": employeeId,
          Картинка: photoUrl,
        };
        inserted = await tryInsert(altPayload);
      }

      const out: CreatedService = {
        id:
          (inserted?.["id"] as string | number | undefined) ??
          (inserted?.["ID"] as string | number | undefined),
        // UI fields
        name:
          (inserted?.["name"] as string) ??
          (inserted?.["service_name"] as string) ??
          (inserted?.["Название услуги"] as string) ??
          name.trim(),
        price:
          typeof inserted?.["price"] === "number"
            ? (inserted?.["price"] as number)
            : typeof inserted?.["price_som"] === "number"
            ? (inserted?.["price_som"] as number)
            : typeof inserted?.["Стоимость, сом"] === "number"
            ? (inserted?.["Стоимость, сом"] as number)
            : Number(price),

        // DB-returned fields
        service_name:
          (inserted?.["service_name"] as string) ??
          (inserted?.["Название услуги"] as string) ??
          name.trim(),
        price_som:
          typeof inserted?.["price_som"] === "number"
            ? (inserted?.["price_som"] as number)
            : typeof inserted?.["Стоимость, сом"] === "number"
            ? (inserted?.["Стоимость, сом"] as number)
            : Number(price),

        employee_id:
          (inserted?.["employee_id"] as string | null) ?? employeeId ?? null,
        employee_name:
          (inserted?.["employee_name"] as string | null) ??
          (selectedEmps && selectedEmps.length > 0
            ? (selectedEmps[0]?.full_name ?? null)
            : null),
        photo_url:
          (inserted?.["photo_url"] as string | null) ??
          (inserted?.["Картинка"] as string | null) ??
          photoUrl ??
          null,
      };

      onCreated?.(out);
      onClose();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Create service failed:", e);
      alert("Не удалось создать услугу. Проверьте схему таблицы и права RLS.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerBase
      open={open}
      title="Добавление услуги"
      busy={busy}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={!name.trim() || !price || Number(price) <= 0}
    >
      <Stack spacing={2}>
        {/* Employee */}
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">
            Выберите сотрудника:
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Autocomplete
              multiple
              loading={loadingEmps}
              options={employees}
              value={selectedEmps}
              filterSelectedOptions
              disableCloseOnSelect
              getOptionLabel={(o) => o.full_name || o.id}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              onChange={(_, v) => {
                setSelectedEmps(v ?? []);
                const first = (v && v[0]) || null;
                setEmployeeId(first?.id ?? null);
              }}
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox
                    size="small"
                    style={{ marginRight: 8 }}
                    checked={selected}
                  />
                  {option.full_name || option.id}
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Сотрудник(и)"
                  fullWidth
                  size="small"
                />
              )}
              sx={{ flex: 1 }}
            />
            <Tooltip title="Добавить сотрудника (перейти)">
              <span>
                <IconButton
                  color="inherit"
                  onClick={() => window.open("/employees", "_blank")}
                  aria-label="Добавить сотрудника"
                >
                  <PersonAddAltOutlined />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Name */}
        <TextField
          label="Название услуги *"
          placeholder="Например: УЗИ брюшной полости"
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setName(e.target.value)
          }
          fullWidth
        />

        {/* Price */}
        <TextField
          label="Стоимость услуги, сом *"
          placeholder="Введите сумму"
          type="text"
          inputMode="numeric"
          value={price}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const v = e.target.value.replace(/[^\d]/g, "");
            setPrice(v);
          }}
          InputProps={{
            endAdornment: <InputAdornment position="end">сом</InputAdornment>,
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              bgcolor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(2,6,23,0.04)",
            },
            "& input": {
              textAlign: "right",
              fontWeight: 600,
              letterSpacing: 0.2,
            },
          }}
          fullWidth
        />

        {/* Photo */}
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">
            Картинка
          </Typography>
          <Card variant="outlined" sx={{ borderStyle: "dashed" }}>
            <CardContent
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                py: 2,
                cursor: "pointer",
              }}
              onClick={() => {
                const el = document.getElementById(
                  "add-service-file-input"
                ) as HTMLInputElement | null;
                el?.click();
              }}
            >
              <Avatar
                variant="rounded"
                src={photoPreview || undefined}
                sx={{ width: 48, height: 48 }}
              >
                <PhotoCameraOutlined />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2">
                  {photoFile
                    ? photoFile.name
                    : "Нажмите для выбора изображения"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  JPG, PNG. Необязательно.
                </Typography>
              </Box>
              <input
                id="add-service-file-input"
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                  const f =
                    e.target.files && e.target.files[0]
                      ? e.target.files[0]
                      : null;
                  await onPickPhoto(f);
                }}
              />
            </CardContent>
          </Card>
        </Stack>
      </Stack>
    </DrawerBase>
  );
};

export default AddServiceDrawer;
