import html2pdf from "html2pdf.js";

/**
 * Originally a verbatim port of bgrowth-studio's src/lib/pdf.ts. Portal's
 * copy has since diverged on one point, documented where it's used below
 * (the optional `pagebreakMode`) — Studio's copy is intentionally NOT
 * updated to match, since Studio is out of scope for whatever introduced
 * this divergence. Every other option keeps the same default values as
 * before, so any existing caller that doesn't pass `pagebreakMode` gets
 * byte-identical behavior to Studio's copy and to Portal's own prior
 * behavior.
 *
 * Pre-existing bug fixed here, found and fixed in Studio's copy first (see
 * that file's comment for the full derivation) and ported back here since
 * this file was byte-for-byte identical in the relevant part: this
 * function used to force `element.style.width = "800px"` right before
 * handing `element` to html2pdf. html2pdf's own internal toContainer()
 * clones that element into ITS OWN wrapper sized to the actual printable
 * page width (always less than 800px at any realistic margin), and since
 * cloneNode() copies inline styles, the clone kept declaring width:800px
 * inside that narrower wrapper — every line of text within roughly the
 * rightmost 60-75px was silently missing from the captured canvas, not
 * just scaled down (confirmed by extracting the embedded page image
 * directly from a generated PDF). The matching fix is also needed in
 * src/styles/index.css's `.printable-summary` rule, which had the exact
 * same fixed 800px width as a plain CSS rule — that one dominates over
 * this function's own (now-removed) inline-style forcing, since it's
 * class-based and gets inherited by html2pdf's clone too.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string,
  pdfOptions?: {
    format?: string;
    orientation?: "portrait" | "landscape";
    /**
     * Overrides html2pdf's `pagebreak.mode` (default, unchanged from
     * before: `["avoid-all", "css", "legacy"]`). Omit this to keep the
     * exact existing behavior — every caller that doesn't pass it is
     * unaffected by this option's existence.
     *
     * `"avoid-all"` makes html2pdf treat literally every DOM element
     * (that's no taller than one full page) as unsplittable: if a
     * boundary falls inside it, the *whole* element gets pushed to the
     * next page — and this overrides any author CSS unconditionally
     * (confirmed by reading node_modules/html2pdf.js/src/plugin/pagebreaks.js:
     * with `avoid-all` present, `rules.avoid` starts `true` for every
     * element and CSS can only add further avoidance via `||`, never
     * remove it). That blanket behavior is what relocated a whole
     * checklist section, and separately a short closing block, onto a
     * near-empty trailing page in Document V1 testing — despite an
     * identical browser Print of the same content fitting it in the
     * room actually available. Passing `["css", "legacy"]` (html2pdf's
     * own un-overridden library default) instead makes only the
     * elements a caller explicitly marks `break-inside: avoid` (or
     * lists in `pagebreak.avoid`) unsplittable, and lets everything
     * else flow/paginate the way a real browser print already does.
     */
    pagebreakMode?: string[];
    /**
     * Overrides the PDF margin in mm, `[top, left, bottom, right]` (default,
     * unchanged from before: `[10, 12, 10, 12]`). Omit this to keep the
     * exact existing behavior.
     *
     * This is the one option that actually controls how much content fits
     * on a page: html2pdf computes `pageSize.inner.height = pageHeight -
     * margin[0] - margin[2]`, and the per-page raster slice height is
     * directly proportional to that (`pxPageHeight = canvas.width *
     * (inner.height / inner.width)` — see node_modules/html2pdf.js/src/worker.js).
     * `html2canvas.scale` was checked and does NOT affect this ratio (it
     * scales the canvas and the content together, proportionally, so it
     * nets out) — margin is the real, documented lever. A smaller margin
     * gives back genuine, computed page height, which is what closes the
     * roughly-one-line shortfall between html2pdf's page-height accounting
     * and a real browser Print's for the same content.
     */
    margin?: [number, number, number, number];
  },
): Promise<void> {
  const container = element.parentElement;
  const target = container || element;

  const originalWidth = target.style.width;
  const originalHeight = target.style.height;
  const originalOverflow = target.style.overflow;
  const originalPosition = target.style.position;
  const originalLeft = target.style.left;
  const originalTop = target.style.top;
  const originalZIndex = target.style.zIndex;
  const originalOpacity = target.style.opacity;
  const originalVisibility = target.style.visibility;

  target.style.position = "absolute";
  target.style.top = "0px";
  target.style.left = "-9999px";
  target.style.width = "800px";
  target.style.height = "auto";
  target.style.overflow = "visible";
  target.style.zIndex = "99999";
  target.style.opacity = "1";
  target.style.visibility = "visible";

  const options = {
    margin: pdfOptions?.margin || ([10, 12, 10, 12] as [number, number, number, number]),
    filename,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false, windowWidth: 824 },
    jsPDF: {
      unit: "mm",
      format: (pdfOptions?.format || "letter").toLowerCase(),
      orientation: pdfOptions?.orientation || ("portrait" as const),
    },
    pagebreak: { mode: pdfOptions?.pagebreakMode || ["avoid-all", "css", "legacy"] },
  };

  try {
    await html2pdf().set(options).from(element).save();
  } finally {
    target.style.width = originalWidth;
    target.style.height = originalHeight;
    target.style.overflow = originalOverflow;
    target.style.position = originalPosition;
    target.style.left = originalLeft;
    target.style.top = originalTop;
    target.style.zIndex = originalZIndex;
    target.style.opacity = originalOpacity;
    target.style.visibility = originalVisibility;
  }
}
