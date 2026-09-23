import type { WorkspaceData } from "@/types/workspaceContent";

/**
 * Fixture only — a representative "mostly filled" fill for the Notary
 * Appointment Checklist™, used solely by the isolated Document V1 preview
 * route (see ../DocumentV1PreviewPage.tsx). Every key matches a real
 * section id, and every field id inside a section matches
 * notaryWorkspaceContent.ts exactly, field-for-field — this exercises the
 * same section/field ids production `workspace_instances.data` rows use,
 * without reading or writing any real saved instance.
 */
export const notaryWorkspaceData: WorkspaceData = {
  signer: {
    signerName: "Elena Marquez",
    phone: "(555) 214-7788",
    email: "elena.marquez@email.com",
    numSigners: "2 Signers",
    notarizationType: "Acknowledgement",
    documents: "Power of Attorney, Deed of Trust",
  },
  appointment: {
    date: "2026-10-02",
    time: "14:30",
    location: "123 Main Street, Suite 200",
    city: "Los Angeles",
    state: "CA",
    zip: "90001",
    specialInstructions: "Parking is in the rear lot. Buzz unit 200 at the gate.",
  },
  agency: {
    companyName: "Pacific Title & Escrow",
    contactName: "Maria Lopez",
    phone: "(555) 987-6543",
    email: "orders@pacifictitle.com",
    orderNumber: "ORD-2026-4471",
    escrowNumber: "ESC-88213",
  },
  journal: {
    journalNumber: "JN-014",
    page: "42",
    entry: "7",
    invoice: "INV-3390",
    feeCharged: "$15.00",
  },
  beforeAppointment: {
    confirmAppointment: true,
    reviewDocuments: true,
    selectCertificate: true,
    prepareSupplies: true,
    clarifyPayment: false,
  },
  duringAppointment: {
    signerPresent: true,
    verifyId: true,
    correctNotarialAct: true,
    completeCertificate: false,
    answerQuestions: false,
  },
  beforeClosing: {
    journalEntry: true,
    reviewSeal: true,
    reviewDocumentsClosing: false,
    returnDocuments: false,
    thankSigner: false,
  },
  professionalHabits: {
    followedProcess: true,
    nothingSkipped: true,
    recordsSecured: false,
    educationCompleted: false,
    reflectImprove: false,
  },
  notes:
    "Signer arrived a few minutes early. Confirmed ID with California driver's license, expiration verified. Second signer joined by phone for a brief acknowledgement — followed up in person same day.",
  outcome: {
    completedSuccessfully: true,
    followUpNeeded: false,
    additionalDocumentsRequired: false,
    invoiceSent: true,
  },
};
