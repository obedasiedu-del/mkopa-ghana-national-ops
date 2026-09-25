"use strict";
import React from "react";
import { supabaseClient } from "../supabaseClient.js";
import { PSEUDO_CODES, WAREHOUSE_PENDING_ENABLED } from "../lib/domain.js";

const PAGE_SIZE = 1000;
// How many pages of one table are ever in flight at once. warehouse_pending_stock alone is
// 70,000+ rows (70+ pages) -- firing all of those at once (no cap) hits Supabase's
// connection pooler hard enough to start failing under load, which is worse than the
// original one-at-a-time fetch it was meant to replace. A bounded batch keeps the big win
// (70+ sequential round trips collapse to ~9 batches) without overwhelming the pooler.
const FETCH_CONCURRENCY = 8;

function buildPageQuery(table, orderCol, from) {
  let q = supabaseClient.from(table).select("*").range(from, from + PAGE_SIZE - 1);
  if (orderCol) q = q.order(orderCol, { ascending: true });
  return q;
}
async function fetchAll(table, orderCol) {
  const { count, error: countErr } = await supabaseClient.from(table).select("*", { count: "exact", head: true });
  if (countErr) throw countErr;
  const total = count || 0;
  if (total === 0) return [];
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const pageRows = new Array(pageCount);
  await runWithConcurrency(Array.from({ length: pageCount }, (_, p) => p), FETCH_CONCURRENCY, async (p) => {
    const { data, error } = await buildPageQuery(table, orderCol, p * PAGE_SIZE);
    if (error) throw error;
    pageRows[p] = data || [];
  });
  const all = [];
  for (const rows of pageRows) all.push(...rows);
  return all;
}
function chunkArr(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
// Firing one write per depot all at once (Promise.all across 80-100+ depots) was enough
// concurrent load against Supabase to trip a statement timeout on a large upload (a
// depot's DELETE landing but its replacement INSERT never finishing is the failure mode
// that actually loses data) -- a small fixed concurrency keeps throughput reasonable
// without hammering the database with that many simultaneous connections.
async function runWithConcurrency(items, limit, fn) {
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export function useAppData() {
  const [depots, setDepots] = React.useState({});
  const [stockBalances, setStockBalances] = React.useState({});
  const [submissionsByDepot, setSubmissionsByDepot] = React.useState({});
  const [ledgerBaseline, setLedgerBaseline] = React.useState({});
  const [deviceLedger, setDeviceLedger] = React.useState({});
  const [warehousePending, setWarehousePending] = React.useState({});
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
  // Devices at Depot is computed, not edited: depot_stock_balances is a view rolling up
  // stock_movements into Received / Issued / Remaining per depot+model (see the
  // movement-derived-stock migration). Keyed depots[code][model] = { received, issued, remaining }.
  const refreshStockBalances = React.useCallback(async () => {
    const rows = await fetchAll("depot_stock_balances");
    const map = {};
    rows.forEach((r) => {
      if (!map[r.depot_code]) map[r.depot_code] = {};
      map[r.depot_code][r.model] = { received: r.received || 0, issued: r.issued || 0, remaining: r.remaining || 0 };
    });
    setStockBalances(map);
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
        allocatedDate: r.allocated_date, initialAllocatedDate: r.initial_allocated_date || r.allocated_date, status: r.status,
        statusUpdatedAt: r.status_updated_at, statusUpdatedBy: r.status_updated_by || "",
      });
    });
    setDeviceLedger(map);
  }, []);
  // Warehouse-held stock that's earmarked for a depot but not physically there yet (still
  // sitting in a warehouse, per the source tracker's own "Warehouse Stock" state) -- kept
  // separate from device_ledger/stockBalances so it's never mistaken for on-hand stock.
  const refreshWarehousePending = React.useCallback(async () => {
    const rows = await fetchAll("warehouse_pending_stock");
    const map = {};
    rows.forEach((r) => {
      if (!map[r.depot_code]) map[r.depot_code] = [];
      map[r.depot_code].push({
        serial: r.serial, model: r.model || "", shopName: r.current_owner_label || "",
        manifestDate: r.manifest_date, allocatedDate: r.warehouse_since_date, initialAllocatedDate: r.warehouse_since_date,
        status: "in_stock",
      });
    });
    setWarehousePending(map);
  }, []);

  // Not every rejection is a plain Error with a .message -- a Postgrest error object with
  // an empty message, or something that isn't an Error at all, stringifies to the useless
  // "[object Object]" via template interpolation. Fall back to the object's own fields
  // (JSON.stringify) before giving up, so the banner always shows something diagnosable.
  function describeError(e) {
    if (!e) return "Unknown error";
    if (typeof e === "string") return e;
    if (e.message) return e.message + (e.code ? ` (code ${e.code})` : "");
    try {
      const s = JSON.stringify(e);
      if (s && s !== "{}") return s;
    } catch (_jsonErr) { /* fall through */ }
    return String(e);
  }
  // Tags a refresh failure with which table it came from -- Supabase/fetch errors don't
  // self-identify the source, and without this every failure collapses into the same
  // generic message, leaving no way to tell a network drop from an RLS/permission issue
  // from the resulting banner alone.
  function tagSource(name, fn) {
    return fn().catch((e) => { throw new Error(`[${name}] ${describeError(e)}`); });
  }
  const loadAllTagged = React.useCallback(() => {
    const tasks = [
      tagSource("depots", refreshDepots), tagSource("stock balances", refreshStockBalances),
      tagSource("submissions", refreshSubmissions), tagSource("ledger baseline", refreshLedgerBaseline),
      tagSource("device ledger", refreshDeviceLedger),
    ];
    if (WAREHOUSE_PENDING_ENABLED) tasks.push(tagSource("warehouse pending", refreshWarehousePending));
    return Promise.all(tasks);
  }, [refreshDepots, refreshStockBalances, refreshSubmissions, refreshLedgerBaseline, refreshDeviceLedger, refreshWarehousePending]);
  const loadAll = React.useCallback(async () => {
    try {
      setDbError(null);
      await loadAllTagged();
      setLoaded(true);
    } catch (e) {
      setDbError(e);
    }
  }, [loadAllTagged]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadAllTagged();
        if (!cancelled) setLoaded(true);
      } catch (e) {
        if (!cancelled) setDbError(e);
      }
    })();
    return () => { cancelled = true; };
  }, [loadAllTagged]);

  // Debounced realtime refresh -- a bulk paste can insert thousands of device_ledger rows in one
  // go, and Postgres realtime fires one event PER row; without coalescing, that would trigger
  // thousands of full refetches back-to-back and freeze the tab. Any burst of change events for a
  // table collapses into a single refetch ~350ms after the last one.
  const timers = React.useRef({});
  const refreshers = {
    depots: refreshDepots, stock_movements: refreshStockBalances,
    submissions: refreshSubmissions, device_ledger_baseline: refreshLedgerBaseline, device_ledger: refreshDeviceLedger,
    ...(WAREHOUSE_PENDING_ENABLED ? { warehouse_pending_stock: refreshWarehousePending } : {}),
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
    setDepots((prev) => (prev[code] ? { ...prev, [code]: { ...prev[code], ...patch } } : prev));
  }, []);

  const saveSubmission = React.useCallback(async (depotCode, dateStr, submittedBy, modelsObj) => {
    const { error } = await supabaseClient.from("submissions").upsert(
      { depot_code: depotCode, date: dateStr, submitted_by: submittedBy, models: modelsObj, updated_at: new Date().toISOString() },
      { onConflict: "depot_code,date" }
    );
    if (error) throw error;
    const entry = { date: dateStr, submittedBy: submittedBy || "", models: modelsObj };
    setSubmissionsByDepot((prev) => {
      const list = prev[depotCode] || [];
      const idx = list.findIndex((s) => s.date === dateStr);
      const nextList = idx === -1
        ? list.concat(entry).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
        : list.map((s, i) => (i === idx ? entry : s));
      return { ...prev, [depotCode]: nextList };
    });
  }, []);

  const writeLedgerBaseline = React.useCallback(async (depotCode, setBy, devicesArr) => {
    const { error: delErr } = await supabaseClient.from("device_ledger").delete().eq("depot_code", depotCode);
    if (delErr) throw delErr;
    if (devicesArr.length) {
      const rows = devicesArr.map((d) => ({
        depot_code: depotCode, serial: d.serial, model: d.model, shop_name: d.shopName,
        dsr_name: d.dsrName, allocated_date: d.allocatedDate, initial_allocated_date: d.initialAllocatedDate || d.allocatedDate, status: d.status || "in_stock",
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
    await runWithConcurrency(codes, 4, (code) => writeLedgerBaseline(code, setBy, byDepotMap[code]));
    await Promise.all([refreshDeviceLedger(), refreshLedgerBaseline()]);
    return codes.reduce((sum, c) => sum + byDepotMap[c].length, 0);
  }, [writeLedgerBaseline, refreshDeviceLedger, refreshLedgerBaseline]);
  // Full-replace write for one depot's warehouse-pending rows -- same delete-then-insert
  // shape as writeLedgerBaseline, but there's no baseline table for this one.
  const writeWarehousePending = React.useCallback(async (depotCode, rowsArr) => {
    const { error: delErr } = await supabaseClient.from("warehouse_pending_stock").delete().eq("depot_code", depotCode);
    if (delErr) throw delErr;
    // warehouse_since_date is NOT NULL -- a row missing it (and with no Manifest Date to
    // fall back to either) can't be placed on the aging clock this table exists for, so it's
    // dropped here rather than failing the whole chunk's insert.
    const usable = rowsArr.filter((r) => r.sinceDate || r.manifestDate);
    if (usable.length) {
      const rows = usable.map((r) => ({
        depot_code: depotCode, serial: r.serial, model: r.model || "",
        current_owner_label: r.ownerLabel || "", manifest_date: r.manifestDate || null,
        warehouse_since_date: r.sinceDate || r.manifestDate,
      }));
      for (const batch of chunkArr(rows, 500)) {
        const { error } = await supabaseClient.from("warehouse_pending_stock").insert(batch);
        if (error) throw error;
      }
    }
  }, []);
  const saveWarehousePendingBulk = React.useCallback(async (byDepotMap) => {
    const codes = Object.keys(byDepotMap);
    if (!codes.length) throw new Error("No matched rows to save yet — check the owner codes/names.");
    await runWithConcurrency(codes, 4, (code) => writeWarehousePending(code, byDepotMap[code]));
    await refreshWarehousePending();
    return codes.reduce((sum, c) => sum + byDepotMap[c].length, 0);
  }, [writeWarehousePending, refreshWarehousePending]);
  const clearAllDeviceLedger = React.useCallback(async () => {
    const { error: e1 } = await supabaseClient.from("device_ledger").delete().neq("depot_code", "__none__");
    if (e1) throw e1;
    const { error: e2 } = await supabaseClient.from("device_ledger_baseline").delete().neq("depot_code", "__none__");
    if (e2) throw e2;
    await Promise.all([refreshDeviceLedger(), refreshLedgerBaseline()]);
  }, [refreshDeviceLedger, refreshLedgerBaseline]);
  const updateDeviceStatus = React.useCallback(async (depotCode, serial, newStatus, updatedBy) => {
    const statusUpdatedAt = new Date().toISOString();
    const statusUpdatedBy = updatedBy || "";
    const { error } = await supabaseClient.from("device_ledger").update({
      status: newStatus, status_updated_at: statusUpdatedAt, status_updated_by: statusUpdatedBy,
    }).eq("depot_code", depotCode).eq("serial", serial);
    if (error) throw error;
    setDeviceLedger((prev) => {
      const list = prev[depotCode];
      if (!list) return prev;
      const idx = list.findIndex((d) => d.serial === serial);
      if (idx === -1) return prev;
      const nextList = list.slice();
      nextList[idx] = { ...nextList[idx], status: newStatus, statusUpdatedAt, statusUpdatedBy };
      return { ...prev, [depotCode]: nextList };
    });
  }, []);

  // Stock Movement and Audit History are fetched on demand (scoped, paginated) rather than
  // held in global state -- both tables grow unboundedly (every device_ledger/depot_stock/
  // submissions/depots change writes an audit_log row via trigger) so eagerly loading them
  // the way the other tables are loaded would not scale.
  const fetchMovements = React.useCallback(async ({ depotCode, depotCodes, model, sinceIso, untilIso, limit = 200 } = {}) => {
    let q = supabaseClient.from("stock_movements").select("*").order("moved_at", { ascending: false }).limit(limit);
    if (depotCode) q = q.or(`depot_code.eq.${depotCode},to_depot_code.eq.${depotCode}`);
    else if (depotCodes && depotCodes.length) {
      const list = depotCodes.join(",");
      q = q.or(`depot_code.in.(${list}),to_depot_code.in.(${list})`);
    }
    if (model) q = q.eq("model", model);
    if (sinceIso) q = q.gte("moved_at", sinceIso);
    if (untilIso) q = q.lte("moved_at", untilIso);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id, depotCode: r.depot_code, toDepotCode: r.to_depot_code, serial: r.serial, model: r.model,
      quantity: r.quantity, movementType: r.movement_type, reference: r.reference,
      movedAt: r.moved_at, recordedBy: r.recorded_by,
    }));
  }, []);
  // Client-side checks catch the common mistakes with a clear message; the DB trigger
  // (fn_check_stock_movement_quantity) is the actual source of truth and also blocks
  // writes made outside this app, e.g. direct API calls.
  function validateMovementPayload(payload) {
    if (!payload.depotCode) throw new Error("A depot is required");
    if (!payload.model || !payload.model.trim()) throw new Error("A device model is required");
    if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) throw new Error("Quantity must be a positive number");
    if (payload.movementType === "transfer" && !payload.toDepotCode) throw new Error("A destination depot is required for a transfer");
  }
  const recordMovement = React.useCallback(async (payload) => {
    validateMovementPayload(payload);
    const { error } = await supabaseClient.from("stock_movements").insert({
      depot_code: payload.depotCode,
      to_depot_code: payload.toDepotCode || null,
      serial: payload.serial || null,
      model: payload.model.trim(),
      quantity: payload.quantity,
      movement_type: payload.movementType,
      reference: payload.reference || null,
      moved_at: payload.movedAt || new Date().toISOString(),
      recorded_by: payload.recordedBy || null,
    });
    if (error) throw error;
    await refreshStockBalances();
  }, [refreshStockBalances]);
  // Used by the "Upload Stock (All Depots)" bulk paste: one receipt movement per
  // depot+model with a nonzero In Stock count, one return movement per nonzero Returned
  // count. Runs as a single batched insert per chunk, same pattern as the device-ledger
  // bulk upload.
  const recordReceiptsBulk = React.useCallback(async (byDepotModels, recordedBy) => {
    const rows = [];
    Object.keys(byDepotModels).forEach((depotCode) => {
      Object.keys(byDepotModels[depotCode]).forEach((model) => {
        const { inStock, returned } = byDepotModels[depotCode][model];
        if (inStock > 0) rows.push({ depot_code: depotCode, model, quantity: inStock, movement_type: "receipt", reference: "Bulk stock upload", recorded_by: recordedBy || null });
        if (returned > 0) rows.push({ depot_code: depotCode, model, quantity: returned, movement_type: "return", reference: "Bulk stock upload", recorded_by: recordedBy || null });
      });
    });
    if (!rows.length) throw new Error("No positive quantities to save — check the pasted data.");
    for (const batch of chunkArr(rows, 500)) {
      const { error } = await supabaseClient.from("stock_movements").insert(batch);
      if (error) throw error;
    }
    await refreshStockBalances();
    return rows.length;
  }, [refreshStockBalances]);
  // Used by the "Upload Stock Movements" bulk paste -- rows already have movementType/
  // depotCode/toDepotCode resolved by parseMovementPaste. Inserted in chunks of 300 so a
  // row that would violate the stock-balance trigger only fails its own chunk, and the
  // error says how many rows landed before it, rather than losing the whole paste to one
  // bad row deep in a 3,000-row file.
  const recordMovementsBulk = React.useCallback(async (rows, defaultRecordedBy) => {
    if (!rows.length) throw new Error("No valid movement rows to save — check the pasted data.");
    const chunks = chunkArr(rows, 300);
    for (let i = 0; i < chunks.length; i++) {
      const batch = chunks[i].map((r) => ({
        depot_code: r.depotCode, to_depot_code: r.toDepotCode || null,
        serial: r.serial || null, model: r.model, quantity: r.quantity,
        movement_type: r.movementType, reference: r.reference || null,
        moved_at: r.movedAt || new Date().toISOString(),
        recorded_by: r.recordedBy || defaultRecordedBy || null,
      }));
      const { error } = await supabaseClient.from("stock_movements").insert(batch);
      if (error) {
        const done = i * 300;
        throw new Error(`Saved ${done} of ${rows.length} rows, then stopped at row ${done + 1}: ${error.message}`);
      }
    }
    await refreshStockBalances();
    return rows.length;
  }, [refreshStockBalances]);
  // Lightweight counts for the National/Region "Stock Movement" KPI -- a head-only count
  // query rather than pulling rows, so this stays cheap regardless of history size.
  const fetchMovementCount = React.useCallback(async ({ depotCodes, sinceIso } = {}) => {
    let q = supabaseClient.from("stock_movements").select("id", { count: "exact", head: true });
    if (depotCodes && depotCodes.length) {
      const list = depotCodes.join(",");
      q = q.or(`depot_code.in.(${list}),to_depot_code.in.(${list})`);
    }
    if (sinceIso) q = q.gte("moved_at", sinceIso);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  }, []);
  const fetchAuditLog = React.useCallback(async ({ depotCode, depotCodes, sinceIso, untilIso, limit = 200 } = {}) => {
    let q = supabaseClient.from("audit_log").select("*").order("occurred_at", { ascending: false }).limit(limit);
    if (depotCode) q = q.eq("depot_code", depotCode);
    else if (depotCodes && depotCodes.length) q = q.in("depot_code", depotCodes);
    if (sinceIso) q = q.gte("occurred_at", sinceIso);
    if (untilIso) q = q.lte("occurred_at", untilIso);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id, tableName: r.table_name, rowId: r.row_id, depotCode: r.depot_code, action: r.action,
      oldValue: r.old_value, newValue: r.new_value, actor: r.actor, occurredAt: r.occurred_at,
    }));
  }, []);

  return {
    depots, stockBalances, submissionsByDepot, ledgerBaseline, deviceLedger, warehousePending,
    loaded, dbError, retryLoad: loadAll, pseudoCodes: PSEUDO_CODES,
    saveDepotField, saveSubmission,
    saveLedgerBaseline, saveLedgerBaselineBulk, saveWarehousePendingBulk, clearAllDeviceLedger, updateDeviceStatus,
    fetchMovements, fetchMovementCount, recordMovement, recordReceiptsBulk, recordMovementsBulk, fetchAuditLog,
  };
}
