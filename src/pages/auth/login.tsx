import React from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Stack,
  TextField,
  Button,
  Typography,
  Alert,
  Divider,
  IconButton,
  InputAdornment,
} from "@mui/material";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import FavoriteBorderOutlined from "@mui/icons-material/FavoriteBorderOutlined";
import { supabase } from "../../utility/supabaseClient";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = params.get("to") || "/home";

  const [mode, setMode] = React.useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [infoMsg, setInfoMsg] = React.useState<string | null>(null);

  // Если уже есть сессия — редиректим
  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          navigate(redirectTo, { replace: true });
        }
      } catch {
        // ignore
      }
    })();
  }, [navigate, redirectTo]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      if (!email.trim() || !password) {
        setErrorMsg("Введите email и пароль");
        return;
      }

      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        navigate(redirectTo, { replace: true });
      } else {
        // sign-up
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (data.user && !data.session) {
          // В проекте может быть включено подтверждение по email
          setInfoMsg("Регистрация успешна. Проверьте почту для подтверждения.");
        } else {
          navigate(redirectTo, { replace: true });
        }
      }
    } catch (err) {
      const msg =
        (typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: unknown }).message)
          : null) || "Ошибка аутентификации";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === "sign-in" ? "sign-up" : "sign-in"));
    setErrorMsg(null);
    setInfoMsg(null);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        px: 2,
      }}
    >
      <Card variant="outlined" sx={{ width: "100%", maxWidth: 420 }}>
        <CardHeader
          title={
            <Stack direction="row" alignItems="center" gap={1}>
              <FavoriteBorderOutlined color="primary" />
              <Typography variant="h6">Мама Доктор</Typography>
            </Stack>
          }
          subheader={
            mode === "sign-in" ? "Вход в систему" : "Регистрация нового пользователя"
          }
        />
        <Divider />
        <CardContent>
          <Stack component="form" onSubmit={onSubmit} spacing={2}>
            {errorMsg ? <Alert severity="error">{errorMsg}</Alert> : null}
            {infoMsg ? <Alert severity="info">{infoMsg}</Alert> : null}

            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              required
              fullWidth
              autoFocus
            />

            <TextField
              label="Пароль"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPassword(e.target.value)
              }
              required
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPw ? "Скрыть пароль" : "Показать пароль"}
                      onClick={() => setShowPw((s) => !s)}
                      edge="end"
                    >
                      {showPw ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              fullWidth
            >
              {loading
                ? "Подождите…"
                : mode === "sign-in"
                ? "Войти"
                : "Зарегистрироваться"}
            </Button>

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Button
                type="button"
                variant="text"
                onClick={toggleMode}
                disabled={loading}
              >
                {mode === "sign-in"
                  ? "Создать аккаунт"
                  : "У меня уже есть аккаунт"}
              </Button>
            </Stack>

            {/* Пример места для провайдеров OAuth (если подключите их в проекте Supabase):
            <Divider>или</Divider>
            <Button
              variant="outlined"
              onClick={() => supabase.auth.signInWithOAuth({ provider: "google" })}
            >
              Войти через Google
            </Button>
            */}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;
