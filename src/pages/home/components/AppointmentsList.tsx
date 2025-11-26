import React from "react";
import { Link as RouterLink } from "react-router";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import FilterListOutlined from "@mui/icons-material/FilterListOutlined";
import CheckCircleOutlineOutlined from "@mui/icons-material/CheckCircleOutlineOutlined";
import HourglassEmptyOutlined from "@mui/icons-material/HourglassEmptyOutlined";

import { formatKGS } from "../../../utility/format";
import type { Appointment } from "../types";

type AppointmentsListProps = {
  titleDate: string; // formatted dd.MM.yyyy
  loading: boolean;
  errorMsg: string | null;
  items: Appointment[];
  onOpenFilters: () => void;
};

export const AppointmentsList: React.FC<AppointmentsListProps> = ({
  titleDate,
  loading,
  errorMsg,
  items,
  onOpenFilters,
}) => {
  return (
    <Card variant="outlined">
      <CardHeader
        title={
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="subtitle1">Приемы сегодня ({titleDate})</Typography>
            <Chip size="small" label={items.length} />
          </Stack>
        }
        action={
          <IconButton onClick={onOpenFilters} aria-label="Фильтры">
            <FilterListOutlined />
          </IconButton>
        }
      />
      <Divider />
      <CardContent sx={{ p: 0, maxHeight: "53vh", overflowY: "auto" }}>
        {loading ? (
          <Typography sx={{ p: 2 }} variant="body2">
            Загрузка…
          </Typography>
        ) : errorMsg ? (
          <Typography sx={{ p: 2 }} variant="body2" color="error">
            Ошибка: {errorMsg}
          </Typography>
        ) : items.length === 0 ? (
          <Typography sx={{ p: 2 }} variant="body2">
            Нет записей
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />}>
            {items.map((a) => (
              <Box
                key={a['Прием ID']}
                component={RouterLink}
                to={`/home/appointments/${a['Прием ID']}`}
                sx={{
                  px: 2,
                  py: 1.25,
                  textDecoration: "none",
                  color: "inherit",
                  "&:hover": { bgcolor: (theme) => theme.palette.action.hover },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                  <Stack>
                    <Typography variant="subtitle2">{a["Дата и время"]}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Пациент: {a["Пациент ФИО"]}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Доктор: {a["Доктор ФИО"]}
                    </Typography>
                    {a["Дата n8n"] && (
                      <Typography variant="caption" color="text.secondary">
                        Дата n8n: {a["Дата n8n"]}
                      </Typography>
                    )}
                  </Stack>
                  <Stack alignItems="flex-end">
                    <Chip
                      label={a.Статус}
                      size="small"
                      color={a.Статус === "Оплачено" ? "success" : a.Статус === "Ожидаем" ? "warning" : "default"}
                      variant={a.Статус === "Со скидкой" ? "outlined" : "filled"}
                      icon={a.Статус === "Оплачено" ? <CheckCircleOutlineOutlined /> : <HourglassEmptyOutlined />}
                    />
                    {(a.Ночь === true || a.Ночь === "true") && (
                      <Chip label="Ночной" size="small" variant="outlined" color="info" sx={{ mt: 0.5 }} />
                    )}
                    <Typography variant="body2" color="text.secondary">
                      Стоимость: {formatKGS(a["Стоимость"] ?? 0)}
                    </Typography>
                    {a["Итого, сом"] != null && (
                      <Typography variant="body2" color="text.secondary">
                        Итого: {formatKGS(a["Итого, сом"] ?? 0)}
                      </Typography>
                    )}
                    {typeof a["Наличные"] !== "undefined" && (
                      <Typography variant="body2" color="text.secondary">
                        Наличные: {formatKGS(a["Наличные"] ?? 0)}
                      </Typography>
                    )}
                    {typeof a["Безналичные"] !== "undefined" && (
                      <Typography variant="body2" color="text.secondary">
                        Безналичные: {formatKGS(a["Безналичные"] ?? 0)}
                      </Typography>
                    )}
                    {typeof a["Долг"] !== "undefined" && (
                      <Typography variant="body2" color="text.secondary">
                        Долг: {formatKGS(a["Долг"] ?? 0)}
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default AppointmentsList;
