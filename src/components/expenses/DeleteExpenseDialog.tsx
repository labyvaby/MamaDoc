import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  CircularProgress,
} from "@mui/material";
import { useDelete, useInvalidate, useNotification } from "@refinedev/core";
import type { Expense } from "../../pages/expenses/types";
import { deleteExpensePhotoByUrl } from "../../services/storage";

type DeleteExpenseDialogProps = {
  open: boolean;
  onClose: () => void;
  record: Expense | null;
  onDeleted?: (id: number) => void;
};

export const DeleteExpenseDialog: React.FC<DeleteExpenseDialogProps> = ({
  open,
  onClose,
  record,
  onDeleted,
}) => {
  const { mutateAsync: deleteAsync } = useDelete();
  const [busy, setBusy] = React.useState(false);
  const invalidate = useInvalidate();
  const { open: notify } = useNotification();

  const handleDelete = async () => {
    if (!record) return;
    try {
      setBusy(true);

      // Delete DB row
      await deleteAsync({
        resource: "expenses",
        id: record.id,
      });

      // Best-effort delete photo from storage (non-blocking for UX)
      if (record.photo) {
        try {
          await deleteExpensePhotoByUrl(record.photo);
        } catch {
          // ignore storage deletion errors
        }
      }

      await invalidate({
        resource: "expenses",
        invalidates: ["list", "detail"],
      });

      notify?.({
        type: "success",
        message: "Расход удалён",
        description: record.name,
      });

      if (onDeleted) onDeleted(record.id);
      onClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      notify?.({
        type: "error",
        message: "Ошибка при удалении",
        description: message || "Неизвестная ошибка",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Удалить расход</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Действительно удалить расход{record ? ` “${record.name}”` : ""}? Это действие необратимо.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Отмена</Button>
        <Button onClick={handleDelete} color="error" variant="contained" disabled={busy}>
          {busy ? (
            <Stack direction="row" alignItems="center" spacing={1}>
              <CircularProgress size={18} />
              <span>Удаление…</span>
            </Stack>
          ) : (
            "Удалить"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
