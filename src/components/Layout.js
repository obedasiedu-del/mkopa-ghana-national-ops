"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { REGION_ORDER, USER_ROLES } from "../lib/domain.js";
import { depotsForScope, activeDepots } from "../lib/selectors.js";

function Sidebar() {
  const { data, auth, route, goNational, goRegion } = useApp();
  const isSC = auth.role && auth.role.role === "depot_controller";
  const allDepots = depotsForScope(data.depots, "national");
  const currentRegion = route.name === "region" ? route.region : (route.name === "depot" && data.depots[route.depotCode] ? data.depots[route.depotCode].region : null);
  const rec = isSC ? data.depots[auth.role.depotCode] : null;
  return React.createElement("aside", { className: "sidebar" },
    React.createElement("div", { className: "brand" },
      React.createElement("div", { className: "brand-mark" },
        React.createElement("div", { className: "brand-icon" }, "GH"),
        React.createElement("div", null,
          React.createElement("div", { className: "brand-title" }, "National Stock Ops"),
          React.createElement("div", { className: "brand-sub" }, "M-KOPA Ghana"))),
    ),
    // A Stock Controller only ever has one place to be -- her own depot -- so there's
    // nothing to navigate between; the National/Regions nav (which would otherwise show
    // RLS-blocked, broken fragments for her) is replaced with just her depot's name.
    isSC
      ? React.createElement("div", { className: "nav-section" },
          React.createElement("div", { className: "nav-label" }, "Your Depot"),
          React.createElement("div", { className: "nav-item active" }, rec ? rec.name : auth.role.depotCode))
      : React.createElement(React.Fragment, null,
          React.createElement("div", { className: "nav-section" },
            React.createElement("div", { className: "nav-label" }, "Scope"),
            React.createElement("button", { className: "nav-item" + (route.name === "national" ? " active" : ""), onClick: goNational },
              "National ", React.createElement("span", { className: "count" }, activeDepots(allDepots).length))),
          React.createElement("div", { className: "nav-section", style: { flex: 1 } },
            React.createElement("div", { className: "nav-label" }, "Regions"),
            REGION_ORDER.map((r) => {
              const list = depotsForScope(data.depots, r);
              return React.createElement("button", { key: r, className: "nav-item" + (currentRegion === r ? " active" : ""), onClick: () => goRegion(r) },
                r, " ", React.createElement("span", { className: "count" }, activeDepots(list).length));
            }))),
    React.createElement("div", { className: "sidebar-footer" }, data.loaded ? "Synced" : (data.dbError ? "Connection error" : "Connecting…")));
}

function Topbar() {
  const { data, auth, search, setSearch, goSearch } = useApp();
  const roleLabel = auth.role ? (USER_ROLES.find((r) => r.key === auth.role.role) || {}).label : null;
  const isSC = auth.role && auth.role.role === "depot_controller";
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
