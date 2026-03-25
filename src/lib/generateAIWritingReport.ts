import jsPDF from "jspdf";
import { TURNITIN_HEADER_LOGO_BASE64, FAQ_DIAGRAM_BASE64, ICON_DOC_BASE64, ICON_SUBMIT_BASE64, ICON_UNIVERSITY_BASE64, AI_ROBOT_ICON_BASE64 } from "./pdfAssets";

interface PlagiarismReport {
  similarity_score: number;
  paraphrase_score: number;
  ai_probability: number;
  flagged_sections: { text: string; reason: string; risk: string }[];
  summary: string;
  recommendations: string[];
}

export function generateAIWritingReport(report: PlagiarismReport, text: string, title?: string) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 20;
  const maxW = pw - m * 2;
  let y = 0;

  const headerHeight = 22;
  const footerHeight = 20;
  const contentTop = headerHeight + 4;
  const contentBottom = ph - footerHeight;

  const addPageIfNeeded = (needed: number) => {
    if (y + needed > contentBottom) {
      doc.addPage();
      y = contentTop;
    }
  };

  const fileName = title || "Document";
  const submissionId = `trn:oid:::1:${Math.floor(Math.random() * 9000000000) + 1000000000}`;
  const now = new Date();
  const dateStr = now.toLocaleString("en-US", {
    month: "short", day: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
  const wordCount = text.trim().split(/\s+/).length;
  const charCount = text.length;
  const pageCount = Math.ceil(wordCount / 350);
  const fileSize = `${(new Blob([text]).size / 1024).toFixed(1)} KB`;

  // ─── HEADER/FOOTER HELPER (exact Turnitin style) ───
  const drawHeader = (pageNum: number, totalPages: number, sectionName: string) => {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pw, headerHeight, "F");
    // turnitin logo on the left - adjusted size for new logo
    try {
      doc.addImage(TURNITIN_HEADER_LOGO_BASE64, "PNG", m, 5, 22, 6);
    } catch {}
    // Page info after logo - reduced size
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`Page ${pageNum} of ${totalPages} - ${sectionName}`, m + 25, 9);
    // Submission ID on far right
    doc.text(`Submission ID   ${submissionId}`, pw - m, 9, { align: "right" });
  };

  const drawFooter = (pageNum: number, totalPages: number, sectionName: string) => {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, ph - footerHeight, pw, footerHeight, "F");
    // turnitin logo bottom left - adjusted size
    try {
      doc.addImage(TURNITIN_HEADER_LOGO_BASE64, "PNG", m, ph - 13, 18, 5);
    } catch {}
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`Page ${pageNum} of ${totalPages} - ${sectionName}`, m + 22, ph - 9);
    doc.text(`Submission ID   ${submissionId}`, pw - m, ph - 9, { align: "right" });
  };

  // ═══════════════════════════════════════════════════════════════
  // PAGE 1: COVER PAGE
  // ═══════════════════════════════════════════════════════════════

  // Large number + filename (like reference: "1 2" then "1.docx")
  y = ph * 0.32;
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("2 1", m, y);
  y += 14;

  // File name as subtitle
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  const titleLines = doc.splitTextToSize(fileName, maxW);
  titleLines.forEach((line: string) => {
    doc.text(line, m, y);
    y += 9;
  });
  y += 4;

  // Quick Submit lines with icons
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  try { doc.addImage(ICON_DOC_BASE64, "PNG", m, y - 4, 5, 5); } catch {}
  doc.text("Quick Submit", m + 8, y);
  y += 8;
  try { doc.addImage(ICON_SUBMIT_BASE64, "PNG", m, y - 4, 5, 5); } catch {}
  doc.text("Quick Submit", m + 8, y);
  y += 8;
  try { doc.addImage(ICON_UNIVERSITY_BASE64, "PNG", m, y - 4, 5, 5); } catch {}
  doc.text("Punjab University", m + 8, y);
  y += 16;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(m, y, pw - m, y);
  y += 10;

  // Document Details heading
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Document Details", m, y);
  y += 14;

  // Details left column
  const detailsStartY = y;
  const detailPairs = [
    ["Submission ID", submissionId],
    ["Submission Date", dateStr],
    ["Download Date", dateStr],
    ["File Name", fileName],
    ["File Size", fileSize],
  ];

  doc.setFontSize(8);
  detailPairs.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(label, m, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    const truncVal = value.length > 40 ? value.slice(0, 37) + "..." : value;
    doc.text(truncVal, m, y);
    y += 10;
  });

  // Stats box on right (sharp square edges, ultra light pink)
  const boxX = pw - m - 50;
  const boxY = detailsStartY - 2;
  doc.setFillColor(255, 250, 251);
  doc.rect(boxX, boxY, 50, 36, "F");
  doc.setDrawColor(248, 238, 240);
  doc.rect(boxX, boxY, 50, 36, "S");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text(`${pageCount} Pages`, boxX + 8, boxY + 12);
  doc.text(`${wordCount.toLocaleString()} Words`, boxX + 8, boxY + 22);
  doc.text(`${charCount.toLocaleString()} Characters`, boxX + 8, boxY + 32);

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2: AI WRITING OVERVIEW
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  y = contentTop;

  // Divider line under header
  doc.setDrawColor(200, 200, 200);
  doc.line(m, headerHeight, pw - m, headerHeight);

  // AI % detected section (left) + Caution box (right)
  doc.setFontSize(9);
  const aiDesc = "The percentage indicates the combined amount of likely AI-generated text as well as likely AI-generated text that was also likely AI-paraphrased.";
  const leftTextW = maxW * 0.48;
  const aiLines = doc.splitTextToSize(aiDesc, leftTextW);
  const descHeight = aiLines.length * 5;

  const cautionX = m + leftTextW + 6;
  const cautionBoxW = pw - m - cautionX;
  const cautionText = "It is essential to understand the limitations of AI detection before making decisions about a student's work. We encourage you to learn more about Turnitin's AI detection capabilities before using the tool.";
  doc.setFontSize(6.5);
  const cautionLines = doc.splitTextToSize(cautionText, cautionBoxW - 12);
  const cautionBoxH = 12 + cautionLines.length * 3.8;

  const boxHeight = Math.max(cautionBoxH + 8, 30 + descHeight);

  // Light blue caution box
  doc.setFillColor(235, 245, 252);
  doc.roundedRect(cautionX, y + 4, cautionBoxW, cautionBoxH, 3, 3, "F");

  // Left: AI percentage
  const aiPercentDisplay = report.ai_probability < 20 ? `*%` : `${report.ai_probability}%`;
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text(`${aiPercentDisplay} detected as AI`, m, y + 16);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  aiLines.forEach((line: string, i: number) => {
    doc.text(line, m, y + 24 + i * 4.5);
  });

  // Right: Caution text inside box
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(7);
  doc.text("Caution: Review required.", cautionX + 6, y + 11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(6.5);
  cautionLines.forEach((line: string, i: number) => {
    doc.text(line, cautionX + 6, y + 16 + i * 3.8);
  });

  y += boxHeight + 10;

  // ─── DETECTION GROUPS ───
  doc.setDrawColor(200, 200, 200);
  doc.line(m, y, pw - m, y);
  y += 8;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Detection Groups", m, y);
  y += 10;

  // Group 1: AI-generated only
  const aiGenPct = report.ai_probability;
  const aiGenSentences = Math.max(1, Math.round(aiGenPct / 5));
  // Cyan bubble with robot icon
  doc.setFillColor(0, 188, 212);
  doc.circle(m + 4, y + 1, 5, "F");
  try { doc.addImage(AI_ROBOT_ICON_BASE64, "PNG", m + 1, y - 2, 6, 6); } catch {}
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text(`${aiGenSentences}   AI-generated only   ${aiGenPct}%`, m + 12, y + 2);
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Likely AI-generated text from a large-language model.", m + 12, y + 2);
  y += 12;

  // Group 2: AI-generated text that was AI-paraphrased
  const paraphrasePct = report.paraphrase_score || 0;
  // Purple bubble with robot icon
  doc.setFillColor(156, 39, 176);
  doc.circle(m + 4, y + 1, 5, "F");
  try { doc.addImage(AI_ROBOT_ICON_BASE64, "PNG", m + 1, y - 2, 6, 6); } catch {}
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text(`0   AI-generated text that was AI-paraphrased   ${paraphrasePct}%`, m + 12, y + 2);
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Likely AI-generated text that was likely revised using an AI-paraphrase tool", m + 12, y + 2);
  y += 4;
  doc.text("or word spinner.", m + 12, y + 2);
  y += 12;

  // Disclaimer section
  doc.setDrawColor(200, 200, 200);
  doc.line(m, y, pw - m, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Disclaimer", m, y);
  y += 6;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const disclaimer = "Our AI writing assessment is designed to help educators identify text that might be prepared by a generative AI tool. Our AI writing assessment may not always be accurate (i.e., our AI models may produce either false positive results or false negative results), so it should not be used as the sole basis for adverse actions against a student. It takes further scrutiny and human judgment in conjunction with an organization's application of its specific academic policies to determine whether any academic misconduct has occurred.";
  const disclaimerLines = doc.splitTextToSize(disclaimer, maxW);
  disclaimerLines.forEach((line: string) => {
    addPageIfNeeded(5);
    doc.text(line, m, y);
    y += 4;
  });

  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(m, y, pw - m, y);
  y += 10;

  // Frequently Asked Questions section
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Frequently Asked Questions", m, y);

  // FAQ diagram on right side
  const faqDiagramX = pw - m - 50;
  const faqDiagramY = y + 2;
  try {
    doc.addImage(FAQ_DIAGRAM_BASE64, "PNG", faqDiagramX, faqDiagramY, 48, 48);
  } catch {}

  y += 12;
  const faqTextWidth = maxW - 55;

  const faqs = [
    {
      q: "How should I interpret Turnitin's AI writing percentage and false positives?",
      a: "The percentage shown in the AI writing report is the amount of qualifying text within the submission that Turnitin's AI writing detection model determines was either likely AI-generated text from a large-language model or likely AI-generated text that was likely revised using an AI paraphrase tool or word spinner.\n\nFalse positives (incorrectly flagging human-written text as AI-generated) are a possibility in AI models.\n\nAI detection scores under 20%, which we do not surface in new reports, have a higher likelihood of false positives. To reduce the likelihood of misinterpretation, no score or highlights are attributed and are indicated with an asterisk in the report (*%).\n\nThe AI writing percentage should not be the sole basis to determine whether misconduct has occurred. The reviewer/instructor should use the percentage as a means to start a formative conversation with their student and/or use it to examine the submitted assignment in accordance with their school's policies."
    },
    {
      q: "What does 'qualifying text' mean?",
      a: "Our model only processes qualifying text in the form of long-form writing. Long-form writing means individual sentences contained in paragraphs that make up a longer piece of written work, such as an essay, a dissertation, or an article, etc. Qualifying text that has been determined to be likely AI-generated will be highlighted in cyan in the submission, and likely AI-generated and then likely AI-paraphrased will be highlighted purple.\n\nNon-qualifying text, such as bullet points, annotated bibliographies, etc., will not be processed and can create disparity between the submission highlights and the percentage shown."
    }
  ];

  faqs.forEach((faq) => {
    addPageIfNeeded(25);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    const qLines = doc.splitTextToSize(faq.q, faqTextWidth);
    qLines.forEach((line: string) => {
      addPageIfNeeded(6);
      doc.text(line, m, y);
      y += 5;
    });
    y += 2;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const aLines = doc.splitTextToSize(faq.a, faqTextWidth);
    aLines.forEach((line: string) => {
      addPageIfNeeded(5);
      doc.text(line, m, y);
      y += 4.5;
    });
    y += 8;
  });

  // ═══════════════════════════════════════════════════════════════
  // PAGES 3+: AI WRITING SUBMISSION (full document text)
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  y = contentTop;

  // Build highlight ranges based on AI probability percentage
  const textToRender = text.slice(0, 50000);
  const lowerText = textToRender.toLowerCase();
  const aiHighlights: { start: number; end: number }[] = [];

  // First, add flagged sections
  report.flagged_sections.forEach((section) => {
    const needle = section.text.toLowerCase().slice(0, 200);
    if (!needle) return;
    const idx = lowerText.indexOf(needle, 0);
    if (idx >= 0) {
      aiHighlights.push({ start: idx, end: idx + section.text.length });
    }
  });

  // Calculate how much text should be highlighted based on ai_probability
  const totalLen = textToRender.length;
  const targetHighlightLen = Math.floor(totalLen * (report.ai_probability / 100));

  // Calculate currently highlighted length
  let currentHighlightLen = 0;
  aiHighlights.forEach(h => { currentHighlightLen += (h.end - h.start); });

  // If we need more highlighting, add continuous blocks from the beginning
  if (currentHighlightLen < targetHighlightLen) {
    const remaining = targetHighlightLen - currentHighlightLen;
    // Find sentences/paragraphs to highlight to fill the gap
    const sentences = textToRender.split(/(?<=[.!?])\s+/);
    let pos = 0;
    let added = 0;

    for (const sentence of sentences) {
      if (added >= remaining) break;
      const sentStart = textToRender.indexOf(sentence, Math.max(0, pos - 2));
      if (sentStart < 0) { pos += sentence.length + 1; continue; }
      const sentEnd = sentStart + sentence.length;

      // Check if already highlighted
      const alreadyHighlighted = aiHighlights.some(h =>
        sentStart >= h.start && sentEnd <= h.end
      );

      if (!alreadyHighlighted) {
        aiHighlights.push({ start: sentStart, end: sentEnd });
        added += sentence.length;
      }
      pos = sentEnd + 1;
    }
  }

  // Sort and merge overlapping highlights
  aiHighlights.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  aiHighlights.forEach(h => {
    if (merged.length > 0 && h.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, h.end);
    } else {
      merged.push({ ...h });
    }
  });
  aiHighlights.length = 0;
  aiHighlights.push(...merged);

  // Render document text with AI highlighting
  const textFontSize = 10;
  const lineHeight = 5.5;
  doc.setFontSize(textFontSize);
  doc.setFont("helvetica", "normal");

  // Split into paragraphs
  const paragraphs = textToRender.split(/\n+/);
  let globalCharPos = 0;
  const spaceW = doc.getTextWidth(" ");

  paragraphs.forEach((para) => {
    const trimmed = para.trim();
    if (!trimmed) { globalCharPos += para.length + 1; return; }

    const paraStart = textToRender.indexOf(trimmed, Math.max(0, globalCharPos - 5));
    let charPos = paraStart >= 0 ? paraStart : globalCharPos;

    const words = trimmed.split(/(\s+)/);
    // Build lines with word positions
    const lines: { text: string; start: number; end: number }[][] = [];
    let currentLine: { text: string; start: number; end: number }[] = [];
    let lineW = 0;

    words.forEach((word) => {
      const wStart = charPos;
      const wEnd = charPos + word.length;
      charPos = wEnd;
      if (word.match(/^\s+$/)) return;

      const ww = doc.getTextWidth(word);
      if (currentLine.length > 0 && lineW + spaceW + ww > maxW) {
        lines.push([...currentLine]);
        currentLine = [{ text: word, start: wStart, end: wEnd }];
        lineW = ww;
      } else {
        if (currentLine.length > 0) lineW += spaceW;
        currentLine.push({ text: word, start: wStart, end: wEnd });
        lineW += ww;
      }
    });
    if (currentLine.length > 0) lines.push([...currentLine]);

    lines.forEach((lineWords) => {
      addPageIfNeeded(lineHeight + 2);
      let x = m;

      lineWords.forEach((w) => {
        const ww = doc.getTextWidth(w.text);
        const isAI = aiHighlights.some((h) => w.start < h.end && w.end > h.start);

        if (isAI) {
          // Cyan highlight background (Turnitin AI style)
          doc.setFillColor(0, 188, 212);
          doc.setGState(new (doc as any).GState({ opacity: 0.18 }));
          doc.rect(x - 0.5, y - 3.5, ww + 1, 5, "F");
          doc.setGState(new (doc as any).GState({ opacity: 1 }));
          doc.setTextColor(0, 131, 148);
        } else {
          doc.setTextColor(50, 50, 50);
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(textFontSize);
        doc.text(w.text, x, y);
        x += ww + spaceW;
      });

      y += lineHeight;
    });

    globalCharPos = charPos + 1;
  });

  // ═══════════════════════════════════════════════════════════════
  // APPLY HEADERS & FOOTERS TO ALL PAGES
  // ═══════════════════════════════════════════════════════════════
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    let section: string;
    if (p === 1) {
      section = "Cover Page";
    } else if (p === 2) {
      section = "AI Writing Overview";
    } else {
      section = "AI Writing Submission";
    }
    drawHeader(p, totalPages, section);
    drawFooter(p, totalPages, section);
  }

  doc.save("Turnitin_AI_Writing_Report.pdf");
}
