import type { WorkspaceContent } from "@/types/workspaceContent";

/**
 * Fixture only — used by the isolated Document V1 preview route
 * (see ../DocumentV1PreviewPage.tsx), never by production data-fetching.
 *
 * Copied verbatim from supabase/seed.sql (the real, currently-published
 * `products.content` for slug "notary-appointment-workspace" — seed.sql's
 * own header says this "is not demo/mock content — it's the actual
 * published Workspace JSON"). Reproduced here as a local, isolated fixture
 * specifically so Document V1 can be exercised against the real Notary
 * Appointment Checklist™ content without any Supabase query, so this
 * preview can never read or write production data.
 */
export const notaryWorkspaceContent: WorkspaceContent = {
  productId: "notary-appointment-checklist",
  brand: {
    name: "Notary Appointment Workflow Checklist",
    companyLabel: "BGrowth",
    primaryColor: "#1061EC",
  },
  footer: {
    proTip:
      "Complete all sections for the most accurate recordkeeping and a smooth, professional experience.",
    helpText: "Visit portal.bgrowth.app for resources and support.",
    helpUrl: "https://portal.bgrowth.app",
  },
  sections: [
    {
      id: "signer",
      number: 1,
      type: "form",
      title: "Signer Information",
      description: "Enter the details of the signer(s) and documents for this notary appointment.",
      icon: "user",
      whyItMatters:
        "Accurate signer information ensures proper identification and prevents delays or issues during the appointment.",
      tip: "Double-check the spelling of names and the type of notarization before continuing.",
      fields: [
        { id: "signerName", label: "Signer Name", type: "text", icon: "user", required: true, placeholder: "John Smith" },
        { id: "phone", label: "Phone Number", type: "phone", icon: "phone", required: true, placeholder: "(555) 123-4567" },
        { id: "email", label: "Email Address", type: "email", icon: "mail", required: true, placeholder: "john.smith@email.com" },
        {
          id: "numSigners",
          label: "Number of Signers",
          type: "select",
          icon: "users",
          required: true,
          options: ["1 Signer", "2 Signers", "3 Signers", "4+ Signers"],
        },
        {
          id: "notarizationType",
          label: "Type of Notarization",
          type: "select",
          icon: "shield-check",
          required: true,
          options: ["Acknowledgement", "Jurat", "Oath or Affirmation", "Copy Certification", "Signature Witnessing", "Other"],
        },
        {
          id: "documents",
          label: "Documents to be Signed",
          type: "textarea",
          icon: "file-text",
          placeholder: "Power of Attorney, Deed of Trust",
        },
      ],
    },
    {
      id: "appointment",
      number: 2,
      type: "form",
      title: "Appointment Details",
      description: "Date, time, location, and special instructions.",
      icon: "calendar-days",
      whyItMatters: "Getting the date, time, and location right avoids missed appointments and wasted travel.",
      tip: "Confirm the exact suite or unit number — many delays start with the wrong door.",
      fields: [
        { id: "date", label: "Appointment Date", type: "date", icon: "calendar-days", required: true },
        { id: "time", label: "Appointment Time", type: "time", icon: "clock", required: true },
        {
          id: "location",
          label: "Location",
          type: "text",
          icon: "map-pin",
          required: true,
          placeholder: "123 Main Street, Suite 200",
          fullWidth: true,
        },
        { id: "city", label: "City", type: "text", icon: "building", required: true, placeholder: "Los Angeles" },
        { id: "state", label: "State", type: "text", icon: "map", required: true, placeholder: "CA" },
        { id: "zip", label: "ZIP", type: "text", icon: "hash", required: true, placeholder: "90001" },
        {
          id: "specialInstructions",
          label: "Special Instructions",
          type: "textarea",
          icon: "notebook-pen",
          placeholder: "Parking is in the rear lot.",
          fullWidth: true,
        },
      ],
    },
    {
      id: "agency",
      number: 3,
      type: "form",
      title: "Agency / Title Company",
      description: "Company and contact information.",
      icon: "building-2",
      whyItMatters: "Order and escrow numbers let the title company match your work to the right file instantly.",
      tip: "Copy order and escrow numbers directly from the assignment email to avoid typos.",
      fields: [
        { id: "companyName", label: "Company Name", type: "text", icon: "building-2", required: true, placeholder: "Pacific Title & Escrow" },
        { id: "contactName", label: "Contact Name", type: "text", icon: "user-round", required: true, placeholder: "Maria Lopez" },
        { id: "phone", label: "Phone", type: "phone", icon: "phone", required: true, placeholder: "(555) 987-6543" },
        { id: "email", label: "Email", type: "email", icon: "mail", required: true, placeholder: "orders@pacifictitle.com" },
        { id: "orderNumber", label: "Order Number", type: "text", icon: "hash", required: true, placeholder: "ORD-2026-4471" },
        { id: "escrowNumber", label: "Escrow Number", type: "text", icon: "file-search", required: true, placeholder: "ESC-88213" },
      ],
    },
    {
      id: "journal",
      number: 4,
      type: "form",
      title: "Journal Reference",
      description: "Journal book reference information.",
      icon: "book-open",
      optional: true,
      tip: "Leave this blank until the appointment is complete if you prefer to journal in person.",
      fields: [
        { id: "journalNumber", label: "Journal Number", type: "text", icon: "book-open", placeholder: "JN-014" },
        { id: "page", label: "Page", type: "text", icon: "file-digit", placeholder: "42" },
        { id: "entry", label: "Entry", type: "text", icon: "pen-line", placeholder: "7" },
        { id: "invoice", label: "Invoice", type: "text", icon: "receipt", placeholder: "INV-3390" },
        { id: "feeCharged", label: "Fee Charged", type: "text", icon: "dollar-sign", placeholder: "$15.00" },
      ],
    },
    {
      id: "beforeAppointment",
      number: 5,
      type: "checklist",
      title: "Before the Appointment",
      description: "Tasks to complete before the appointment.",
      icon: "clipboard-list",
      whyItMatters: "A quick check before you leave catches missing documents or supplies before they cost you time.",
      items: [
        { id: "confirmAppointment", label: "Confirm appointment with the signer" },
        { id: "reviewDocuments", label: "Review documents to be notarized" },
        { id: "selectCertificate", label: "Select the correct certificate type" },
        { id: "prepareSupplies", label: "Prepare seal, journal, and supplies" },
        { id: "clarifyPayment", label: "Clarify payment and fees with the signer" },
      ],
    },
    {
      id: "duringAppointment",
      number: 6,
      type: "checklist",
      title: "During the Appointment",
      description: "Tasks while working with the signer.",
      icon: "users",
      whyItMatters: "Following the correct notarial act protects you, the signer, and the validity of the document.",
      items: [
        { id: "signerPresent", label: "Signer is present and willing" },
        { id: "verifyId", label: "Verify signer identification" },
        { id: "correctNotarialAct", label: "Perform the correct notarial act" },
        { id: "completeCertificate", label: "Complete the notarial certificate" },
        { id: "answerQuestions", label: "Answer any signer questions" },
      ],
    },
    {
      id: "beforeClosing",
      number: 7,
      type: "checklist",
      title: "Before Closing the Appointment",
      description: "Final steps before the appointment ends.",
      icon: "file-check-2",
      whyItMatters: "A careful close-out keeps your journal accurate and your records audit-ready.",
      items: [
        { id: "journalEntry", label: "Complete the journal entry" },
        { id: "reviewSeal", label: "Review seal impression for clarity" },
        { id: "reviewDocumentsClosing", label: "Review documents for completeness" },
        { id: "returnDocuments", label: "Return original documents to signer" },
        { id: "thankSigner", label: "Thank the signer" },
      ],
    },
    {
      id: "professionalHabits",
      number: 8,
      type: "checklist",
      title: "Professional Habits Check",
      description: "Best practices for a professional notary.",
      icon: "shield-check",
      whyItMatters: "Consistent habits are what separate a reliable notary from a risky one.",
      items: [
        { id: "followedProcess", label: "Followed standard notarial process" },
        { id: "nothingSkipped", label: "Nothing was skipped or rushed" },
        { id: "recordsSecured", label: "Records and journal are secured" },
        { id: "educationCompleted", label: "Continuing education is up to date" },
        { id: "reflectImprove", label: "Reflected on the appointment to improve" },
      ],
    },
    {
      id: "notes",
      number: 9,
      type: "notes",
      title: "Notes",
      description: "Additional notes about this appointment.",
      icon: "file-text",
      tip: "Notes are private to you — they are never shared with the signer or agency.",
    },
    {
      id: "outcome",
      number: 10,
      type: "outcome",
      title: "Appointment Outcome",
      description: "Final outcome and follow-up actions.",
      icon: "check-circle-2",
      whyItMatters: "Recording the outcome keeps your pipeline and invoicing accurate.",
      items: [
        { id: "completedSuccessfully", label: "Completed Successfully" },
        { id: "followUpNeeded", label: "Follow-up Needed" },
        { id: "additionalDocumentsRequired", label: "Additional Documents Required" },
        { id: "invoiceSent", label: "Invoice Sent" },
      ],
    },
  ],
};
