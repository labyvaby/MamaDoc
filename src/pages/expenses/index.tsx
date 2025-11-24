import React from "react";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import { List } from "@refinedev/mui";
import { Stack, Button, TextField, IconButton, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText, Divider, Chip } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import AddIcon from "@mui/icons-material/Add";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import MoreVert from "@mui/icons-material/MoreVert";
import { useDataGrid } from "@refinedev/mui";
import { formatKGS } from "../../utility/format";
import type { Expense, EmployeesRow } from "./types";
import AddExpenseDrawer from "../../components/expenses/AddExpenseDrawer";
import { EditExpenseModal } from "../../components/expenses/EditExpenseModal";
import { DeleteExpenseDialog } from "../../components/expenses/DeleteExpenseDialog";
import { ExpenseDetailsDrawer } from "../../components/expenses/ExpenseDetailsDrawer";
import { supabase } from "../../utility/supabaseClient";
import { fetchEmployees } from "../../services/employees";

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

  type ExpenseCategory = {
    id: string;
    name: string;
  };

  // Helpers to avoid any: robust id and name extraction
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
  const [employeeFilter, setEmployeeFilter] = React.useState<string>("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  // Кэш имён сотрудников по id, подгружаем по мере необходимости (если общий список недоступен из-за RLS)
  const [nameCache, setNameCache] = React.useState<Map<string, string>>(new Map());

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Fast path: unified employees fetch via service
      try {
        const [emps, catRes2] = await Promise.all([
          fetchEmployees(),
          supabase.from("expense_category").select("id, name"),
        ]);
        const cats2: { id: string; name: string }[] = [];
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
      const [empRes1, empRes2, empRes3, catRes] = await Promise.all([
        supabase
          .from("employees")
          .select("*"),
        supabase
          .from("Employes")
          .select("*"),
        supabase
          .from("Employes")
          .select("*"),
        supabase.from("expense_category").select("id, name"),
      ]);

      const nameById = new Map<string, string>();

      const considerEmp = (rec: unknown) => {
        if (typeof rec !== "object" || rec === null) return;
        const r = rec as Record<string, unknown>;
        const id = getIdFrom(r);
        if (!id) return;
        const name = getNameFrom(r);
        if (name.length > 0) {
          nameById.set(id, name);
        } else if (!nameById.has(id)) {
          nameById.set(id, "");
        }
      };

      if (Array.isArray(empRes1?.data)) {
        for (const e of empRes1.data as unknown[]) considerEmp(e);
      }
      if (Array.isArray(empRes2?.data)) {
        for (const e of empRes2.data as unknown[]) considerEmp(e);
      }
      if (Array.isArray(empRes3?.data)) {
        for (const e of empRes3.data as unknown[]) considerEmp(e);
      }

      const mergedEmployees: EmployeesRow[] = Array.from(nameById, ([id, full_name]) => ({
        id,
        full_name: typeof full_name === "string" && full_name.trim().length > 0 ? full_name : id,
      }));

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
            .select("id, fullName, full_name, name, first_name, last_name, fio")
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
                const idVal = o.id;
                const id = typeof idVal === "string" ? idVal : typeof idVal === "number" ? String(idVal) : "";
                if (!id || seen2.has(id)) continue;

                const pref = ["full_name", "fullName", "fio", "name", "first_name", "last_name"];
                let cand = "";
                for (const p of pref) {
                  const v = o[p];
                  if (typeof v === "string" && v.trim().length > 0) { cand = v.trim(); break; }
                }
                if (!cand) {
                  const fa = o["first_name"];
                  const fb = o["last_name"];
                  const combined = `${typeof fa === "string" ? fa.trim() : ""}${(typeof fa === "string" && fa && typeof fb === "string" && fb) ? " " : ""}${typeof fb === "string" ? fb.trim() : ""}`.trim();
                  cand = combined;
                }
                if (!cand) {
                  for (const k of Object.keys(o)) {
                    const v = o[k];
                    if (typeof v === "string" && /name|fio/i.test(k) && v.trim().length > 0) { cand = v.trim(); break; }
                  }
                }
                mapped.push({ id, full_name: cand || id });
                seen2.add(id);
              }
              if (mapped.length > 0) { finalEmployees = mapped; break; }
            }
          }
        }
      } catch {
        // ignore
      }

      // Fallback: если ничего не нашли, пробуем получить только тех сотрудников, чьи ID реально встречаются в расходах.
      // Это полезно при строгом RLS, когда list запрещён, но выборка по конкретному id разрешена.
      if (finalEmployees.length === 0) {
        try {
          const ids = Array.from(
            new Set(
              normalizedRows
                .map((r) => r.employee_id)
                .filter((v): v is string => typeof v === "string" && v.trim().length > 0),
            ),
          );

          if (ids.length > 0) {
            const tables = ["employees", "Employes", "employee", "Employee", "profiles", "Profiles", "users", "staff", "Staff", "people", "Persons", "persons", "People"];
            const collected: EmployeesRow[] = [];
            const seenIds = new Set<string>();

            for (const id of ids) {
              let name: string | null = null;

              for (const t of tables) {
                try {
                  const { data, error } = await supabase
                    .from(t)
                    .select("*")
                    .eq("id", id)
                    .maybeSingle();

                  if (!error && data) {
                    const d = data as Record<string, unknown>;
                    const f1 = d["full_name"];
                    const f2 = d["fullName"];
                    const f3 = d["name"];
                    const f4 = d["fio"];
                    const fa = d["first_name"];
                    const fb = d["last_name"];
                    const combined = `${typeof fa === "string" ? fa.trim() : ""}${
                      (typeof fa === "string" && fa && typeof fb === "string" && fb) ? " " : ""
                    }${typeof fb === "string" ? fb.trim() : ""}`.trim();

                    const candidates = [f1, f2, f3, f4, combined].filter(
                      (s): s is string => typeof s === "string" && s.trim().length > 0,
                    );
                    if (candidates.length > 0) {
                      name = candidates[0];
                      break;
                    }
                  }
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

      // Basic last-resort fallback: построить список по employee_id из расходов,
      // если ничего не смогли получить из Supabase (полезно при строгом RLS).
      if (finalEmployees.length === 0) {
        const ids = Array.from(
          new Set(
            normalizedRows
              .map((r) => r.employee_id)
              .filter((v): v is string => typeof v === "string" && v.trim().length > 0),
          ),
        );
        if (ids.length > 0) {
          finalEmployees = ids.map((id) => ({ id, full_name: id }));
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
  }, [normalizedRows]);

  // Догружаем имена сотрудников точечно для тех employee_id, которые присутствуют в расходах,
  // если они не пришли в общем списке (обход и/или дополнение при строгих RLS).
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
        const fa = d["first_name"];
        const fb = d["last_name"];
        const combined = `${typeof fa === "string" ? fa.trim() : ""}${
          (typeof fa === "string" && fa && typeof fb === "string" && fb) ? " " : ""
        }${typeof fb === "string" ? fb.trim() : ""}`.trim();
        const candidates = [f1, f2, f3, f4, combined].filter(
          (s): s is string => typeof s === "string" && s.trim().length > 0,
        );
        return candidates[0] ?? null;
      }
      return null;
    };

    const loadOneByOne = async () => {
      for (const id of missingIds) {
        // пробуем несколько вероятных таблиц
        const name =
          (await tryFetchName("employees", id)) ??
          (await tryFetchName("Employes", id)) ??
          (await tryFetchName("employee", id)) ??
          (await tryFetchName("Employee", id)) ??
          (await tryFetchName("profiles", id)) ??
          (await tryFetchName("Profiles", id)) ??
          (await tryFetchName("users", id)) ??
          (await tryFetchName("staff", id)) ??
          (await tryFetchName("Staff", id)) ??
          (await tryFetchName("people", id)) ??
          (await tryFetchName("Persons", id)) ??
          (await tryFetchName("persons", id)) ??
          (await tryFetchName("People", id));

        if (!cancelled) {
          if (name) {
            setNameCache((prev) => {
              const m = new Map(prev);
              if (!m.has(id)) m.set(id, name);
              return m;
            });
          } else {
            // сохранём хотя бы id, чтобы в таблице не был пустой столбец
            setNameCache((prev) => {
              const m = new Map(prev);
              if (!m.has(id)) m.set(id, id);
              return m;
            });
          }
        }
      }
    };

    if (missingIds.length > 0) {
      loadOneByOne();
    }

    return () => {
      cancelled = true;
    };
  }, [normalizedRows, employees, nameCache, supabase]);

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

  const employeeOptions = React.useMemo<EmployeesRow[]>(() => {
    const map = new Map<string, string>();
    for (const e of employees) map.set(e.id, e.full_name);
    for (const [id, name] of nameCache) if (!map.has(id)) map.set(id, name);
    const arr = Array.from(map, ([id, full_name]) => ({ id, full_name }));
    arr.sort((a, b) => (a.full_name || a.id).localeCompare(b.full_name || b.id, "ru", { sensitivity: "base" }));
    return arr;
  }, [employees, nameCache]);

  const filteredRows: Expense[] = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return normalizedRows.filter((r) => {
      if (employeeFilter && r.employee_id !== employeeFilter) return false;
      if (categoryFilter && (r.category ?? "") !== categoryFilter) return false;
      if (q) {
        const name = r.name.toLowerCase();
        const comment = (r.comment ?? "").toLowerCase();
        const category = (r.category ?? "").toLowerCase();
        const empName = (employeeNameById.get(r.employee_id ?? "") ?? "").toLowerCase();
        return name.includes(q) || comment.includes(q) || category.includes(q) || empName.includes(q);
      }
      return true;
    });
  }, [normalizedRows, employeeFilter, categoryFilter, searchQuery, employeeNameById]);

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
      const tryFetch = async (table: string) => {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .or(`id.eq.${rec.employee_id},ID.eq.${rec.employee_id}`)
          .maybeSingle();
        if (!error && data) {
          const d = data as Record<string, unknown>;
          const nm = getNameFrom(d);
          return nm || null;
        }
        return null;
      };

      const name =
        (await tryFetch("employees")) ??
        (await tryFetch("Employes")) ??
        (await tryFetch("Employes"));

      if (name) setEmployeeFullName(name);
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
        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
          <TextField
            size="small"
            label="Поиск"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          />
          <Autocomplete<EmployeesRow, false, false, false>
            size="small"
            options={employeeOptions}
            noOptionsText=""
            value={employeeOptions.find((e) => e.id === employeeFilter) ?? null}
            getOptionLabel={(option) => option.full_name || option.id}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            onChange={(_e, newValue) => setEmployeeFilter(newValue?.id ?? "")}
            renderInput={(params) => <TextField {...params} label="Сотрудник" />}
            sx={{ minWidth: 220 }}
          />
          <Autocomplete<{ id: string; name: string }, false, false, false>
            size="small"
            options={categories}
            noOptionsText=""
            value={categories.find((c) => c.name === categoryFilter) ?? null}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            onChange={(_e, newValue) => setCategoryFilter(newValue?.name ?? "")}
            renderInput={(params) => <TextField {...params} label="Категория" />}
            sx={{ minWidth: 200 }}
          />
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => setAddOpen(true)}>
            Добавить расход
          </Button>
        </Stack>
      }
    >
      <DataGrid
        rows={filteredRows}
        columns={columns}
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

      <AddExpenseDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(e) => setSelected(e)}
      />

      {selected && (
        <EditExpenseModal
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
    </List>
  );
};

export default ExpensesListPage;
