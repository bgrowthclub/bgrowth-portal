import type { WorkspaceData } from "@/types/workspaceContent";

/**
 * Fixture only — used by the isolated Document V1 preview route to validate
 * layout robustness against realistic long-form content (a fully filled,
 * verbose fill — long textarea answers and a long Notes entry), enough to
 * span multiple pages. Same section/field ids as notaryWorkspaceContent.ts.
 * Not read from or written to any real workspace_instances row.
 */
export const notaryWorkspaceDataLong: WorkspaceData = {
  signer: {
    signerName: "Elena Marquez-Whitfield",
    phone: "(555) 214-7788",
    email: "elena.marquez-whitfield@longform-email-example.com",
    numSigners: "4+ Signers",
    notarizationType: "Other",
    documents:
      "Durable Power of Attorney (General), Revocable Living Trust Amendment No. 3, Deed of Trust for the property at 4471 Wandering Oak Lane, Certificate of Trust, HIPAA Authorization Release, and a Grant Deed transferring the Wandering Oak property from the Marquez-Whitfield Family Trust to the newly formed Whitfield Holdings LLC — all four signers need to review and sign each document in the order listed, with the Grant Deed requiring an additional witness signature per county recorder requirements.",
  },
  appointment: {
    date: "2026-10-02",
    time: "14:30",
    location: "123 Main Street, Suite 200, 4th Floor, Conference Room B (ask front desk for a visitor badge)",
    city: "Los Angeles",
    state: "CA",
    zip: "90001",
    specialInstructions:
      "Parking is in the rear lot only — the street-facing spaces are reserved for the medical office next door and towing is enforced. Buzz unit 200 at the gate; if there's no answer, call the front desk at (555) 214-0099 and someone will let you in. The building requires a signed-in visitor badge, so bring a government ID. Once upstairs, the conference room is the second door on the left past the kitchenette — there will be a sign on the door. Please arrive 10 minutes early since all four signers need ID verified individually before the notarization can begin, and street parking after 4pm requires a permit that visitors don't have.",
  },
  agency: {
    companyName: "Pacific Title & Escrow — Downtown Regional Office",
    contactName: "Maria Lopez-Fernandez",
    phone: "(555) 987-6543",
    email: "orders@pacifictitleandescrowdowntownregional.com",
    orderNumber: "ORD-2026-4471-REV2",
    escrowNumber: "ESC-88213-A",
  },
  journal: {
    journalNumber: "JN-014",
    page: "42",
    entry: "7",
    invoice: "INV-3390",
    feeCharged: "$75.00 (4 signatures @ $15.00 + $15.00 travel fee)",
  },
  beforeAppointment: {
    confirmAppointment: true,
    reviewDocuments: true,
    selectCertificate: true,
    prepareSupplies: true,
    clarifyPayment: true,
  },
  duringAppointment: {
    signerPresent: true,
    verifyId: true,
    correctNotarialAct: true,
    completeCertificate: true,
    answerQuestions: true,
  },
  beforeClosing: {
    journalEntry: true,
    reviewSeal: true,
    reviewDocumentsClosing: true,
    returnDocuments: true,
    thankSigner: true,
  },
  professionalHabits: {
    followedProcess: true,
    nothingSkipped: true,
    recordsSecured: true,
    educationCompleted: true,
    reflectImprove: true,
  },
  notes:
    "This was a longer-than-usual appointment due to the number of signers and documents involved. All four signers (Elena Marquez-Whitfield, her spouse, and two adult children as trustees/beneficiaries) were present and verified with current California driver's licenses — all four IDs matched the names on the documents exactly, no discrepancies. The Grant Deed required an additional witness signature per the county recorder's office requirement for LLC transfers from a family trust; the office manager next door agreed to serve as the witness and was also ID-verified and logged in the journal as a witness entry.\n\nOne signer (the younger adult child) initially had an expired ID, but produced a valid passport as a secondary form of acceptable identification, which was used instead and noted accordingly.\n\nThe Revocable Living Trust Amendment took the longest to review since it referenced two prior amendments that weren't part of the packet — confirmed with the agency contact (Maria) by phone during the appointment that this was expected and the notarization could proceed regardless, since the amendment stands on its own.\n\nAll signatures and notarial certificates were completed without issue. Recommended the client keep a certified copy of the Grant Deed for their own records before it's recorded with the county. Overall a smooth appointment despite the extra time required — following the same structured process even for a large multi-document signing kept everything organized and avoided any missed pages or signatures.",
  outcome: {
    completedSuccessfully: true,
    followUpNeeded: true,
    additionalDocumentsRequired: false,
    invoiceSent: true,
  },
};
