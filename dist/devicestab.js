"use strict";
/* ============ Devices at Depot / Devices in Trade toggle shell ============ */
function DevicesTab() {
    const { devicesView, setDevicesView, depotSubview, setDepotSubview } = useApp();
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 16 } },
            React.createElement("button", { className: "btn btn-sm" + (devicesView === "depot" ? " btn-primary" : ""), onClick: () => setDevicesView("depot") }, "Devices at Depot"),
            React.createElement("button", { className: "btn btn-sm" + (devicesView === "trade" ? " btn-primary" : ""), onClick: () => setDevicesView("trade") }, "Devices in Trade")),
        devicesView === "trade" ? (React.createElement(DeviceLedgerSection, null)) : (React.createElement(React.Fragment, null,
            React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 16 } },
                React.createElement("button", { className: "btn btn-sm" + (depotSubview === "stock" ? " btn-primary" : ""), onClick: () => setDepotSubview("stock") }, "Depot Stock"),
                React.createElement("button", { className: "btn btn-sm" + (depotSubview === "submission" ? " btn-primary" : ""), onClick: () => setDepotSubview("submission") }, "Daily Submission")),
            depotSubview === "submission" ? React.createElement(SubmissionTab, null) : React.createElement(DepotStockSection, null)))));
}
/* ============ Depot Stock ============ */
function DepotStockSection() {
    const { data, scope, search, openDrawer } = useApp();
    let depots = depotsForScope(data.depots, scope);
    const q = search.trim().toLowerCase();
    if (q)
        depots = depots.filter((d) => (d.name + " " + d.code).toLowerCase().includes(q));
    depots = [...depots].sort((a, b) => a.name.localeCompare(b.name));
    const grand = { inStock: 0, returned: 0, total: 0 };
    depots.forEach((d) => {
        const t = deviceTotals(data.depotStock[d.code]);
        grand.inStock += t.inStock;
        grand.returned += t.returned;
        grand.total += t.total;
    });
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "kpi-grid", style: { marginBottom: 16 } },
            React.createElement(KpiTile, { label: "In stock", value: String(grand.inStock), foot: "units on shelf" }),
            React.createElement(KpiTile, { label: "Returned", value: String(grand.returned), foot: "pending redeployment" }),
            React.createElement(KpiTile, { label: "Total tracked", value: String(grand.total), foot: "in stock + returned" })),
        React.createElement("div", { className: "table-wrap" },
            React.createElement("table", null,
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "Depot"),
                        React.createElement("th", null, "Territory"),
                        React.createElement("th", { className: "num" }, "In stock"),
                        React.createElement("th", { className: "num" }, "Returned"),
                        React.createElement("th", { className: "num" }, "Total"))),
                React.createElement("tbody", null,
                    depots.length === 0 && React.createElement(EmptyRow, { colSpan: 5 }, "No depots match your search."),
                    depots.map((d) => {
                        const t = deviceTotals(data.depotStock[d.code]);
                        return (React.createElement("tr", { key: d.code, className: "clickable", onClick: () => openDrawer(d.code, "devices") },
                            React.createElement("td", null,
                                React.createElement("div", { className: "depot-name-cell" },
                                    React.createElement("span", null, d.name),
                                    React.createElement("span", { className: "code" }, d.code))),
                            React.createElement("td", null, d.territory),
                            React.createElement("td", { className: "num" }, fmtNum(t.inStock)),
                            React.createElement("td", { className: "num" }, fmtNum(t.returned)),
                            React.createElement("td", { className: "num", style: { fontWeight: 600 } }, fmtNum(t.total))));
                    }))))));
}
/* ============ Daily Submission ============ */
function SubmissionTab() {
    const { data, scope, search, openModal } = useApp();
    let depots = activeDepots(depotsForScope(data.depots, scope));
    const q = search.trim().toLowerCase();
    if (q)
        depots = depots.filter((d) => (d.name + " " + d.code).toLowerCase().includes(q));
    depots = [...depots].sort((a, b) => a.name.localeCompare(b.name));
    const today = todayStr();
    let submittedToday = 0, totalStockSum = 0, agedStockSum = 0;
    const skuTotals = {};
    SUBMISSION_MODELS.forEach((m) => { skuTotals[m] = { totalStock: 0, agedStock: 0 }; });
    function latestFor(code) {
        const days = data.submissionsByDepot[code] || [];
        return days.length ? days[days.length - 1] : null;
    }
    depots.forEach((d) => {
        const latest = latestFor(d.code);
        if (latest) {
            const t = submissionTotals(latest);
            totalStockSum += t.totalStock;
            agedStockSum += t.agedStock;
            if (latest.date === today)
                submittedToday++;
            SUBMISSION_MODELS.forEach((m) => {
                const row = latest.models && latest.models[m];
                if (row) {
                    skuTotals[m].totalStock += Number(row.totalStock) || 0;
                    skuTotals[m].agedStock += Number(row.agedStock) || 0;
                }
            });
        }
    });
    const agedPct = totalStockSum > 0 ? Math.round((agedStockSum / totalStockSum) * 1000) / 10 : null;
    function exportLatestCsv() {
        const rows = [["Depot", "Code", "Territory", "Total Stock", "Aged Stock", "% Aged", "Submitted by", "Date"]];
        depots.forEach((d) => {
            const latest = latestFor(d.code);
            const t = latest ? submissionTotals(latest) : null;
            const pct = t && t.totalStock > 0 ? Math.round((t.agedStock / t.totalStock) * 1000) / 10 : "";
            rows.push([d.name, d.code, d.territory, t ? t.totalStock : "", t ? t.agedStock : "", pct, latest ? latest.submittedBy : "", latest ? latest.date : ""]);
        });
        downloadCsv((scope === "national" ? "national" : scope.replace(/\W+/g, "-")) + "-daily-submission-latest.csv", rows);
    }
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, marginBottom: 14, flexWrap: "wrap" } },
            React.createElement("div", { style: { fontSize: 12.8, color: "var(--text-muted)", maxWidth: 480 } }, "Each depot submits its Total Stock and Aged Stock by model once a day \u2014 whoever submits is recorded with the entry."),
            React.createElement("div", { style: { display: "flex", gap: 8 } },
                React.createElement("button", { className: "btn btn-sm", onClick: exportLatestCsv }, "\uD83D\uDCE5 Export latest (CSV)"),
                React.createElement("button", { className: "btn btn-primary btn-sm", onClick: () => openModal("submission", { depotCode: null }) }, "+ New Submission"))),
        React.createElement("div", { className: "kpi-grid", style: { marginBottom: 14 } },
            React.createElement(KpiTile, { label: "Submitted today", value: submittedToday + "/" + depots.length, foot: "depots with a Today entry" }),
            React.createElement(KpiTile, { label: "Total stock (latest)", value: String(totalStockSum), foot: "units across scope" }),
            React.createElement(KpiTile, { label: "Aged stock (latest)", value: String(agedStockSum), foot: "units aged across scope" }),
            React.createElement(KpiTile, { label: "% aged", value: agedPct === null ? "—" : agedPct + "%", foot: "of total stock" })),
        React.createElement("div", { className: "table-wrap", style: { padding: "14px 16px", marginBottom: 16 } },
            React.createElement("div", { className: "drawer-section-title", style: { marginBottom: 10 } },
                "By SKU (",
                scope === "national" ? "national" : scope,
                ")"),
            React.createElement("div", { style: { display: "flex", gap: 22, flexWrap: "wrap" } }, SUBMISSION_MODELS.map((m) => {
                const s = skuTotals[m];
                return (React.createElement("div", { key: m },
                    React.createElement("div", { className: "mono", style: { fontSize: 11.5, color: "var(--text-muted)" } }, m),
                    React.createElement("div", { className: "mono", style: { fontSize: 15, fontWeight: 600 } },
                        s.totalStock,
                        s.agedStock > 0 && React.createElement("span", { style: { fontSize: 11.5, color: "var(--warning)", fontWeight: 500, marginLeft: 5 } },
                            "(",
                            s.agedStock,
                            " aged)"))));
            }))),
        React.createElement("div", { className: "table-wrap" },
            React.createElement("table", null,
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "Depot"),
                        React.createElement("th", null, "Territory"),
                        React.createElement("th", { className: "num" }, "Total Stock"),
                        React.createElement("th", { className: "num" }, "Aged Stock"),
                        React.createElement("th", { className: "num" }, "% Aged"),
                        React.createElement("th", null, "Priority"),
                        React.createElement("th", null, "Submitted by"),
                        React.createElement("th", null, "Last entry"))),
                React.createElement("tbody", null,
                    depots.length === 0 && React.createElement(EmptyRow, { colSpan: 8 }, "No depots match your search."),
                    depots.map((d) => {
                        const latest = latestFor(d.code);
                        const isToday = latest && latest.date === today;
                        const t = latest ? submissionTotals(latest) : null;
                        const pct = t && t.totalStock > 0 ? Math.round((t.agedStock / t.totalStock) * 1000) / 10 : null;
                        const label = priorityLabel(pct);
                        return (React.createElement("tr", { key: d.code, className: "clickable", onClick: () => openModal("submission", { depotCode: d.code }) },
                            React.createElement("td", null,
                                React.createElement("div", { className: "depot-name-cell" },
                                    React.createElement("span", null, d.name),
                                    React.createElement("span", { className: "code" }, d.code))),
                            React.createElement("td", null, d.territory),
                            React.createElement("td", { className: "num", style: { fontWeight: 600 } }, t ? fmtNum(t.totalStock) : "—"),
                            React.createElement("td", { className: "num" }, t ? fmtNum(t.agedStock) : "—"),
                            React.createElement("td", { className: "num" }, pct === null ? "—" : React.createElement("span", { className: "mono", style: { color: agedPctColor(pct), fontWeight: 600 } },
                                pct,
                                "%")),
                            React.createElement("td", null, label ? React.createElement(Pill, { cls: label === "HIGH AGING" ? "pill-critical" : "pill-success" }, label) : "—"),
                            React.createElement("td", null, latest ? latest.submittedBy : "—"),
                            React.createElement("td", null, latest ? React.createElement(Pill, { cls: isToday ? "pill-success" : "pill-muted" }, fmtDateShort(latest.date)) : React.createElement("span", { style: { color: "var(--text-faint)" } }, "No entries yet"))));
                    }))))));
}
/* ============ Device Allocation Analysis (ledger) ============ */
function DeviceLedgerSection() {
    const { data, scope, search, ledgerFilter, setLedgerFilter, ledgerGroupBy, setLedgerGroupBy, openModal } = useApp();
    let depots = ledgerDepotsForScope(data.depots, scope);
    const q = search.trim().toLowerCase();
    if (q)
        depots = depots.filter((d) => (d.name + " " + d.code).toLowerCase().includes(q));
    depots = [...depots].sort((a, b) => {
        const aPseudo = PSEUDO_CODES.includes(a.code), bPseudo = PSEUDO_CODES.includes(b.code);
        if (aPseudo !== bPseudo)
            return aPseudo ? 1 : -1;
        return a.name.localeCompare(b.name);
    });
    const countsByCode = {};
    depots.forEach((d) => { countsByCode[d.code] = countsForDevices(ledgerDevices(data.deviceLedger, d.code)); });
    const grand = { total: 0, fresh: 0, projected: 0, aged: 0, urgent: 0, highrisk: 0, reallocated: 0, returned: 0 };
    depots.forEach((d) => { const c = countsByCode[d.code]; Object.keys(grand).forEach((k) => { grand[k] += c[k]; }); });
    function exportScopeCsv() {
        const rows = [["Depot", "Code", "Territory", "Devices Tracked", "Fresh", "Projected Aging", "Aged", "Urgent Sale", "High Risk", "Reallocated", "Returned", "Baseline Set", "Baseline By"]];
        depots.forEach((d) => {
            const c = countsByCode[d.code];
            const rec = data.ledgerBaseline[d.code];
            rows.push([d.name, d.code, d.territory, c.total, c.fresh, c.projected, c.aged, c.urgent, c.highrisk, c.reallocated, c.returned, rec ? rec.baselineSetAt : "", rec ? rec.baselineSetBy : ""]);
        });
        downloadCsv((scope === "national" ? "national" : scope.replace(/\W+/g, "-")) + "-device-allocation-analysis.csv", rows);
    }
    function exportAgentsCsv() {
        const rows = [["Agent / DSR", "Depot(s)", "Devices Tracked", "Fresh", "Projected Aging", "Aged", "Urgent Sale", "High Risk", "Reallocated", "Returned"]];
        groupDevicesByAgent(ledgerDevicesForScope(data.deviceLedger, data.depots, scope)).forEach((g) => {
            const c = countsForDevices(g.devices);
            rows.push([g.name, Object.keys(g.depotNames).join("; "), c.total, c.fresh, c.projected, c.aged, c.urgent, c.highrisk, c.reallocated, c.returned]);
        });
        downloadCsv((scope === "national" ? "national" : scope.replace(/\W+/g, "-")) + "-devices-by-agent.csv", rows);
    }
    const chipDefs = [
        { key: "all", label: "All Devices" }, { key: "fresh", label: "Fresh (0–5d)" },
        { key: "projected", label: "Projected (6–10d)" }, { key: "aged", label: "Aged (11–13d)" },
        { key: "urgent", label: "Urgent Sale (14–29d)" }, { key: "highrisk", label: "High Risk (30d+)" },
    ];
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, marginBottom: 14, flexWrap: "wrap" } },
            React.createElement("div", { style: { fontSize: 12.8, color: "var(--text-muted)", maxWidth: 520 } }, "Paste your full device export once \u2014 rows are matched to a depot by Shop Name and split automatically; indirect-channel partner shops and anything unrecognised are grouped into their own buckets below so nothing is dropped. Mark items Reallocated (recovery) or Returned as they move; aging is calculated from the device age at upload, no re-upload needed to keep tracking it."),
            React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
                React.createElement("button", { className: "btn btn-sm", onClick: () => (ledgerGroupBy === "agent" ? exportAgentsCsv() : exportScopeCsv()) }, "\uD83D\uDCE5 Export analysis (CSV)"),
                React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => openModal("ledger", { depotCode: null }) }, "Upload one depot"),
                React.createElement("button", { className: "btn btn-primary btn-sm", onClick: () => openModal("bulkLedger") }, "+ Upload Baseline (All Depots)"),
                React.createElement("button", { className: "btn btn-danger btn-sm", onClick: () => openModal("clearLedger") }, "\uD83D\uDDD1 Clear All Devices"))),
        React.createElement("div", { className: "kpi-grid", style: { marginBottom: 14 } },
            React.createElement(KpiTile, { label: "Devices tracked", value: String(grand.total), foot: "with a DSR or resolved" }),
            React.createElement(KpiTile, { label: "Fresh (0\u20135d)", value: String(grand.fresh), foot: "on track" }),
            React.createElement(KpiTile, { label: "Aged (11+d)", value: String(grand.aged + grand.urgent + grand.highrisk), foot: "needs attention" }),
            React.createElement(KpiTile, { label: "High Risk (30+d)", value: String(grand.highrisk), foot: "escalate now" }),
            React.createElement(KpiTile, { label: "Reallocated", value: String(grand.reallocated), foot: "recovered \u2014 out of the aging pool" })),
        React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 } }, chipDefs.map((c) => (React.createElement("button", { key: c.key, className: "btn btn-sm" + (ledgerFilter === c.key ? " btn-primary" : ""), onClick: () => setLedgerFilter(c.key) }, c.label)))),
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 } },
            React.createElement("span", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-faint)" } }, "Group by"),
            React.createElement("button", { className: "btn btn-sm" + (ledgerGroupBy === "depot" ? " btn-primary" : ""), onClick: () => setLedgerGroupBy("depot") }, "By Depot"),
            React.createElement("button", { className: "btn btn-sm" + (ledgerGroupBy === "agent" ? " btn-primary" : ""), onClick: () => setLedgerGroupBy("agent") }, "By Agent / DSR")),
        ledgerGroupBy === "agent" ? (React.createElement(LedgerByAgentTable, { depots: depots })) : (React.createElement("div", { className: "table-wrap" },
            React.createElement("table", null,
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "Depot"),
                        React.createElement("th", null, "Territory"),
                        React.createElement("th", { className: "num" }, "Devices"),
                        React.createElement("th", { className: "num" }, "Fresh"),
                        React.createElement("th", { className: "num" }, "Projected"),
                        React.createElement("th", { className: "num" }, "Aged"),
                        React.createElement("th", { className: "num" }, "Urgent"),
                        React.createElement("th", { className: "num" }, "High Risk"),
                        React.createElement("th", null, "Baseline set"))),
                React.createElement("tbody", null, (() => {
                    const filtered = ledgerFilter === "all" ? depots : depots.filter((d) => countsByCode[d.code][ledgerFilter] > 0);
                    if (filtered.length === 0)
                        return React.createElement(EmptyRow, { colSpan: 9 }, "No depots match this filter.");
                    return filtered.map((d) => {
                        const c = countsByCode[d.code];
                        const rec = data.ledgerBaseline[d.code];
                        return (React.createElement("tr", { key: d.code, className: "clickable", onClick: () => openModal("ledger", { depotCode: d.code }) },
                            React.createElement("td", null,
                                React.createElement("div", { className: "depot-name-cell" },
                                    React.createElement("span", null, d.name),
                                    React.createElement("span", { className: "code" }, d.code))),
                            React.createElement("td", null, d.territory),
                            React.createElement("td", { className: "num", style: { fontWeight: 600 } }, fmtNum(c.total)),
                            React.createElement("td", { className: "num" }, fmtNum(c.fresh)),
                            React.createElement("td", { className: "num" }, fmtNum(c.projected)),
                            React.createElement("td", { className: "num" }, fmtNum(c.aged)),
                            React.createElement("td", { className: "num" }, fmtNum(c.urgent)),
                            React.createElement("td", { className: "num" }, fmtNum(c.highrisk)),
                            React.createElement("td", null, rec ? React.createElement(Pill, { cls: "pill-muted" }, fmtDateShort(rec.baselineSetAt.slice(0, 10))) : React.createElement("span", { style: { color: "var(--text-faint)" } }, "Not set"))));
                    });
                })()))))));
}
function LedgerByAgentTable({ depots }) {
    const { data, scope, search, ledgerFilter, openModal } = useApp();
    let groups = groupDevicesByAgent(ledgerDevicesForScope(data.deviceLedger, data.depots, scope));
    const q = search.trim().toLowerCase();
    if (q)
        groups = groups.filter((g) => g.name.toLowerCase().includes(q));
    const countsByAgent = {};
    groups.forEach((g) => { countsByAgent[g.name] = countsForDevices(g.devices); });
    const filtered = ledgerFilter === "all" ? groups : groups.filter((g) => countsByAgent[g.name][ledgerFilter] > 0);
    return (React.createElement("div", { className: "table-wrap" },
        React.createElement("table", null,
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null, "Agent / DSR"),
                    React.createElement("th", null, "Depot(s)"),
                    React.createElement("th", { className: "num" }, "Devices"),
                    React.createElement("th", { className: "num" }, "Fresh"),
                    React.createElement("th", { className: "num" }, "Projected"),
                    React.createElement("th", { className: "num" }, "Aged"),
                    React.createElement("th", { className: "num" }, "Urgent"),
                    React.createElement("th", { className: "num" }, "High Risk"),
                    React.createElement("th", { className: "num" }, "Reallocated"))),
            React.createElement("tbody", null,
                filtered.length === 0 && React.createElement(EmptyRow, { colSpan: 9 }, "No agents match this filter."),
                filtered.map((g) => {
                    const c = countsByAgent[g.name];
                    const depotNames = Object.keys(g.depotNames);
                    const depotLabel = depotNames.length <= 1 ? (depotNames[0] || "—") : depotNames.length + " depots";
                    return (React.createElement("tr", { key: g.name, className: "clickable", onClick: () => openModal("agentLedger", { group: g }) },
                        React.createElement("td", null, g.name),
                        React.createElement("td", null, depotLabel),
                        React.createElement("td", { className: "num", style: { fontWeight: 600 } }, fmtNum(c.total)),
                        React.createElement("td", { className: "num" }, fmtNum(c.fresh)),
                        React.createElement("td", { className: "num" }, fmtNum(c.projected)),
                        React.createElement("td", { className: "num" }, fmtNum(c.aged)),
                        React.createElement("td", { className: "num" }, fmtNum(c.urgent)),
                        React.createElement("td", { className: "num" }, fmtNum(c.highrisk)),
                        React.createElement("td", { className: "num" }, fmtNum(c.reallocated))));
                })))));
}
function ledgerAgingBadge(device) {
    if (device.status === "reallocated")
        return React.createElement(Pill, { cls: "pill-muted" }, "Reallocated");
    const days = daysAllocated(device.allocatedDate);
    const tier = ledgerTierFor(days);
    if (!tier)
        return React.createElement("span", { style: { color: "var(--text-faint)" } }, "\u2014");
    return React.createElement(Pill, { cls: tier.cls },
        tier.label,
        days !== null ? " · " + days + "d" : "");
}
