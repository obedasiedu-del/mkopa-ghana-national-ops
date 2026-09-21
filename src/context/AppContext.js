"use strict";
import React from "react";
import { useAppData } from "../data/useAppData.js";
import { useAuth } from "../data/useAuth.js";
import { useRouter } from "../router.js";

const AppContext = React.createContext(null);

export function AppProvider({ children }) {
  const data = useAppData();
  const auth = useAuth();
  const router = useRouter();

  const [search, setSearch] = React.useState("");
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
  const runAction = React.useCallback(async (fn, successMsg) => {
    try {
      const r = await fn();
      if (successMsg) toast(successMsg);
      return r;
    } catch (e) {
      toast("Failed: " + (e && e.message ? e.message : "try again"));
      throw e;
    }
  }, [toast]);

  const value = {
    data, auth, ...router,
    search, setSearch,
    modal, openModal, closeModal, toast, toasts, runAction,
  };
  return React.createElement(AppContext.Provider, { value }, children);
}

export function useApp() {
  const ctx = React.useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
