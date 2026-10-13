// Extracts readable text from user-uploaded research documents.
// PDFs are parsed with pdf.js (dynamic import, so it never enters the eager
// bundle); plain-text formats are read directly. Anything else is rejected
// rather than read as raw bytes, which used to send binary junk to the AI.

export interface DocumentText {
  text: string;
  pages: number;          // 0 for non-PDF files
  truncated: boolean;
}

export class UnsupportedDocumentError extends Error {}

const TEXT_EXTENSIONS = ['.txt', '.md'];

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i).toLowerCase();
}

export function isSupportedDocument(name: string): boolean {
  const ext = extensionOf(name);
  return ext === '.pdf' || TEXT_EXTENSIONS.includes(ext);
}

async function readPdf(file: File, maxChars: number): Promise<DocumentText> {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const doc = await loadingTask.promise;
  try {
    const parts: string[] = [];
    let length = 0;
    for (let p = 1; p <= doc.numPages && length < maxChars; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const pageText = content.items
        .map(item => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (pageText) {
        parts.push(pageText);
        length += pageText.length;
      }
    }
    const text = parts.join('\n\n');
    return { text: text.slice(0, maxChars), pages: doc.numPages, truncated: text.length > maxChars };
  } finally {
    await loadingTask.destroy();
  }
}

export async function readDocumentText(file: File, maxChars: number): Promise<DocumentText> {
  const ext = extensionOf(file.name);
  if (ext === '.pdf') return readPdf(file, maxChars);
  if (TEXT_EXTENSIONS.includes(ext)) {
    const text = await file.text();
    return { text: text.slice(0, maxChars), pages: 0, truncated: text.length > maxChars };
  }
  throw new UnsupportedDocumentError(`${file.name}: only PDF, TXT and MD files are supported`);
}
