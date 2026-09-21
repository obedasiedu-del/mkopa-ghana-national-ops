"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";

export function LoginPage() {
  const { auth } = useApp();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  function submit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    auth.signInWithPassword(email.trim(), password)
      .catch((err) => setError(err.message || "Sign-in failed"))
      .finally(() => setSubmitting(false));
  }

  return React.createElement("div", { className: "auth-shell" },
    React.createElement("div", { className: "auth-card" },
      React.createElement("div", { className: "brand-mark" },
        React.createElement("div", { className: "brand-icon" }, "GH"),
        React.createElement("div", null,
          React.createElement("div", { className: "brand-title" }, "National Stock Ops"),
          React.createElement("div", { className: "brand-sub" }, "M-KOPA Ghana"))),
      React.createElement("form", { onSubmit: submit },
        error && React.createElement("div", { className: "auth-error" }, error),
        React.createElement("div", { className: "field-row" },
          React.createElement("div", { className: "field-label" }, "Email"),
          React.createElement("input", { className: "field-input", type: "email", value: email, autoFocus: true, onChange: (e) => setEmail(e.target.value), required: true })),
        React.createElement("div", { className: "field-row" },
          React.createElement("div", { className: "field-label" }, "Password"),
          React.createElement("input", { className: "field-input", type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true })),
        React.createElement("button", { className: "btn btn-primary", type: "submit", style: { width: "100%", justifyContent: "center" }, disabled: submitting }, submitting ? "Signing in…" : "Sign in")),
      React.createElement("div", { className: "auth-hint" }, "Access is granted per account by a National Admin. If you don't have an account yet, contact your regional manager or the ops team.")));
}
