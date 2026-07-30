/**
 * The one place that decides who transactional email comes from — every
 * other file (sendEmail.ts, templates/*) reads these exports, never
 * `process.env.EMAIL_*` directly. Switching senders (e.g. to a future
 * @bgrowth.app domain once it's verified in Resend) is an env var change
 * here, not a template or logic change.
 *
 * Defaults match the initial launch sender BGrowth decided on
 * (info@benterprises.biz) so a deploy with no EMAIL_* env vars set still
 * sends correctly — but every value is overridable via env var so a future
 * domain switch never requires touching code.
 */
const DEFAULT_FROM_NAME = "BGrowth";
const DEFAULT_FROM_ADDRESS = "info@benterprises.biz";

export const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME?.trim() || DEFAULT_FROM_NAME;
export const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS?.trim() || DEFAULT_FROM_ADDRESS;
/** Defaults to the From address itself — override independently only if a reply path other than the sender is ever needed. */
export const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO?.trim() || EMAIL_FROM_ADDRESS;

/** Resend's `from` field format: `"Name <address>"`. */
export const EMAIL_FROM = `${EMAIL_FROM_NAME} <${EMAIL_FROM_ADDRESS}>`;
