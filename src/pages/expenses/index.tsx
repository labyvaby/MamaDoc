import React from "react";
import { DataGrid, type GridColDef, type GridRenderCellParams, type GridColumnVisibilityModel } from "@mui/x-data-grid";
import { List } from "@refinedev/mui";
import { Box, Stack, Button, TextField, IconButton, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText, Divider, Chip, Fab } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import MoreVert from "@mui/icons-material/MoreVert";
import { useDataGrid } from "@refinedev/mui";
import { formatKGS } from "../../utility/format";
import type { Expense, EmployeesRow } from "./types";
import AddExpenseDrawer from "../../components/expenses/AddExpenseDrawer";
import EditExpenseDrawer from "../../components/expenses/EditExpenseDrawer";
import { DeleteExpenseDialog } from "../../components/expenses/DeleteExpenseDialog";
import { ExpenseDetailsDrawer } from "../../components/expenses/ExpenseDetailsDrawer";
import { supabase } from "../../utility/supabaseClient";
import { fetchEmployees } from "../../services/employees";

const importMetaEnv = ((import.meta as unknown) as { env?: Record<string, string | undefined> }).env || {};
const EMPLOYEES_SOURCE: string = importMetaEnv.VITE_EMPLOYEES_TABLE || "EmployeesView";

const ActionsCell: React.FC<{
  row: Expense;
  onView: (e: Expense) => void;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}> = ({ row, onView, onEdit, onDelete }) => {
  return (
    <Stack direction="row" justifyContent="flex-end" sx={{ width: "100%", pr: 0.5 }}>
      <ActionsMenu row={row} onView={onView} onEdit={onEdit} onDelete={onDelete} />
    </Stack>
  );
};

const ActionsMenu: React.FC<{
  row: Expense;
  onView: (e: Expense) => void;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}> = ({ row, onView, onEdit, onDelete }) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  return (
    <>
      <Tooltip title="Действия" arrow>
        <IconButton
          size="small"
          aria-label="Действия"
          onClick={handleOpen}
          sx={{ bgcolor: "action.hover", "&:hover": { bgcolor: "action.selected" } }}
        >
          <MoreVert fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        elevation={3}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            handleClose();
            onView(row);
          }}
        >
          <ListItemIcon>
            <VisibilityOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Просмотр" />
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleClose();
            onEdit(row);
          }}
        >
          <ListItemIcon>
            <EditOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Редактировать" />
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            handleClose();
            onDelete(row);
          }}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon sx={{ color: "error.main" }}>
            <DeleteOutline fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Удалить" />
        </MenuItem>
      </Menu>
    </>
  );
};

const ExpensesListPage: React.FC = () => {
  const { dataGridProps } = useDataGrid<Expense>({
    resource: "expenses",
    syncWithLocation: false,
  });

  const isExpense = (r: unknown): r is Expense =>
    typeof r === "object" && r !== null && "id" in r;

  const rawRows = (dataGridProps as { rows?: unknown })?.rows;
  const safeRows: Expense[] = Array.isArray(rawRows) ? rawRows.filter(isExpense) : [];

  // Нормализуем значения, чтобы DataGrid не получал null/undefined и не падал
  const normalizedRows: Expense[] = safeRows.map((r) => ({
    id: r.id ?? 0,
    employee_id: r.employee_id != null ? String(r.employee_id) : null,
    name: r.name ?? "",
    cash_amount: r.cash_amount ?? 0,
    cashless_amount: r.cashless_amount ?? 0,
    total_amount: r.total_amount ?? (r.cash_amount ?? 0) + (r.cashless_amount ?? 0),
    comment: r.comment ?? null,
    category: r.category ?? null,
    photo: r.photo ?? null,
    created_at: r.created_at ?? "",
    updated_at: r.updated_at ?? "",
  }));


  // Helpers to avoid any: robust id and name extraction

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
    const fa = (o as Record<string, unknown>)["first_name"];
    const fb = (o as Record<string, unknown>)["last_name"];
    const combined = `${typeof fa === "string" ? fa.trim() : ""}${
      (typeof fa === "string" && fa && typeof fb === "string" && fb) ? " " : ""
    }${typeof fb === "string" ? fb.trim() : ""}`.trim();

    const candidate = vals.concat(combined).find((s) => s.length > 0);
    return candidate ?? "";
  };

  const [employees, setEmployees] = React.useState<EmployeesRow[]>([]);
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  // Кэш имён сотрудников по id, подгружаем по мере необходимости (если общий список недоступен из-за RLS)
  const [nameCache, setNameCache] = React.useState<Map<string, string>>(new Map());

  // Единоразовая загрузка сотрудников и категорий (без перебора множества таблиц)
  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const emps = await fetchEmployees();
        if (!cancelled) {
          setEmployees(emps);
        }
      } catch {
        // ignore
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Догружаем имена сотрудников точечно по всем отсутствующим ID одной пачкой.
  React.useEffect(() => {
    let cancelled = false;

    const missingIds = Array.from(
      new Set(
        normalizedRows
          .map((r) => r.employee_id)
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          .filter((id) => !employees.some((e) => e.id === id))
          .filter((id) => !nameCache.has(id)),
      ),
    );

    const loadBulk = async () => {
      if (missingIds.length === 0) return;
      try {
        const { data, error } = await supabase
          .from(EMPLOYEES_SOURCE)
          .select("id, ID, full_name, fullName, name, first_name, last_name, fio")
          .in("id", missingIds)
          .limit(1000);
        if (!error && Array.isArray(data) && !cancelled) {
          setNameCache((prev) => {
            const m = new Map(prev);
            for (const rec of data as unknown[]) {
              if (typeof rec !== "object" || rec === null) continue;
              const o = rec as Record<string, unknown>;
              const idVal = (o["id"] ?? o["ID"]) as unknown;
              const id =
                typeof idVal === "string"
                  ? idVal
                  : typeof idVal === "number"
                  ? String(idVal)
                  : "";
              if (!id || m.has(id)) continue;
              const nm = getNameFrom(o);
              m.set(id, nm || id);
            }
            return m;
          });
        }
      } catch {
        // ignore
      }
    };

    loadBulk();
    return () => {
      cancelled = true;
    };
  }, [normalizedRows, employees, nameCache]);

  const employeeNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) {
      m.set(e.id, e.full_name);
    }
    for (const [id, name] of nameCache) {
      if (!m.has(id)) m.set(id, name);
    }
    return m;
  }, [employees, nameCache]);


  const filteredRows: Expense[] = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return normalizedRows.filter((r) => {
      if (q) {
        const name = r.name.toLowerCase();
        const comment = (r.comment ?? "").toLowerCase();
        const category = (r.category ?? "").toLowerCase();
        const empName = (employeeNameById.get(r.employee_id ?? "") ?? "").toLowerCase();
        return name.includes(q) || comment.includes(q) || category.includes(q) || empName.includes(q);
      }
      return true;
    });
  }, [normalizedRows, searchQuery, employeeNameById]);

  const [addOpen, setAddOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const [selected, setSelected] = React.useState<Expense | null>(null);
  const [employeeFullName, setEmployeeFullName] = React.useState<string | null>(null);

  const handleView = async (rec: Expense) => {
    setSelected(rec);
    setDrawerOpen(true);
    setEmployeeFullName(null);
    if (rec.employee_id) {
      try {
        const { data } = await supabase
          .from(EMPLOYEES_SOURCE)
          .select("*")
          .or(`id.eq.${rec.employee_id},ID.eq.${rec.employee_id}`)
          .maybeSingle();
        const nm = data && typeof data === "object" ? getNameFrom(data as Record<string, unknown>) : null;
        if (nm) setEmployeeFullName(nm);
      } catch {
        // ignore
      }
    }
  };

  const handleEdit = (rec: Expense) => {
    setSelected(rec);
    setEditOpen(true);
  };

  const handleDelete = (rec: Expense) => {
    setSelected(rec);
    setDeleteOpen(true);
  };

  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("sm"));
  const isMd = useMediaQuery(theme.breakpoints.down("md"));
  const columnVisibility = React.useMemo<GridColumnVisibilityModel>(() => {
    const model: GridColumnVisibilityModel = {};
    if (isSm) {
      model.id = false;
      model.cash_amount = false;
      model.cashless_amount = false;
      model.created_at = false;
    } else if (isMd) {
      model.created_at = false;
    }
    return model;
  }, [isSm, isMd]);

  const columns = React.useMemo<GridColDef<Expense>[]>(
    () => [
      {
        field: "id",
        headerName: "ID",
        type: "number",
        minWidth: 80,
        align: "left",
        headerAlign: "left",
      },
      {
        field: "name",
        headerName: "Название",
        flex: 1,
        minWidth: 180,
      },
      {
        field: "employee_id",
        headerName: "Сотрудник",
        flex: 0.8,
        minWidth: 180,
        renderCell: (params: GridRenderCellParams<Expense>) =>
          employeeNameById.get(params.row.employee_id ?? "") || (params.row.employee_id ?? "-"),
      },
      {
        field: "category",
        headerName: "Категория",
        flex: 0.6,
        minWidth: 140,
        renderCell: (params: GridRenderCellParams<Expense>) =>
          params.row.category ? (
            <Chip size="small" label={params.row.category} variant="outlined" />
          ) : (
            "-"
          ),
      },
      {
        field: "cash_amount",
        headerName: "Наличные",
        minWidth: 120,
        align: "right",
        headerAlign: "right",
        renderCell: (params: GridRenderCellParams<Expense>) => formatKGS(Number(params.row.cash_amount ?? 0)),
      },
      {
        field: "cashless_amount",
        headerName: "Безнал",
        minWidth: 120,
        align: "right",
        headerAlign: "right",
        renderCell: (params: GridRenderCellParams<Expense>) => formatKGS(Number(params.row.cashless_amount ?? 0)),
      },
      {
        field: "total_amount",
        headerName: "Итого",
        minWidth: 120,
        align: "right",
        headerAlign: "right",
        renderCell: (params: GridRenderCellParams<Expense>) => formatKGS(Number(params.row.total_amount ?? 0)),
      },
      {
        field: "created_at",
        headerName: "Создано",
        minWidth: 180,
        renderCell: (params: GridRenderCellParams<Expense>) =>
          params.row.created_at ? new Date(String(params.row.created_at)).toLocaleString("ru-RU") : "-",
      },
      {
        field: "actions",
        headerName: "Действия",
        align: "right",
        headerAlign: "right",
        sortable: false,
        minWidth: 120,
        renderCell: (params: GridRenderCellParams<Expense>) => (
          <ActionsCell
            row={params.row}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ),
      },
    ],
    [handleView, handleEdit, handleDelete, employeeNameById]
  );

  return (
    <List
      headerButtons={
        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" sx={{ width: 1, rowGap: 1, columnGap: 1 }}>
          <TextField
            size="small"
            label="Поиск"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            sx={{ width: { xs: 1, md: 240 } }}
          />
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => setAddOpen(true)} sx={{ display: { xs: "none", lg: "inline-flex" } }}>
            Добавить расход
          </Button>
        </Stack>
      }
    >
      <Box sx={{ px: { xs: 1.5, md: 2 }, pb: { xs: 2, md: 3 } }}>
      <DataGrid
        rows={filteredRows}
        columns={columns}
        columnVisibilityModel={columnVisibility}
        getRowId={(row: Expense) => row.id}
        disableRowSelectionOnClick
        autoHeight
        density="compact"
        sx={{
          borderRadius: 2,
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: 'background.paper',
          },
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
            outline: 'none',
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: 'action.hover',
          },
        }}
      />

      {/* Mobile FAB: Add Expense */}
      <Fab
        color="primary"
        aria-label="add-expense"
        onClick={() => setAddOpen(true)}
        sx={{
          position: "fixed",
          bottom: { xs: 16, md: 24 },
          right: { xs: 16, md: 24 },
          display: { xs: "flex", md: "flex", lg: "none" },
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <AddIcon />
      </Fab>

      <AddExpenseDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(e) => setSelected(e)}
      />

      {selected && (
        <EditExpenseDrawer
          open={editOpen}
          onClose={() => setEditOpen(false)}
          record={selected}
          onUpdated={(e) => setSelected(e)}
        />
      )}

      <DeleteExpenseDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        record={selected}
        onDeleted={() => setSelected(null)}
      />

      <ExpenseDetailsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        record={selected}
        employeeFullName={employeeFullName}
        onEdit={(rec) => handleEdit(rec)}
        onDelete={(rec) => handleDelete(rec)}
      />
      </Box>
    </List>
  );
};

export default ExpensesListPage;
