"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";

export function PendingAccessPage() {
  const { auth } = useApp();
  return React.createElement("div", { className: "auth-shell" },
    React.createElement("div", { className: "auth-card" },
      React.createElement("div", { className: "brand-mark" },
        React.createElement("div", { className: "brand-icon" }, "GH"),
        React.createElement("div", null,
          React.createElement("div", { className: "brand-title" }, "Access pending"),
          React.createElement("div", { className: "brand-sub" }, auth.user?.email))),
      React.createElement("div", { style: { fontSize: 13, lineHeight: 1.6, margin: "10px 0 18px" } },
        "You're signed in, but no role has been assigned to your account yet. Ask a National Admin to grant you access, then refresh this page."),
      React.createElement("button", { className: "btn", onClick: () => auth.signOut() }, "Sign out")));
}
