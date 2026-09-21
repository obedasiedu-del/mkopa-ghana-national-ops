"use strict";
import React from "react";
import { scoreColor, daysAllocated, ledgerTierFor } from "../lib/domain.js";

export function KpiTile({ label, value, foot }) {
  return React.createElement("div", { className: "kpi-tile" },
    React.createElement("div", { className: "kpi-label" }, label),
    React.createElement("div", { className: "kpi-value" }, value),
    React.createElement("div", { className: "kpi-foot" }, foot));
}
export function Pill({ cls, children }) {
  return React.createElement("span", { className: "pill " + cls },
    React.createElement("span", { className: "pill-dot" }),
    children);
}
export function ScStatusPill({ status }) {
  const map = {
    active: { cls: "pill-success", label: "Active" },
    leave: { cls: "pill-warning", label: "On Leave" },
    vacant: { cls: "pill-critical", label: "Vacant" },
  };
  const m = map[status] || map.vacant;
  return React.createElement(Pill, { cls: m.cls }, m.label);
}
export function ScoreCell({ score }) {
  const pct = score === null || score === undefined ? 0 : Math.max(0, Math.min(100, score));
  const color = scoreColor(score);
  return React.createElement("div", { className: "score-cell" },
    React.createElement("div", { className: "score-bar" },
      React.createElement("div", { className: "score-bar-fill", style: { width: pct + "%", background: color } })),
    React.createElement("div", { className: "score-num mono", style: { color } }, score === null || score === undefined ? "—" : String(score)));
}
export function FieldInput({ label, value, onChange, type = "text", placeholder }) {
  return React.createElement("div", { className: "field-row" },
    React.createElement("div", { className: "field-label" }, label),
    React.createElement("input", { className: "field-input", type, value: value ?? "", placeholder, onChange: (e) => onChange(e.target.value) }));
}
export function FieldTextarea({ label, value, onChange, rows, placeholder }) {
  return React.createElement("div", { className: "field-row" },
    React.createElement("div", { className: "field-label" }, label),
    React.createElement("textarea", { className: "field-input", rows, placeholder, value: value ?? "", onChange: (e) => onChange(e.target.value) }));
}
export function FieldSelect({ label, value, onChange, options }) {
  return React.createElement("div", { className: "field-row" },
    React.createElement("div", { className: "field-label" }, label),
    React.createElement("select", { className: "field-input", value, onChange: (e) => onChange(e.target.value) },
      options.map(([v, l]) => React.createElement("option", { key: v, value: v }, l))));
}
export function Modal({ open, onClose, wide, xwide, title, children, footer }) {
  return React.createElement("div", { className: "modal-overlay" + (open ? " open" : ""), onMouseDown: (e) => { if (e.target === e.currentTarget) onClose(); } },
    React.createElement("div", { className: "modal" + (wide ? " modal-wide" : "") + (xwide ? " modal-xwide" : "") },
      title !== undefined && React.createElement("div", { className: "modal-header" }, title),
      React.createElement("div", { className: "modal-body" }, children),
      footer && React.createElement("div", { className: "modal-footer" }, footer)));
}
export function ToastStack({ toasts }) {
  return React.createElement("div", { id: "toast-stack" }, toasts.map((t) => React.createElement("div", { key: t.id, className: "toast show" }, t.msg)));
}
export function EmptyRow({ colSpan, children }) {
  return React.createElement("tr", { className: "empty-row" },
    React.createElement("td", { colSpan }, children));
}
export function Breadcrumb({ items }) {
  return React.createElement("div", { className: "breadcrumb" }, items.map((it, i) => (
    React.createElement(React.Fragment, { key: i },
      i > 0 && React.createElement("span", { className: "breadcrumb-sep" }, "/"),
      it.onClick
        ? React.createElement("button", { className: "breadcrumb-link", onClick: it.onClick }, it.label)
        : React.createElement("span", { className: "breadcrumb-current" }, it.label))
  )));
}
export function LedgerAgingBadge({ device }) {
  if (device.status === "reallocated") return React.createElement(Pill, { cls: "pill-muted" }, "Reallocated");
  const days = daysAllocated(device.allocatedDate);
  const tier = ledgerTierFor(days);
  if (!tier) return React.createElement("span", { style: { color: "var(--text-faint)" } }, "—");
  return React.createElement(Pill, { cls: tier.cls }, tier.label, days !== null ? " · " + days + "d" : "");
}
export function Tabs({ tabs, active, onChange }) {
  return React.createElement("div", { className: "tabs" }, tabs.map((t) => (
    React.createElement("button", { key: t.id, className: "tab-btn" + (active === t.id ? " active" : ""), onClick: () => onChange(t.id) }, t.label)
  )));
}
