export type Expense = {
  id: number;
  employee_id: string | null;
  name: string;
  cash_amount: number;
  cashless_amount: number;
  total_amount: number;
  comment?: string | null;
  category?: string | null;
  photo?: string | null; // public URL
  created_at: string;
  updated_at: string;
};

export type ExpenseFormValues = {
  employee_id: string | null;
  name: string;
  cash_amount: number;
  cashless_amount: number;
  total_amount: number;
  comment?: string | null;
  category?: string | null;
  photo?: string | null; // existing photo URL (edit mode)
  photoFile?: File | null; // selected file in form
};

export type EmployeesRow = {
  id: string;
  full_name: string;
};

export const coerceNumber = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};
