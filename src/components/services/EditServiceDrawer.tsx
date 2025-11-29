import React from "react";
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  Tooltip,
  Checkbox,
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import PersonAddAltOutlined from "@mui/icons-material/PersonAddAltOutlined";
import Autocomplete from "@mui/material/Autocomplete";
import { supabase } from "../../utility/supabaseClient";
import { fetchEmployees } from "../../services/employees";
import type { EmployeesRow } from "../../pages/expenses/types";
import type { CreatedService } from "./AddServiceDrawer";

const importMetaEnv =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
const SERVICES_WRITE: string = importMetaEnv.VITE_SERVICES_WRITE_TABLE || "Services";

type Props = {
  open: boolean;
  onClose: () => void;
  record: {
    id: string | number;
    name: string;
    price: number;
    employee_id: string | null;
    employee_name?: string | null;
    photo_url?: string | null;
  };
  onUpdated?: (rec: CreatedService) => void;
};

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

const EditServiceDrawer: React.FC<Props> = ({ open, onClose, record, onUpdated }) => {
  const [name, setName] = React.useState(record.name);
  const [price, setPrice] = React.useState<string>(String(record.price ?? ""));
  const [selectedEmps, setSelectedEmps] = React.useState<EmployeesRow[]>([]);
  const [employees, setEmployees] = React.useState<EmployeesRow[]>([]);
  const [loadingEmps, setLoadingEmps] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (!open) return;

    const load = async () => {
      try {
        setLoadingEmps(true);
        const emps = await fetchEmployees();
        if (!cancelled) {
          setEmployees(emps);
          // try preselect by employee_id
          const found = emps.find((e) => e.id === record.employee_id);
          if (found) setSelectedEmps([found]);
          else setSelectedEmps([]);
        }
      } finally {
        if (!cancelled) setLoadingEmps(false);
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [open, record.employee_id]);

  React.useEffect(() => {
    if (!open) {
      setName(record.name);
      setPrice(String(record.price ?? ""));
      setSelectedEmps([]);
      setBusy(false);
    }
  }, [open, record]);

  const handleSubmit = async () => {
    const priceNum = Number(price);
    if (!name.trim() || !price || !Number.isFinite(priceNum) || priceNum <= 0) {
      alert("Заполните название и положительную стоимость услуги");
      return;
    }

    try {
      setBusy(true);

      const employeeId = selectedEmps[0]?.id ?? null;

      const primaryPayload: Record<string, unknown> = {
        service_name: name.trim(),
        price_som: priceNum,
        employee_id: employeeId,
      };

      const tryUpdate = async (payload: Record<string, unknown>) => {
        // Обновляем по колонке "ID" (регистр- чувствительное имя столбца)
        const { data, error } = await supabase
          .from(SERVICES_WRITE)
          .update(payload)
          .eq("ID", record.id)
          .select("*")
          .single();
        if (error) throw error;
        return data as Record<string, unknown>;
      };

      let updated: Record<string, unknown> | null;
      try {
        updated = await tryUpdate(primaryPayload);
      } catch {
        const altPayload: Record<string, unknown> = {
          "Название услуги": name.trim(),
          "Стоимость, сом": priceNum,
          "Сотрудник ID": employeeId,
        };
        updated = await tryUpdate(altPayload);
      }

      const out: CreatedService = {
        id:
          (updated?.["id"] as string | number | undefined) ??
          (updated?.["ID"] as string | number | undefined) ??
          record.id,
        name:
          (updated?.["name"] as string) ??
          (updated?.["service_name"] as string) ??
          (updated?.["Название услуги"] as string) ??
          name.trim(),
        price:
          typeof updated?.["price"] === "number"
            ? (updated?.["price"] as number)
            : typeof updated?.["price_som"] === "number"
            ? (updated?.["price_som"] as number)
            : typeof updated?.["Стоимость, сом"] === "number"
            ? (updated?.["Стоимость, сом"] as number)
            : priceNum,
        service_name:
          (updated?.["service_name"] as string) ??
          (updated?.["Название услуги"] as string) ??
          name.trim(),
        price_som:
          typeof updated?.["price_som"] === "number"
            ? (updated?.["price_som"] as number)
            : typeof updated?.["Стоимость, сом"] === "number"
            ? (updated?.["Стоимость, сом"] as number)
            : priceNum,
        employee_id:
          (updated?.["employee_id"] as string | null) ?? employeeId ?? null,
        employee_name:
          (updated?.["employee_name"] as string | null) ??
          (selectedEmps && selectedEmps.length > 0
            ? (selectedEmps[0]?.full_name ?? null)
            : record.employee_name ?? null),
        photo_url:
          (updated?.["photo_url"] as string | null) ?? record.photo_url ?? null,
      };

      onUpdated?.(out);
      onClose();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Update service failed:", e);
      alert("Не удалось обновить услугу. Проверьте схему таблицы и права RLS.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerBase
      open={open}
      title="Редактирование услуги"
      busy={busy}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={!name.trim() || !price || Number(price) <= 0}
    >
      <Stack spacing={2}>
        <TextField
          label="Название услуги *"
          placeholder="Например: УЗИ брюшной полости"
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setName(e.target.value)
          }
          fullWidth
        />
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
          fullWidth
        />
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">
            Сотрудник
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
              }}
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox size="small" style={{ marginRight: 8 }} checked={selected} />
                  {option.full_name || option.id}
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} placeholder="Сотрудник(и)" fullWidth size="small" />
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
      </Stack>
    </DrawerBase>
  );
};

export default EditServiceDrawer;
