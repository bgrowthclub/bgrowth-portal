import html2pdf from "html2pdf.js";

/**
 * Verbatim port of bgrowth-studio's src/lib/pdf.ts — same PDF generation
 * logic, kept identical on purpose so Studio and Portal produce the same
 * PDF output/behavior. If this ever needs to change, change both copies
 * together.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string,
  pdfOptions?: {
    format?: string;
    orientation?: "portrait" | "landscape";
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

  const origElementWidth = element.style.width;
  element.style.width = "800px";

  const options = {
    margin: [10, 12, 10, 12] as [number, number, number, number],
    filename,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false, windowWidth: 824 },
    jsPDF: {
      unit: "mm",
      format: (pdfOptions?.format || "letter").toLowerCase(),
      orientation: pdfOptions?.orientation || ("portrait" as const),
    },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
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
    element.style.width = origElementWidth;
  }
}
