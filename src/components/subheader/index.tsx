import React from "react";
import { Box, Stack, Typography } from "@mui/material";

export type SubHeaderProps = {
  title: string;
  actions?: React.ReactNode;
};

export const SubHeader: React.FC<SubHeaderProps> = ({ title, actions }) => {
  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        bgcolor: (theme) => theme.palette.background.paper,
        position: "sticky",
        top: 0,
        zIndex: (theme) => theme.zIndex.appBar - 1,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
        <Typography variant="h6">{title}</Typography>
        {actions && <Box>{actions}</Box>}
      </Stack>
    </Box>
  );
};
