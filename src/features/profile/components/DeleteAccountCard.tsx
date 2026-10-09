import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import { TextField } from "@/components/ui/TextField";
import { accountService, type DeletionRequest } from "@/services/accountService";

const WORD = "DELETE";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/**
 * Profile → Delete account: ask BGrowth to delete the account and all its
 * data, see the pending request, or cancel it. Same request as the
 * Website's Settings (the team completes it in the Website's Admin).
 */
export function DeleteAccountCard() {
  const [request, setRequest] = useState<DeletionRequest | null | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    accountService
      .getDeletionRequest()
      .then(setRequest)
      .catch(() => setRequest(null));
  }, []);

  async function run(action: () => Promise<DeletionRequest | null>) {
    setBusy(true);
    setError(null);
    try {
      setRequest(await action());
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const pending = request?.status === "pending";

  return (
    <Card className="mt-6 border-red-100 p-6 dark:border-red-500/20">
      <h2 className="font-semibold text-navy-900 dark:text-white">Delete account</h2>
      {request === undefined ? (
        <div className="mt-4 flex justify-center">
          <Spinner />
        </div>
      ) : pending ? (
        <>
          <p className="mt-1 text-sm text-navy-500 dark:text-white/60">
            You asked to delete your account on <strong>{formatDate(request.requested_at)}</strong>. Our team will complete it
            within 30 days and e-mail you when it's done. Until then, your account keeps working.
          </p>
          <div className="mt-4">
            <Button size="sm" variant="secondary" isLoading={busy} onClick={() => void run(accountService.cancelDeletion)}>
              Cancel the request
            </Button>
          </div>
        </>
      ) : !confirming ? (
        <>
          <p className="mt-1 text-sm text-navy-500 dark:text-white/60">
            Ask us to delete your account and everything in it: your Workspaces and access, saved records, reviews, support
            conversations and newsletter subscription. We keep only the payment records the law requires.
          </p>
          {request?.status === "rejected" && request.admin_note && (
            <p className="mt-3 rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-600 dark:bg-white/5 dark:text-white/70">
              Your last request wasn't completed: {request.admin_note}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setReason("");
              setTyped("");
              setError(null);
              setConfirming(true);
            }}
            className="mt-4 text-sm font-semibold text-red-600 hover:underline"
          >
            Delete my account…
          </button>
        </>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-navy-500 dark:text-white/60">
            Everything will be deleted for good. Purchases can't be recovered afterwards.
          </p>
          <Textarea
            label="Why are you leaving? (optional)"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="It helps us improve."
          />
          <TextField label={`Type ${WORD} to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} />
          <div className="flex flex-wrap gap-3">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
              Keep my account
            </Button>
            <Button
              size="sm"
              isLoading={busy}
              disabled={typed.trim().toUpperCase() !== WORD}
              onClick={() => void run(() => accountService.requestDeletion(reason.trim()))}
              className="!bg-red-600 hover:!bg-red-700"
            >
              Request deletion
            </Button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </Card>
  );
}
