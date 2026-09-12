"use strict";
const AppContext = React.createContext(null);
function AppProvider({ children }) {
    const data = useSupabaseData();
    const [scope, setScope] = React.useState("national");
    const [tab, setTab] = React.useState("overview");
    const [devicesView, setDevicesView] = React.useState("depot");
    const [depotSubview, setDepotSubview] = React.useState("stock");
    const [ledgerFilter, setLedgerFilter] = React.useState("all");
    const [ledgerGroupBy, setLedgerGroupBy] = React.useState("depot");
    const [search, setSearch] = React.useState("");
    const [drawerDepotCode, setDrawerDepotCode] = React.useState(null);
    const [drawerFocus, setDrawerFocus] = React.useState(null);
    const [modal, setModal] = React.useState(null);
    const [toasts, setToasts] = React.useState([]);
    const toastId = React.useRef(0);
    const toast = React.useCallback((msg) => {
        const id = ++toastId.current;
        setToasts((t) => [...t, { id, msg }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
    }, []);
    const openModal = React.useCallback((type, props) => setModal({ type, props: props || {} }), []);
    const closeModal = React.useCallback(() => setModal(null), []);
    const openDrawer = React.useCallback((code, focusSection) => { setDrawerDepotCode(code); setDrawerFocus(focusSection || null); }, []);
    const closeDrawer = React.useCallback(() => { setDrawerDepotCode(null); setDrawerFocus(null); }, []);
    const runAction = React.useCallback(async (fn, successMsg) => {
        try {
            const r = await fn();
            if (successMsg)
                toast(successMsg);
            return r;
        }
        catch (e) {
            toast("Failed: " + (e && e.message ? e.message : "try again"));
            throw e;
        }
    }, [toast]);
    const value = {
        data, scope, setScope, tab, setTab, devicesView, setDevicesView,
        depotSubview, setDepotSubview, ledgerFilter, setLedgerFilter, ledgerGroupBy, setLedgerGroupBy,
        search, setSearch, drawerDepotCode, drawerFocus, openDrawer, closeDrawer,
        modal, openModal, closeModal, toast, toasts, runAction,
    };
    return React.createElement(AppContext.Provider, { value: value }, children);
}
function useApp() {
    const ctx = React.useContext(AppContext);
    if (!ctx)
        throw new Error("useApp must be used within AppProvider");
    return ctx;
}
