import jsPDF from "jspdf";

interface PlagiarismReport {
  similarity_score: number;
  paraphrase_score: number;
  ai_probability: number;
  flagged_sections: { text: string; reason: string; risk: string; source_url?: string; source_type?: string }[];
  summary: string;
  recommendations: string[];
}

export function generateSimilarityReport(report: PlagiarismReport, text: string, title?: string) {
  const doc = new jsPDF({ format: [240, 297] });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 20;
  const maxW = pw - m * 2;
  let y = 0;

  const borderM = 12;
  const headerHeight = 22;
  const footerHeight = 16;
  const contentTop = headerHeight + 6;
  const contentBottom = ph - footerHeight - 4;

  // Track which pages are "text pages" (uploaded document text)
  const textPages: Set<number> = new Set();

  const addPageIfNeeded = (needed: number) => {
    if (y + needed > contentBottom) {
      doc.addPage();
      y = contentTop;
    }
  };

  const fileName = title || "Document";
  const submissionId = `${Math.floor(Math.random() * 9000000000) + 1000000000}`;
  const now = new Date();
  const dateStr = now.toLocaleString("en-US", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZoneName: "short",
  });
  const wordCount = text.trim().split(/\s+/).length;
  const charCount = text.length;

  const sourceColors: [number, number, number][] = [
    [220, 38, 38], [156, 39, 176], [33, 150, 243], [76, 175, 80],
    [255, 152, 0], [0, 150, 136], [121, 85, 72], [96, 125, 139],
    [103, 58, 183], [0, 188, 212], [255, 87, 34], [63, 81, 181],
    [139, 195, 74],
  ];

  // ─── HEADER / FOOTER / BORDER HELPERS ───
  // Box: wide, far-left positioned, thin border
  const boxX = 18;
  const boxY = 28;
  const boxW = 167;
  const boxH = 242;
  const boxPadLR = 22;
  const boxPadTB = 20;

  const drawTextPageBorder = () => {
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.3);
    doc.rect(boxX, boxY, boxW, boxH);
    doc.setLineWidth(0.2);
  };

  const drawHeader = (pageNum: number, totalPages: number, sectionName: string) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`Page ${pageNum} of ${totalPages}  |  ${sectionName}`, m, 14);
    doc.text(`ID: ${submissionId}`, pw - m - 40, 14);
    doc.setDrawColor(200, 200, 200);
    doc.line(m, headerHeight, pw - m, headerHeight);
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    const fy = ph - footerHeight;
    doc.setDrawColor(200, 200, 200);
    doc.line(m, fy, pw - m, fy);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    doc.text(`Page ${pageNum} of ${totalPages}`, pw - m - 25, fy + 8);
  };

  // ─── PAGE 1: COVER PAGE ───
  y = ph * 0.3;
  doc.setFontSize(36);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text(fileName, pw / 2, y, { align: "center" });
  y += 12;
  doc.setFontSize(12);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120, 120, 120);
  doc.text("by 21", pw / 2, y, { align: "center" });

  // Bottom details
  y = ph - 100;
  doc.setDrawColor(200, 200, 200);
  doc.line(m, y, pw - m, y);
  y += 10;

  const coverDetails = [
    ["Submission date:", dateStr],
    ["Submission ID:", submissionId],
    ["File name:", fileName],
    ["Word count:", wordCount.toLocaleString()],
    ["Character count:", charCount.toLocaleString()],
  ];

  doc.setFontSize(9);
  coverDetails.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text(label, m, y);
    doc.setFont("helvetica", "normal");
    doc.text(` ${value}`, m + doc.getTextWidth(label) + 2, y);
    y += 6;
  });

  // Text positioned inside the box with inner padding
  const textMarginLR = boxX + boxPadLR;       // left text edge inside box
  const textMarginTop = boxY + boxPadTB;       // top text edge inside box
  const textMarginBottom2 = boxY + boxH - boxPadTB; // bottom text edge
  const textMaxW = boxW - boxPadLR * 2;        // ~84mm text column width
  const textLineHeight = 6.5;                  // 1.5 line spacing at 12pt
  const textFontSize = 12;

  const addTextPageIfNeeded = (needed: number) => {
    if (y + needed > textMarginBottom2) {
      doc.addPage();
      drawTextPageBorder();
      y = textMarginTop;
    }
  };

  doc.addPage();
  const textStartPage = doc.getNumberOfPages();
  y = textMarginTop;

  const textToRender = text.slice(0, 50000);

  // Build highlight ranges from flagged sections
  // Instead of highlighting the entire flagged passage, extract key phrases/words
  // to create more realistic, scattered highlights like real Turnitin reports
  const highlights: { start: number; end: number; color: [number, number, number]; idx: number }[] = [];
  
  const extractKeyPhrases = (sectionText: string, fullText: string, startSearchFrom: number): { start: number; end: number }[] => {
    const ranges: { start: number; end: number }[] = [];
    const lowerFull = fullText.toLowerCase();
    const sectionStart = lowerFull.indexOf(sectionText.toLowerCase().slice(0, 60), startSearchFrom);
    if (sectionStart < 0) return ranges;

    const sectionEnd = sectionStart + Math.min(sectionText.length, fullText.length - sectionStart);

    // Highlight the entire matched range as one block
    ranges.push({ start: sectionStart, end: sectionEnd });
    return ranges;
  };

  report.flagged_sections.forEach((section, i) => {
    const color = sourceColors[i % sourceColors.length];
    const keyPhrases = extractKeyPhrases(section.text, textToRender, 0);
    keyPhrases.forEach((range, phraseIdx) => {
      highlights.push({
        start: range.start,
        end: range.end,
        color,
        idx: i,
      });
    });
  });
  highlights.sort((a, b) => a.start - b.start);

  // Split text into paragraphs
  const paragraphs = textToRender.split(/\n\s*\n|\n/);
  let globalCharPos = 0;
  let inReferenceSection = false;

  paragraphs.forEach((para, paraIdx) => {
    const trimmedPara = para.trim();
    if (!trimmedPara) {
      globalCharPos += para.length + 1;
      return;
    }

    const isHeading = trimmedPara.length < 80 && !trimmedPara.endsWith(".") && !trimmedPara.endsWith(",");
    const isReferenceHeading = /^(references|bibliography|works cited|citations|reference list)$/i.test(trimmedPara);
    if (isReferenceHeading) inReferenceSection = true;
    const isRefEntry = inReferenceSection && !isReferenceHeading;

    if (paraIdx > 0) {
      y += isHeading ? textLineHeight * 2.5 : textLineHeight * 1.5;
      addTextPageIfNeeded(textLineHeight + 4);
    }

    doc.setFontSize(textFontSize);
    doc.setFont("times", isHeading ? "bold" : "normal");

    // Left-aligned rendering with word-level highlighting
    const words = trimmedPara.split(/(\s+)/);
    const paraStartCharPos = textToRender.indexOf(trimmedPara, Math.max(0, globalCharPos - 5));
    let charPos = paraStartCharPos >= 0 ? paraStartCharPos : globalCharPos;

    // Build lines
    const lines: { words: { text: string; start: number; end: number }[] }[] = [];
    let currentLine: { text: string; start: number; end: number }[] = [];
    let currentLineWidth = 0;
    const spaceWidth = doc.getTextWidth(" ");

    words.forEach((word) => {
      const wordStart = charPos;
      const wordEnd = charPos + word.length;
      charPos = wordEnd;
      if (word.match(/^\s+$/)) return;

      const wordW = doc.getTextWidth(word);
      if (currentLine.length > 0 && currentLineWidth + spaceWidth + wordW > textMaxW) {
        lines.push({ words: [...currentLine] });
        currentLine = [{ text: word, start: wordStart, end: wordEnd }];
        currentLineWidth = wordW;
      } else {
        if (currentLine.length > 0) currentLineWidth += spaceWidth;
        currentLine.push({ text: word, start: wordStart, end: wordEnd });
        currentLineWidth += wordW;
      }
    });
    if (currentLine.length > 0) lines.push({ words: [...currentLine] });

    // Render each line LEFT-ALIGNED
    lines.forEach((line) => {
      addTextPageIfNeeded(textLineHeight);
      let lineX = textMarginLR;

      line.words.forEach((w) => {
        const wordW = doc.getTextWidth(w.text);
        const hl = highlights.find((h) => w.start < h.end && w.end > h.start);

        if (hl) {
          // Draw superscript index above the first word of this highlight
          const isFirstWordOfHighlight = w.start <= hl.start + 2;
          if (isFirstWordOfHighlight) {
            doc.setFontSize(6);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(hl.color[0], hl.color[1], hl.color[2]);
            doc.text(`${hl.idx + 1}`, lineX, y - 4);
            doc.setFontSize(textFontSize);
          }

          // Background highlight (no underline)
          doc.setFillColor(hl.color[0], hl.color[1], hl.color[2]);
          doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
          doc.rect(lineX - 0.5, y - 3.5, wordW + 1, 5, "F");
          doc.setGState(new (doc as any).GState({ opacity: 1 }));

          doc.setTextColor(hl.color[0], hl.color[1], hl.color[2]);
        } else {
          doc.setTextColor(30, 30, 30);
        }
        doc.setFont("times", isHeading ? "bold" : "normal");
        // Check if this word is a URL
        const isUrl = /^https?:\/\/\S+$/i.test(w.text);
        if (isRefEntry && isUrl) {
          doc.setTextColor(16, 70, 180);
          doc.text(w.text, lineX, y);
          doc.setDrawColor(16, 70, 180);
          doc.line(lineX, y + 1, lineX + wordW, y + 1);
        } else {
          doc.text(w.text, lineX, y);
        }
        lineX += wordW + spaceWidth;
      });
      y += textLineHeight;
    });

    globalCharPos += para.length + 1;
  });

  const textEndPage = doc.getNumberOfPages();
  // Record all text pages
  for (let p = textStartPage; p <= textEndPage; p++) {
    textPages.add(p);
  }

  // ─── ORIGINALITY REPORT PAGE ───
  doc.addPage();
  y = contentTop;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(fileName, m, y);
  y += 3;
  doc.setDrawColor(180, 180, 180);
  doc.line(m, y, pw - m, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(220, 60, 60);
  doc.text("ORIGINALITY REPORT", m, y);
  y += 3;
  doc.setDrawColor(180, 180, 180);
  doc.line(m, y, pw - m, y);
  y += 10;

  // Big scores row - only first (similarity index) is colored, rest are black
  const scores = [
    { val: `${report.similarity_score}`, label: "SIMILARITY INDEX", color: [220, 60, 60] as [number, number, number] },
    { val: `${Math.round(report.similarity_score * 0.7)}`, label: "INTERNET SOURCES", color: [30, 30, 30] as [number, number, number] },
    { val: `${Math.round(report.similarity_score * 0.8)}`, label: "PUBLICATIONS", color: [30, 30, 30] as [number, number, number] },
    { val: `${Math.round(report.similarity_score * 0.1)}`, label: "STUDENT PAPERS", color: [30, 30, 30] as [number, number, number] },
  ];

  let sx = m;
  scores.forEach((s, idx) => {
    const numSize = idx === 0 ? 48 : 36;
    const pctSize = idx === 0 ? 18 : 14;
    doc.setFontSize(numSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(s.color[0], s.color[1], s.color[2]);
    doc.text(`${s.val}`, sx, y + 10);
    const numW = doc.getTextWidth(`${s.val}`);
    doc.setFontSize(pctSize);
    doc.text("%", sx + numW, y + 10);
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 120, 120);
    doc.text(s.label, sx, y + 16);
    sx += 45;
  });

  y += 28;
  doc.setDrawColor(180, 180, 180);
  doc.line(m, y, pw - m, y);
  y += 8;

  // PRIMARY SOURCES header
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(220, 60, 60);
  doc.text("PRIMARY SOURCES", m, y);
  y += 3;
  doc.setDrawColor(180, 180, 180);
  doc.line(m, y, pw - m, y);
  y += 8;

  // List sources - matching the reference image style with URLs
  report.flagged_sections.forEach((section, i) => {
    const color = sourceColors[i % sourceColors.length];
    // Always use only these three source type labels
    const allowedTypes = ["Internet Source", "Publication", "Student Papers"];
    let sourceType = allowedTypes[i % allowedTypes.length];
    // If source_type is provided, map it to one of the allowed types
    if (section.source_type) {
      const st = section.source_type.toLowerCase();
      if (st.includes("internet") || st.includes("web") || st.includes("online") || st.includes("url") || st.includes("site")) {
        sourceType = "Internet Source";
      } else if (st.includes("student") || st.includes("submitted")) {
        sourceType = "Student Papers";
      } else {
        sourceType = "Publication";
      }
    }
    
    // Build display text based on source type
    let displayText = "";
    const isInternetSource = sourceType.toLowerCase().includes("internet");
    if (section.source_url) {
      displayText = section.source_url;
    } else if (isInternetSource) {
      // For internet sources, try to extract a domain-like string from reason
      const urlMatch = section.reason.match(/https?:\/\/[^\s,]+/);
      if (urlMatch) {
        try {
          displayText = new URL(urlMatch[0]).hostname.replace(/^www\./, '');
        } catch {
          displayText = urlMatch[0];
        }
      } else {
        displayText = section.reason;
      }
    } else {
      // For publications, show the full reason as citation text
      displayText = section.reason;
    }
    
    // Wrap source text to multiple lines
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const sourceLines = doc.splitTextToSize(displayText, maxW - 55);
    const blockHeight = sourceLines.length * 5.5 + 16;
    
    addPageIfNeeded(blockHeight + 5);

    // Colored number badge (square)
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(m, y - 4, 9, 9, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    const numStr = `${i + 1}`;
    doc.text(numStr, m + 4.5 - doc.getTextWidth(numStr) / 2, y + 1.5);

    // Source text in source color (multi-line)
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(color[0], color[1], color[2]);
    let textY = y;
    sourceLines.forEach((line: string) => {
      doc.text(line, m + 14, textY);
      textY += 5.5;
    });

    // Source type label below (e.g. "Internet Source", "Publication")
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(sourceType, m + 14, textY + 1);

    // Percentage on the right side - vertically centered
    const blockMidY = y + (textY - y) / 2;
    doc.setFontSize(18);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text("<1", pw - m - 18, blockMidY + 2);
    doc.setFontSize(9);
    doc.text("%", pw - m - 6, blockMidY + 2);

    y = textY + 8;
    doc.setDrawColor(220, 220, 220);
    doc.line(m, y, pw - m, y);
    y += 8;
  });

  // Exclude settings - matching Turnitin default style
  y += 4;
  addPageIfNeeded(30);
  doc.setDrawColor(200, 200, 200);
  doc.line(m, y, pw - m, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Exclude quotes", m, y);
  doc.text("Off", m + 50, y);
  doc.text("Exclude matches", pw / 2, y);
  doc.text("Off", pw / 2 + 50, y);
  y += 7;
  doc.text("Exclude bibliography", m, y);
  doc.text("On", m + 50, y);

  // (Source Details page removed)

  // ─── GRADEMARK REPORT PAGE ───
  doc.addPage();
  y = contentTop;

  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(fileName, m, y);
  y += 3;
  doc.setDrawColor(180, 180, 180);
  doc.line(m, y, pw - m, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 160, 200);
  doc.text("GRADEMARK REPORT", m, y);
  y += 3;
  doc.setDrawColor(180, 180, 180);
  doc.line(m, y, pw - m, y);
  y += 10;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("FINAL GRADE", m, y);
  doc.text("GENERAL COMMENTS", pw / 2, y);
  y += 8;
  doc.setFontSize(28);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("/0", m, y);
  y += 5;
  doc.setDrawColor(200, 40, 40);
  doc.setLineWidth(0.8);
  doc.line(m, y, pw - m, y);
  doc.setLineWidth(0.2);
  y += 8;

  const pageCount = Math.ceil(wordCount / 350);
  for (let p = 1; p <= Math.min(pageCount, 10); p++) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`PAGE ${p}`, m + 10, y);
    y += 3;
    doc.setDrawColor(220, 220, 220);
    doc.line(m, y, pw - m, y);
    y += 8;
  }

  // ─── APPLY HEADERS, FOOTERS & BORDERS (only text pages get border) ───
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Only draw border on uploaded text pages
    if (textPages.has(p)) {
      drawTextPageBorder();
    }

    // Determine section name
    let section = "Similarity Report";
    if (p === 1) section = "Cover Page";
    else if (textPages.has(p)) section = "Document Text";
    else if (p === totalPages) section = "GradeMark Report";
    else section = "Originality Report";

    // Headers removed for similarity report
    // Footers removed for similarity report
  }

  doc.save("Turnitin_Similarity_Report.pdf");
}
