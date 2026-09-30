"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal, FieldSelect } from "../components/ui.js";
import { USER_ROLES, REGION_ORDER } from "../lib/domain.js";

// Assigns/edits one user's role, region(s) and/or depot(s) -- or revokes access entirely
// (deletes their user_roles row, dropping them back to "pending access"). `user` is a row
// from fetchUsers(): { id, email, role, regions, depotCodes } -- role/regions/depotCodes are
// null/empty for someone who signed up but was never assigned a role yet. A Regional Manager
// can cover more than one region (e.g. one manager running both Bono and Northern), and a
// Depot Controller can very occasionally run more than one depot (one real person, two real
// depots) -- both are checkbox sets, not a single dropdown.
export function AssignRoleModal({ user, onSaved }) {
  const { data, closeModal, runAction, toast } = useApp();
  // Every real depot, plus the synthetic channels (Indirect Sales, Unrecognised Shops,
  // Warehouse Stock, etc.) -- those are real rows in `depots` (is_synthetic = true), so a
  // Stock Controller can legitimately be assigned to run one of them the same as a real depot.
  const depotOptions = React.useMemo(
    () => Object.values(data.depots).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [data.depots]
  );
  const [role, setRole] = React.useState(user.role || "viewer");
  const [regions, setRegions] = React.useState(user.regions || []);
  const [depotCodes, setDepotCodes] = React.useState(user.depotCodes || []);
  const [depotFilter, setDepotFilter] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const isRegionalManager = role === "regional_manager";
  // A National Admin already has full read/write access everywhere -- picking regions for one
  // doesn't change what they can do, it's just a "who's the named lead here" label (e.g. shown
  // in the Region / Depot column). A Regional Manager's regions are the real thing driving
  // their access, so at least one is required there.
  const showRegions = isRegionalManager || role === "national_admin";
  const needsDepot = role === "depot_controller" || role === "cce";
  const filteredDepots = depotOptions.filter((d) => {
    const q = depotFilter.trim().toLowerCase();
    return !q || d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q);
  });

  function toggleRegion(r) {
    setRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : prev.concat(r)));
  }
  function toggleDepot(code) {
    setDepotCodes((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : prev.concat(code)));
  }
  function submit() {
    if (saving) return;
    if (isRegionalManager && regions.length === 0) { toast("At least one region is required for a Regional Manager"); return; }
    if (needsDepot && depotCodes.length === 0) { toast("At least one depot is required"); return; }
    setSaving(true);
    runAction(() => data.saveUserRole(user.id, {
      role, regions: showRegions ? regions : [], depotCodes: needsDepot ? depotCodes : [],
    }), "Role saved").then(() => { closeModal(); if (onSaved) onSaved(); }).finally(() => setSaving(false));
  }
  function revoke() {
    if (saving) return;
    if (!window.confirm(`Revoke access for ${user.email}? They'll go back to "pending access" until reassigned.`)) return;
    setSaving(true);
    runAction(() => data.removeUserRole(user.id), "Access revoked").then(() => { closeModal(); if (onSaved) onSaved(); }).finally(() => setSaving(false));
  }

  return React.createElement(Modal, {
    open: true, onClose: closeModal, title: "Assign Role — " + user.email,
    footer: React.createElement(React.Fragment, null,
      user.role && React.createElement("button", { className: "btn btn-danger", onClick: revoke, disabled: saving, style: { marginRight: "auto" } }, "Revoke Access"),
      React.createElement("button", { className: "btn", onClick: closeModal }, "Cancel"),
      React.createElement("button", { className: "btn btn-primary", onClick: submit, disabled: saving }, saving ? "Saving…" : "Save Role")),
  },
    React.createElement(FieldSelect, { label: "Role", value: role, onChange: setRole, options: USER_ROLES.map((r) => [r.key, r.label]) }),
    showRegions && React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" },
        isRegionalManager ? "Region(s) — select all that apply" : "Region(s) led (optional — a National Admin already has full access everywhere; this is just a label)"),
      React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px 16px" } },
        REGION_ORDER.map((r) => React.createElement("label", { key: r, style: { display: "flex", alignItems: "center", gap: 6, fontSize: 13 } },
          React.createElement("input", { type: "checkbox", checked: regions.includes(r), onChange: () => toggleRegion(r) }),
          r)))),
    needsDepot && React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "Depot(s) — select all that apply (usually just one)"),
      depotCodes.length > 0 && React.createElement("div", { style: { fontSize: 12, color: "var(--text-muted)", marginBottom: 6 } },
        "Selected: ", depotCodes.map((c) => (data.depots[c] || {}).name || c).join(", ")),
      React.createElement("input", {
        className: "field-input", placeholder: "Filter by depot name or code…",
        value: depotFilter, onChange: (e) => setDepotFilter(e.target.value), style: { marginBottom: 8 },
      }),
      React.createElement("div", { style: { maxHeight: 220, overflowY: "auto", border: "1px solid var(--border, #ddd)", borderRadius: 6, padding: 8 } },
        filteredDepots.length === 0 && React.createElement("div", { style: { fontSize: 12.5, color: "var(--text-faint)" } }, "No depots match."),
        filteredDepots.map((d) => React.createElement("label", { key: d.code, style: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "3px 0" } },
          React.createElement("input", { type: "checkbox", checked: depotCodes.includes(d.code), onChange: () => toggleDepot(d.code) }),
          d.name, " (", d.code, ")")))));
}
