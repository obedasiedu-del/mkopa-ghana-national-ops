"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal, FieldSelect } from "../components/ui.js";
import { depotsForScope } from "../lib/selectors.js";
import { USER_ROLES, REGION_ORDER } from "../lib/domain.js";

// Assigns/edits one user's role, region and/or depot -- or revokes access entirely (deletes
// their user_roles row, dropping them back to "pending access"). `user` is a row from
// fetchUsers(): { id, email, role, region, depotCode } -- role/region/depotCode are null for
// someone who signed up but was never assigned a role yet.
export function AssignRoleModal({ user, onSaved }) {
  const { data, closeModal, runAction, toast } = useApp();
  const depotOptions = React.useMemo(() => depotsForScope(data.depots, "national"), [data.depots]);
  const [role, setRole] = React.useState(user.role || "viewer");
  const [region, setRegion] = React.useState(user.region || REGION_ORDER[0]);
  const [depotCode, setDepotCode] = React.useState(user.depotCode || (depotOptions[0] || {}).code || "");
  const [saving, setSaving] = React.useState(false);
  const needsRegion = role === "regional_manager";
  const needsDepot = role === "depot_controller";

  function submit() {
    if (saving) return;
    if (needsRegion && !region) { toast("A region is required for a Regional Manager"); return; }
    if (needsDepot && !depotCode) { toast("A depot is required for a Depot / Stock Controller"); return; }
    setSaving(true);
    runAction(() => data.saveUserRole(user.id, {
      role, region: needsRegion ? region : null, depotCode: needsDepot ? depotCode : null,
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
    needsRegion && React.createElement(FieldSelect, { label: "Region", value: region, onChange: setRegion, options: REGION_ORDER.map((r) => [r, r]) }),
    needsDepot && React.createElement(FieldSelect, {
      label: "Depot", value: depotCode, onChange: setDepotCode,
      options: depotOptions.map((d) => [d.code, d.name + " (" + d.code + ")"]),
    }));
}
