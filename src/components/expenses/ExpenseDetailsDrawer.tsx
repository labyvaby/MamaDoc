import React from "react";
import {
  Box,
  Button,
  Divider,
  Drawer,
  Grid,
  Stack,
  Typography,
  Avatar,
} from "@mui/material";
import type { Expense } from "../../pages/expenses/types";
import { formatKGS } from "../../utility/format";

type ExpenseDetailsDrawerProps = {
  open: boolean;
  onClose: () => void;
  record: Expense | null;
  employeeFullName?: string | null;
  onEdit?: (record: Expense) => void;
  onDelete?: (record: Expense) => void;
};

export const ExpenseDetailsDrawer: React.FC<ExpenseDetailsDrawerProps> = ({
  open,
  onClose,
  record,
  employeeFullName,
  onEdit,
  onDelete,
}) => {
  if (!record) {
    return (
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: "100vw", sm: 420, md: "30vw" } } }}
      >
        <Box sx={{ width: 1, minWidth: 320 }} p={{ xs: 1.5, md: 2 }}>
          <Typography variant="h6">Нет данных</Typography>
        </Box>
      </Drawer>
    );
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100vw", sm: 420, md: "30vw" } } }}
    >
      <Box sx={{ width: 1, minWidth: 320 }} p={{ xs: 1.5, md: 2 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          p={{ xs: 1.5, md: 2 }}
          sx={{ borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}
        >
          <Typography variant="h6">Детали расхода</Typography>
          <Stack direction="row" spacing={1.25}>
            <Button variant="outlined" onClick={() => onEdit?.(record)}>Редактировать</Button>
            <Button variant="outlined" color="error" onClick={() => onDelete?.(record)}>Удалить</Button>
          </Stack>
        </Stack>

        <Divider sx={{ my: { xs: 1.5, md: 2 } }} />

        <Stack spacing={2}>
          {record.photo ? (
            <Avatar
              variant="rounded"
              src={record.photo}
              sx={{ width: "100%", height: 200 }}
            />
          ) : (
            <Box
              sx={{
                width: "100%",
                height: 200,
                bgcolor: "action.hover",
                borderRadius: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography variant="body2" color="text.secondary">Фото отсутствует</Typography>
            </Box>
          )}

          <Grid container spacing={{ xs: 1.25, md: 1.5 }}>
            <Grid item xs={5}>
              <Typography variant="body2" color="text.secondary">Название</Typography>
            </Grid>
            <Grid item xs={7}>
              <Typography variant="body1">{record.name}</Typography>
            </Grid>

            <Grid item xs={5}>
              <Typography variant="body2" color="text.secondary">Категория</Typography>
            </Grid>
            <Grid item xs={7}>
              <Typography variant="body1">{record.category ?? "-"}</Typography>
            </Grid>

            <Grid item xs={5}>
              <Typography variant="body2" color="text.secondary">Наличные</Typography>
            </Grid>
            <Grid item xs={7}>
              <Typography variant="body1">{formatKGS(record.cash_amount)}</Typography>
            </Grid>

            <Grid item xs={5}>
              <Typography variant="body2" color="text.secondary">Безнал</Typography>
            </Grid>
            <Grid item xs={7}>
              <Typography variant="body1">{formatKGS(record.cashless_amount)}</Typography>
            </Grid>

            <Grid item xs={5}>
              <Typography variant="body2" color="text.secondary">Итого</Typography>
            </Grid>
            <Grid item xs={7}>
              <Typography variant="body1">{formatKGS(record.total_amount)}</Typography>
            </Grid>

            <Grid item xs={5}>
              <Typography variant="body2" color="text.secondary">Сотрудник</Typography>
            </Grid>
            <Grid item xs={7}>
              <Typography variant="body1">{employeeFullName ?? "-"}</Typography>
            </Grid>

            <Grid item xs={5}>
              <Typography variant="body2" color="text.secondary">Комментарий</Typography>
            </Grid>
            <Grid item xs={7}>
              <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>{record.comment ?? "-"}</Typography>
            </Grid>


          </Grid>
        </Stack>
      </Box>
    </Drawer>
  );
};
