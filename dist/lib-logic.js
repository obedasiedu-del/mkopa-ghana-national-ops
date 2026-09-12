"use strict";
// Pure domain logic ported from the original artifact (national-ops.html).
// No DOM/React dependencies here — all state is passed in as plain data.
const TERRITORY_ORDER = [
    "Accra West", "Accra East", "Eastern", "Volta/Oti", "Western", "Central",
    "Ashanti East", "Ashanti West", "Bono", "Northern & Upper",
];
const DEVICE_MODEL_SUGGESTIONS = ["A06", "A07", "A16", "A17"];
const SUBMISSION_MODELS = ["A07/64", "A07/128", "A16/128", "A17/128", "A17/256"];
const SUBMISSION_HISTORY_CAP = 60;
const HIGH_AGING_THRESHOLD = 30;
const INDIRECT_DEPOT = { code: "INDIRECT", name: "Indirect Channel (All Shops)", territory: "Indirect Channel", status: "active" };
const UNRECOGNISED_DEPOT = { code: "UNRECOGNISED", name: "Unrecognised Shops", territory: "Unrecognised", status: "active" };
const PSEUDO_CODES = [INDIRECT_DEPOT.code, UNRECOGNISED_DEPOT.code];
const LEDGER_TIERS = [
    { key: "fresh", label: "Fresh", max: 5, cls: "pill-success" },
    { key: "projected", label: "Projected Aging", min: 6, max: 10, cls: "pill-warning" },
    { key: "aged", label: "Aged", min: 11, max: 13, cls: "pill-critical" },
    { key: "urgent", label: "Urgent Sale", min: 14, max: 29, cls: "pill-urgent" },
    { key: "highrisk", label: "High Risk", min: 30, cls: "pill-severe" },
];
function fmtNum(n) {
    return n === null || n === undefined || Number.isNaN(n) ? "—" : String(n);
}
function todayStr() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function fmtDateShort(iso) {
    if (!iso)
        return iso;
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime()))
        return iso;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function scoreColor(score) {
    if (score === null || score === undefined)
        return "var(--text-faint)";
    if (score >= 80)
        return "var(--success)";
    if (score >= 60)
        return "var(--warning)";
    return "var(--critical)";
}
function agedPctColor(pct) {
    if (pct <= 15)
        return "var(--success)";
    if (pct <= 35)
        return "var(--warning)";
    return "var(--critical)";
}
function priorityLabel(pct) {
    if (pct === null || pct === undefined)
        return null;
    return pct >= HIGH_AGING_THRESHOLD ? "HIGH AGING" : "ON TRACK";
}
function deviceTotals(models) {
    const totals = { inStock: 0, returned: 0, total: 0 };
    if (!models)
        return totals;
    Object.keys(models).forEach((m) => {
        const row = models[m] || {};
        totals.inStock += Number(row.inStock) || 0;
        totals.returned += Number(row.returned) || 0;
    });
    totals.total = totals.inStock + totals.returned;
    return totals;
}
function submissionTotals(entry) {
    const totals = { totalStock: 0, agedStock: 0 };
    if (!entry || !entry.models)
        return totals;
    Object.keys(entry.models).forEach((m) => {
        const row = entry.models[m] || {};
        totals.totalStock += Number(row.totalStock) || 0;
        totals.agedStock += Number(row.agedStock) || 0;
    });
    return totals;
}
function daysAllocated(dateStr) {
    if (!dateStr)
        return null;
    const d = new Date(dateStr + "T00:00:00");
    if (Number.isNaN(d.getTime()))
        return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - d) / 86400000);
    return diff < 0 ? 0 : diff;
}
function ledgerTierFor(days) {
    if (days === null || days === undefined)
        return null;
    for (const t of LEDGER_TIERS) {
        if ((t.min === undefined || days >= t.min) && (t.max === undefined || days <= t.max))
            return t;
    }
    return null;
}
// devices: array of {status, allocatedDate}
function countsForDevices(devices) {
    const counts = { total: 0, fresh: 0, projected: 0, aged: 0, urgent: 0, highrisk: 0, reallocated: 0, returned: 0 };
    devices.forEach((dv) => {
        counts.total++;
        if (dv.status === "reallocated") {
            counts.reallocated++;
            return;
        }
        if (dv.status === "returned")
            counts.returned++;
        const tier = ledgerTierFor(daysAllocated(dv.allocatedDate));
        if (tier)
            counts[tier.key]++;
    });
    return counts;
}
function groupDevicesByAgent(devices) {
    const groups = {};
    devices.forEach((dv) => {
        const name = (dv.dsrName || "").trim();
        const key = name || "(No DSR listed)";
        if (!groups[key])
            groups[key] = { name: key, devices: [], depotNames: {} };
        groups[key].devices.push(dv);
        groups[key].depotNames[dv.depotName || dv.depotCode] = true;
    });
    const list = Object.values(groups);
    list.sort((a, b) => {
        if (a.name === "(No DSR listed)")
            return 1;
        if (b.name === "(No DSR listed)")
            return -1;
        return a.name.localeCompare(b.name);
    });
    return list;
}
/* ---------------- Bulk paste parsing / depot fuzzy matching ---------------- */
function splitPasteLines(text) {
    return String(text || "").split(/\r\n|\n|\r/).map((l) => l.trim()).filter((l) => l.length);
}
function parseDeviceRow(cells, uploadDate) {
    const serial = cells[0] || "";
    if (!serial)
        return null;
    const model = cells[1] || "";
    const shopName = cells[2] || "";
    const dsrName = cells[3] || "";
    let deviceAge = parseInt(cells[4] || "", 10);
    if (Number.isNaN(deviceAge) || deviceAge < 0)
        deviceAge = 0;
    const allocDate = new Date(uploadDate + "T00:00:00");
    allocDate.setDate(allocDate.getDate() - deviceAge);
    const allocatedDate = allocDate.getFullYear() + "-" + String(allocDate.getMonth() + 1).padStart(2, "0") + "-" + String(allocDate.getDate()).padStart(2, "0");
    return { serial, model, shopName, dsrName, allocatedDate, status: "in_stock" };
}
function parsePastedDevices(text) {
    const lines = splitPasteLines(text);
    const rows = [];
    let skipped = 0;
    const uploadDate = todayStr();
    lines.forEach((line, idx) => {
        let cells = line.indexOf("\t") !== -1 ? line.split("\t") : line.split(",");
        cells = cells.map((c) => c.trim());
        if (idx === 0 && /serial/i.test(cells[0] || ""))
            return;
        const row = parseDeviceRow(cells, uploadDate);
        if (!row) {
            skipped++;
            return;
        }
        rows.push(row);
    });
    return { rows, skipped };
}
function normalizeDepotName(s) {
    let t = String(s || "").toLowerCase();
    t = t.replace(/\([^)]*\)/g, " ");
    t = t.replace(/\bdepot\b/g, " ");
    t = t.replace(/[^a-z0-9]+/g, " ");
    return t.trim().replace(/\s+/g, " ");
}
function depotTokens(name) {
    return normalizeDepotName(name).split(" ").filter((w) => w.length > 0);
}
// depots: array of {code, name}
function buildDepotIndex(depots) {
    return depots.map((d) => ({
        code: d.code,
        codeLower: String(d.code).toLowerCase(),
        norm: normalizeDepotName(d.name),
        tokens: depotTokens(d.name),
    }));
}
const DEPOT_ALIASES = {
    SC74: ["kasoa 2", "kasoa two", "kasoa ofaakor", "ofaakor", "kasoa ofaakor 2", "kasoa branch 2"],
};
function matchDepotForShop(shopName, depotIndex) {
    const norm = normalizeDepotName(shopName);
    if (!norm)
        return null;
    const shopToks = norm.split(" ").filter((w) => w.length > 0);
    for (const code in DEPOT_ALIASES) {
        if (DEPOT_ALIASES[code].indexOf(norm) !== -1 && depotIndex.some((d) => d.code === code))
            return code;
    }
    const byCode = depotIndex.find((d) => shopToks.indexOf(d.codeLower) !== -1);
    if (byCode)
        return byCode.code;
    const exact = depotIndex.find((d) => d.norm === norm);
    if (exact)
        return exact.code;
    let best = null, bestScore = 0, tieCount = 0;
    depotIndex.forEach((d) => {
        if (!d.tokens.length)
            return;
        const shared = d.tokens.filter((w) => shopToks.indexOf(w) !== -1).length;
        if (shared < d.tokens.length)
            return;
        const score = d.tokens.length / shopToks.length;
        if (score > bestScore) {
            bestScore = score;
            best = d;
            tieCount = 1;
        }
        else if (score === bestScore && best && d.code !== best.code)
            tieCount++;
    });
    return best && tieCount === 1 ? best.code : null;
}
const INDIRECT_CHANNEL_KEYWORDS = ["mtn", "telecel", "vodafone", "franko", "izone", "i zone", "mcs", "indirect", "partner"];
function isIndirectChannelShop(shopName) {
    const norm = normalizeDepotName(shopName);
    if (!norm)
        return false;
    return INDIRECT_CHANNEL_KEYWORDS.some((k) => norm.indexOf(k) !== -1);
}
function classifyShopForLedger(shopName, depotIndex) {
    const depotCode = matchDepotForShop(shopName, depotIndex);
    if (depotCode)
        return { code: depotCode, bucket: "depot" };
    if (isIndirectChannelShop(shopName))
        return { code: INDIRECT_DEPOT.code, bucket: "indirect" };
    return { code: UNRECOGNISED_DEPOT.code, bucket: "unrecognised" };
}
// Splits one big multi-depot paste into per-depot device lists.
// depots: array of {code, name} used to build the matching index.
function parsePastedDevicesMultiDepot(text, depots) {
    const lines = splitPasteLines(text);
    const uploadDate = todayStr();
    const byDepot = {};
    let skipped = 0;
    const indirectCounts = {}, unrecognisedCounts = {}, indirectRows = [], unrecognisedRows = [];
    const depotIndex = buildDepotIndex(depots);
    const classifyCache = {};
    function classifyCached(shopName) {
        const key = normalizeDepotName(shopName);
        if (!(key in classifyCache))
            classifyCache[key] = classifyShopForLedger(shopName, depotIndex);
        return classifyCache[key];
    }
    lines.forEach((line, idx) => {
        let cells = line.indexOf("\t") !== -1 ? line.split("\t") : line.split(",");
        cells = cells.map((c) => c.trim());
        if (idx === 0 && /serial/i.test(cells[0] || ""))
            return;
        const row = parseDeviceRow(cells, uploadDate);
        if (!row) {
            skipped++;
            return;
        }
        const cls = classifyCached(row.shopName);
        if (!byDepot[cls.code])
            byDepot[cls.code] = [];
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
/* ---------------- CSV export ---------------- */
function downloadCsv(filename, rows) {
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
function csvCell(v) {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
