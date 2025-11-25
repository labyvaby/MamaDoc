import { Typography } from "@mui/material";
import { DataGrid, type GridColDef, type GridColumnVisibilityModel } from "@mui/x-data-grid";
import { useMany } from "@refinedev/core";
import {
  DateField,
  DeleteButton,
  EditButton,
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
              <EditButton hideText recordItemId={row.id} />
              <ShowButton hideText recordItemId={row.id} />
              <DeleteButton hideText recordItemId={row.id} />
            </>
          );
        },
      },
    ],
    [categories, categoryIsLoading]
  );

  return (
    <List>
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
    </List>
  );
};
