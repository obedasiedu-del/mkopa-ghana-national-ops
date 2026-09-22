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

function Router() {
  const { route } = useApp();
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
