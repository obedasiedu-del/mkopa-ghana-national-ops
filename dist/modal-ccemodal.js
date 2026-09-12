"use strict";
function CceModal({ existing, presetDepotCode }) {
    const { data, scope, closeModal, runAction, toast } = useApp();
    const isEdit = !!existing;
    let depotOptions = depotsForScope(data.depots, "national").filter((d) => d.status === "active");
    if (scope !== "national" && !isEdit && !presetDepotCode)
        depotOptions = depotOptions.filter((d) => d.territory === scope);
    const initialDepot = isEdit ? existing.depotCode : (presetDepotCode || (depotOptions[0] && depotOptions[0].code) || "");
    const [depotCode, setDepotCode] = React.useState(initialDepot);
    const [name, setName] = React.useState(existing ? existing.name : "");
    const [phone, setPhone] = React.useState(existing ? existing.phone : "");
    const [status, setStatus] = React.useState(existing ? existing.status : "active");
    const [score, setScore] = React.useState(existing && typeof existing.score === "number" ? String(existing.score) : "");
    const [notes, setNotes] = React.useState(existing ? existing.notes : "");
    function save() {
        const scoreVal = score.trim() === "" ? null : Math.max(0, Math.min(100, Number(score)));
        const depotRec = data.depots[depotCode];
        const body = { name: name.trim(), phone: phone.trim(), status, score: scoreVal, notes: notes.trim(), depotCode, depotName: depotRec ? depotRec.name : "" };
        if (!body.name) {
            toast("Name is required");
            return;
        }
        if (isEdit)
            runAction(() => data.updateCce(existing.id, body), "Saved").then(closeModal);
        else
            runAction(() => data.addCce(body), "CCE added").then(closeModal);
    }
    return (React.createElement(Modal, { open: true, onClose: closeModal, title: isEdit ? "Edit CCE" : "Add CCE", footer: React.createElement(React.Fragment, null,
            React.createElement("button", { className: "btn", onClick: closeModal }, "Cancel"),
            React.createElement("button", { className: "btn btn-primary", onClick: save }, isEdit ? "Save" : "Add CCE")) },
        React.createElement("div", { className: "field-row" },
            React.createElement("div", { className: "field-label" }, "Depot"),
            React.createElement("select", { className: "field-input", value: depotCode, onChange: (e) => setDepotCode(e.target.value) }, depotOptions.map((d) => React.createElement("option", { key: d.code, value: d.code },
                d.name,
                " (",
                d.code,
                ")")))),
        React.createElement("div", { className: "field-grid" },
            React.createElement(FieldInput, { label: "Name", value: name, onChange: setName }),
            React.createElement(FieldInput, { label: "Phone", value: phone, onChange: setPhone })),
        React.createElement("div", { className: "field-grid" },
            React.createElement(FieldSelect, { label: "Status", value: status, onChange: setStatus, options: [["active", "Active"], ["inactive", "Inactive"]] }),
            React.createElement(FieldInput, { label: "Score (0\u2013100)", value: score, onChange: setScore, type: "number" })),
        React.createElement(FieldTextarea, { label: "Notes", value: notes, onChange: setNotes })));
}
