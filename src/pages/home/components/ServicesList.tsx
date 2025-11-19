import React from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { formatKGS } from "../../../utility/format";

type ServicesListProps = {
  loading: boolean;
  errorMsg: string | null;
  items: Array<Record<string, unknown>>;
};

export const ServicesList: React.FC<ServicesListProps> = ({ loading, errorMsg, items }) => {
  return (
    <Card variant="outlined">
      <CardHeader
        title={
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="subtitle1">Услуги</Typography>
            <Chip size="small" label={items.length} />
          </Stack>
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
            Нет услуг
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />}>
            {items.map((s, idx) => {
              const name = String(
                s["Название услуги"] ??
                  s["Название"] ??
                  s["Наименование"] ??
                  s["name"] ??
                  s["title"] ??
                  s["service_name"] ??
                  s["id"] ??
                  ""
              );
              const category = String(
                s["Категория"] ?? s["category"] ?? s["group"] ?? s["Сотрудник ID"] ?? ""
              );
              const price = Number(
                s["Стоимость, сом"] ??
                  s["Стоимость"] ??
                  s["price"] ??
                  s["amount"] ??
                  s["cost"] ??
                  0
              );
              const img = String(s["Картинка"] ?? s["image"] ?? s["img"] ?? "");
              const key = String(s["ID"] ?? s["id"] ?? idx);

              return (
                <Box
                  key={key}
                  sx={{
                    px: 2,
                    py: 1.25,
                    "&:hover": { bgcolor: (theme) => theme.palette.action.hover },
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1.5}>
                    <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: 1,
                          bgcolor: (theme) => theme.palette.action.selected,
                          overflow: "hidden",
                          flexShrink: 0,
                        }}
                      >
                        {img ? (
                          <Box
                            component="img"
                            src={img}
                            alt={name}
                            sx={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                        ) : (
                          <Stack width="100%" height="100%" alignItems="center" justifyContent="center">
                            <Typography variant="subtitle2">
                              {(name || "—").slice(0, 1).toUpperCase()}
                            </Typography>
                          </Stack>
                        )}
                      </Box>

                      <Stack sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap>
                          {name || "Без названия"}
                        </Typography>
                        <Stack direction="row" alignItems="center" gap={0.75}>
                          {category ? <Chip size="small" variant="outlined" label={category} /> : null}
                        </Stack>
                      </Stack>
                    </Stack>

                    <Typography variant="subtitle2" color="text.primary" sx={{ whiteSpace: "nowrap" }}>
                      {formatKGS(price)}
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default ServicesList;
