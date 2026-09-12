"use strict";
// Bulk paste for aggregate Depot Stock, mirroring the "Upload Baseline (All Depots)"
// flow in Devices in Trade -- paste once, rows are matched to a depot by name, and
// depots present in the paste have their stock replaced (others untouched).
function BulkDepotStockModal() {
    const { data, closeModal, toast, runAction } = useApp();
    const depots = depotsForScope(data.depots, "national");
    const depotsLoaded = depots.length > 0;
    const [text, setText] = React.useState("");
    const [summary, setSummary] = React.useState(null);
    const [parsing, setParsing] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const parseTimerRef = React.useRef(null);
    function scheduleParse(value) {
        setParsing(true);
        clearTimeout(parseTimerRef.current);
        parseTimerRef.current = setTimeout(() => {
            if (!value.trim()) {
                setSummary(null);
                setParsing(false);
                return;
            }
            setSummary(parseDepotStockPaste(value, depots));
            setParsing(false);
        }, 200);
    }
    function onChange(e) {
        const value = e.target.value;
        setText(value);
        scheduleParse(value);
    }
    function saveStock() {
        setSaving(true);
        setTimeout(() => {
            const parsed = parseDepotStockPaste(text, depots);
            runAction(() => data.saveDepotStockBulk(parsed.byDepot), null)
                .then((count) => {
                toast("Stock saved for " + count + " depot" + (count === 1 ? "" : "s"));
                closeModal();
            })
                .catch(() => { })
                .finally(() => setSaving(false));
        }, 0);
    }
    function unmatchedDownload() {
        const rows = [["Depot (as pasted)", "Model", "In Stock", "Returned"]];
        summary.unmatchedRows.forEach((r) => rows.push([r.depotText, r.model, r.inStock, r.returned]));
        downloadCsv("unmatched-depot-stock-rows.csv", rows);
    }
    const depotCodes = summary ? Object.keys(summary.byDepot) : [];
    const totalRows = summary ? depotCodes.reduce((s, c) => s + Object.keys(summary.byDepot[c]).length, 0) + summary.unmatchedRows.length : 0;
    return (React.createElement(Modal, { open: true, onClose: closeModal, xwide: true, title: "Upload Stock \u2014 All Depots", footer: React.createElement("button", { className: "btn", onClick: closeModal }, "Cancel") },
        !depotsLoaded && (React.createElement("div", { className: "banner", style: { marginBottom: 10 } },
            React.createElement("span", null, "\u26A0"),
            React.createElement("div", null, "The depot list hasn't finished loading yet \u2014 pasting now would match nothing. Close this, wait a couple seconds, then reopen."))),
        React.createElement("div", { style: { fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10 } }, "Paste depot stock rows \u2014 one row per depot + model. Columns: Depot (name or code), Model, In Stock, Returned. Each row is matched to a depot by name (same matching as Devices in Trade); repeated rows for the same depot and model are summed. Depots present in this paste have their stock fully replaced \u2014 others are left untouched."),
        React.createElement("div", { className: "field-row" },
            React.createElement("div", { className: "field-label" }, "Paste stock rows (all depots)"),
            React.createElement("textarea", { className: "field-input", rows: 10, placeholder: "Kasoa Depot\tA07/64\t12\t2\nCape Coast Depot\tA16/128\t5\t0", value: text, onChange: onChange })),
        React.createElement("div", { style: { fontSize: 12, margin: "4px 0 14px" } },
            parsing && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Parsing\u2026"),
            !parsing && !summary && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Paste rows above to see a preview."),
            !parsing && summary && totalRows === 0 && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Paste rows above to see a preview."),
            !parsing && summary && totalRows > 0 && (React.createElement(React.Fragment, null,
                React.createElement("div", { style: { color: "var(--success)", fontWeight: 600, marginBottom: 4 } },
                    totalRows - summary.unmatchedRows.length,
                    " of ",
                    totalRows,
                    " pasted row",
                    totalRows === 1 ? "" : "s",
                    " matched, across ",
                    depotCodes.length,
                    " depot",
                    depotCodes.length === 1 ? "" : "s",
                    "."),
                summary.unmatchedRows.length > 0 && (React.createElement("div", { style: { color: "var(--warning)", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: 2 } },
                    React.createElement("span", null,
                        summary.unmatchedRows.length,
                        " row",
                        summary.unmatchedRows.length === 1 ? "" : "s",
                        " didn't match a depot \u2014 name",
                        Object.keys(summary.unmatchedCounts).length === 1 ? "" : "s",
                        ": ",
                        Object.keys(summary.unmatchedCounts).slice(0, 8).join(", "),
                        Object.keys(summary.unmatchedCounts).length > 8 ? ", …" : "",
                        "."),
                    React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: unmatchedDownload }, "\uD83D\uDCE5 Download"))),
                summary.skipped > 0 && React.createElement("div", { style: { color: "var(--text-faint)" } },
                    summary.skipped,
                    " row(s) skipped (missing depot or model).")))),
        React.createElement("div", null,
            React.createElement("button", { className: "btn btn-primary btn-sm", disabled: saving || !depotCodes.length, onClick: saveStock }, saving ? "Saving…" : "Save Stock — All Depots"))));
}
