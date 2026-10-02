"use strict";
import React from "react";
import { AppProvider, useApp } from "./context/AppContext.js";
import { Layout } from "./components/Layout.js";
import { LoginPage } from "./pages/LoginPage.js";
import { PendingAccessPage } from "./pages/PendingAccessPage.js";
import { DepotPage } from "./pages/DepotPage.js";
import { ModalHost } from "./modals/ModalHost.js";
import { ToastStack } from "./components/ui.js";

// A Stock Controller/CCE (see ScRouter below) never renders any of these -- she's confined
// to her own DepotPage. Loading them eagerly meant every one of her logins downloaded the
// full National/Region/Movements/Audit/Halts/Search/Admin bundle (charts, bulk-upload
// parsers, data tables and all) before she could even clock in, which is real weight on a
// slow connection. Lazy-loading means her initial bundle is just Login + Layout + DepotPage;
// a national/regional user pays a brief Suspense flash only the first time she visits each
// of these, in exchange for not downloading pages she may never open either.
const NationalOverviewPage = React.lazy(() => import("./pages/NationalOverviewPage.js").then((m) => ({ default: m.NationalOverviewPage })));
const RegionPage = React.lazy(() => import("./pages/RegionPage.js").then((m) => ({ default: m.RegionPage })));
const MovementsPage = React.lazy(() => import("./pages/MovementsPage.js").then((m) => ({ default: m.MovementsPage })));
const AuditPage = React.lazy(() => import("./pages/AuditPage.js").then((m) => ({ default: m.AuditPage })));
const HaltReportPage = React.lazy(() => import("./pages/HaltReportPage.js").then((m) => ({ default: m.HaltReportPage })));
const SearchPage = React.lazy(() => import("./pages/SearchPage.js").then((m) => ({ default: m.SearchPage })));
const AdminPage = React.lazy(() => import("./pages/AdminPage.js").then((m) => ({ default: m.AdminPage })));

function RouteLoading() {
  return React.createElement("div", { className: "content" },
    React.createElement("div", { style: { padding: "40px 0", textAlign: "center", color: "var(--text-faint)", fontSize: 13 } }, "Loading…"));
}

// A Stock Controller (and, identically, a Customer Care Executive) is confined to her own
// depot page(s) -- everything else (National, Region, Search, Movements/Audit/Halts logs)
// shows nothing but RLS-blocked fragments for her anyway (fn_can_read_depot restricts every
// underlying table to her own depot(s)), so letting her land on those pages at all just means
// broken, confusing partial data rather than an actual leak. Most Stock Controllers/CCEs run
// exactly one depot, but a few real people run two (see user_role_depots) -- this redirects
// her to one of her own depots the moment she's anywhere else, including a typed-in URL for a
// depot that isn't hers.
function ScRouter() {
  const { route, auth, goDepot } = useApp();
  const depotCodes = auth.role.depotCodes || [];
  const onOwnDepot = route.name === "depot" && depotCodes.includes(route.depotCode);
  React.useEffect(() => {
    if (!onOwnDepot && depotCodes.length) goDepot(depotCodes[0]);
  }, [onOwnDepot, depotCodes, goDepot]);
  if (!depotCodes.length) {
    return React.createElement("div", { className: "content" },
      React.createElement("div", { className: "banner" }, React.createElement("span", null, "⚠"),
        React.createElement("div", null, "Your account has no depot assigned yet — ask an admin to fix this in User Management.")));
  }
  if (!onOwnDepot) return null; // redirecting
  return React.createElement(DepotPage, null);
}
function Router() {
  const { route, auth } = useApp();
  if (auth.role.role === "depot_controller" || auth.role.role === "cce") return React.createElement(ScRouter, null);
  if (route.name === "region") return React.createElement(RegionPage, null);
  if (route.name === "depot") return React.createElement(DepotPage, null);
  if (route.name === "movements") return React.createElement(MovementsPage, null);
  if (route.name === "audit") return React.createElement(AuditPage, null);
  if (route.name === "halts") return React.createElement(HaltReportPage, null);
  if (route.name === "search") return React.createElement(SearchPage, null);
  if (route.name === "admin") return React.createElement(AdminPage, null);
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
    React.createElement(Layout, null,
      React.createElement(React.Suspense, { fallback: React.createElement(RouteLoading, null) },
        React.createElement(Router, null))),
    React.createElement(React.Suspense, { fallback: null },
      React.createElement(ModalHost, null)),
    React.createElement(ToastStack, { toasts }));
}

export function App() {
  return React.createElement(AppProvider, null, React.createElement(Shell, null));
}
