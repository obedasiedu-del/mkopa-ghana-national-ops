"use strict";
// Pure domain logic -- no DOM/React dependencies here, all state is passed in as plain data.

export const REGION_ORDER = [
  "Accra West", "Accra East", "Eastern", "Oti-Volta", "Western", "Central",
  "Bono", "Northern", "Ashanti",
];
export const DEVICE_MODEL_SUGGESTIONS = ["A06", "A07", "A16", "A17"];
export const SUBMISSION_MODELS = ["A07/64", "A07/128", "A16/128", "A17/128", "A17/256"];
export const SUBMISSION_HISTORY_CAP = 60;
export const HIGH_AGING_THRESHOLD = 30;
export const INDIRECT_DEPOT = { code: "INDIRECT", name: "Indirect Channel (All Shops)", region: "National", status: "active" };
export const UNRECOGNISED_DEPOT = { code: "UNRECOGNISED", name: "Unrecognised Shops", region: "National", status: "active" };
// Non-depot supply-chain locations that show up as transfer sources/destinations in stock
// movement data (warehouses, refurb/repair centres, reverse logistics) -- not real retail
// depots, so they're modeled the same way as Indirect/Unrecognised: pseudo-depot rows
// (is_synthetic = true) rather than a schema change.
export const WAREHOUSE_DEPOT = { code: "WAREHOUSE", name: "Warehouse Stock (All Warehouses)", region: "National", status: "active" };
export const REFURB_DEPOT = { code: "REFURB", name: "Refurb / Repair Centres", region: "National", status: "active" };
export const REVLOGISTICS_DEPOT = { code: "REVLOGISTICS", name: "Reverse Logistics", region: "National", status: "active" };
export const PSEUDO_CODES = [INDIRECT_DEPOT.code, UNRECOGNISED_DEPOT.code, WAREHOUSE_DEPOT.code, REFURB_DEPOT.code, REVLOGISTICS_DEPOT.code];
// Category names match the approved architecture exactly (Fresh / Projected / Aged /
// Urgent / High Risk); day ranges are shown alongside them in the UI, not in the label.
export const LEDGER_TIERS = [
  { key: "fresh", label: "Fresh", max: 5, cls: "pill-success" },
  { key: "projected", label: "Projected", min: 6, max: 10, cls: "pill-warning" },
  { key: "aged", label: "Aged", min: 11, max: 13, cls: "pill-critical" },
  { key: "urgent", label: "Urgent", min: 14, max: 29, cls: "pill-urgent" },
  { key: "highrisk", label: "High Risk", min: 30, cls: "pill-severe" },
];
// The 5 movement categories from the approved architecture (Transfers, Receipts, Issues,
// Returns, Status changes). A more specific reason (e.g. "allocated to DSR", "sold",
// "damaged") goes in the movement's free-text reference under 'issue' rather than being
// its own type, keeping this list exactly matching the spec.
export const MOVEMENT_TYPES = [
  { key: "receipt", label: "Receipt" },
  { key: "issue", label: "Issue" },
  { key: "transfer", label: "Transfer" },
  { key: "return", label: "Return" },
  { key: "status_change", label: "Status Change" },
];
export const USER_ROLES = [
  { key: "national_admin", label: "National Admin" },
  { key: "regional_manager", label: "Regional Manager" },
  { key: "depot_controller", label: "Depot / Stock Controller" },
  { key: "viewer", label: "Viewer / Reporting" },
];

export function fmtNum(n) {
  return n === null || n === undefined || Number.isNaN(n) ? "—" : String(n);
}
export function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
export function fmtDateShort(iso) {
  if (!iso) return iso;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
export function scoreColor(score) {
  if (score === null || score === undefined) return "var(--text-faint)";
  if (score >= 80) return "var(--success)";
  if (score >= 60) return "var(--warning)";
  return "var(--critical)";
}
export function agedPctColor(pct) {
  if (pct <= 15) return "var(--success)";
  if (pct <= 35) return "var(--warning)";
  return "var(--critical)";
}
export function priorityLabel(pct) {
  if (pct === null || pct === undefined) return null;
  return pct >= HIGH_AGING_THRESHOLD ? "HIGH AGING" : "ON TRACK";
}
export function submissionTotals(entry) {
  const totals = { totalStock: 0, agedStock: 0 };
  if (!entry || !entry.models) return totals;
  Object.keys(entry.models).forEach((m) => {
    const row = entry.models[m] || {};
    totals.totalStock += Number(row.totalStock) || 0;
    totals.agedStock += Number(row.agedStock) || 0;
  });
  return totals;
}
export function daysAllocated(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  return diff < 0 ? 0 : diff;
}
export function ledgerTierFor(days) {
  if (days === null || days === undefined) return null;
  for (const t of LEDGER_TIERS) {
    if ((t.min === undefined || days >= t.min) && (t.max === undefined || days <= t.max)) return t;
  }
  return null;
}
// devices: array of {status, allocatedDate}
export function countsForDevices(devices) {
  const counts = { total: 0, fresh: 0, projected: 0, aged: 0, urgent: 0, highrisk: 0, reallocated: 0, returned: 0 };
  devices.forEach((dv) => {
    counts.total++;
    if (dv.status === "reallocated") {
      counts.reallocated++;
      return;
    }
    if (dv.status === "returned") counts.returned++;
    const tier = ledgerTierFor(daysAllocated(dv.allocatedDate));
    if (tier) counts[tier.key]++;
  });
  return counts;
}
export function groupDevicesByAgent(devices) {
  const groups = {};
  devices.forEach((dv) => {
    const name = (dv.dsrName || "").trim();
    const key = name || "(No DSR listed)";
    if (!groups[key]) groups[key] = { name: key, devices: [], depotNames: {} };
    groups[key].devices.push(dv);
    groups[key].depotNames[dv.depotName || dv.depotCode] = true;
  });
  const list = Object.values(groups);
  list.sort((a, b) => {
    if (a.name === "(No DSR listed)") return 1;
    if (b.name === "(No DSR listed)") return -1;
    return a.name.localeCompare(b.name);
  });
  return list;
}
export function groupDevicesByTier(devices) {
  const groups = {};
  LEDGER_TIERS.forEach((t) => { groups[t.key] = []; });
  devices.forEach((dv) => {
    if (dv.status === "reallocated" || dv.status === "returned") return;
    const tier = ledgerTierFor(daysAllocated(dv.allocatedDate));
    if (tier) groups[tier.key].push(dv);
  });
  return groups;
}

/* ---------------- Bulk paste parsing / depot fuzzy matching ---------------- */
// Trims only blank lines, not each line's own content -- a whole-line trim would eat a
// leading tab-delimited empty cell (e.g. a movement row with no "From"), shifting every
// column after it. Individual cells are trimmed after splitting, once delimiters are known.
export function splitPasteLines(text) {
  return String(text || "").split(/\r\n|\n|\r/).filter((l) => l.trim().length);
}
// Column headers vary a lot between exports (our own simple template vs. a full
// operational "Device Register" dump with 19 columns in a different order) -- rather than
// force everyone to reorder columns before pasting, the first row is sniffed for recognised
// header names and mapped by name; only if that fails do we fall back to the original fixed
// 5-column order (Serial, Product, Shop Name, DSR Name, Device Age).
const DEVICE_COLUMN_ALIASES = {
  serial: ["serialnumber", "serial number", "serial"],
  model: ["product", "model", "itemtypecode", "item type code", "item type", "sku"],
  shopName: ["shopname", "shop name", "shop", "depot", "outlet", "outletname"],
  dsrName: ["dsrname", "dsr name", "dsr", "agent"],
  allocatedDate: ["current_allocation_date", "current allocation date", "allocated date", "allocation date", "initial_allocation_date", "initial allocation date"],
  deviceAge: ["deviceage", "device age", "age"],
};
function normalizeHeaderCell(s) {
  return String(s || "").trim().toLowerCase().replace(/[_\s]+/g, " ");
}
function detectDeviceColumnMap(headerCells) {
  const norm = headerCells.map(normalizeHeaderCell);
  const map = {};
  Object.keys(DEVICE_COLUMN_ALIASES).forEach((field) => {
    for (const alias of DEVICE_COLUMN_ALIASES[field]) {
      const idx = norm.indexOf(alias);
      if (idx !== -1) { map[field] = idx; return; }
    }
  });
  return map;
}
// Accepts "2026-09-19" (incl. datetime), "9/19/2026", or a raw Excel serial date number --
// the shapes a cell can paste as depending on its source formatting.
function parseFlexibleDate(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + "-" + m[2] + "-" + m[3];
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + "-" + m[1].padStart(2, "0") + "-" + m[2].padStart(2, "0");
  if (/^\d{4,6}$/.test(s)) {
    const d = new Date((Number(s) - 25569) * 86400000);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}
export function parseDeviceRow(cells, uploadDate, columnMap) {
  const map = columnMap || {};
  const serial = (map.serial !== undefined ? cells[map.serial] : cells[0]) || "";
  if (!serial) return null;
  const model = (map.model !== undefined ? cells[map.model] : cells[1]) || "";
  const shopName = (map.shopName !== undefined ? cells[map.shopName] : cells[2]) || "";
  const dsrName = (map.dsrName !== undefined ? cells[map.dsrName] : cells[3]) || "";
  let allocatedDate = map.allocatedDate !== undefined ? parseFlexibleDate(cells[map.allocatedDate]) : null;
  if (!allocatedDate) {
    let deviceAge = parseInt((map.deviceAge !== undefined ? cells[map.deviceAge] : cells[4]) || "", 10);
    if (Number.isNaN(deviceAge) || deviceAge < 0) deviceAge = 0;
    const allocDate = new Date(uploadDate + "T00:00:00");
    allocDate.setDate(allocDate.getDate() - deviceAge);
    allocatedDate = allocDate.getFullYear() + "-" + String(allocDate.getMonth() + 1).padStart(2, "0") + "-" + String(allocDate.getDate()).padStart(2, "0");
  }
  return { serial, model, shopName, dsrName, allocatedDate, status: "in_stock" };
}
// Shared by the single-depot and all-depots paste modals: splits the pasted text into
// (columnMap, dataLines) once, so both callers get the same header-sniffing behavior.
function prepareDevicePaste(text) {
  const lines = splitPasteLines(text);
  if (lines.length === 0) return { columnMap: null, dataLines: [] };
  const headerCells = (lines[0].indexOf("\t") !== -1 ? lines[0].split("\t") : lines[0].split(",")).map((c) => c.trim());
  const columnMap = detectDeviceColumnMap(headerCells);
  // Require at least serial + one more recognised field before trusting it's a real header
  // row rather than a data row that happens to start with "Serial...".
  const isHeader = columnMap.serial !== undefined && Object.keys(columnMap).length >= 2;
  return { columnMap: isHeader ? columnMap : null, dataLines: isHeader ? lines.slice(1) : lines };
}
export function parsePastedDevices(text) {
  const { columnMap, dataLines } = prepareDevicePaste(text);
  const rows = [];
  let skipped = 0;
  const uploadDate = todayStr();
  dataLines.forEach((line, idx) => {
    let cells = line.indexOf("\t") !== -1 ? line.split("\t") : line.split(",");
    cells = cells.map((c) => c.trim());
    if (!columnMap && idx === 0 && /serial/i.test(cells[0] || "")) return;
    const row = parseDeviceRow(cells, uploadDate, columnMap);
    if (!row) { skipped++; return; }
    rows.push(row);
  });
  return { rows, skipped };
}
export function normalizeDepotName(s) {
  let t = String(s || "").toLowerCase();
  t = t.replace(/\([^)]*\)/g, " ");
  t = t.replace(/\bdepot\b/g, " ");
  t = t.replace(/[^a-z0-9]+/g, " ");
  return t.trim().replace(/\s+/g, " ");
}
export function depotTokens(name) {
  return normalizeDepotName(name).split(" ").filter((w) => w.length > 0);
}
// depots: array of {code, name}
export function buildDepotIndex(depots) {
  return depots.map((d) => ({
    code: d.code,
    codeLower: String(d.code).toLowerCase(),
    norm: normalizeDepotName(d.name),
    tokens: depotTokens(d.name),
  }));
}
export const DEPOT_ALIASES = {
  SC74: ["kasoa 2", "kasoa two", "kasoa ofaakor", "ofaakor", "kasoa ofaakor 2", "kasoa branch 2"],
};
export function matchDepotForShop(shopName, depotIndex) {
  const raw = String(shopName || "").trim();
  if (!raw) return null;
  // A pasted code is an exact identifier, not natural-language text -- check it against the
  // real code first, before any normalizing/tokenizing. This matters because a code like
  // "NC-ADEISODEPO" is stored (and compared below) as one hyphenated string, but the token
  // match a few lines down strips punctuation into ["nc", "adeisodepo"], which can never
  // equal the un-split "nc-adeisodepo" -- so a hyphenated code would otherwise never match
  // itself even when pasted verbatim.
  const rawLower = raw.toLowerCase();
  const directCode = depotIndex.find((d) => d.codeLower === rawLower);
  if (directCode) return directCode.code;
  const norm = normalizeDepotName(shopName);
  if (!norm) return null;
  const shopToks = norm.split(" ").filter((w) => w.length > 0);
  for (const code in DEPOT_ALIASES) {
    if (DEPOT_ALIASES[code].indexOf(norm) !== -1 && depotIndex.some((d) => d.code === code)) return code;
  }
  const byCode = depotIndex.find((d) => shopToks.indexOf(d.codeLower) !== -1);
  if (byCode) return byCode.code;
  const exact = depotIndex.find((d) => d.norm === norm);
  if (exact) return exact.code;
  let best = null, bestScore = 0, tieCount = 0;
  depotIndex.forEach((d) => {
    if (!d.tokens.length) return;
    const shared = d.tokens.filter((w) => shopToks.indexOf(w) !== -1).length;
    if (shared < d.tokens.length) return;
    const score = d.tokens.length / shopToks.length;
    if (score > bestScore) { bestScore = score; best = d; tieCount = 1; }
    else if (score === bestScore && best && d.code !== best.code) tieCount++;
  });
  return best && tieCount === 1 ? best.code : null;
}
export const INDIRECT_CHANNEL_KEYWORDS = ["mtn", "telecel", "vodafone", "franko", "izone", "i zone", "mcs", "indirect", "partner"];
export function isIndirectChannelShop(shopName) {
  const norm = normalizeDepotName(shopName);
  if (!norm) return false;
  return INDIRECT_CHANNEL_KEYWORDS.some((k) => norm.indexOf(k) !== -1);
}
export function classifyShopForLedger(shopName, depotIndex) {
  const depotCode = matchDepotForShop(shopName, depotIndex);
  if (depotCode) return { code: depotCode, bucket: "depot" };
  if (isIndirectChannelShop(shopName)) return { code: INDIRECT_DEPOT.code, bucket: "indirect" };
  return { code: UNRECOGNISED_DEPOT.code, bucket: "unrecognised" };
}
// Splits one big multi-depot paste into per-depot device lists.
export function parsePastedDevicesMultiDepot(text, depots) {
  const { columnMap, dataLines } = prepareDevicePaste(text);
  const uploadDate = todayStr();
  const byDepot = {};
  let skipped = 0;
  const indirectCounts = {}, unrecognisedCounts = {}, indirectRows = [], unrecognisedRows = [];
  const depotIndex = buildDepotIndex(depots);
  const classifyCache = {};
  function classifyCached(shopName) {
    const key = normalizeDepotName(shopName);
    if (!(key in classifyCache)) classifyCache[key] = classifyShopForLedger(shopName, depotIndex);
    return classifyCache[key];
  }
  dataLines.forEach((line, idx) => {
    let cells = line.indexOf("\t") !== -1 ? line.split("\t") : line.split(",");
    cells = cells.map((c) => c.trim());
    if (!columnMap && idx === 0 && /serial/i.test(cells[0] || "")) return;
    const row = parseDeviceRow(cells, uploadDate, columnMap);
    if (!row) { skipped++; return; }
    const cls = classifyCached(row.shopName);
    if (!byDepot[cls.code]) byDepot[cls.code] = [];
    byDepot[cls.code].push(row);
    if (cls.bucket !== "depot") {
      const key = row.shopName || "(blank shop name)";
      const counts = cls.bucket === "indirect" ? indirectCounts : unrecognisedCounts;
      const rowsArr = cls.bucket === "indirect" ? indirectRows : unrecognisedRows;
      counts[key] = (counts[key] || 0) + 1;
      rowsArr.push(row);
    }
  });
  return { byDepot, skipped, indirectCounts, unrecognisedCounts, indirectRows, unrecognisedRows };
}
export function parseDepotStockPaste(text, depots) {
  const lines = splitPasteLines(text);
  const depotIndex = buildDepotIndex(depots);
  const matchCache = {};
  function matchCached(depotText) {
    const key = normalizeDepotName(depotText);
    if (!(key in matchCache)) matchCache[key] = matchDepotForShop(depotText, depotIndex);
    return matchCache[key];
  }
  const byDepot = {};
  const unmatchedRows = [];
  const unmatchedCounts = {};
  let skipped = 0;
  lines.forEach((line, idx) => {
    let cells = line.indexOf("\t") !== -1 ? line.split("\t") : line.split(",");
    cells = cells.map((c) => c.trim());
    if (idx === 0 && /^(depot|shop)/i.test(cells[0] || "") && /model/i.test(cells[1] || "")) return;
    const depotText = cells[0] || "";
    const model = cells[1] || "";
    if (!depotText || !model) { skipped++; return; }
    let inStock = parseInt(cells[2] || "0", 10);
    let returned = parseInt(cells[3] || "0", 10);
    if (Number.isNaN(inStock) || inStock < 0) inStock = 0;
    if (Number.isNaN(returned) || returned < 0) returned = 0;
    const code = matchCached(depotText);
    if (!code) {
      const key = depotText || "(blank depot)";
      unmatchedCounts[key] = (unmatchedCounts[key] || 0) + 1;
      unmatchedRows.push({ depotText, model, inStock, returned });
      return;
    }
    if (!byDepot[code]) byDepot[code] = {};
    if (!byDepot[code][model]) byDepot[code][model] = { inStock: 0, returned: 0 };
    byDepot[code][model].inStock += inStock;
    byDepot[code][model].returned += returned;
  });
  return { byDepot, skipped, unmatchedRows, unmatchedCounts };
}

// Bulk paste for stock movements (transfers/receipts/issues) -- e.g. a waybill/transit
// export with a source and/or destination column per row. Column names are sniffed the
// same way as the device paste above; From/To are matched against ALL depots including
// the synthetic pseudo-depot buckets (Warehouse, Refurb, Reverse Logistics, Indirect,
// Unrecognised), not just active retail depots, since transit data routinely references
// those. Movement type is inferred from which of From/To resolved to a depot: both -> a
// transfer, From only -> an issue, To only -> a receipt.
const MOVEMENT_COLUMN_ALIASES = {
  from: ["from", "source", "from depot", "source depot", "origin"],
  to: ["to", "destination", "to depot", "destination depot"],
  serial: ["serial", "serial number", "serialnumber", "imei"],
  model: ["model", "product", "item", "sku", "itemtypecode", "item type code"],
  quantity: ["quantity", "qty"],
  reference: ["reference", "waybill", "note", "reason"],
  date: ["date", "moved at", "movedat", "moved date", "timestamp"],
  recordedBy: ["recorded by", "recordedby", "by", "agent"],
};
function detectMovementColumnMap(headerCells) {
  const norm = headerCells.map(normalizeHeaderCell);
  const map = {};
  Object.keys(MOVEMENT_COLUMN_ALIASES).forEach((field) => {
    for (const alias of MOVEMENT_COLUMN_ALIASES[field]) {
      const idx = norm.indexOf(alias);
      if (idx !== -1) { map[field] = idx; return; }
    }
  });
  return map;
}
function parseMovementRow(cells, columnMap) {
  const map = columnMap || {};
  const g = (field, fallbackIdx) => (map[field] !== undefined ? cells[map[field]] : cells[fallbackIdx]) || "";
  const fromText = g("from", 0);
  const toText = g("to", 1);
  const serial = g("serial", 2);
  const model = g("model", 3);
  const qtyRaw = g("quantity", 4);
  const reference = g("reference", 5);
  const dateRaw = g("date", 6);
  const recordedBy = g("recordedBy", 7);
  if (!fromText && !toText) return null;
  if (!model) return null;
  let quantity = qtyRaw.trim() === "" ? 1 : parseFloat(qtyRaw);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return { fromText, toText, serial, model, quantity, reference, movedAt: parseFlexibleDate(dateRaw), recordedBy };
}
export function parseMovementPaste(text, depots) {
  const lines = splitPasteLines(text);
  const rows = [];
  const unmatchedRows = [];
  const unmatchedCounts = {};
  const typeCounts = { transfer: 0, issue: 0, receipt: 0 };
  let skipped = 0;
  if (!lines.length) return { rows, skipped, unmatchedRows, unmatchedCounts, typeCounts };
  const headerCells = (lines[0].indexOf("\t") !== -1 ? lines[0].split("\t") : lines[0].split(",")).map((c) => c.trim());
  const columnMap = detectMovementColumnMap(headerCells);
  const isHeader = Object.keys(columnMap).length >= 2 && (columnMap.from !== undefined || columnMap.to !== undefined);
  const dataLines = isHeader ? lines.slice(1) : lines;
  const depotIndex = buildDepotIndex(depots);
  const matchCache = {};
  function matchCached(depotText) {
    if (!depotText) return null;
    const key = normalizeDepotName(depotText);
    if (!(key in matchCache)) matchCache[key] = matchDepotForShop(depotText, depotIndex);
    return matchCache[key];
  }
  dataLines.forEach((line) => {
    let cells = line.indexOf("\t") !== -1 ? line.split("\t") : line.split(",");
    cells = cells.map((c) => c.trim());
    const parsed = parseMovementRow(cells, isHeader ? columnMap : null);
    if (!parsed) { skipped++; return; }
    const fromCode = matchCached(parsed.fromText);
    const toCode = matchCached(parsed.toText);
    if (parsed.fromText && !fromCode) {
      unmatchedCounts[parsed.fromText] = (unmatchedCounts[parsed.fromText] || 0) + 1;
      unmatchedRows.push({ ...parsed, reason: "From not matched to a depot" });
      return;
    }
    if (parsed.toText && !toCode) {
      unmatchedCounts[parsed.toText] = (unmatchedCounts[parsed.toText] || 0) + 1;
      unmatchedRows.push({ ...parsed, reason: "To not matched to a depot" });
      return;
    }
    const movementType = fromCode && toCode ? "transfer" : fromCode ? "issue" : "receipt";
    typeCounts[movementType]++;
    rows.push({
      depotCode: fromCode || toCode, toDepotCode: movementType === "transfer" ? toCode : null,
      serial: parsed.serial || null, model: parsed.model, quantity: parsed.quantity,
      movementType, reference: parsed.reference || null, movedAt: parsed.movedAt || null,
      recordedBy: parsed.recordedBy || null,
    });
  });
  return { rows, skipped, unmatchedRows, unmatchedCounts, typeCounts };
}

/* ---------------- CSV export ---------------- */
export function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
