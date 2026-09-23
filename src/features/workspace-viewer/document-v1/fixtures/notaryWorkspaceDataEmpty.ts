import type { WorkspaceData } from "@/types/workspaceContent";

/**
 * Fixture only — used by the isolated Document V1 preview route to validate
 * layout robustness against a near-empty fill (a member who just opened the
 * Workspace and has barely started). Same section/field ids as
 * notaryWorkspaceContent.ts; almost everything left blank/unchecked on
 * purpose. Not read from or written to any real workspace_instances row.
 */
export const notaryWorkspaceDataEmpty: WorkspaceData = {
  signer: {
    signerName: "Elena Marquez",
    // phone, email, numSigners, notarizationType, documents intentionally left blank.
  },
  appointment: {
    // Only the date is set — everything else still blank.
    date: "2026-10-02",
  },
  agency: {},
  journal: {},
  beforeAppointment: {
    confirmAppointment: true,
    // Remaining four items unchecked.
  },
  duringAppointment: {},
  beforeClosing: {},
  professionalHabits: {},
  notes: "",
  outcome: {},
};
