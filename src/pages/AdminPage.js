"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Breadcrumb, Pill } from "../components/ui.js";
import { DataTable } from "../components/DataTable.js";
import { USER_ROLES } from "../lib/domain.js";
import { isAdmin } from "../data/useAuth.js";

const ROLE_LABEL = Object.fromEntries(USER_ROLES.map((r) => [r.key, r.label]));

export function AdminPage() {
  const { data, auth, openModal, goNational } = useApp();
  const [users, setUsers] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const load = React.useCallback(() => {
    setLoading(true);
    data.fetchUsers().then((rows) => { setUsers(rows); setError(null); }).catch((e) => setError(e)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => { load(); }, [load]);

  if (!isAdmin(auth.role)) {
    return React.createElement("div", { className: "content" },
      React.createElement(Breadcrumb, { items: [{ label: "National", onClick: goNational }, { label: "User Management" }] }),
      React.createElement("div", { className: "banner" }, React.createElement("span", null, "⚠"),
        React.createElement("div", null, "User Management is only available to National Admins.")));
  }

  const columns = [
    {
      key: "email", label: "Name / Email", sortable: true,
      // A Depot Controller's real name lives on the depot record (Stock Controller name) --
      // the login itself is often still a placeholder (scXXX@mkopa-ghana-ops.internal) rather
      // than their personal email, so show the name as the primary line where we have it.
      render: (u) => {
        const firstDepot = (u.role === "depot_controller" || u.role === "cce") && u.depotCodes && u.depotCodes.length ? data.depots[u.depotCodes[0]] : null;
        const personName = firstDepot ? (u.role === "cce" ? firstDepot.cceName : firstDepot.scName) : null;
        if (!personName) return u.email;
        return React.createElement("div", null,
          React.createElement("div", null, personName),
          React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--text-faint)" } }, u.email));
      },
    },
    {
      key: "role", label: "Role", sortable: true, sortValue: (u) => u.role || "",
      render: (u) => u.role ? React.createElement(Pill, { cls: "pill-success" }, ROLE_LABEL[u.role] || u.role) : React.createElement(Pill, { cls: "pill-critical" }, "Pending access"),
    },
    {
      key: "scope", label: "Region / Depot",
      render: (u) => u.role === "regional_manager" || u.role === "national_admin"
        ? (u.regions && u.regions.length ? u.regions.join(", ") : "—")
        : u.role === "depot_controller" || u.role === "cce"
          ? (u.depotCodes && u.depotCodes.length ? u.depotCodes.map((c) => (data.depots[c] || {}).name || c).join(", ") : "—")
          : "—",
    },
    {
      key: "actions", label: "",
      render: (u) => React.createElement("button", { className: "btn btn-sm", onClick: () => openModal("assignRole", { user: u, onSaved: load }) }, u.role ? "Edit Role" : "Assign Role"),
    },
  ];

  return React.createElement("div", { className: "content" },
    React.createElement(Breadcrumb, { items: [{ label: "National", onClick: goNational }, { label: "User Management" }] }),
    React.createElement("div", { className: "topbar-row", style: { marginBottom: 14 } },
      React.createElement("div", null,
        React.createElement("div", { className: "scope-title" }, "User Management"),
        React.createElement("div", { className: "scope-sub" }, "Everyone who has signed in at least once — assign a role to grant access, or revoke it to lock someone out. New accounts are still created in the Supabase dashboard (Authentication → Users); this only manages what they can see once they've signed in."))),
    error && React.createElement("div", { className: "banner banner-critical" }, React.createElement("span", null, "⚠"), React.createElement("div", null, String(error.message || error))),
    loading ? React.createElement("div", { style: { padding: 20, color: "var(--text-faint)" } }, "Loading…")
      : React.createElement(DataTable, {
        columns, rows: users || [], rowKey: (u) => u.id, defaultSortKey: "role", defaultSortDir: "asc",
        emptyMessage: "No accounts on file yet.",
      }));
}
