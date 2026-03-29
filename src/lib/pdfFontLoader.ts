import jsPDF from "jspdf";

// Cache the font data so we only load it once
let cachedFontBase64: string | null = null;
let fontLoadPromise: Promise<string | null> | null = null;

/**
 * Check if text contains non-Latin characters that need a special font
 */
export function hasNonLatinChars(text: string): boolean {
  // Match CJK, Arabic, Hebrew, Thai, Korean, Japanese, Devanagari, and other non-Latin scripts
  return /[^\u0000-\u024F\u1E00-\u1EFF]/.test(text);
}

/**
 * Load Noto Sans SC font for CJK/Unicode support
 * Returns base64 font data or null if loading fails
 */
async function loadUnicodeFont(): Promise<string | null> {
  if (cachedFontBase64) return cachedFontBase64;

  try {
    // Use Noto Sans SC Regular - supports CJK characters
    // Using a subset URL from Google Fonts for smaller size
    const response = await fetch(
      "https://fonts.gstatic.com/s/notosanssc/v37/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYxNbPzS5HE.0.woff2"
    );
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    // Convert to base64
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    cachedFontBase64 = btoa(binary);
    return cachedFontBase64;
  } catch {
    return null;
  }
}

/**
 * Register Unicode font with jsPDF document if needed
 * Call this before rendering non-Latin text
 */
export async function registerUnicodeFontIfNeeded(doc: jsPDF, text: string): Promise<boolean> {
  if (!hasNonLatinChars(text)) return false;

  if (!fontLoadPromise) {
    fontLoadPromise = loadUnicodeFont();
  }

  const fontData = await fontLoadPromise;
  if (!fontData) return false;

  try {
    doc.addFileToVFS("NotoSansSC-Regular.woff2", fontData);
    doc.addFont("NotoSansSC-Regular.woff2", "NotoSansSC", "normal");
    return true;
  } catch {
    return false;
  }
}

/**
 * Set font for text rendering - uses Unicode font if available and needed,
 * otherwise falls back to standard font
 */
export function setFontForText(
  doc: jsPDF,
  text: string,
  unicodeFontAvailable: boolean,
  fallbackFont: string = "helvetica",
  fallbackStyle: string = "normal"
) {
  if (unicodeFontAvailable && hasNonLatinChars(text)) {
    doc.setFont("NotoSansSC", "normal");
  } else {
    doc.setFont(fallbackFont, fallbackStyle);
  }
}
