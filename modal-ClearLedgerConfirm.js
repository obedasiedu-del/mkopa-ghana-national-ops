"use strict";
function ClearLedgerConfirm() {
    const { data, closeModal, runAction } = useApp();
    const codes = Object.keys(data.deviceLedger);
    const totalDevices = codes.reduce((sum, c) => sum + (data.deviceLedger[c] || []).length, 0);
    return (React.createElement(Modal, { open: true, onClose: closeModal, title: "Clear All Devices", footer: React.createElement(React.Fragment, null,
            React.createElement("button", { className: "btn", onClick: closeModal }, "Cancel"),
            React.createElement("button", { className: "btn btn-danger", onClick: () => runAction(() => data.clearAllDeviceLedger(), "Cleared " + codes.length + " depot" + (codes.length === 1 ? "" : "s") + " — ready for a fresh paste").then(closeModal) }, "Delete Everything")) },
        React.createElement("div", { style: { fontSize: 13, lineHeight: 1.5 } },
            "This will permanently delete all ",
            totalDevices,
            " device",
            totalDevices === 1 ? "" : "s",
            " across ",
            codes.length,
            " depot",
            codes.length === 1 ? "" : "s",
            " and bucket",
            codes.length === 1 ? "" : "s",
            " (including Indirect Channel / Unrecognised) in Devices in Trade. It does not affect Depot Stock. This can't be undone \u2014 use it to start a clean paste.")));
}
