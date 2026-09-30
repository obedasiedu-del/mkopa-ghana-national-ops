"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal, FieldInput } from "../components/ui.js";
import { supabaseClient } from "../supabaseClient.js";

export function ChangePasswordModal() {
  const { closeModal, runAction } = useApp();
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");

  function save() {
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords don't match."); return; }
    setError("");
    runAction(async () => {
      const { error: err } = await supabaseClient.auth.updateUser({ password: newPassword });
      if (err) throw err;
    }, "Password changed").then(closeModal);
  }

  return React.createElement(Modal, {
    open: true, onClose: closeModal, title: "Change Password",
    footer: React.createElement(React.Fragment, null,
      React.createElement("button", { className: "btn", onClick: closeModal }, "Cancel"),
      React.createElement("button", { className: "btn btn-primary", onClick: save }, "Save Password")),
  },
    React.createElement("div", { style: { fontSize: 12.8, color: "var(--text-muted)", marginBottom: 12 } }, "Choose a new password for your own login. You'll use it the next time you sign in."),
    React.createElement(FieldInput, { label: "New Password", type: "password", value: newPassword, onChange: setNewPassword, placeholder: "At least 8 characters" }),
    React.createElement(FieldInput, { label: "Confirm New Password", type: "password", value: confirmPassword, onChange: setConfirmPassword }),
    error && React.createElement("div", { style: { color: "var(--danger, #d6473f)", fontSize: 12.5, marginTop: 8 } }, error));
}
