"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { SubmissionModal } from "./SubmissionModal.js";
import { LedgerModal } from "./LedgerModal.js";
import { BulkLedgerModal } from "./BulkLedgerModal.js";
import { BulkWarehouseStockModal } from "./BulkWarehouseStockModal.js";
import { BulkDepotStockModal } from "./BulkDepotStockModal.js";
import { BulkMovementModal } from "./BulkMovementModal.js";
import { AgentLedgerModal } from "./AgentLedgerModal.js";
import { ClearLedgerConfirm } from "./ClearLedgerConfirm.js";
import { RecordMovementModal } from "./RecordMovementModal.js";

export function ModalHost() {
  const { modal } = useApp();
  if (!modal) return null;
  switch (modal.type) {
    case "submission": return React.createElement(SubmissionModal, { ...modal.props });
    case "ledger": return React.createElement(LedgerModal, { ...modal.props });
    case "bulkLedger": return React.createElement(BulkLedgerModal, { ...modal.props });
    case "bulkWarehouseStock": return React.createElement(BulkWarehouseStockModal, { ...modal.props });
    case "bulkDepotStock": return React.createElement(BulkDepotStockModal, { ...modal.props });
    case "bulkMovement": return React.createElement(BulkMovementModal, { ...modal.props });
    case "agentLedger": return React.createElement(AgentLedgerModal, { ...modal.props });
    case "clearLedger": return React.createElement(ClearLedgerConfirm, { ...modal.props });
    case "recordMovement": return React.createElement(RecordMovementModal, { ...modal.props });
    default: return null;
  }
}
