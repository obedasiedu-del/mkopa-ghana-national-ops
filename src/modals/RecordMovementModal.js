"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal, FieldInput, FieldSelect, FieldTextarea } from "../components/ui.js";
import { depotsForScope } from "../lib/selectors.js";
import { MOVEMENT_TYPES, SUBMISSION_MODELS, fmtNum } from "../lib/domain.js";

export function RecordMovementModal({ depotCode: initialCode, model: initialModel, onSaved }) {
  const { data, closeModal, runAction, toast } = useApp();
  const depotOptions = React.useMemo(() => depotsForScope(data.depots, "national").filter((d) => d.status === "active"), [data.depots]);
  const [depotCode, setDepotCode] = React.useState(initialCode || (depotOptions[0] || {}).code || "");
  const [toDepotCode, setToDepotCode] = React.useState("");
  const [movementType, setMovementType] = React.useState("receipt");
  const [serial, setSerial] = React.useState("");
  const [model, setModel] = React.useState(initialModel || "");
  const [quantity, setQuantity] = React.useState("1");
  const [reference, setReference] = React.useState("");
  const [recordedBy, setRecordedBy] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const needsToDepot = movementType === "transfer";
  const isOutbound = movementType === "issue" || movementType === "transfer";

  const knownModels = React.useMemo(() => {
    const set = new Set(SUBMISSION_MODELS);
    Object.keys(data.stockBalances[depotCode] || {}).forEach((m) => set.add(m));
    return Array.from(set);
  }, [data.stockBalances, depotCode]);
  const currentBalance = (data.stockBalances[depotCode] || {})[model.trim()]?.remaining ?? 0;

  function submit() {
    if (saving) return;
    if (!recordedBy.trim()) { toast("Your name is required"); return; }
    if (!model.trim()) { toast("A device model is required"); return; }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) { toast("Quantity must be a positive number"); return; }
    if (isOutbound && qty > currentBalance) { toast(`Only ${fmtNum(currentBalance)} available at this depot — can't move ${qty}`); return; }
    if (needsToDepot && !toDepotCode) { toast("A destination depot is required for a transfer"); return; }
    setSaving(true);
    runAction(() => data.recordMovement({
      depotCode, toDepotCode: needsToDepot ? toDepotCode : null,
      serial: serial.trim() || null, model: model.trim(),
      quantity: Number(quantity), movementType, reference: reference.trim(), recordedBy: recordedBy.trim(),
    }), "Movement recorded").then(() => { closeModal(); if (onSaved) onSaved(); }).finally(() => setSaving(false));
  }
  return React.createElement(Modal, { open: true, onClose: closeModal, wide: true, title: "Record Stock Movement", footer: React.createElement(React.Fragment, null,
    React.createElement("button", { className: "btn", onClick: closeModal }, "Cancel"),
    React.createElement("button", { className: "btn btn-primary", onClick: submit, disabled: saving }, saving ? "Saving…" : "Save Movement")) },
    React.createElement("div", { className: "field-grid" },
      React.createElement(FieldSelect, {
        label: "Depot", value: depotCode, onChange: setDepotCode,
        options: depotOptions.map((d) => [d.code, d.name + " (" + d.code + ")"]),
      }),
      React.createElement(FieldSelect, { label: "Movement type", value: movementType, onChange: setMovementType, options: MOVEMENT_TYPES.map((t) => [t.key, t.label]) })),
    needsToDepot && React.createElement(FieldSelect, {
      label: "Destination depot", value: toDepotCode, onChange: setToDepotCode,
      options: [["", "Select a depot…"]].concat(depotOptions.filter((d) => d.code !== depotCode).map((d) => [d.code, d.name + " (" + d.code + ")"])),
    }),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "Device model"),
      React.createElement("input", { className: "field-input", list: "movement-model-suggestions", value: model, onChange: (e) => setModel(e.target.value), placeholder: "e.g. A07/64" }),
      React.createElement("datalist", { id: "movement-model-suggestions" }, knownModels.map((m) => React.createElement("option", { value: m, key: m })))),
    isOutbound && model.trim() && React.createElement("div", { style: { fontSize: 11.5, color: currentBalance > 0 ? "var(--text-muted)" : "var(--critical)", marginTop: -6, marginBottom: 10 } },
      "Currently available at this depot: ", fmtNum(currentBalance)),
    React.createElement("div", { className: "field-grid" },
      React.createElement(FieldInput, { label: "Quantity", type: "number", min: "1", value: quantity, onChange: setQuantity }),
      React.createElement(FieldInput, { label: "Serial (optional, for one device)", value: serial, onChange: setSerial })),
    React.createElement(FieldTextarea, { label: "Note / reason", value: reference, onChange: setReference, rows: 2 }),
    React.createElement(FieldInput, { label: "Recorded by (your name)", value: recordedBy, onChange: setRecordedBy }));
}
