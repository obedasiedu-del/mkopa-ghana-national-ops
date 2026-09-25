"use strict";
import React from "react";
import { AppProvider, useApp } from "./context/AppContext.js";
import { Layout } from "./components/Layout.js";
import { LoginPage } from "./pages/LoginPage.js";
import { PendingAccessPage } from "./pages/PendingAccessPage.js";
import { NationalOverviewPage } from "./pages/NationalOverviewPage.js";
import { RegionPage } from "./pages/RegionPage.js";
import { DepotPage } from "./pages/DepotPage.js";
import { MovementsPage } from "./pages/MovementsPage.js";
import { AuditPage } from "./pages/AuditPage.js";
import { HaltReportPage } from "./pages/HaltReportPage.js";
import { SearchPage } from "./pages/SearchPage.js";
import { ModalHost } from "./modals/ModalHost.js";
import { ToastStack } from "./components/ui.js";

// A Stock Controller is confined to her own depot's page -- everything else (National,
// Region, Search, Movements/Audit/Halts logs) shows nothing but RLS-blocked fragments for
// her anyway (fn_can_read_depot restricts every underlying table to her own depot_code), so
// letting her land on those pages at all just means broken, confusing partial data rather
// than an actual leak. This redirects her to her own depot the moment she's anywhere else,
// including a typed-in URL for a different depot.
function ScRouter() {
  const { route, auth, goDepot } = useApp();
  const depotCode = auth.role.depotCode;
  const onOwnDepot = route.name === "depot" && route.depotCode === depotCode;
  React.useEffect(() => {
    if (!onOwnDepot && depotCode) goDepot(depotCode);
  }, [onOwnDepot, depotCode, goDepot]);
  if (!depotCode) {
    return React.createElement("div", { className: "content" },
      React.createElement("div", { className: "banner" }, React.createElement("span", null, "⚠"),
        React.createElement("div", null, "Your account has no depot assigned yet — ask an admin to fix this in User Management.")));
  }
  if (!onOwnDepot) return null; // redirecting
  return React.createElement(DepotPage, null);
}
function Router() {
  const { route, auth } = useApp();
  if (auth.role.role === "depot_controller") return React.createElement(ScRouter, null);
  if (route.name === "region") return React.createElement(RegionPage, null);
  if (route.name === "depot") return React.createElement(DepotPage, null);
  if (route.name === "movements") return React.createElement(MovementsPage, null);
  if (route.name === "audit") return React.createElement(AuditPage, null);
  if (route.name === "halts") return React.createElement(HaltReportPage, null);
  if (route.name === "search") return React.createElement(SearchPage, null);
  return React.createElement(NationalOverviewPage, null);
}

function Shell() {
  const { auth, toasts } = useApp();
  if (auth.loading) {
    return React.createElement("div", { className: "auth-shell" }, React.createElement("div", { style: { color: "var(--text-muted)" } }, "Loading…"));
  }
  if (!auth.session) return React.createElement(LoginPage, null);
  if (!auth.role) return React.createElement(PendingAccessPage, null);
  return React.createElement(React.Fragment, null,
    React.createElement(Layout, null, React.createElement(Router, null)),
    React.createElement(ModalHost, null),
    React.createElement(ToastStack, { toasts }));
}

export function App() {
  return React.createElement(AppProvider, null, React.createElement(Shell, null));
}
