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
  "Доктор ФИО": string;
  "Пациент ФИО": string;
  "Услуга ID": string;
  "Услуга"?: string;
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
        let record: Record<string, unknown> | null = null;
        let lastError: unknown = null;
        for (const tableName of ["FullAppointmentsView", "AppointmentsView", "Appointments"]) {
          // 1) Пытаемся отфильтровать по колонке "ID"
          // Запрос к Supabase: получить запись приема по ID из указанной таблицы/представления
          const byId = await supabase
            .schema("public")
            .from(tableName)
            .select("*")
            .eq("ID", id)
            .maybeSingle();

          if (!byId.error && byId.data) {
            record = byId.data as Record<string, unknown>;
            lastError = null;
            break;
          }

          // 2) Если колонки "ID" нет (42703) или запись не найдена — грузим все и фильтруем по альтернативным ключам
          // Запрос к Supabase: получить все записи и искать нужную по альтернативным ключам
          // (если колонки "ID" нет или запись не найдена прямым сравнением)
          const allRes = await supabase
            .schema("public")
            .from(tableName)
            .select("*");

          if (!allRes.error && allRes.data) {
            const candidates = (allRes.data as Array<Record<string, unknown>>) ?? [];
            const keys = ["ID", "Прием ID", "Appointment ID", "Appointment_Id", "Запись ID", "Запись", "id"];
            const found = candidates.find((r) => {
              const rr = r as Record<string, unknown>;
              return keys.some((k) => rr[k] != null && String(rr[k] as unknown) === String(id));
            });
            if (found) {
              record = found;
              lastError = null;
              break;
            }
          } else {
            lastError = allRes.error ?? byId.error ?? lastError;
          }
        }

        if (!record) {
          if (lastError) throw lastError;
          setItem(null);
        } else {
          const d = record as Record<string, unknown>;
          const get = (k: string) => d[k] as unknown;

          const sid = String((get("Услуга ID") as string) ?? "");
          let svcName = String(((get("Название услуги") as string) ?? (get("Услуга") as string) ?? "") || "");
          if (!svcName && sid) {
            for (const tableName of ["Services", "services", "Услуги"]) {
              // Запрос к Supabase: получить название услуги по её ID из таблиц/представлений услуг
              const svc = await supabase
                .schema("public")
                .from(tableName)
                .select("*")
                .or(`ID.eq.${sid},id.eq.${sid}`)
                .maybeSingle();
              if (!svc.error && svc.data) {
                const s = svc.data as Record<string, unknown>;
                svcName = String(
                  s["Название услуги"] ??
                    s["Название"] ??
                    s["Наименование"] ??
                    s["name"] ??
                    s["title"] ??
                    s["service_name"] ??
                    ""
                );
                if (svcName) break;
              }
            }
          }

          const mapped: Appointment = {
            ID: String(
              (d["ID"] ??
                d["Прием ID"] ??
                d["Appointment ID"] ??
                d["Appointment_Id"] ??
                d["Запись ID"] ??
                d["Запись"] ??
                d["id"] ??
                "") as string | number
            ),
            "Дата и время": (get("Дата и время") as string) ?? "",
            "Дата n8n": (get("Дата n8n") as string) ?? "",
            "Доктор ФИО":
              ((d["Доктор ФИО"] as string) ??
                (d["Доктор"] as string) ??
                [d["Доктор Фамилия"], d["Доктор Имя"]].filter(Boolean).join(" ")) || "",
            "Пациент ФИО":
              ((d["Пациент ФИО"] as string) ??
                (d["Пациент"] as string) ??
                [d["Пациент Фамилия"], d["Пациент Имя"]].filter(Boolean).join(" ")) || "",
            "Услуга ID": sid,
            "Услуга": svcName,
            "Заключение ID": (get("Заключение ID") as string) ?? "",
            Статус: (get("Статус") as string) ?? "",
            Ночь: (get("Ночь") as boolean | string | null) ?? false,
            Стоимость: Number((get("Стоимость") as number | string | null) ?? 0),
            Скидка: (get("Скидка") as number | string | null) ?? 0,
            "Итого, сом":
              d["Итого, сом"] != null ? Number(d["Итого, сом"] as number | string) : undefined,
            "Жалобы при обращении": (get("Жалобы при обращении") as string | undefined) ?? undefined,
            "Комментарий администратора": (get("Комментарий администратора") as string | undefined) ?? undefined,
          };
          setItem(mapped);
        }
      } catch (e: unknown) {
        console.error(e);
        const errObj = (typeof e === "object" && e !== null ? e : {}) as {
          message?: string;
          error_description?: string;
          hint?: string;
        };
        const msg =
          errObj.message ??
          errObj.error_description ??
          errObj.hint ??
          (typeof e === "object" ? JSON.stringify(e) : String(e));
        setErrorMsg(msg);
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
                        {item["Пациент ФИО"]}
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
                        <Typography variant="subtitle2">{item["Доктор ФИО"] || "—"}</Typography>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Stack direction="row" alignItems="center" gap={1.25}>
                          <MedicalServicesOutlined color="primary" fontSize="small" />
                          <Typography variant="body2" color="text.secondary">
                            Услуга
                          </Typography>
                        </Stack>
                        <Typography variant="subtitle2">{item["Услуга"] || "—"}</Typography>
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
