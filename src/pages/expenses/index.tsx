import React from "react";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { List } from "@refinedev/mui";
import { Stack, Button } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import { useDataGrid } from "@refinedev/mui";
import { formatKGS } from "../../utility/format";
import type { Expense } from "./types";
import AddExpenseDrawer from "../../components/expenses/AddExpenseDrawer";
import { EditExpenseModal } from "../../components/expenses/EditExpenseModal";
import { DeleteExpenseDialog } from "../../components/expenses/DeleteExpenseDialog";
import { ExpenseDetailsDrawer } from "../../components/expenses/ExpenseDetailsDrawer";
import { supabase } from "../../utility/supabaseClient";

const ActionsCell: React.FC<{
  row: Expense;
  onView: (e: Expense) => void;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}> = ({ row, onView, onEdit, onDelete }) => {

  return (
    <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ width: "100%" }}>
      <Button size="small" variant="text" startIcon={<VisibilityOutlined />} onClick={() => onView(row)}>
        Просмотр
      </Button>
      <Button size="small" variant="text" startIcon={<EditOutlined />} onClick={() => onEdit(row)}>
        Редактировать
      </Button>
      <Button size="small" color="error" variant="text" startIcon={<DeleteOutline />} onClick={() => onDelete(row)}>
        Удалить
      </Button>
    </Stack>
  );
};

const ExpensesListPage: React.FC = () => {
  const { dataGridProps } = useDataGrid<Expense>({
    resource: "expenses",
    syncWithLocation: false,
  });


  const isExpense = (r: unknown): r is Expense =>
    typeof r === "object" && r !== null && "id" in r;

  const safeRows: Expense[] =
    Array.isArray((dataGridProps as unknown as { rows?: unknown })?.rows)
      ? ((dataGridProps as unknown as { rows?: unknown }).rows as unknown[]).filter(isExpense)
      : [];

  // Нормализуем значения, чтобы DataGrid не получал null/undefined и не падал
  const normalizedRows: Expense[] = safeRows.map((r) => ({
    id: Number((r as unknown as Record<string, unknown>).id ?? 0),
    employee_id: ((r as unknown as Record<string, unknown>).employee_id ?? null) as string | null,
    name: String((r as unknown as Record<string, unknown>).name ?? ""),
    cash_amount: Number((r as unknown as Record<string, unknown>).cash_amount ?? 0),
    cashless_amount: Number((r as unknown as Record<string, unknown>).cashless_amount ?? 0),
    total_amount: Number(
      (r as unknown as Record<string, unknown>).total_amount ??
        Number((r as unknown as Record<string, unknown>).cash_amount ?? 0) +
          Number((r as unknown as Record<string, unknown>).cashless_amount ?? 0),
    ),
    comment: ((r as unknown as Record<string, unknown>).comment ?? null) as string | null,
    category: ((r as unknown as Record<string, unknown>).category ?? null) as string | null,
    photo: ((r as unknown as Record<string, unknown>).photo ?? null) as string | null,
    created_at: String((r as unknown as Record<string, unknown>).created_at ?? ""),
    updated_at: String((r as unknown as Record<string, unknown>).updated_at ?? ""),
  }));

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
      const { data, error } = await supabase
        .from("employees")
        .select("full_name")
        .eq("id", rec.employee_id)
        .maybeSingle();
      if (!error && data?.full_name) {
        setEmployeeFullName(data.full_name);
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

  const columns = React.useMemo<GridColDef[]>(
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
        field: "category",
        headerName: "Категория",
        flex: 0.6,
        minWidth: 140,
        renderCell: ({ row }) => row.category ?? "-",
      },
      {
        field: "cash_amount",
        headerName: "Наличные",
        minWidth: 120,
        valueFormatter: (params) => formatKGS(Number((params as any)?.value ?? 0)),
      },
      {
        field: "cashless_amount",
        headerName: "Безнал",
        minWidth: 120,
        valueFormatter: (params) => formatKGS(Number((params as any)?.value ?? 0)),
      },
      {
        field: "total_amount",
        headerName: "Итого",
        minWidth: 120,
        valueFormatter: (params) => formatKGS(Number((params as any)?.value ?? 0)),
      },
      {
        field: "created_at",
        headerName: "Создано",
        minWidth: 180,
        valueFormatter: (params) =>
          (params && (params as any).value) ? new Date(String((params as any).value)).toLocaleString("ru-RU") : "-",
      },
      {
        field: "actions",
        headerName: "Действия",
        align: "right",
        headerAlign: "right",
        sortable: false,
        minWidth: 280,
        renderCell: (params) => (
          <ActionsCell
            row={params.row}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ),
      },
    ],
    [handleView, handleEdit, handleDelete]
  );

  return (
    <List
      headerButtons={
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setAddOpen(true)}>
          Добавить расход
        </Button>
      }
    >
      <DataGrid
        rows={normalizedRows}
        columns={columns}
        getRowId={(row: Expense) => row.id}
        disableRowSelectionOnClick
        autoHeight
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
