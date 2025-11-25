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
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useDelete, useInvalidate } from "@refinedev/core";
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
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

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

      if (onDeleted) onDeleted(record.id);
      onClose();
    } catch (e: unknown) {
      // eslint-disable-next-line no-console
      console.error("Delete expense failed:", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" fullScreen={fullScreen}>
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
