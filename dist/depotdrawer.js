"use strict";
function DepotDrawer() {
    const { data, drawerDepotCode, drawerFocus, closeDrawer, openModal, runAction } = useApp();
    const rec = drawerDepotCode ? data.depots[drawerDepotCode] : null;
    const devSectionRef = React.useRef(null);
    const [scName, setScName] = React.useState("");
    const [scPhone, setScPhone] = React.useState("");
    const [scStatus, setScStatus] = React.useState("vacant");
    const [scScore, setScScore] = React.useState("");
    const [scNotes, setScNotes] = React.useState("");
    const [models, setModels] = React.useState({});
    const [newModel, setNewModel] = React.useState("");
    React.useEffect(() => {
        if (!rec)
            return;
        setScName(rec.scName || "");
        setScPhone(rec.scPhone || "");
        setScStatus(rec.scStatus || "vacant");
        setScScore(rec.scScore === null || rec.scScore === undefined ? "" : String(rec.scScore));
        setScNotes(rec.scNotes || "");
        const m = { ...(data.depotStock[rec.code] || {}) };
        DEVICE_MODEL_SUGGESTIONS.forEach((mm) => { if (!m[mm])
            m[mm] = { inStock: 0, returned: 0 }; });
        setModels(m);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rec && rec.code]);
    React.useEffect(() => {
        if (drawerFocus === "devices" && devSectionRef.current) {
            setTimeout(() => devSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
        }
    }, [drawerFocus, drawerDepotCode]);
    if (!rec)
        return React.createElement(Drawer, { open: false, onClose: closeDrawer });
    const cceList = Object.values(data.cces).filter((c) => c.depotCode === rec.code);
    function saveSc() {
        const scoreVal = scScore.trim() === "" ? null : Math.max(0, Math.min(100, Number(scScore)));
        runAction(() => data.saveDepotField(rec.code, { scName: scName.trim(), scPhone: scPhone.trim(), scStatus, scScore: scoreVal, scNotes: scNotes.trim() }), "Saved");
    }
    function saveModels() {
        runAction(() => data.saveDeviceModels(rec.code, models), "Stock updated");
    }
    return (React.createElement(Drawer, { open: !!drawerDepotCode, onClose: closeDrawer },
        React.createElement("div", { className: "drawer-header" },
            React.createElement("div", null,
                React.createElement("div", { className: "drawer-title" }, rec.name),
                React.createElement("div", { className: "drawer-sub" },
                    rec.code,
                    " \u00B7 ",
                    rec.territory,
                    rec.status === "closed" ? " · Closed" : "")),
            React.createElement("button", { className: "icon-btn", onClick: closeDrawer }, "\u2715")),
        React.createElement("div", { className: "drawer-body" },
            React.createElement("div", { className: "drawer-section" },
                React.createElement("div", { className: "drawer-section-title" }, "Stock Controller"),
                React.createElement("div", { className: "field-grid" },
                    React.createElement(FieldInput, { label: "Name", value: scName, onChange: setScName }),
                    React.createElement(FieldInput, { label: "Phone", value: scPhone, onChange: setScPhone })),
                React.createElement("div", { className: "field-grid" },
                    React.createElement(FieldSelect, { label: "Status", value: scStatus, onChange: setScStatus, options: [["active", "Active"], ["leave", "On Leave"], ["vacant", "Vacant"]] }),
                    React.createElement(FieldInput, { label: "Score (0\u2013100)", value: scScore, onChange: setScScore, type: "number" })),
                React.createElement(FieldTextarea, { label: "Notes", value: scNotes, onChange: setScNotes }),
                React.createElement("button", { className: "btn btn-primary btn-sm", onClick: saveSc }, "Save Stock Controller")),
            React.createElement("div", { className: "drawer-section" },
                React.createElement("div", { className: "drawer-section-title" },
                    "CCEs at this depot",
                    React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => openModal("cce", { existing: null, presetDepotCode: rec.code }) }, "+ Add")),
                cceList.length === 0 && React.createElement("div", { style: { fontSize: 12.5, color: "var(--text-faint)" } }, "No CCEs recorded for this depot yet."),
                cceList.map((c) => (React.createElement("div", { className: "mini-list-item", key: c.id },
                    React.createElement("div", { className: "info" },
                        React.createElement("div", { className: "name" }, c.name || "—"),
                        React.createElement("div", { className: "meta" },
                            c.status === "inactive" ? "Inactive" : "Active",
                            typeof c.score === "number" ? " · score " + c.score : "",
                            c.phone ? " · " + c.phone : "")),
                    React.createElement("div", { className: "actions" },
                        React.createElement("button", { className: "icon-btn", title: "Edit", onClick: () => openModal("cce", { existing: c }) }, "\u270E"),
                        React.createElement("button", { className: "icon-btn", title: "Remove", onClick: () => { if (confirm("Remove " + (c.name || "this CCE") + "?"))
                                runAction(() => data.deleteCce(c.id), "Removed"); } }, "\u2715")))))),
            React.createElement("div", { className: "drawer-section", ref: devSectionRef },
                React.createElement("div", { className: "drawer-section-title" }, "Device stock"),
                React.createElement("div", { className: "device-model-head" },
                    React.createElement("div", null, "Model"),
                    React.createElement("div", null, "In stock"),
                    React.createElement("div", null, "Returned"),
                    React.createElement("div", null)),
                React.createElement("div", null, Object.keys(models).map((m) => (React.createElement("div", { className: "device-model-row", key: m },
                    React.createElement("input", { className: "field-input mono", value: m, disabled: true }),
                    React.createElement("input", { className: "field-input mono", type: "number", min: "0", value: models[m].inStock || 0, onChange: (e) => setModels({ ...models, [m]: { ...models[m], inStock: Number(e.target.value) || 0 } }) }),
                    React.createElement("input", { className: "field-input mono", type: "number", min: "0", value: models[m].returned || 0, onChange: (e) => setModels({ ...models, [m]: { ...models[m], returned: Number(e.target.value) || 0 } }) }),
                    React.createElement("button", { className: "icon-btn", title: "Remove model", onClick: () => { const m2 = { ...models }; delete m2[m]; setModels(m2); } }, "\u2715"))))),
                React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 8 } },
                    React.createElement("input", { className: "field-input", placeholder: "Add model (e.g. A26)", list: "model-suggestions", value: newModel, onChange: (e) => setNewModel(e.target.value) }),
                    React.createElement("datalist", { id: "model-suggestions" }, DEVICE_MODEL_SUGGESTIONS.map((m) => React.createElement("option", { value: m, key: m }))),
                    React.createElement("button", { className: "btn btn-sm", onClick: () => {
                            const m = newModel.trim();
                            if (!m)
                                return;
                            if (!models[m])
                                setModels({ ...models, [m]: { inStock: 0, returned: 0 } });
                            setNewModel("");
                        } }, "Add")),
                React.createElement("button", { className: "btn btn-primary btn-sm", style: { marginTop: 12 }, onClick: saveModels }, "Save device stock")))));
}
