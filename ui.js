"use strict";
function KpiTile({ label, value, foot }) {
    return (React.createElement("div", { className: "kpi-tile" },
        React.createElement("div", { className: "kpi-label" }, label),
        React.createElement("div", { className: "kpi-value" }, value),
        React.createElement("div", { className: "kpi-foot" }, foot)));
}
function Pill({ cls, children }) {
    return (React.createElement("span", { className: "pill " + cls },
        React.createElement("span", { className: "pill-dot" }),
        children));
}
function ScStatusPill({ status }) {
    const map = {
        active: { cls: "pill-success", label: "Active" },
        leave: { cls: "pill-warning", label: "On Leave" },
        vacant: { cls: "pill-critical", label: "Vacant" },
    };
    const m = map[status] || map.vacant;
    return React.createElement(Pill, { cls: m.cls }, m.label);
}
function CceStatusPill({ status }) {
    const map = {
        active: { cls: "pill-success", label: "Active" },
        inactive: { cls: "pill-muted", label: "Inactive" },
    };
    const m = map[status] || map.active;
    return React.createElement(Pill, { cls: m.cls }, m.label);
}
function ScoreCell({ score }) {
    const pct = score === null || score === undefined ? 0 : Math.max(0, Math.min(100, score));
    const color = scoreColor(score);
    return (React.createElement("div", { className: "score-cell" },
        React.createElement("div", { className: "score-bar" },
            React.createElement("div", { className: "score-bar-fill", style: { width: pct + "%", background: color } })),
        React.createElement("div", { className: "score-num mono", style: { color } }, score === null || score === undefined ? "—" : String(score))));
}
function FieldInput({ label, value, onChange, type = "text", placeholder }) {
    return (React.createElement("div", { className: "field-row" },
        React.createElement("div", { className: "field-label" }, label),
        React.createElement("input", { className: "field-input", type: type, value: value ?? "", placeholder: placeholder, onChange: (e) => onChange(e.target.value) })));
}
function FieldTextarea({ label, value, onChange, rows, placeholder }) {
    return (React.createElement("div", { className: "field-row" },
        React.createElement("div", { className: "field-label" }, label),
        React.createElement("textarea", { className: "field-input", rows: rows, placeholder: placeholder, value: value ?? "", onChange: (e) => onChange(e.target.value) })));
}
function FieldSelect({ label, value, onChange, options }) {
    return (React.createElement("div", { className: "field-row" },
        React.createElement("div", { className: "field-label" }, label),
        React.createElement("select", { className: "field-input", value: value, onChange: (e) => onChange(e.target.value) }, options.map(([v, l]) => React.createElement("option", { key: v, value: v }, l)))));
}
function Modal({ open, onClose, wide, xwide, title, children, footer }) {
    return (React.createElement("div", { className: "modal-overlay" + (open ? " open" : ""), onMouseDown: (e) => { if (e.target === e.currentTarget)
            onClose(); } },
        React.createElement("div", { className: "modal" + (wide ? " modal-wide" : "") + (xwide ? " modal-xwide" : "") },
            title !== undefined && React.createElement("div", { className: "modal-header" }, title),
            React.createElement("div", { className: "modal-body" }, children),
            footer && React.createElement("div", { className: "modal-footer" }, footer))));
}
function Drawer({ open, onClose, children }) {
    return (React.createElement("div", { className: "overlay" + (open ? " open" : ""), onMouseDown: (e) => { if (e.target === e.currentTarget)
            onClose(); } },
        React.createElement("div", { className: "drawer" }, children)));
}
function ToastStack({ toasts }) {
    return (React.createElement("div", { id: "toast-stack" }, toasts.map((t) => React.createElement("div", { key: t.id, className: "toast show" }, t.msg))));
}
function EmptyRow({ colSpan, children }) {
    return (React.createElement("tr", { className: "empty-row" },
        React.createElement("td", { colSpan: colSpan }, children)));
}
