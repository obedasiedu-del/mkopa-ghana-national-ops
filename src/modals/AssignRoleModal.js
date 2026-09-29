"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal, FieldSelect } from "../components/ui.js";
import { USER_ROLES, REGION_ORDER } from "../lib/domain.js";

// Assigns/edits one user's role, region(s) and/or depot -- or revokes access entirely
// (deletes their user_roles row, dropping them back to "pending access"). `user` is a row
// from fetchUsers(): { id, email, role, regions, depotCode } -- role/regions/depotCode are
// null/empty for someone who signed up but was never assigned a role yet. A Regional Manager
// can cover more than one region (e.g. one manager running both Bono and Northern), so region
// is a checkbox set, not a single dropdown.
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
  const [depotCode, setDepotCode] = React.useState(user.depotCode || (depotOptions[0] || {}).code || "");
  const [saving, setSaving] = React.useState(false);
  const isRegionalManager = role === "regional_manager";
  // A National Admin already has full read/write access everywhere -- picking regions for one
  // doesn't change what they can do, it's just a "who's the named lead here" label (e.g. shown
  // in the Region / Depot column). A Regional Manager's regions are the real thing driving
  // their access, so at least one is required there.
  const showRegions = isRegionalManager || role === "national_admin";
  const needsDepot = role === "depot_controller";

  function toggleRegion(r) {
    setRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : prev.concat(r)));
  }
  function submit() {
    if (saving) return;
    if (isRegionalManager && regions.length === 0) { toast("At least one region is required for a Regional Manager"); return; }
    if (needsDepot && !depotCode) { toast("A depot is required for a Depot / Stock Controller"); return; }
    setSaving(true);
    runAction(() => data.saveUserRole(user.id, {
      role, regions: showRegions ? regions : [], depotCode: needsDepot ? depotCode : null,
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
    needsDepot && React.createElement(FieldSelect, {
      label: "Depot", value: depotCode, onChange: setDepotCode,
      options: depotOptions.map((d) => [d.code, d.name + " (" + d.code + ")"]),
    }));
}
