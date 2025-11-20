import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router";

export const UnderConstruction: React.FC = () => {
  return (
    <Stack alignItems="center" justifyContent="center" sx={{ minHeight: "60vh", p: 3 }} spacing={2}>
      <Typography variant="h4" textAlign="center">
        Страница еще в разработке
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        Мы работаем над этой функцией. Пожалуйста, загляните позже.
      </Typography>
      <Box>
        <Button component={RouterLink} to="/blog-posts" variant="contained">
          Вернуться назад
        </Button>
      </Box>
    </Stack>
  );
};
