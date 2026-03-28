import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const type = file.type;

  // Plain text
  if (ext === "txt" || type === "text/plain") {
    return file.text();
  }

  // PDF
  if (ext === "pdf" || type === "application/pdf") {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: any) => item.str).join(" "));
    }
    return pages.join("\n\n");
  }

  // DOCX
  if (
    ext === "docx" ||
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  // DOC (old format) - text extraction supporting all languages
  if (ext === "doc" || type === "application/msword") {
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Try UTF-16LE first (Word .doc stores text internally as UTF-16LE)
    const tryUtf16 = (): string => {
      const uint16 = new Uint16Array(arrayBuffer.byteLength % 2 === 0 ? arrayBuffer : arrayBuffer.slice(0, arrayBuffer.byteLength - 1));
      const chunks: string[] = [];
      let chunk = "";
      for (let i = 0; i < uint16.length; i++) {
        const code = uint16[i];
        // Accept printable characters across all Unicode planes, newlines, tabs
        if ((code >= 32 && code !== 0xFFFE && code !== 0xFFFF) || code === 10 || code === 13 || code === 9) {
          chunk += String.fromCharCode(code);
        } else {
          if (chunk.trim().length > 3) chunks.push(chunk.trim());
          chunk = "";
        }
      }
      if (chunk.trim().length > 3) chunks.push(chunk.trim());
      return chunks.join(" ").replace(/\s{3,}/g, " ").trim();
    };

    // Also try reading as UTF-8 for modern .doc variants
    const tryUtf8 = (): string => {
      const decoder = new TextDecoder("utf-8", { fatal: false });
      const decoded = decoder.decode(uint8);
      // Filter out control chars but keep all Unicode printable chars
      const cleaned = decoded.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");
      const chunks: string[] = [];
      let chunk = "";
      for (const char of cleaned) {
        const code = char.codePointAt(0)!;
        if (code >= 32 || code === 10 || code === 13 || code === 9) {
          chunk += char;
        } else {
          if (chunk.trim().length > 3) chunks.push(chunk.trim());
          chunk = "";
        }
      }
      if (chunk.trim().length > 3) chunks.push(chunk.trim());
      return chunks.join(" ").replace(/\s{3,}/g, " ").trim();
    };

    const utf16Result = tryUtf16();
    const utf8Result = tryUtf8();

    // Pick the result with more meaningful content (longer usually = better extraction)
    const extracted = utf16Result.length > utf8Result.length ? utf16Result : utf8Result;

    if (!extracted || extracted.length < 10) {
      throw new Error("Could not extract text from .doc file. Please save as .docx and try again.");
    }
    return extracted;
  }

  // RTF - read as text and strip RTF tags
  if (ext === "rtf" || type === "application/rtf") {
    const raw = await file.text();
    return raw.replace(/\{\\[^{}]*\}/g, "").replace(/\\[a-z]+\d?\s?/gi, "").replace(/[{}]/g, "").trim();
  }

  // CSV / other text-based
  if (ext === "csv" || ext === "md" || ext === "html" || ext === "htm" || ext === "xml" || ext === "json") {
    return file.text();
  }

  throw new Error(`Unsupported file type: .${ext}. Supported formats: TXT, PDF, DOCX, RTF, CSV, MD, HTML, JSON`);
}
