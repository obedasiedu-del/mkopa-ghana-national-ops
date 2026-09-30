"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { REGION_ORDER, OTHER_SCOPES, USER_ROLES } from "../lib/domain.js";
import { depotsForScope, activeDepots } from "../lib/selectors.js";
import { isAdmin } from "../data/useAuth.js";

function Sidebar() {
  const { data, auth, route, goNational, goRegion, goAdmin, goDepot } = useApp();
  const isSC = auth.role && (auth.role.role === "depot_controller" || auth.role.role === "cce");
  const userIsAdmin = isAdmin(auth.role);
  const allDepots = depotsForScope(data.depots, "national");
  const currentRegion = route.name === "region" ? route.region : (route.name === "depot" && data.depots[route.depotCode] ? data.depots[route.depotCode].region : null);
  const myDepots = isSC ? (auth.role.depotCodes || []).map((c) => data.depots[c]).filter(Boolean) : [];
  return React.createElement("aside", { className: "sidebar" },
    React.createElement("div", { className: "brand" },
      React.createElement("div", { className: "brand-mark" },
        React.createElement("div", { className: "brand-icon" }, "GH"),
        React.createElement("div", null,
          React.createElement("div", { className: "brand-title" }, "National Stock Ops"),
          React.createElement("div", { className: "brand-sub" }, "M-KOPA Ghana"))),
    ),
    // A Stock Controller only ever has her own depot(s) to navigate between -- almost always
    // just one, occasionally two for someone who genuinely runs two depots (user_role_depots)
    // -- so the National/Regions nav (which would otherwise show RLS-blocked, broken fragments
    // for her) is replaced with just that.
    isSC
      ? React.createElement("div", { className: "nav-section" },
          React.createElement("div", { className: "nav-label" }, myDepots.length > 1 ? "Your Depots" : "Your Depot"),
          myDepots.length
            ? myDepots.map((d) => React.createElement("button", {
                key: d.code, className: "nav-item" + (route.name === "depot" && route.depotCode === d.code ? " active" : ""),
                onClick: () => goDepot(d.code),
              }, d.name))
            : React.createElement("div", { className: "nav-item active" }, "—"))
      : React.createElement(React.Fragment, null,
          React.createElement("div", { className: "nav-section" },
            React.createElement("div", { className: "nav-label" }, "Scope"),
            React.createElement("button", { className: "nav-item" + (route.name === "national" ? " active" : ""), onClick: goNational },
              "National ", React.createElement("span", { className: "count" }, activeDepots(allDepots).length))),
          React.createElement("div", { className: "nav-section" },
            React.createElement("div", { className: "nav-label" }, "Regions"),
            REGION_ORDER.map((r) => {
              const list = depotsForScope(data.depots, r);
              return React.createElement("button", { key: r, className: "nav-item" + (currentRegion === r ? " active" : ""), onClick: () => goRegion(r) },
                r, " ", React.createElement("span", { className: "count" }, activeDepots(list).length));
            })),
          React.createElement("div", { className: "nav-section", style: { flex: 1 } },
            React.createElement("div", { className: "nav-label" }, "Other Channels"),
            OTHER_SCOPES.map((scope) => {
              const rec = Object.values(data.depots).find((d) => d.region === scope);
              return React.createElement("button", { key: scope, className: "nav-item" + (currentRegion === scope ? " active" : ""), onClick: () => goRegion(scope) },
                rec ? rec.name : scope);
            }))),
    userIsAdmin && !isSC && React.createElement("div", { className: "nav-section" },
      React.createElement("div", { className: "nav-label" }, "Admin"),
      React.createElement("button", { className: "nav-item" + (route.name === "admin" ? " active" : ""), onClick: goAdmin }, "User Management")),
    React.createElement("div", { className: "sidebar-footer" }, data.loaded ? "Synced" : (data.dbError ? "Connection error" : "Connecting…")));
}

function Topbar() {
  const { data, auth, search, setSearch, goSearch, openModal } = useApp();
  const roleLabel = auth.role ? (USER_ROLES.find((r) => r.key === auth.role.role) || {}).label : null;
  const isSC = auth.role && (auth.role.role === "depot_controller" || auth.role.role === "cce");
  function onSearchKeyDown(e) {
    if (e.key === "Enter" && search.trim()) goSearch(search.trim());
  }
  return React.createElement("div", { className: "topbar" },
    React.createElement("div", { className: "topbar-row" },
      // A Stock Controller's search would only ever match her own depot anyway (every
      // underlying table is RLS-scoped to it), and the results page itself is one of the
      // routes she's confined away from -- so the search box is just dead UI for her.
      isSC
        ? React.createElement("div", null)
        : React.createElement("div", { className: "search-box" },
            React.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
              React.createElement("circle", { cx: "11", cy: "11", r: "7" }),
              React.createElement("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })),
            React.createElement("input", { placeholder: "Search depot, serial or DSR…", value: search, onChange: (e) => setSearch(e.target.value), onKeyDown: onSearchKeyDown })),
      React.createElement("div", { className: "topbar-actions" },
        React.createElement("div", { className: "user-menu" },
          roleLabel && React.createElement("span", { className: "pill pill-muted" }, roleLabel),
          React.createElement("span", { className: "user-menu-email" }, auth.user?.email),
          React.createElement("button", { className: "btn btn-sm", onClick: () => openModal("changePassword") }, "Change Password"),
          React.createElement("button", { className: "btn btn-sm", onClick: () => auth.signOut() }, "Sign out")))));
}

export function Layout({ children }) {
  const { data } = useApp();
  return React.createElement("div", { id: "app" },
    React.createElement(Sidebar, null),
    React.createElement("div", { className: "main" },
      React.createElement(Topbar, null),
      data.dbError && React.createElement("div", { className: "content", style: { paddingBottom: 0 } },
        React.createElement("div", { className: "banner", style: { alignItems: "flex-start" } },
          React.createElement("span", null, "⚠"),
          React.createElement("div", { style: { flex: 1 } },
            React.createElement("div", null, "Can't reach live storage right now — edits here won't be saved until the connection recovers."),
            React.createElement("div", { className: "mono", style: { fontSize: 11, opacity: 0.75, marginTop: 4 } }, String(data.dbError.message || data.dbError))),
          React.createElement("button", { className: "btn btn-sm", onClick: () => data.retryLoad(), style: { marginLeft: 12 } }, "Retry"))),
      children));
}
