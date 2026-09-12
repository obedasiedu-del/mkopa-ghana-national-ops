"use strict";
const PAGE_SIZE = 1000;
async function fetchAll(table, orderCol) {
    let all = [];
    let from = 0;
    for (;;) {
        let q = supabaseClient.from(table).select("*").range(from, from + PAGE_SIZE - 1);
        if (orderCol)
            q = q.order(orderCol, { ascending: true });
        const { data, error } = await q;
        if (error)
            throw error;
        all = all.concat(data || []);
        if (!data || data.length < PAGE_SIZE)
            break;
        from += PAGE_SIZE;
    }
    return all;
}
function chunkArr(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size)
        out.push(arr.slice(i, i + size));
    return out;
}
function useSupabaseData() {
    const [depots, setDepots] = React.useState({});
    const [cces, setCces] = React.useState({});
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
                code: r.code, name: r.name, territory: r.territory, status: r.status,
                scName: r.sc_name || "", scPhone: r.sc_phone || "", scStatus: r.sc_status || "vacant",
                scScore: r.sc_score === null || r.sc_score === undefined ? null : Number(r.sc_score),
                scNotes: r.sc_notes || "", isSynthetic: r.is_synthetic,
            };
        });
        setDepots(map);
    }, []);
    const refreshCces = React.useCallback(async () => {
        const rows = await fetchAll("cces");
        const map = {};
        rows.forEach((r) => {
            map[r.id] = {
                id: r.id, depotCode: r.depot_code, name: r.name, phone: r.phone || "",
                status: r.status || "active", score: r.score === null || r.score === undefined ? null : Number(r.score),
                notes: r.notes || "",
            };
        });
        setCces(map);
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
            if (!map[r.depot_code])
                map[r.depot_code] = [];
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
            if (!map[r.depot_code])
                map[r.depot_code] = [];
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
                await Promise.all([refreshDepots(), refreshCces(), refreshDepotStock(), refreshSubmissions(), refreshLedgerBaseline(), refreshDeviceLedger()]);
                if (!cancelled)
                    setLoaded(true);
            }
            catch (e) {
                if (!cancelled)
                    setDbError(e);
            }
        })();
        return () => { cancelled = true; };
    }, [refreshDepots, refreshCces, refreshDepotStock, refreshSubmissions, refreshLedgerBaseline, refreshDeviceLedger]);
    // Debounced realtime refresh — a bulk paste can insert thousands of device_ledger rows in one
    // go, and Postgres realtime fires one event PER row; without coalescing, that would trigger
    // thousands of full refetches back-to-back and freeze the tab (the same class of bug the
    // original artifact hit with its render storm). Any burst of change events for a table
    // collapses into a single refetch ~350ms after the last one.
    const timers = React.useRef({});
    const refreshers = {
        depots: refreshDepots, cces: refreshCces, depot_stock: refreshDepotStock,
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
        if ("scName" in patch)
            body.sc_name = patch.scName;
        if ("scPhone" in patch)
            body.sc_phone = patch.scPhone;
        if ("scStatus" in patch)
            body.sc_status = patch.scStatus;
        if ("scScore" in patch)
            body.sc_score = patch.scScore;
        if ("scNotes" in patch)
            body.sc_notes = patch.scNotes;
        body.updated_at = new Date().toISOString();
        const { error } = await supabaseClient.from("depots").update(body).eq("code", code);
        if (error)
            throw error;
        await refreshDepots();
    }, [refreshDepots]);
    const addCce = React.useCallback(async (data) => {
        const { error } = await supabaseClient.from("cces").insert({
            depot_code: data.depotCode, name: data.name, phone: data.phone, status: data.status,
            score: data.score, notes: data.notes,
        });
        if (error)
            throw error;
        await refreshCces();
    }, [refreshCces]);
    const updateCce = React.useCallback(async (id, data) => {
        const { error } = await supabaseClient.from("cces").update({
            depot_code: data.depotCode, name: data.name, phone: data.phone, status: data.status,
            score: data.score, notes: data.notes, updated_at: new Date().toISOString(),
        }).eq("id", id);
        if (error)
            throw error;
        await refreshCces();
    }, [refreshCces]);
    const deleteCce = React.useCallback(async (id) => {
        const { error } = await supabaseClient.from("cces").delete().eq("id", id);
        if (error)
            throw error;
        await refreshCces();
    }, [refreshCces]);
    const saveDeviceModels = React.useCallback(async (depotCode, modelsObj) => {
        const { error } = await supabaseClient.from("depot_stock").upsert({
            depot_code: depotCode, models: modelsObj, updated_at: new Date().toISOString(),
        });
        if (error)
            throw error;
        await refreshDepotStock();
    }, [refreshDepotStock]);
    const saveSubmission = React.useCallback(async (depotCode, dateStr, submittedBy, modelsObj) => {
        const { error } = await supabaseClient.from("submissions").upsert({ depot_code: depotCode, date: dateStr, submitted_by: submittedBy, models: modelsObj, updated_at: new Date().toISOString() }, { onConflict: "depot_code,date" });
        if (error)
            throw error;
        await refreshSubmissions();
    }, [refreshSubmissions]);
    const writeLedgerBaseline = React.useCallback(async (depotCode, setBy, devicesArr) => {
        const { error: delErr } = await supabaseClient.from("device_ledger").delete().eq("depot_code", depotCode);
        if (delErr)
            throw delErr;
        if (devicesArr.length) {
            const rows = devicesArr.map((d) => ({
                depot_code: depotCode, serial: d.serial, model: d.model, shop_name: d.shopName,
                dsr_name: d.dsrName, allocated_date: d.allocatedDate, status: d.status || "in_stock",
            }));
            for (const batch of chunkArr(rows, 500)) {
                const { error } = await supabaseClient.from("device_ledger").insert(batch);
                if (error)
                    throw error;
            }
        }
        const { error: baseErr } = await supabaseClient.from("device_ledger_baseline").upsert({
            depot_code: depotCode, baseline_set_at: new Date().toISOString(), baseline_set_by: String(setBy).trim(),
            updated_at: new Date().toISOString(),
        });
        if (baseErr)
            throw baseErr;
    }, []);
    const saveLedgerBaseline = React.useCallback(async (depotCode, setBy, devicesArr) => {
        if (!setBy || !String(setBy).trim())
            throw new Error("Your name is required");
        if (!devicesArr.length)
            throw new Error("Paste at least one device row first");
        await writeLedgerBaseline(depotCode, setBy, devicesArr);
        await Promise.all([refreshDeviceLedger(), refreshLedgerBaseline()]);
    }, [writeLedgerBaseline, refreshDeviceLedger, refreshLedgerBaseline]);
    const saveLedgerBaselineBulk = React.useCallback(async (setBy, byDepotMap) => {
        if (!setBy || !String(setBy).trim())
            throw new Error("Your name is required");
        const codes = Object.keys(byDepotMap);
        if (!codes.length)
            throw new Error("No matched devices to save yet — check the shop names.");
        await Promise.all(codes.map((code) => writeLedgerBaseline(code, setBy, byDepotMap[code])));
        await Promise.all([refreshDeviceLedger(), refreshLedgerBaseline()]);
        return codes.reduce((sum, c) => sum + byDepotMap[c].length, 0);
    }, [writeLedgerBaseline, refreshDeviceLedger, refreshLedgerBaseline]);
    const clearAllDeviceLedger = React.useCallback(async () => {
        const { error: e1 } = await supabaseClient.from("device_ledger").delete().neq("depot_code", "__none__");
        if (e1)
            throw e1;
        const { error: e2 } = await supabaseClient.from("device_ledger_baseline").delete().neq("depot_code", "__none__");
        if (e2)
            throw e2;
        await Promise.all([refreshDeviceLedger(), refreshLedgerBaseline()]);
    }, [refreshDeviceLedger, refreshLedgerBaseline]);
    const updateDeviceStatus = React.useCallback(async (depotCode, serial, newStatus, updatedBy) => {
        const { error } = await supabaseClient.from("device_ledger").update({
            status: newStatus, status_updated_at: new Date().toISOString(), status_updated_by: updatedBy || "",
        }).eq("depot_code", depotCode).eq("serial", serial);
        if (error)
            throw error;
        await refreshDeviceLedger();
    }, [refreshDeviceLedger]);
    return {
        depots, cces, depotStock, submissionsByDepot, ledgerBaseline, deviceLedger,
        loaded, dbError, pseudoCodes: PSEUDO_CODES,
        saveDepotField, addCce, updateCce, deleteCce, saveDeviceModels, saveSubmission,
        saveLedgerBaseline, saveLedgerBaselineBulk, clearAllDeviceLedger, updateDeviceStatus,
    };
}
