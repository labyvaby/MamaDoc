import React from "react";
import { useParams, Link as RouterLink } from "react-router";
import {
  Box,
  Breadcrumbs,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Link,
  Stack,
  Typography,
  Button,
  Grid,
} from "@mui/material";
import ArrowBackIosNewOutlined from "@mui/icons-material/ArrowBackIosNewOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import PersonOutlineOutlined from "@mui/icons-material/PersonOutlineOutlined";
import MedicalServicesOutlined from "@mui/icons-material/MedicalServicesOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import NightlightOutlined from "@mui/icons-material/NightlightOutlined";
import PaidOutlined from "@mui/icons-material/PaidOutlined";
import LocalOfferOutlined from "@mui/icons-material/LocalOfferOutlined";
import CheckCircleOutlineOutlined from "@mui/icons-material/CheckCircleOutlineOutlined";
import HourglassEmptyOutlined from "@mui/icons-material/HourglassEmptyOutlined";

import { SubHeader } from "../../components";
import { supabase } from "../../utility/supabaseClient";
import { formatKGS } from "../../utility/format";

type Appointment = {
  ID: string;
  "Дата и время": string;
  "Дата n8n": string;
  "Доктор ID": string;
  "Пациент ID": string;
  "Услуга ID": string;
  "Заключение ID": string;
  Статус: string;
  Ночь: boolean | string;
  Стоимость: number;
  Скидка: number | string;
  "Итого, сом"?: number;
  "Жалобы при обращении"?: string;
  "Комментарий администратора"?: string;
};

export const AppointmentDetailsPage: React.FC = () => {
  const { id } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [item, setItem] = React.useState<Appointment | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        if (!id) throw new Error("Missing id param");
        const { data, error } = await supabase
          .schema("public")
          .from("Appointments")
          .select(
            '"ID","Дата и время","Дата","Доктор ID","Пациент ID","Статус","Ночь","Стоимость","Итого, сом","Скидка","Жалобы при обращении","Комментарий администратора","Услуга ID","Заключение ID"'
          )
          .eq("ID", id)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          setItem(null);
        } else {
          const mapped: Appointment = {
            ID: String(data["ID"]),
            "Дата и время": data["Дата и время"] ?? "",
            "Дата n8n": data["Дата"] ?? "",
            "Доктор ID": data["Доктор ID"] ?? "",
            "Пациент ID": data["Пациент ID"] ?? "",
            "Услуга ID": data["Услуга ID"] ?? "",
            "Заключение ID": data["Заключение ID"] ?? "",
            Статус: data["Статус"] ?? "",
            Ночь: data["Ночь"] ?? false,
            Стоимость: Number(data["Стоимость"] ?? 0),
            Скидка: data["Скидка"] ?? 0,
            "Итого, сом": data["Итого, сом"] != null ? Number(data["Итого, сом"]) : undefined,
            "Жалобы при обращении": data["Жалобы при обращении"] ?? undefined,
            "Комментарий администратора": data["Комментарий администратора"] ?? undefined,
          };
          setItem(mapped);
        }
      } catch (e: unknown) {
        console.error(e);
        setErrorMsg(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const isNight = item ? item.Ночь === true || item.Ночь === "true" : false;
  const statusColor: "success" | "warning" | "default" =
    item?.Статус === "Оплачено" ? "success" : item?.Статус === "Ожидаем" ? "warning" : "default";
  const statusIcon =
    item?.Статус === "Оплачено" ? <CheckCircleOutlineOutlined fontSize="small" /> : <HourglassEmptyOutlined fontSize="small" />;

  return (
    <Box>
      <SubHeader
        title="Подробнее о приеме"
        actions={
          <Button component={RouterLink} to="/home" variant="text" startIcon={<ArrowBackIosNewOutlined />}>
            Назад
          </Button>
        }
      />

      <Box sx={{ px: 2, py: 2 }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link component={RouterLink} to="/home" underline="hover" color="inherit">
            Главная
          </Link>
          <Typography color="text.primary">Подробнее о приеме</Typography>
        </Breadcrumbs>

        {/* Summary and totals */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Card variant="outlined">
              <CardHeader
                title={
                  loading ? (
                    "Загрузка…"
                  ) : item ? (
                    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                      <Typography variant="h6" component="span">
                        Пациент:
                      </Typography>
                      <Typography variant="h6" component="span">
                        {item["Пациент ID"]}
                      </Typography>
                      <Chip
                        size="small"
                        color={statusColor}
                        variant={item.Статус === "Со скидкой" ? "outlined" : "filled"}
                        label={item.Статус || "—"}
                        icon={statusIcon}
                        sx={{ ml: 1 }}
                      />
                      {isNight && (
                        <Chip
                          size="small"
                          variant="outlined"
                          color="info"
                          label="Ночной"
                          icon={<NightlightOutlined fontSize="small" />}
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Stack>
                  ) : (
                    <Typography variant="h6">Прием не найден</Typography>
                  )
                }
                subheader={
                  item ? (
                    <Stack direction="row" alignItems="center" gap={1}>
                      <CalendarMonthOutlined fontSize="small" />
                      <Typography variant="body2">Дата и время: {item["Дата и время"]}</Typography>
                    </Stack>
                  ) : undefined
                }
              />
              <Divider />
              <CardContent>
                {errorMsg ? (
                  <Typography variant="body2" color="error">
                    Ошибка: {errorMsg}
                  </Typography>
                ) : item ? (
                  <Stack spacing={2}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Stack direction="row" alignItems="center" gap={1.25}>
                          <PersonOutlineOutlined color="primary" fontSize="small" />
                          <Typography variant="body2" color="text.secondary">
                            Доктор
                          </Typography>
                        </Stack>
                        <Typography variant="subtitle2">{item["Доктор ID"] || "—"}</Typography>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Stack direction="row" alignItems="center" gap={1.25}>
                          <MedicalServicesOutlined color="primary" fontSize="small" />
                          <Typography variant="body2" color="text.secondary">
                            Услуга
                          </Typography>
                        </Stack>
                        <Typography variant="subtitle2">{item["Услуга ID"] || "—"}</Typography>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Stack direction="row" alignItems="center" gap={1.25}>
                          <DescriptionOutlined color="primary" fontSize="small" />
                          <Typography variant="body2" color="text.secondary">
                            Заключение
                          </Typography>
                        </Stack>
                        <Typography variant="subtitle2">{item["Заключение ID"] || "—"}</Typography>
                      </Grid>
                    </Grid>

                    {item["Жалобы при обращении"] && (
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Жалобы при обращении
                        </Typography>
                        <Typography variant="body2">{item["Жалобы при обращении"]}</Typography>
                      </Box>
                    )}

                    {item["Комментарий администратора"] && (
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Комментарий администратора
                        </Typography>
                        <Typography variant="body2">{item["Комментарий администратора"]}</Typography>
                      </Box>
                    )}
                  </Stack>
                ) : null}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card
              variant="outlined"
              sx={{
                borderColor: "transparent",
                color: "primary.contrastText",
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.palette.success.light}, ${theme.palette.success.main})`,
              }}
            >
              <CardHeader
                title={
                  <Stack direction="row" alignItems="center" gap={1.25}>
                    <PaidOutlined />
                    <Typography variant="h6">Итого</Typography>
                  </Stack>
                }
              />
              <Divider sx={{ borderColor: "rgba(255,255,255,0.35)" }} />
              <CardContent>
                {item ? (
                  <Stack spacing={1.5}>
                    <Typography variant="h4">
                      {formatKGS(item["Итого, сом"] ?? item["Стоимость"])}
                    </Typography>
                    {Number(item.Скидка) ? (
                      <Chip
                        size="small"
                        color="info"
                        variant="outlined"
                        icon={<LocalOfferOutlined />}
                        label={`Скидка: ${item.Скидка}`}
                        sx={{
                          color: "inherit",
                          borderColor: "rgba(255,255,255,0.6)",
                          "& .MuiChip-icon": { color: "inherit" },
                        }}
                      />
                    ) : null}
                    {item["Дата n8n"] && (
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        Дата расчета: {item["Дата n8n"]}
                      </Typography>
                    )}
                  </Stack>
                ) : (
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Нет данных
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default AppointmentDetailsPage;
