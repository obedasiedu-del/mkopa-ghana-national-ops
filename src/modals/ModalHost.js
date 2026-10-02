"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { SubmissionModal } from "./SubmissionModal.js";
import { LedgerModal } from "./LedgerModal.js";
import { BulkLedgerModal } from "./BulkLedgerModal.js";
import { BulkWarehouseStockModal } from "./BulkWarehouseStockModal.js";
import { BulkDepotStockModal } from "./BulkDepotStockModal.js";
import { BulkPsdsrModal } from "./BulkPsdsrModal.js";
import { BulkAgedSoldModal } from "./BulkAgedSoldModal.js";
import { PsdsrDetailModal } from "./PsdsrDetailModal.js";
import { ClockInDetailModal } from "./ClockInDetailModal.js";
import { BulkInventoryAccuracyModal } from "./BulkInventoryAccuracyModal.js";
import { BulkCcePerformanceModal } from "./BulkCcePerformanceModal.js";
import { BulkIndirectAccuracyModal } from "./BulkIndirectAccuracyModal.js";
import { BulkMovementModal } from "./BulkMovementModal.js";
import { ClearLedgerConfirm } from "./ClearLedgerConfirm.js";
import { RecordMovementModal } from "./RecordMovementModal.js";
import { AssignRoleModal } from "./AssignRoleModal.js";
import { ChangePasswordModal } from "./ChangePasswordModal.js";

export function ModalHost() {
  const { modal } = useApp();
  if (!modal) return null;
  switch (modal.type) {
    case "submission": return React.createElement(SubmissionModal, { ...modal.props });
    case "ledger": return React.createElement(LedgerModal, { ...modal.props });
    case "bulkLedger": return React.createElement(BulkLedgerModal, { ...modal.props });
    case "bulkWarehouseStock": return React.createElement(BulkWarehouseStockModal, { ...modal.props });
    case "bulkDepotStock": return React.createElement(BulkDepotStockModal, { ...modal.props });
    case "bulkPsdsr": return React.createElement(BulkPsdsrModal, { ...modal.props });
    case "bulkAgedSold": return React.createElement(BulkAgedSoldModal, { ...modal.props });
    case "psdsrDetail": return React.createElement(PsdsrDetailModal, { ...modal.props });
    case "clockInDetail": return React.createElement(ClockInDetailModal, { ...modal.props });
    case "bulkInventoryAccuracy": return React.createElement(BulkInventoryAccuracyModal, { ...modal.props });
    case "bulkCcePerformance": return React.createElement(BulkCcePerformanceModal, { ...modal.props });
    case "bulkIndirectAccuracy": return React.createElement(BulkIndirectAccuracyModal, { ...modal.props });
    case "bulkMovement": return React.createElement(BulkMovementModal, { ...modal.props });
    case "clearLedger": return React.createElement(ClearLedgerConfirm, { ...modal.props });
    case "recordMovement": return React.createElement(RecordMovementModal, { ...modal.props });
    case "assignRole": return React.createElement(AssignRoleModal, { ...modal.props });
    case "changePassword": return React.createElement(ChangePasswordModal, { ...modal.props });
    default: return null;
  }
}
