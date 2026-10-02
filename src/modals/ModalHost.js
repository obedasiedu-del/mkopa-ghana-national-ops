"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";

// Every modal is lazy-loaded -- only one is ever mounted at a time (the switch below), so
// there's no reason to ship all 18 of them (most are National-Admin-only bulk uploaders a
// Stock Controller never opens) in everyone's initial bundle. The brief Suspense gap on
// first open of a given modal is a better trade than paying for all of them up front,
// especially on a slow connection.
const SubmissionModal = React.lazy(() => import("./SubmissionModal.js").then((m) => ({ default: m.SubmissionModal })));
const LedgerModal = React.lazy(() => import("./LedgerModal.js").then((m) => ({ default: m.LedgerModal })));
const BulkLedgerModal = React.lazy(() => import("./BulkLedgerModal.js").then((m) => ({ default: m.BulkLedgerModal })));
const BulkWarehouseStockModal = React.lazy(() => import("./BulkWarehouseStockModal.js").then((m) => ({ default: m.BulkWarehouseStockModal })));
const BulkDepotStockModal = React.lazy(() => import("./BulkDepotStockModal.js").then((m) => ({ default: m.BulkDepotStockModal })));
const BulkPsdsrModal = React.lazy(() => import("./BulkPsdsrModal.js").then((m) => ({ default: m.BulkPsdsrModal })));
const BulkAgedSoldModal = React.lazy(() => import("./BulkAgedSoldModal.js").then((m) => ({ default: m.BulkAgedSoldModal })));
const PsdsrDetailModal = React.lazy(() => import("./PsdsrDetailModal.js").then((m) => ({ default: m.PsdsrDetailModal })));
const ClockInDetailModal = React.lazy(() => import("./ClockInDetailModal.js").then((m) => ({ default: m.ClockInDetailModal })));
const ReallocationsDetailModal = React.lazy(() => import("./ReallocationsDetailModal.js").then((m) => ({ default: m.ReallocationsDetailModal })));
const BulkInventoryAccuracyModal = React.lazy(() => import("./BulkInventoryAccuracyModal.js").then((m) => ({ default: m.BulkInventoryAccuracyModal })));
const BulkCcePerformanceModal = React.lazy(() => import("./BulkCcePerformanceModal.js").then((m) => ({ default: m.BulkCcePerformanceModal })));
const BulkIndirectAccuracyModal = React.lazy(() => import("./BulkIndirectAccuracyModal.js").then((m) => ({ default: m.BulkIndirectAccuracyModal })));
const BulkMovementModal = React.lazy(() => import("./BulkMovementModal.js").then((m) => ({ default: m.BulkMovementModal })));
const ClearLedgerConfirm = React.lazy(() => import("./ClearLedgerConfirm.js").then((m) => ({ default: m.ClearLedgerConfirm })));
const RecordMovementModal = React.lazy(() => import("./RecordMovementModal.js").then((m) => ({ default: m.RecordMovementModal })));
const AssignRoleModal = React.lazy(() => import("./AssignRoleModal.js").then((m) => ({ default: m.AssignRoleModal })));
const ChangePasswordModal = React.lazy(() => import("./ChangePasswordModal.js").then((m) => ({ default: m.ChangePasswordModal })));

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
    case "reallocations": return React.createElement(ReallocationsDetailModal, { ...modal.props });
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
