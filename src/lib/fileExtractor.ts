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

  // DOC (old format)
  if (ext === "doc" || type === "application/msword") {
    throw new Error("Old .doc format is not supported. Please save as .docx and try again.");
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
