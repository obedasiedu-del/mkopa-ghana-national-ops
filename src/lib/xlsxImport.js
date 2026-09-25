"use strict";
// Client-side .xlsx reading for the "Upload Device Register" flow -- turns an uploaded
// workbook into the same tab-separated text that parsePastedDevicesMultiDepot() already
// knows how to parse, so the rest of that pipeline (column-name detection, shop matching,
// Indirect/Unrecognised bucketing, saveLedgerBaselineBulk) is reused unchanged rather than
// re-implemented here.
import * as XLSX from "xlsx";
import { DEVICE_COLUMN_ALIASES, detectDeviceColumnMap, parseFlexibleDate } from "./domain.js";

export async function readWorkbook(file) {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: "array", cellDates: true, cellNF: false });
}

function normalizeHeader(s) {
  return String(s || "").trim().toLowerCase().replace(/[_\s]+/g, " ");
}
function sheetHeaderRow(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0, blankrows: false, defval: "" });
  return rows[0] || [];
}
// A workbook like the real operational trackers bundles 15-20 sheets (rosters, monthly
// tabs, etc.) -- only one or two actually look like a device-level export. Prefer a sheet
// whose name says so, then fall back to sniffing headers.
export function guessDeviceRegisterSheet(wb) {
  const byName = wb.SheetNames.find((n) => /aged stock|device register/i.test(n));
  if (byName) return byName;
  const byHeader = wb.SheetNames.find((n) => {
    const header = sheetHeaderRow(wb.Sheets[n]).map(normalizeHeader);
    const map = detectDeviceColumnMap(header);
    return map.serial !== undefined && map.shopName !== undefined;
  });
  return byHeader || wb.SheetNames[0];
}
export function sheetLooksLikeDeviceRegister(wb, sheetName) {
  const header = sheetHeaderRow(wb.Sheets[sheetName]).map(normalizeHeader);
  const map = detectDeviceColumnMap(header);
  return map.serial !== undefined && map.shopName !== undefined;
}

// Same idea for the "WH STOCKS" sheet of a tracker like INDIRECT_INVENTORY_TRACKER --
// prefer a sheet named for it, else sniff for its distinctive Current Owner Code column.
export function guessWarehouseStockSheet(wb) {
  const byName = wb.SheetNames.find((n) => /wh stocks|warehouse stock/i.test(n));
  if (byName) return byName;
  const byHeader = wb.SheetNames.find((n) => {
    const header = sheetHeaderRow(wb.Sheets[n]).map(normalizeHeader);
    return header.some((h) => h.indexOf("currentownercode") !== -1) && header.some((h) => h.indexOf("serial") !== -1);
  });
  return byHeader || wb.SheetNames[0];
}
export function sheetLooksLikeWarehouseStock(wb, sheetName) {
  const header = sheetHeaderRow(wb.Sheets[sheetName]).map(normalizeHeader);
  return header.some((h) => h.indexOf("currentownercode") !== -1) && header.some((h) => h.indexOf("serial") !== -1);
}
// A warehouse-stock export runs 50-100k+ rows -- the per-cell address lookup used for the
// (much smaller) Device Register sheet, so it can distinguish native-date cells from text
// ones, would be too slow here. sheet_to_json is a single optimized pass; we lose that
// cell-type distinction, but a direct cross-check against this sheet's own FIFO DAYS column
// (20,000-row sample, 2026-09-23 as reference) found zero date anomalies in this export, so
// there's no known defect here to guard against the way there was for the aged-stock sheet.
export function readWarehouseStockSheet(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "", blankrows: false });
  if (!aoa.length) return { textRows: [], totalRows: 0 };
  const header = aoa[0].map((h) => String(h === undefined || h === null ? "" : h));
  const textRows = [header.join("\t")];
  let totalRows = 0;
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row || row.every((c) => c === "" || c === null || c === undefined)) continue;
    totalRows++;
    const cells = row.map((c) => {
      if (c instanceof Date) return dateToISO(c);
      return String(c === undefined || c === null ? "" : c).replace(/\t/g, " ");
    });
    textRows.push(cells.join("\t"));
  }
  return { textRows, totalRows };
}

// Same idea for the PSDSR weekly export -- prefer a sheet named for it, else sniff for its
// distinctive "Total PDSR" / "Sufficient Stocks" header pair (the real export's first-column
// header is an arbitrary leftover label, not something reliably named, so it's never used to
// identify the sheet).
export function guessPsdsrSheet(wb) {
  const byName = wb.SheetNames.find((n) => /psdsr/i.test(n));
  if (byName) return byName;
  const byHeader = wb.SheetNames.find((n) => sheetLooksLikePsdsr(wb, n));
  return byHeader || wb.SheetNames[0];
}
function findPsdsrHeaderRow(wb, sheetName) {
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: "", blankrows: false });
  const idx = aoa.findIndex((row) => {
    const norm = row.map(normalizeHeader);
    return norm.some((h) => /total.*pdsr|pdsr.*total/.test(h)) && norm.some((h) => h.indexOf("sufficient") !== -1);
  });
  return { aoa, idx };
}
export function sheetLooksLikePsdsr(wb, sheetName) {
  return findPsdsrHeaderRow(wb, sheetName).idx !== -1;
}
// A PSDSR export's header row isn't necessarily row 1 -- the real file has blank leading
// rows -- so this scans down for the "Total PDSR"/"Sufficient..." row and treats everything
// below it as data, converting straight into the same tab-separated Depot/Total/Sufficient
// text parsePsdsrPaste() already knows how to read (the depot name is always the first
// column in the real export, whatever its own header text happens to say).
export function readPsdsrSheet(wb, sheetName) {
  const { aoa, idx: headerIdx } = findPsdsrHeaderRow(wb, sheetName);
  if (headerIdx === -1) throw new Error('Could not find "Total PDSR" / "Sufficient Stocks" columns on sheet "' + sheetName + '".');
  const header = aoa[headerIdx].map(normalizeHeader);
  const totalIdx = header.findIndex((h) => /total.*pdsr|pdsr.*total/.test(h));
  const suffIdx = header.findIndex((h) => h.indexOf("sufficient") !== -1);
  const textRows = [];
  let totalRows = 0;
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const row = aoa[i];
    const depot = row[0];
    const totalNum = Number(row[totalIdx]);
    if (!depot || !Number.isFinite(totalNum)) continue;
    totalRows++;
    const suffNum = Number(row[suffIdx]);
    textRows.push(String(depot).trim() + "\t" + totalNum + "\t" + (Number.isFinite(suffNum) ? suffNum : 0));
  }
  return { textRows, totalRows };
}

function excelSerialToDate(serial) {
  return new Date(Math.round((serial - 25569) * 86400000));
}
function dateToISO(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function swapMonthDay(d) {
  // Only meaningful (and safe) when the day-of-month is a valid month number; otherwise the
  // cell isn't the transposed-date defect we're checking for and is left untouched.
  const day = d.getDate();
  if (day < 1 || day > 12) return null;
  const swapped = new Date(d.getFullYear(), day - 1, d.getMonth() + 1);
  return Number.isNaN(swapped.getTime()) ? null : swapped;
}
// Cells Excel itself typed as a date come through (with cellDates:true) as JS Date objects --
// that's the same "native date cell" signal that, in the RETAIL_AGED_IN_CHANNEL__5.xlsx
// import, distinguished the ~1,900 rows with a genuine month/day-transposed date defect from
// the rows storing the same field as plain text (which always parsed correctly). A text cell
// here is parsed the same flexible way pasted text is.
function readDateCell(cell) {
  if (!cell) return { date: null, isNative: false, text: "" };
  if (cell.v instanceof Date) return { date: cell.v, isNative: true, text: dateToISO(cell.v) };
  if (typeof cell.v === "number" && cell.t === "n") {
    const d = excelSerialToDate(cell.v);
    return { date: d, isNative: true, text: dateToISO(d) };
  }
  const s = String(cell.v !== undefined ? cell.v : cell.w || "").trim();
  const iso = parseFlexibleDate(s);
  return { date: iso ? new Date(iso + "T00:00:00") : null, isNative: false, text: s };
}

// Reads the given sheet into device-register rows, applying the same "does this date cross-
// check against the sheet's own DeviceAge column" defense used for the manual import: if a
// native-date Initial_Allocation_Date cell's implied age doesn't match DeviceAge, try
// swapping its month/day (and the paired Current_Allocation_Date cell in the same row, since
// the defect affected both fields together) and keep the swap only if that resolves the
// mismatch. Anything still mismatched afterwards is reported, not silently trusted.
export function readDeviceRegisterSheet(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  const ref = ws["!ref"];
  if (!ref) return { textRows: [], totalRows: 0, correctedDates: 0, dateAnomalies: [] };
  const range = XLSX.utils.decode_range(ref);
  const header = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
    header.push(cell ? String(cell.v !== undefined ? cell.v : cell.w || "") : "");
  }
  const colMap = detectDeviceColumnMap(header.map(normalizeHeader));
  if (colMap.serial === undefined) throw new Error('Could not find a "Serial Number" column on sheet "' + sheetName + '".');

  // Establish the reference date this export's DeviceAge column was computed against, by
  // taking the most common (initialDate + age) across ALL rows -- not just non-native-date
  // ones. We don't know in advance which rows (if any) have the month/day-transposed defect,
  // but that defect only ever affects a minority of rows, so the untouched majority still
  // clusters tightly on the true reference date regardless of cell type; a sheet with zero
  // text-typed date cells (seen in practice) would otherwise never calibrate a reference date
  // at all, silently skipping the cross-check entirely.
  const ageColIdx = colMap.deviceAge;
  const refCandidates = {};
  const rowCache = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const get = (idx) => (idx === undefined ? undefined : ws[XLSX.utils.encode_cell({ r, c: range.s.c + idx })]);
    const serialCell = get(colMap.serial);
    const serial = serialCell ? String(serialCell.v !== undefined ? serialCell.v : serialCell.w || "").trim() : "";
    if (!serial) continue;
    const initial = colMap.initialAllocatedDate !== undefined ? readDateCell(get(colMap.initialAllocatedDate)) : null;
    const age = ageColIdx !== undefined ? parseInt(String(get(ageColIdx) ? (get(ageColIdx).v !== undefined ? get(ageColIdx).v : get(ageColIdx).w) : ""), 10) : null;
    rowCache.push({ r, serial, initial, age: Number.isFinite(age) ? age : null });
    if (initial && initial.date && Number.isFinite(age)) {
      const implied = new Date(initial.date.getTime());
      implied.setDate(implied.getDate() + age);
      const key = dateToISO(implied);
      refCandidates[key] = (refCandidates[key] || 0) + 1;
    }
  }
  let refDate = null, refCount = -1;
  Object.keys(refCandidates).forEach((k) => { if (refCandidates[k] > refCount) { refDate = new Date(k + "T00:00:00"); refCount = refCandidates[k]; } });

  let correctedDates = 0;
  const dateAnomalies = [];
  const textRows = [header.map((h) => h || "").join("\t")];
  for (const cached of rowCache) {
    const { r, initial, age } = cached;
    const get = (idx) => (idx === undefined ? undefined : ws[XLSX.utils.encode_cell({ r, c: range.s.c + idx })]);
    let initialText = initial ? initial.text : "";
    let currentCell = colMap.allocatedDate !== undefined ? readDateCell(get(colMap.allocatedDate)) : null;
    let currentText = currentCell ? currentCell.text : "";
    if (refDate && initial && initial.date && Number.isFinite(age)) {
      const implied = Math.round((refDate.getTime() - initial.date.getTime()) / 86400000);
      if (implied !== age) {
        // Only a native (Excel-typed) date cell fits the known transposition defect -- a
        // text-typed cell that mismatches is a different, unexplained problem and is always
        // flagged rather than guessed at.
        const swapped = initial.isNative ? swapMonthDay(initial.date) : null;
        const impliedSwapped = swapped ? Math.round((refDate.getTime() - swapped.getTime()) / 86400000) : null;
        if (swapped && impliedSwapped === age) {
          initialText = dateToISO(swapped);
          correctedDates++;
          if (currentCell && currentCell.isNative) {
            const swappedCurrent = swapMonthDay(currentCell.date);
            if (swappedCurrent) currentText = dateToISO(swappedCurrent);
          }
        } else {
          dateAnomalies.push({ serial: cached.serial, initialAllocatedDate: initial.text, deviceAge: age, impliedAge: implied });
        }
      }
    }
    const rowCells = header.map((_, idx) => {
      if (idx === colMap.initialAllocatedDate) return initialText;
      if (idx === colMap.allocatedDate) return currentText;
      const cell = get(idx);
      if (!cell) return "";
      return String(cell.v !== undefined ? cell.v : cell.w || "");
    });
    textRows.push(rowCells.map((c) => String(c).replace(/\t/g, " ")).join("\t"));
  }
  return { textRows, totalRows: rowCache.length, correctedDates, dateAnomalies, refDateUsed: refDate ? dateToISO(refDate) : null };
}
