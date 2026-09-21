"use strict";
import React from "react";
import { EmptyRow } from "./ui.js";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

// Generic sortable, paginated table. `columns` is [{ key, label, numeric, sortable,
// sortValue(row) -> comparable, render(row) -> node|string }]. Sorting and pagination are
// both client-side over the `rows` already handed to it (matches how this app loads data --
// full tables into state, then filters/derives in memory), so this stays a thin
// presentation layer rather than a second data-fetching path.
export function DataTable({ columns, rows, rowKey, onRowClick, emptyMessage, defaultSortKey, defaultSortDir = "asc", pageSize: initialPageSize = 25 }) {
  const [sortKey, setSortKey] = React.useState(defaultSortKey ?? null);
  const [sortDir, setSortDir] = React.useState(defaultSortDir);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(initialPageSize);

  const sortCol = columns.find((c) => c.key === sortKey);
  const sorted = React.useMemo(() => {
    if (!sortCol) return rows;
    const valueOf = sortCol.sortValue || ((r) => r[sortCol.key]);
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = valueOf(a), bv = valueOf(b);
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return av > bv ? 1 : -1;
    });
    if (sortDir === "desc") copy.reverse();
    return copy;
  }, [rows, sortCol, sortDir]);

  React.useEffect(() => { setPage(0); }, [rows, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize);

  function toggleSort(col) {
    if (!col.sortable) return;
    if (sortKey === col.key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(col.key); setSortDir("asc"); }
  }

  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "table-wrap" },
      React.createElement("table", null,
        React.createElement("thead", null, React.createElement("tr", null,
          columns.map((c) => React.createElement("th", {
            key: c.key, className: (c.numeric ? "num " : "") + (c.sortable ? "th-sortable" : ""),
            onClick: () => toggleSort(c),
          }, c.label, c.sortable && sortKey === c.key ? (sortDir === "asc" ? " ↑" : " ↓") : "")))),
        React.createElement("tbody", null,
          pageRows.length === 0 && React.createElement(EmptyRow, { colSpan: columns.length }, emptyMessage || "No rows to show."),
          pageRows.map((row) => React.createElement("tr", {
            key: rowKey(row), className: onRowClick ? "clickable" : undefined, onClick: onRowClick ? () => onRowClick(row) : undefined,
          }, columns.map((c) => React.createElement("td", { key: c.key, className: c.numeric ? "num" : undefined }, c.render ? c.render(row) : row[c.key])))))),
    ),
    sorted.length > 0 && React.createElement("div", { className: "table-pagination" },
      React.createElement("div", { className: "table-pagination-info" },
        clampedPage * pageSize + 1, "–", Math.min(sorted.length, (clampedPage + 1) * pageSize), " of ", sorted.length),
      React.createElement("select", { className: "field-input filter-input", value: pageSize, onChange: (e) => setPageSize(Number(e.target.value)) },
        PAGE_SIZE_OPTIONS.map((n) => React.createElement("option", { key: n, value: n }, n, " / page"))),
      React.createElement("div", { style: { display: "flex", gap: 4 } },
        React.createElement("button", { className: "btn btn-sm", disabled: clampedPage === 0, onClick: () => setPage(clampedPage - 1) }, "← Prev"),
        React.createElement("span", { style: { fontSize: 12, color: "var(--text-muted)", padding: "6px 4px" } }, "Page ", clampedPage + 1, " / ", totalPages),
        React.createElement("button", { className: "btn btn-sm", disabled: clampedPage >= totalPages - 1, onClick: () => setPage(clampedPage + 1) }, "Next →"))));
}
