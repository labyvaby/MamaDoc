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
} from "@mui/material";
import ArrowBackIosNewOutlined from "@mui/icons-material/ArrowBackIosNewOutlined";
import { SubHeader } from "../../components";

const appointmentsUrl = new URL("../../mock/appointments.json", import.meta.url).toString();

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

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch(appointmentsUrl);
        const json: Appointment[] = await res.json();
        const found = json.find((a) => a.ID === id) || null;
        setItem(found);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <Box>
      <SubHeader
        title="Подробнее о приеме"
        actions={
          <Button component={RouterLink} to="/home" variant="text" startIcon={<ArrowBackIosNewOutlined />}>Назад</Button>
        }
      />

      <Box sx={{ px: 2, py: 2 }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link component={RouterLink} to="/home" underline="hover" color="inherit">
            Главная
          </Link>
          <Typography color="text.primary">Подробнее о приеме</Typography>
        </Breadcrumbs>

        <Stack spacing={2} maxWidth={900}>
          <Card variant="outlined">
            <CardHeader
              title={
                loading ? "Загрузка…" : item ? (
                  <Typography variant="h6">
                    Пациент: {item["Пациент ID"]}
                  </Typography>
                ) : (
                  <Typography variant="h6">Прием не найден</Typography>
                )
              }
              subheader={item ? `Дата и время: ${item["Дата и время"]}` : undefined}
            />
            <Divider />
            <CardContent>
              {item && (
                <Stack spacing={1.5}>
                  {item["Жалобы при обращении"] && (
                    <Typography variant="body2" color="text.secondary">
                      Жалобы: {item["Жалобы при обращении"]}
                    </Typography>
                  )}
                  {item["Комментарий администратора"] && (
                    <Typography variant="body2" color="text.secondary">
                      Комментарий: {item["Комментарий администратора"]}
                    </Typography>
                  )}

                  <Stack direction="row" alignItems="center" gap={1}>
                    <Typography variant="body2" color="text.secondary">Статус:</Typography>
                    <Chip
                      size="small"
                      label={item.Статус}
                      color={item.Статус === "Оплачено" ? "success" : item.Статус === "Ожидаем" ? "warning" : "default"}
                      variant={item.Статус === "Со скидкой" ? "outlined" : "filled"}
                    />
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    Доктор: {item["Доктор ID"]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Услуга: {item["Услуга ID"]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Заключение: {item["Заключение ID"]}
                  </Typography>
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader title="Итого, сом" />
            <Divider />
            <CardContent>
              {item && (
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography variant="h6">{(item["Итого, сом"] ?? item["Стоимость"]) || 0} сом</Typography>
                  {Number(item.Скидка) ? (
                    <Chip size="small" variant="outlined" color="info" label={`Скидка: ${item.Скидка}`} />
                  ) : null}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  );
};

export default AppointmentDetailsPage;
