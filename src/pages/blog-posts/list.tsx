import { Typography } from "@mui/material";
import { Drawer, Box, Stack, TextField, Divider, CircularProgress, IconButton, Button } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlined from "@mui/icons-material/EditOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { DataGrid, type GridColDef, type GridColumnVisibilityModel } from "@mui/x-data-grid";
import { useMany, useCreate, useUpdate, useInvalidate } from "@refinedev/core";
import {
  DateField,
  DeleteButton,
  List,
  ShowButton,
  useDataGrid,
} from "@refinedev/mui";
import React from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

type BlogPostRow = {
  id: number | string;
  title?: string;
  content?: string;
  category?: { id?: string | number } | null;
  status?: string;
  createdAt?: string | Date | null;
};

const DrawerBase: React.FC<{
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  busy?: boolean;
  onSubmit?: () => void;
  submitLabel?: string;
}> = ({ open, title, onClose, children, busy, onSubmit, submitLabel = "Save" }) => {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={busy ? undefined : onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 420, md: "36vw" }, maxWidth: "100vw" } }}
    >
      <Box sx={{ width: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" px={2} py={1.5}>
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={busy ? undefined : onClose}><CloseOutlined /></IconButton>
        </Stack>
        <Divider />
        <Box px={2} py={2}>{children}</Box>
        <Divider />
        <Box px={2} py={1.5} display="flex" justifyContent="flex-end" gap={1.5}>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          {onSubmit && (
            <Button onClick={onSubmit} variant="contained" disabled={busy}>
              {busy ? (<Stack direction="row" alignItems="center" spacing={1}><CircularProgress size={18} /><span>Saving…</span></Stack>) : submitLabel}
            </Button>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

const AddBlogPostDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}> = ({ open, onClose, onCreated }) => {
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const { mutateAsync } = useCreate();
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setTitle("");
      setContent("");
      setBusy(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    try {
      setBusy(true);
      const payload: Record<string, unknown> = {
        title: title.trim(),
        content: content.trim() || null,
      };
      await mutateAsync({ resource: "blog-posts", values: payload });
      await onCreated();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerBase open={open} title="New Post" onClose={onClose} busy={busy} onSubmit={handleSubmit} submitLabel="Create">
      <Stack spacing={2}>
        <TextField label="Title" value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} required fullWidth />
        <TextField label="Content" value={content} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContent(e.target.value)} fullWidth multiline minRows={4} />
      </Stack>
    </DrawerBase>
  );
};

const EditBlogPostDrawer: React.FC<{
  record: BlogPostRow | null;
  onClose: () => void;
  onUpdated: () => void;
}> = ({ record, onClose, onUpdated }) => {
  const open = Boolean(record);
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const { mutateAsync } = useUpdate();
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (record) {
      setTitle(record.title ?? "");
      setContent(record.content ?? "");
      setBusy(false);
    }
  }, [record]);

  const handleSubmit = async () => {
    if (!record) return;
    try {
      setBusy(true);
      const payload: Record<string, unknown> = {
        title: title.trim(),
        content: content.trim() || null,
      };
      await mutateAsync({ resource: "blog-posts", id: record.id, values: payload });
      await onUpdated();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerBase open={open} title="Edit Post" onClose={onClose} busy={busy} onSubmit={handleSubmit} submitLabel="Save">
      <Stack spacing={2}>
        <TextField label="Title" value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} required fullWidth />
        <TextField label="Content" value={content} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContent(e.target.value)} fullWidth multiline minRows={4} />
      </Stack>
    </DrawerBase>
  );
};

export const BlogPostList = () => {
  const { result, dataGridProps } = useDataGrid({});
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("sm"));
  const isMd = useMediaQuery(theme.breakpoints.down("md"));
  const columnVisibility = React.useMemo<GridColumnVisibilityModel>(() => {
    const m: GridColumnVisibilityModel = {};
    if (isSm) {
      m.id = false;
      m.createdAt = false;
    } else if (isMd) {
      m.id = false;
    }
    return m;
  }, [isSm, isMd]);

  const [addOpen, setAddOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState<BlogPostRow | null>(null);
  const invalidate = useInvalidate();

  const {
    result: { data: categories },
    query: { isLoading: categoryIsLoading },
  } = useMany({
    resource: "categories",
    ids:
      ((result?.data as BlogPostRow[] | undefined)?.map((item) => item.category?.id).filter(Boolean) as (string | number)[]) ??
      [],
    queryOptions: {
      enabled: !!result?.data,
    },
  });

  const columns = React.useMemo<GridColDef[]>(
    () => [
      {
        field: "id",
        headerName: "ID",
        type: "number",
        minWidth: 50,
        display: "flex",
        align: "left",
        headerAlign: "left",
      },
      {
        field: "title",
        headerName: "Title",
        minWidth: 200,
        display: "flex",
      },
      {
        field: "content",
        flex: 1,
        headerName: "Content",
        minWidth: 250,
        display: "flex",
        renderCell: function render({ value }) {
          if (!value) return "-";
          return (
            <Typography
              component="p"
              whiteSpace="pre"
              overflow="hidden"
              textOverflow="ellipsis"
            >
              {value}
            </Typography>
          );
        },
      },
      {
        field: "category",
        headerName: "Category",
        minWidth: 160,
        display: "flex",
        valueGetter: (_, row) => {
          const value = row?.category;
          return value;
        },
        renderCell: function render({ value }) {
          return categoryIsLoading ? (
            <>Loading...</>
          ) : (
            categories?.find((item) => item.id === value?.id)?.title
          );
        },
      },
      {
        field: "status",
        headerName: "Status",
        minWidth: 80,
        display: "flex",
      },
      {
        field: "createdAt",
        headerName: "Created at",
        minWidth: 120,
        display: "flex",
        renderCell: function render({ value }) {
          return <DateField value={value} />;
        },
      },
      {
        field: "actions",
        headerName: "Actions",
        align: "right",
        headerAlign: "right",
        minWidth: 120,
        sortable: false,
        display: "flex",
        renderCell: function render({ row }) {
          return (
            <>
              <Stack direction="row" spacing={0.5}>
                <IconButton size="small" aria-label="Edit" onClick={() => setEditOpen(row)}>
                  <EditOutlined fontSize="small" />
                </IconButton>
                <ShowButton hideText recordItemId={row.id} />
                <DeleteButton hideText recordItemId={row.id} />
              </Stack>
            </>
          );
        },
      },
    ],
    [categories, categoryIsLoading]
  );

  return (
    <List
      headerButtons={
        <Stack direction="row" spacing={1}>
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => setAddOpen(true)}>
            Add post
          </Button>
        </Stack>
      }
    >
      <DataGrid
        {...dataGridProps}
        columns={columns}
        columnVisibilityModel={columnVisibility}
        autoHeight
        disableRowSelectionOnClick
        density="compact"
        sx={{
          borderRadius: 2,
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: "background.paper",
          },
        }}
      />
      <AddBlogPostDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={async () => { await invalidate({ resource: "blog-posts", invalidates: ["list"] }); }}
      />
      <EditBlogPostDrawer
        record={editOpen}
        onClose={() => setEditOpen(null)}
        onUpdated={async () => { await invalidate({ resource: "blog-posts", invalidates: ["list"] }); }}
      />
    </List>
  );
};
