"use strict";
import React from "react";
import { supabaseClient } from "../supabaseClient.js";
import { PSEUDO_CODES } from "../lib/domain.js";

const PAGE_SIZE = 1000;

async function fetchAll(table, orderCol) {
  let all = [];
  let from = 0;
  for (;;) {
    let q = supabaseClient.from(table).select("*").range(from, from + PAGE_SIZE - 1);
    if (orderCol) q = q.order(orderCol, { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}
function chunkArr(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function useAppData() {
  const [depots, setDepots] = React.useState({});
  const [depotStock, setDepotStock] = React.useState({});
  const [submissionsByDepot, setSubmissionsByDepot] = React.useState({});
  const [ledgerBaseline, setLedgerBaseline] = React.useState({});
  const [deviceLedger, setDeviceLedger] = React.useState({});
  const [loaded, setLoaded] = React.useState(false);
  const [dbError, setDbError] = React.useState(null);

  const refreshDepots = React.useCallback(async () => {
    const rows = await fetchAll("depots", "name");
    const map = {};
    rows.forEach((r) => {
      map[r.code] = {
        code: r.code, name: r.name, region: r.region, status: r.status,
        scName: r.sc_name || "", scPhone: r.sc_phone || "", scStatus: r.sc_status || "vacant",
        scScore: r.sc_score === null || r.sc_score === undefined ? null : Number(r.sc_score),
        scNotes: r.sc_notes || "", isSynthetic: r.is_synthetic,
      };
    });
    setDepots(map);
  }, []);
  const refreshDepotStock = React.useCallback(async () => {
    const rows = await fetchAll("depot_stock");
    const map = {};
    rows.forEach((r) => { map[r.depot_code] = r.models || {}; });
    setDepotStock(map);
  }, []);
  const refreshSubmissions = React.useCallback(async () => {
    const rows = await fetchAll("submissions", "date");
    const map = {};
    rows.forEach((r) => {
      if (!map[r.depot_code]) map[r.depot_code] = [];
      map[r.depot_code].push({ date: r.date, submittedBy: r.submitted_by || "", models: r.models || {} });
    });
    Object.keys(map).forEach((code) => map[code].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)));
    setSubmissionsByDepot(map);
  }, []);
  const refreshLedgerBaseline = React.useCallback(async () => {
    const rows = await fetchAll("device_ledger_baseline");
    const map = {};
    rows.forEach((r) => { map[r.depot_code] = { baselineSetAt: r.baseline_set_at, baselineSetBy: r.baseline_set_by || "" }; });
    setLedgerBaseline(map);
  }, []);
  const refreshDeviceLedger = React.useCallback(async () => {
    const rows = await fetchAll("device_ledger");
    const map = {};
    rows.forEach((r) => {
      if (!map[r.depot_code]) map[r.depot_code] = [];
      map[r.depot_code].push({
        serial: r.serial, model: r.model || "", shopName: r.shop_name || "", dsrName: r.dsr_name || "",
        allocatedDate: r.allocated_date, status: r.status,
        statusUpdatedAt: r.status_updated_at, statusUpdatedBy: r.status_updated_by || "",
      });
    });
    setDeviceLedger(map);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([refreshDepots(), refreshDepotStock(), refreshSubmissions(), refreshLedgerBaseline(), refreshDeviceLedger()]);
        if (!cancelled) setLoaded(true);
      } catch (e) {
        if (!cancelled) setDbError(e);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshDepots, refreshDepotStock, refreshSubmissions, refreshLedgerBaseline, refreshDeviceLedger]);

  // Debounced realtime refresh -- a bulk paste can insert thousands of device_ledger rows in one
  // go, and Postgres realtime fires one event PER row; without coalescing, that would trigger
  // thousands of full refetches back-to-back and freeze the tab. Any burst of change events for a
  // table collapses into a single refetch ~350ms after the last one.
  const timers = React.useRef({});
  const refreshers = {
    depots: refreshDepots, depot_stock: refreshDepotStock,
    submissions: refreshSubmissions, device_ledger_baseline: refreshLedgerBaseline, device_ledger: refreshDeviceLedger,
  };
  React.useEffect(() => {
    const channel = supabaseClient.channel("national-ops-changes");
    Object.keys(refreshers).forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        clearTimeout(timers.current[table]);
        timers.current[table] = setTimeout(() => { refreshers[table](); }, 350);
      });
    });
    channel.subscribe();
    return () => { supabaseClient.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDepotField = React.useCallback(async (code, patch) => {
    const body = {};
    if ("scName" in patch) body.sc_name = patch.scName;
    if ("scPhone" in patch) body.sc_phone = patch.scPhone;
    if ("scStatus" in patch) body.sc_status = patch.scStatus;
    if ("scScore" in patch) body.sc_score = patch.scScore;
    if ("scNotes" in patch) body.sc_notes = patch.scNotes;
    body.updated_at = new Date().toISOString();
    const { error } = await supabaseClient.from("depots").update(body).eq("code", code);
    if (error) throw error;
    await refreshDepots();
  }, [refreshDepots]);

  const saveDeviceModels = React.useCallback(async (depotCode, modelsObj) => {
    const { error } = await supabaseClient.from("depot_stock").upsert({
      depot_code: depotCode, models: modelsObj, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    await refreshDepotStock();
  }, [refreshDepotStock]);
  const saveDepotStockBulk = React.useCallback(async (byDepotModels) => {
    const codes = Object.keys(byDepotModels);
    if (!codes.length) throw new Error("No matched depots to save yet — check the depot names.");
    for (const batch of chunkArr(codes, 50)) {
      const rows = batch.map((code) => ({
        depot_code: code, models: byDepotModels[code], updated_at: new Date().toISOString(),
      }));
      const { error } = await supabaseClient.from("depot_stock").upsert(rows);
      if (error) throw error;
    }
    await refreshDepotStock();
    return codes.length;
  }, [refreshDepotStock]);

  const saveSubmission = React.useCallback(async (depotCode, dateStr, submittedBy, modelsObj) => {
    const { error } = await supabaseClient.from("submissions").upsert(
      { depot_code: depotCode, date: dateStr, submitted_by: submittedBy, models: modelsObj, updated_at: new Date().toISOString() },
      { onConflict: "depot_code,date" }
    );
    if (error) throw error;
    await refreshSubmissions();
  }, [refreshSubmissions]);

  const writeLedgerBaseline = React.useCallback(async (depotCode, setBy, devicesArr) => {
    const { error: delErr } = await supabaseClient.from("device_ledger").delete().eq("depot_code", depotCode);
    if (delErr) throw delErr;
    if (devicesArr.length) {
      const rows = devicesArr.map((d) => ({
        depot_code: depotCode, serial: d.serial, model: d.model, shop_name: d.shopName,
        dsr_name: d.dsrName, allocated_date: d.allocatedDate, status: d.status || "in_stock",
      }));
      for (const batch of chunkArr(rows, 500)) {
        const { error } = await supabaseClient.from("device_ledger").insert(batch);
        if (error) throw error;
      }
    }
    const { error: baseErr } = await supabaseClient.from("device_ledger_baseline").upsert({
      depot_code: depotCode, baseline_set_at: new Date().toISOString(), baseline_set_by: String(setBy).trim(),
      updated_at: new Date().toISOString(),
    });
    if (baseErr) throw baseErr;
  }, []);
  const saveLedgerBaseline = React.useCallback(async (depotCode, setBy, devicesArr) => {
    if (!setBy || !String(setBy).trim()) throw new Error("Your name is required");
    if (!devicesArr.length) throw new Error("Paste at least one device row first");
    await writeLedgerBaseline(depotCode, setBy, devicesArr);
    await Promise.all([refreshDeviceLedger(), refreshLedgerBaseline()]);
  }, [writeLedgerBaseline, refreshDeviceLedger, refreshLedgerBaseline]);
  const saveLedgerBaselineBulk = React.useCallback(async (setBy, byDepotMap) => {
    if (!setBy || !String(setBy).trim()) throw new Error("Your name is required");
    const codes = Object.keys(byDepotMap);
    if (!codes.length) throw new Error("No matched devices to save yet — check the shop names.");
    await Promise.all(codes.map((code) => writeLedgerBaseline(code, setBy, byDepotMap[code])));
    await Promise.all([refreshDeviceLedger(), refreshLedgerBaseline()]);
    return codes.reduce((sum, c) => sum + byDepotMap[c].length, 0);
  }, [writeLedgerBaseline, refreshDeviceLedger, refreshLedgerBaseline]);
  const clearAllDeviceLedger = React.useCallback(async () => {
    const { error: e1 } = await supabaseClient.from("device_ledger").delete().neq("depot_code", "__none__");
    if (e1) throw e1;
    const { error: e2 } = await supabaseClient.from("device_ledger_baseline").delete().neq("depot_code", "__none__");
    if (e2) throw e2;
    await Promise.all([refreshDeviceLedger(), refreshLedgerBaseline()]);
  }, [refreshDeviceLedger, refreshLedgerBaseline]);
  const updateDeviceStatus = React.useCallback(async (depotCode, serial, newStatus, updatedBy) => {
    const { error } = await supabaseClient.from("device_ledger").update({
      status: newStatus, status_updated_at: new Date().toISOString(), status_updated_by: updatedBy || "",
    }).eq("depot_code", depotCode).eq("serial", serial);
    if (error) throw error;
    await refreshDeviceLedger();
  }, [refreshDeviceLedger]);

  // Stock Movement and Audit History are fetched on demand (scoped, paginated) rather than
  // held in global state -- both tables grow unboundedly (every device_ledger/depot_stock/
  // submissions/depots change writes an audit_log row via trigger) so eagerly loading them
  // the way the other tables are loaded would not scale.
  const fetchMovements = React.useCallback(async ({ depotCode, limit = 200 } = {}) => {
    let q = supabaseClient.from("stock_movements").select("*").order("moved_at", { ascending: false }).limit(limit);
    if (depotCode) q = q.or(`depot_code.eq.${depotCode},to_depot_code.eq.${depotCode}`);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id, depotCode: r.depot_code, toDepotCode: r.to_depot_code, serial: r.serial, model: r.model,
      quantity: r.quantity, movementType: r.movement_type, reference: r.reference,
      movedAt: r.moved_at, recordedBy: r.recorded_by,
    }));
  }, []);
  const recordMovement = React.useCallback(async (payload) => {
    const { error } = await supabaseClient.from("stock_movements").insert({
      depot_code: payload.depotCode || null,
      to_depot_code: payload.toDepotCode || null,
      serial: payload.serial || null,
      model: payload.model || null,
      quantity: payload.quantity ?? 1,
      movement_type: payload.movementType,
      reference: payload.reference || null,
      moved_at: payload.movedAt || new Date().toISOString(),
      recorded_by: payload.recordedBy || null,
    });
    if (error) throw error;
  }, []);
  const fetchAuditLog = React.useCallback(async ({ depotCode, limit = 200 } = {}) => {
    let q = supabaseClient.from("audit_log").select("*").order("occurred_at", { ascending: false }).limit(limit);
    if (depotCode) q = q.eq("depot_code", depotCode);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id, tableName: r.table_name, rowId: r.row_id, depotCode: r.depot_code, action: r.action,
      oldValue: r.old_value, newValue: r.new_value, actor: r.actor, occurredAt: r.occurred_at,
    }));
  }, []);

  return {
    depots, depotStock, submissionsByDepot, ledgerBaseline, deviceLedger,
    loaded, dbError, pseudoCodes: PSEUDO_CODES,
    saveDepotField, saveDeviceModels, saveDepotStockBulk, saveSubmission,
    saveLedgerBaseline, saveLedgerBaselineBulk, clearAllDeviceLedger, updateDeviceStatus,
    fetchMovements, recordMovement, fetchAuditLog,
  };
}
