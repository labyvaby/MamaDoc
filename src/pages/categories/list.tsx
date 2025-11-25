import { DataGrid, type GridColDef, type GridColumnVisibilityModel } from "@mui/x-data-grid";
import {
  DeleteButton,
  EditButton,
  List,
  ShowButton,
  useDataGrid,
} from "@refinedev/mui";
import React from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

export const CategoryList = () => {
  const { dataGridProps } = useDataGrid({});
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("sm"));
  const columnVisibility = React.useMemo<GridColumnVisibilityModel>(() => {
    const m: GridColumnVisibilityModel = {};
    if (isSm) m.id = false;
    return m;
  }, [isSm]);

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
        flex: 1,
        headerName: "Title",
        minWidth: 200,
        display: "flex",
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
    []
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
