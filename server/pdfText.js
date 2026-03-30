import { PDFParse } from 'pdf-parse';

export async function extractTextFromPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result?.text ?? '';
  } finally {
    await parser.destroy();
  }
}

export function extractHeaderText(fullText) {
  const lines = fullText.split('\n');
  const headerLines = [];
  const pageBreakRe = /^--\s*\d+\s+of\s+\d+\s*--$/;
  const fkkoLineRe = /\d\s+\d{2}\s+\d{3}\s+\d{2}\s+\d{2}\s+\d|\d{11}/;
  const tableHeaderRe = /Наименование вида|Код отхода/i;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || pageBreakRe.test(trimmed)) continue;
    headerLines.push(trimmed);
    if (/^(9|10)\.\s/.test(trimmed) || /лицензируемый вид деятельности/i.test(trimmed)) {
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const next = lines[j].trim();
        if (!next || pageBreakRe.test(next)) continue;
        if (fkkoLineRe.test(next) || tableHeaderRe.test(next)) break;
        headerLines.push(next);
      }
      break;
    }
  }
  return headerLines.join('\n').slice(0, 4000);
}

/** Фрагмент текста для модерации ИИ: шапка + хвост документа (лимит символов). */
export function buildModerationPdfSnippet(fullText, maxTotal = 7000) {
  const t = String(fullText || '').trim();
  if (!t) return '';
  const header = extractHeaderText(t);
  const restBudget = Math.max(500, maxTotal - header.length);
  const tailStart = Math.max(0, t.length - restBudget);
  const tail = tailStart > 0 ? `\n...\n${t.slice(tailStart)}` : '';
  const combined = `${header}${tail}`;
  return combined.slice(0, maxTotal);
}
