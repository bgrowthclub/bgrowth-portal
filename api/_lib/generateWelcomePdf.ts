import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { getProductOutcomes } from "../../src/lib/productMarketing.js";
import { formatTrialSentence } from "../../src/lib/trial.js";
import type { TrialUnit } from "../../src/types/database";
import type { WorkspaceContent } from "../../src/types/workspaceContent";

const PORTAL_URL = process.env.PORTAL_PUBLIC_URL;

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const NAVY = rgb(0x0b / 255, 0x1c / 255, 0x3b / 255);
const PRIMARY = rgb(0x10 / 255, 0x61 / 255, 0xec / 255);
const GRAY = rgb(0x47 / 255, 0x55 / 255, 0x69 / 255);
const LIGHT_GRAY = rgb(0x94 / 255, 0xa3 / 255, 0xb8 / 255);
const WHITE = rgb(1, 1, 1);

export interface GenerateWelcomePdfInput {
  productName: string;
  productSlug: string;
  shortDescription: string;
  metadata: Record<string, unknown>;
  content: WorkspaceContent;
  coverImageUrl: string | null;
  trialDuration: number | null;
  trialUnit: TrialUnit;
  /** The publish_product() version this publish is about to become — computed by the caller before the RPC call, since generation happens before it (see api/publishing-engine/publish.ts). */
  workspaceVersion: number;
  publishedAt: Date;
}

/**
 * Renders the Welcome Guide entirely with pdf-lib — no browser/DOM/canvas,
 * so this runs as plain Node in a Vercel serverless function (unlike
 * Portal's other PDF export, html2pdf.js, which needs a live DOM and is
 * strictly client-side). Every Workspace gets one automatically on every
 * publish; nothing here is hand-authored per product.
 */
export async function generateWelcomePdf(input: GenerateWelcomePdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const writer = new PageWriter(pdfDoc, bodyFont, boldFont);

  await drawHeader(writer, input);

  const coverImage = await embedImageFromUrl(pdfDoc, input.coverImageUrl);
  if (coverImage) {
    writer.addImage(coverImage);
  }

  writer.addSpacer(8);
  writer.addHeading("How to Get Started");
  writer.addParagraph(
    `${input.productName} is organized into ${input.content.sections.length} guided section${
      input.content.sections.length === 1 ? "" : "s"
    }. Work through them in order inside BGrowth Workspace — your progress saves automatically as you go.`,
  );
  writer.addNumberedList(
    input.content.sections.map((section) => ({
      title: section.title,
      description: section.description,
    })),
  );

  const outcomes = getProductOutcomes({ metadata: input.metadata });
  if (outcomes && outcomes.length > 0) {
    writer.addSpacer(8);
    writer.addHeading("What You'll Accomplish");
    writer.addBulletList(outcomes);
  }

  writer.addSpacer(8);
  writer.addHeading("Important Notes");
  writer.addParagraph(
    "This guide is an onboarding companion, not the Workspace itself — your actual checklists, planners, and " +
      "templates live inside BGrowth Workspace, where every answer you enter is saved to your account.",
  );

  writer.addSpacer(8);
  writer.addHeading("Need Help?");
  writer.addParagraph("Questions about this Workspace? Reach the BGrowth Club team any time at support@bgrowthclub.com.");

  await drawStartWorkspaceSection(writer, input);

  return pdfDoc.save();
}

async function drawHeader(writer: PageWriter, input: GenerateWelcomePdfInput): Promise<void> {
  const page = writer.page;
  const bandHeight = 132;
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - bandHeight, width: PAGE_WIDTH, height: bandHeight, color: NAVY });

  writer.cursorY = PAGE_HEIGHT - 44;
  writer.drawTextAt("W E L C O M E   G U I D E", MARGIN, writer.cursorY, {
    font: writer.boldFont,
    size: 10,
    color: PRIMARY,
  });

  writer.cursorY -= 26;
  writer.drawWrappedText(input.productName, MARGIN, writer.cursorY, {
    font: writer.boldFont,
    size: 24,
    color: WHITE,
    maxWidth: CONTENT_WIDTH,
    lineHeight: 28,
  });
  writer.cursorY -= 28;

  const trialSentence =
    input.trialDuration != null ? formatTrialSentence(input.trialDuration, input.trialUnit) : null;
  const subtitle = trialSentence
    ? `${input.shortDescription} — try it free for ${trialSentence}.`
    : input.shortDescription;
  writer.cursorY -= 6;
  writer.drawWrappedText(subtitle, MARGIN, writer.cursorY, {
    font: writer.bodyFont,
    size: 12,
    color: rgb(0.85, 0.88, 0.95),
    maxWidth: CONTENT_WIDTH,
    lineHeight: 16,
  });

  writer.cursorY = PAGE_HEIGHT - bandHeight - 24;
  const publishedLabel = input.publishedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  writer.drawTextAt(`Workspace Version ${input.workspaceVersion} · Published ${publishedLabel}`, MARGIN, writer.cursorY, {
    font: writer.bodyFont,
    size: 9,
    color: LIGHT_GRAY,
  });
  writer.cursorY -= 20;
}

async function drawStartWorkspaceSection(writer: PageWriter, input: GenerateWelcomePdfInput): Promise<void> {
  if (!PORTAL_URL) return; // No base URL configured on this deployment — omit the link/QR rather than emit a broken one.

  const productUrl = `${PORTAL_URL}/product/${input.productSlug}`;
  const qrDataUrl = await QRCode.toDataURL(productUrl, { margin: 1, width: 240 });
  const qrImageBytes = Buffer.from(qrDataUrl.split(",")[1], "base64");

  writer.ensureSpace(150);
  writer.addSpacer(8);
  writer.addHeading("Start Your Workspace");
  writer.addParagraph("Scan the code below, or use the link, to open this Workspace in BGrowth Portal:");

  const qrImage = await writer.pdfDoc.embedPng(qrImageBytes);
  const qrSize = 100;
  writer.ensureSpace(qrSize + 12);
  writer.page.drawImage(qrImage, { x: MARGIN, y: writer.cursorY - qrSize, width: qrSize, height: qrSize });
  writer.cursorY -= qrSize + 14;

  writer.drawTextAt(productUrl, MARGIN, writer.cursorY, {
    font: writer.boldFont,
    size: 11,
    color: PRIMARY,
  });
  writer.cursorY -= 20;
}

async function embedImageFromUrl(pdfDoc: PDFDocument, url: string | null) {
  if (!url) return null;
  try {
    // Bounded — an unreachable/slow host must never hang the whole publish
    // request past the function's execution limit (see the outer per-step
    // try/catch in api/publishing-engine/publish.ts, which treats a thrown
    // error here as "skip the Welcome PDF," not "fail the publish," but a
    // hang can't be caught the same way without this).
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("png") || url.toLowerCase().endsWith(".png")) {
      return await pdfDoc.embedPng(bytes);
    }
    return await pdfDoc.embedJpg(bytes);
  } catch {
    // A missing/unreachable cover image should never fail the whole publish.
    return null;
  }
}

interface TextStyle {
  font: PDFFont;
  size: number;
  color: ReturnType<typeof rgb>;
}

interface WrappedTextStyle extends TextStyle {
  maxWidth: number;
  lineHeight: number;
}

/** Minimal top-to-bottom layout helper: tracks a cursor down the page and adds new pages on overflow. */
class PageWriter {
  pdfDoc: PDFDocument;
  bodyFont: PDFFont;
  boldFont: PDFFont;
  page: PDFPage;
  cursorY: number;

  constructor(pdfDoc: PDFDocument, bodyFont: PDFFont, boldFont: PDFFont) {
    this.pdfDoc = pdfDoc;
    this.bodyFont = bodyFont;
    this.boldFont = boldFont;
    this.page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.cursorY = PAGE_HEIGHT - MARGIN;
  }

  private newPage(): void {
    this.page = this.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.cursorY = PAGE_HEIGHT - MARGIN;
  }

  ensureSpace(height: number): void {
    if (this.cursorY - height < MARGIN) this.newPage();
  }

  addSpacer(height: number): void {
    this.ensureSpace(height);
    this.cursorY -= height;
  }

  drawTextAt(text: string, x: number, y: number, style: TextStyle): void {
    this.page.drawText(text, { x, y, font: style.font, size: style.size, color: style.color });
  }

  /** Wraps `text` to `maxWidth`, drawing downward from `startY`, paginating as needed. Returns nothing — caller re-reads writer.cursorY. */
  drawWrappedText(text: string, x: number, startY: number, style: WrappedTextStyle): void {
    const words = text.split(/\s+/);
    let line = "";
    let y = startY;
    this.cursorY = y;

    const flushLine = () => {
      if (!line) return;
      this.ensureSpace(style.lineHeight);
      y = this.cursorY;
      this.page.drawText(line, { x, y, font: style.font, size: style.size, color: style.color });
      this.cursorY -= style.lineHeight;
      line = "";
    };

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      const width = style.font.widthOfTextAtSize(candidate, style.size);
      if (width > style.maxWidth && line) {
        flushLine();
        line = word;
      } else {
        line = candidate;
      }
    }
    flushLine();
  }

  addHeading(text: string): void {
    this.ensureSpace(28);
    this.page.drawText(text, { x: MARGIN, y: this.cursorY, font: this.boldFont, size: 15, color: NAVY });
    this.cursorY -= 22;
  }

  addParagraph(text: string): void {
    this.drawWrappedText(text, MARGIN, this.cursorY, {
      font: this.bodyFont,
      size: 11,
      color: GRAY,
      maxWidth: CONTENT_WIDTH,
      lineHeight: 16,
    });
    this.cursorY -= 6;
  }

  addBulletList(items: string[]): void {
    for (const item of items) {
      this.ensureSpace(16);
      this.page.drawText("•", { x: MARGIN, y: this.cursorY, font: this.bodyFont, size: 11, color: PRIMARY });
      this.drawWrappedText(item, MARGIN + 14, this.cursorY, {
        font: this.bodyFont,
        size: 11,
        color: GRAY,
        maxWidth: CONTENT_WIDTH - 14,
        lineHeight: 16,
      });
      this.cursorY -= 4;
    }
  }

  addNumberedList(items: { title: string; description: string }[]): void {
    items.forEach((item, index) => {
      this.ensureSpace(20);
      this.page.drawText(`${index + 1}.`, { x: MARGIN, y: this.cursorY, font: this.boldFont, size: 11, color: PRIMARY });
      this.drawWrappedText(item.title, MARGIN + 18, this.cursorY, {
        font: this.boldFont,
        size: 11,
        color: NAVY,
        maxWidth: CONTENT_WIDTH - 18,
        lineHeight: 15,
      });
      this.drawWrappedText(item.description, MARGIN + 18, this.cursorY, {
        font: this.bodyFont,
        size: 10,
        color: LIGHT_GRAY,
        maxWidth: CONTENT_WIDTH - 18,
        lineHeight: 14,
      });
      this.cursorY -= 6;
    });
  }

  addImage(image: PDFImage): void {
    const maxHeight = 180;
    const scale = Math.min(CONTENT_WIDTH / image.width, maxHeight / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;
    this.ensureSpace(height + 12);
    const x = MARGIN + (CONTENT_WIDTH - width) / 2;
    this.page.drawImage(image, { x, y: this.cursorY - height, width, height });
    this.cursorY -= height + 12;
  }
}
