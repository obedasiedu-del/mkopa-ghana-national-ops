"use strict";
// "Halt of Allocation in the Territory" policy, agreed by Retail/Sales ops: a phased
// rollout tightening the allowed aged-stock (14d+ = Urgent + High Risk) count a depot
// may carry before new allocation is halted, tiered by how many devices the depot
// already has with DSRs. Phases activate on their start date and stay active until the
// next phase starts.
export const HALT_PHASES = [
  {
    key: "phase1", label: "Phase 1", startDate: "2026-09-17",
    brackets: [{ max: 70, limit: 15 }, { max: Infinity, limit: 25 }],
  },
  {
    key: "phase2", label: "Phase 2", startDate: "2026-09-24",
    brackets: [{ max: 70, limit: 12 }, { max: Infinity, limit: 20 }],
  },
  {
    key: "phase3", label: "Phase 3", startDate: "2026-10-01",
    brackets: [{ max: 70, limit: 10 }, { max: Infinity, limit: 15 }],
  },
];

// The most recent phase whose start date has passed (or today, if it starts today).
// Returns null before 2026-09-17 (no phase active yet).
export function activeHaltPhase(todayStr) {
  const today = todayStr || new Date().toISOString().slice(0, 10);
  let active = null;
  HALT_PHASES.forEach((p) => { if (p.startDate <= today) active = p; });
  return active;
}

// counts: the object countsForDevices() returns for one depot's device ledger.
// Returns null if no phase is active yet (policy hasn't started).
export function haltStatusForDepot(counts, phase) {
  const activePhase = phase === undefined ? activeHaltPhase() : phase;
  if (!activePhase) return null;
  const allocated = counts.total;
  const bracket = activePhase.brackets.find((b) => allocated <= b.max) || activePhase.brackets[activePhase.brackets.length - 1];
  const agedCount = counts.urgent + counts.highrisk; // 14d+
  const halted = agedCount >= bracket.limit;
  return { phase: activePhase, allocated, agedCount, limit: bracket.limit, halted };
}
