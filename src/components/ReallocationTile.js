"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { KpiCard } from "./ui.js";
import { isDsrReassignmentRow } from "../lib/domain.js";
import { ledgerDepotsForScope } from "../lib/selectors.js";

// Self-contained: fetches today's audit_log for the scope itself rather than reading from
// global state -- audit_log is unbounded and already fetched on-demand everywhere else in the
// app (Stock Movement, Audit History), same reasoning here. Counts dsr_name changes; a
// separate concept from the ledger's existing "Reallocated" status, see isDsrReassignmentRow.
export function ReallocationTile({ scope, singleDepotCode }) {
  const { data, openModal } = useApp();
  const depotCodes = React.useMemo(
    () => (singleDepotCode ? [singleDepotCode] : ledgerDepotsForScope(data.depots, scope).map((d) => d.code)),
    [data.depots, scope, singleDepotCode],
  );
  const [count, setCount] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    data.fetchAuditLog({ depotCodes, sinceIso: since.toISOString(), limit: 3000 })
      .then((rows) => { if (!cancelled) setCount(rows.filter(isDsrReassignmentRow).length); })
      .catch(() => { if (!cancelled) setCount(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, depotCodes.join(",")]);
  return React.createElement(KpiCard, {
    label: "Reallocated (DSR)", value: count === null ? "—" : String(count),
    foot: "moved to a different DSR today · tap for details",
    onClick: () => openModal("reallocations", { scope: singleDepotCode || scope }),
  });
}
