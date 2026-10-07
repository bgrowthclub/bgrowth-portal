import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { NEWSLETTER_AREAS, newsletterService } from "@/services/newsletterService";

/**
 * Profile → E-mail updates: the member's BGrowth news e-mails and the areas
 * they care about. Same settings as the Website's Settings page.
 */
export function EmailUpdatesCard() {
  const [loaded, setLoaded] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    newsletterService
      .get()
      .then((s) => {
        setSubscribed(s.status === "subscribed");
        setInterests(s.interests);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your e-mail settings."))
      .finally(() => setLoaded(true));
  }, []);

  async function save(next: boolean) {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const s = await newsletterService.save(next, interests);
      setSubscribed(s.status === "subscribed");
      setInterests(s.interests);
      setNotice(next ? "Saved — you'll get news in the areas you picked." : "You won't get BGrowth news e-mails anymore.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const toggle = (id: string) =>
    setInterests((current) => (current.includes(id) ? current.filter((v) => v !== id) : [...current, id]));
  const chip = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
      active
        ? "border-primary bg-primary text-white"
        : "border-navy-200 text-navy-600 hover:border-primary/40 dark:border-white/15 dark:text-white/70"
    }`;

  return (
    <Card className="mt-6 p-6">
      <h2 className="font-semibold text-navy-900 dark:text-white">E-mail updates</h2>
      <p className="mt-1 text-sm text-navy-500 dark:text-white/60">
        News and new Workspaces from BGrowth. Pick the areas you care about — we'll only write about those. Account
        e-mails (receipts, trial reminders, support) always arrive.
      </p>
      {!loaded ? (
        <div className="mt-4 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" disabled={saving} aria-pressed={interests.length === 0} onClick={() => setInterests([])} className={chip(interests.length === 0)}>
              All topics
            </button>
            {NEWSLETTER_AREAS.map((area) => (
              <button
                key={area.id}
                type="button"
                disabled={saving}
                aria-pressed={interests.includes(area.id)}
                onClick={() => toggle(area.id)}
                className={chip(interests.includes(area.id))}
              >
                {area.label}
              </button>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button size="sm" isLoading={saving} onClick={() => void save(true)}>
              {subscribed ? "Save interests" : "Subscribe"}
            </Button>
            {subscribed && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(false)}
                className="text-sm font-medium text-navy-400 hover:text-navy-700 dark:text-white/50"
              >
                Stop news e-mails
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-navy-400 dark:text-white/40">
            {subscribed ? "You're subscribed." : "You're not subscribed."}
          </p>
        </>
      )}
      {notice && <p className="mt-3 text-sm font-medium text-primary">{notice}</p>}
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </Card>
  );
}
