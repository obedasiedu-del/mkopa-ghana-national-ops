"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal, FieldInput, FieldSelect, FieldTextarea } from "../components/ui.js";
import { depotsForScope } from "../lib/selectors.js";
import { MOVEMENT_TYPES } from "../lib/domain.js";

export function RecordMovementModal({ depotCode: initialCode, onSaved }) {
  const { data, closeModal, runAction } = useApp();
  const depotOptions = React.useMemo(() => depotsForScope(data.depots, "national").filter((d) => d.status === "active"), [data.depots]);
  const [depotCode, setDepotCode] = React.useState(initialCode || (depotOptions[0] || {}).code || "");
  const [toDepotCode, setToDepotCode] = React.useState("");
  const [movementType, setMovementType] = React.useState("transfer_out");
  const [serial, setSerial] = React.useState("");
  const [model, setModel] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [reference, setReference] = React.useState("");
  const [recordedBy, setRecordedBy] = React.useState("");
  const needsToDepot = movementType === "transfer_out" || movementType === "transfer_in";

  function submit() {
    if (!recordedBy.trim()) return;
    runAction(() => data.recordMovement({
      depotCode, toDepotCode: needsToDepot ? toDepotCode : null,
      serial: serial.trim() || null, model: model.trim() || null,
      quantity: Number(quantity) || 1, movementType, reference: reference.trim(), recordedBy: recordedBy.trim(),
    }), "Movement recorded").then(() => { closeModal(); if (onSaved) onSaved(); });
  }
  return React.createElement(Modal, { open: true, onClose: closeModal, wide: true, title: "Record Stock Movement", footer: React.createElement(React.Fragment, null,
    React.createElement("button", { className: "btn", onClick: closeModal }, "Cancel"),
    React.createElement("button", { className: "btn btn-primary", onClick: submit }, "Save Movement")) },
    React.createElement("div", { className: "field-grid" },
      React.createElement(FieldSelect, {
        label: "Depot", value: depotCode, onChange: setDepotCode,
        options: depotOptions.map((d) => [d.code, d.name + " (" + d.code + ")"]),
      }),
      React.createElement(FieldSelect, { label: "Movement type", value: movementType, onChange: setMovementType, options: MOVEMENT_TYPES.map((t) => [t.key, t.label]) })),
    needsToDepot && React.createElement(FieldSelect, {
      label: movementType === "transfer_out" ? "Transfer to depot" : "Transfer from depot", value: toDepotCode, onChange: setToDepotCode,
      options: [["", "Select a depot…"]].concat(depotOptions.filter((d) => d.code !== depotCode).map((d) => [d.code, d.name + " (" + d.code + ")"])),
    }),
    React.createElement("div", { className: "field-grid" },
      React.createElement(FieldInput, { label: "Model (optional)", value: model, onChange: setModel }),
      React.createElement(FieldInput, { label: "Serial (optional, for one device)", value: serial, onChange: setSerial })),
    React.createElement(FieldInput, { label: "Quantity", type: "number", value: quantity, onChange: setQuantity }),
    React.createElement(FieldTextarea, { label: "Note / reason", value: reference, onChange: setReference, rows: 2 }),
    React.createElement(FieldInput, { label: "Recorded by (your name)", value: recordedBy, onChange: setRecordedBy }));
}
