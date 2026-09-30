"use strict";
import React from "react";
import { supabaseClient } from "../supabaseClient.js";

// Session + role. Role assignment happens directly in the user_roles table (SQL editor /
// service role) in this first version -- see the migration notes -- so a signed-in user with
// no row yet is a real, expected state ("pending access"), not an error.
export function useAuth() {
  const [session, setSession] = React.useState(undefined); // undefined = loading, null = signed out
  const [role, setRole] = React.useState(null);
  const [roleLoaded, setRoleLoaded] = React.useState(false);

  React.useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabaseClient.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshRole = React.useCallback(async (userId) => {
    if (!userId) { setRole(null); setRoleLoaded(true); return; }
    setRoleLoaded(false);
    const { data, error } = await supabaseClient.from("user_roles").select("*").eq("user_id", userId).maybeSingle();
    if (error) { setRole(null); setRoleLoaded(true); return; }
    if (!data) { setRole(null); setRoleLoaded(true); return; }
    // A Regional Manager can cover more than one region, and a Depot Controller more than one
    // depot -- membership lives in user_role_regions / user_role_depots (see the multi-region
    // and multi-depot migrations), not the old single region/depot_code columns.
    let regions = [];
    let depotCodes = [];
    if (data.role === "regional_manager") {
      const { data: regionRows } = await supabaseClient.from("user_role_regions").select("region").eq("user_id", userId);
      regions = (regionRows || []).map((r) => r.region);
    } else if (data.role === "depot_controller" || data.role === "cce") {
      const { data: depotRows } = await supabaseClient.from("user_role_depots").select("depot_code").eq("user_id", userId);
      depotCodes = (depotRows || []).map((r) => r.depot_code);
    }
    setRole({ role: data.role, regions, depotCodes, depotCode: data.depot_code });
    setRoleLoaded(true);
  }, []);

  React.useEffect(() => {
    if (session === undefined) return;
    refreshRole(session?.user?.id);
  }, [session, refreshRole]);

  const signInWithPassword = React.useCallback(async (email, password) => {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);
  const signOut = React.useCallback(async () => {
    await supabaseClient.auth.signOut();
  }, []);

  return {
    session, loading: session === undefined || !roleLoaded,
    user: session?.user || null, role,
    signInWithPassword, signOut,
  };
}

export function canWriteDepot(role, depotCode, depotRegion) {
  if (!role) return false;
  if (role.role === "national_admin") return true;
  if (role.role === "regional_manager") return (role.regions || []).includes(depotRegion);
  if (role.role === "depot_controller") return (role.depotCodes || []).includes(depotCode);
  if (role.role === "cce") return (role.depotCodes || []).includes(depotCode);
  return false;
}
export function isAdmin(role) {
  return !!role && role.role === "national_admin";
}
