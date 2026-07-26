/**
 * html2pdf.js ships no type declarations (same as bgrowth-studio, which
 * gets away with it only because that repo's tsconfig isn't strict).
 * Portal's tsconfig has strict: true, so this ambient module keeps the
 * import from erroring under noImplicitAny — src/lib/pdf.ts is the only
 * place that imports it.
 */
declare module "html2pdf.js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped third-party default export, no meaningful shape to give it
  const html2pdf: any;
  export default html2pdf;
}
