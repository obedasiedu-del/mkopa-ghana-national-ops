"use strict";
function ModalHost() {
    const { modal } = useApp();
    if (!modal)
        return null;
    switch (modal.type) {
        case "cce": return React.createElement(CceModal, { ...modal.props });
        case "submission": return React.createElement(SubmissionModal, { ...modal.props });
        case "ledger": return React.createElement(LedgerModal, { ...modal.props });
        case "bulkLedger": return React.createElement(BulkLedgerModal, { ...modal.props });
        case "bulkDepotStock": return React.createElement(BulkDepotStockModal, { ...modal.props });
        case "agentLedger": return React.createElement(AgentLedgerModal, { ...modal.props });
        case "clearLedger": return React.createElement(ClearLedgerConfirm, { ...modal.props });
        default: return null;
    }
}
