"use strict";
import React from "react";

// Minimal hash router -- no dependency needed for a nav this shallow (national / region / depot
// + a couple of report screens), and hash URLs are shareable/bookmarkable which the drawer-based
// navigation in the previous version wasn't.
//
// Routes:
//   #/                              national overview
//   #/region/:region                region overview
//   #/depot/:code                   depot overview (defaults to the "devices" tab)
//   #/depot/:code/:tab              depot page, one of: devices | submission | movement | aging | warehouse | audit
//   #/movements?region=X            Stock Movement log, national (no region) or one region, filterable
//   #/audit?region=X                Audit History log, national (no region) or one region, filterable
//   #/halts?region=X                Allocation Halt Status report, national (no region) or one region
//   #/search?q=...                  cross-entity search results
//   #/admin                         user role management (national_admin only)

function parseHash(hash) {
  const raw = (hash || "").replace(/^#\/?/, "");
  const [pathPart, queryPart] = raw.split("?");
  const parts = pathPart.split("/").filter(Boolean).map(decodeURIComponent);
  const query = Object.fromEntries(new URLSearchParams(queryPart || ""));
  if (parts[0] === "region" && parts[1]) {
    return { name: "region", region: parts[1], query };
  }
  if (parts[0] === "depot" && parts[1]) {
    return { name: "depot", depotCode: parts[1], tab: parts[2] || "devices", query };
  }
  if (parts[0] === "movements") {
    return { name: "movements", region: query.region || null, query };
  }
  if (parts[0] === "audit") {
    return { name: "audit", region: query.region || null, query };
  }
  if (parts[0] === "halts") {
    return { name: "halts", region: query.region || null, query };
  }
  if (parts[0] === "search") {
    return { name: "search", query };
  }
  if (parts[0] === "admin") {
    return { name: "admin", query };
  }
  return { name: "national", query };
}

export function useRouter() {
  const [route, setRoute] = React.useState(() => parseHash(window.location.hash));
  React.useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = React.useCallback((path) => { window.location.hash = path; }, []);
  const goNational = React.useCallback(() => navigate("#/"), [navigate]);
  const goRegion = React.useCallback((region) => navigate("#/region/" + encodeURIComponent(region)), [navigate]);
  const goDepot = React.useCallback((code, tab) => navigate("#/depot/" + encodeURIComponent(code) + (tab ? "/" + tab : "")), [navigate]);
  const goSearch = React.useCallback((q) => navigate("#/search?q=" + encodeURIComponent(q)), [navigate]);
  const goAdmin = React.useCallback(() => navigate("#/admin"), [navigate]);
  const goMovements = React.useCallback((region) => navigate("#/movements" + (region ? "?region=" + encodeURIComponent(region) : "")), [navigate]);
  const goAudit = React.useCallback((region) => navigate("#/audit" + (region ? "?region=" + encodeURIComponent(region) : "")), [navigate]);
  const goHalts = React.useCallback((region) => navigate("#/halts" + (region ? "?region=" + encodeURIComponent(region) : "")), [navigate]);

  return { route, navigate, goNational, goRegion, goDepot, goSearch, goAdmin, goMovements, goAudit, goHalts };
}
