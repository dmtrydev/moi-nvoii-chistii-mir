import { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

try {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

const PAGE_WIDTH = 380;

type TextItem = { str: string; transform: number[] };

function getTextContentFromPdf(
  pdf: { getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }> },
  pageNumber: number
) {
  return pdf.getPage(pageNumber).then((page) => page.getTextContent());
}

/** Вычисляет прямоугольники подсветки для текста в PDF (координаты в px относительно страницы) */
function getHighlightRects(
  items: TextItem[],
  highlightText: string,
  pageWidth: number,
  pageHeight: number,
  viewWidth: number
): { left: number; top: number; width: number; height: number }[] {
  if (!highlightText || !items?.length) return [];
  const normalized = highlightText.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const fullText = items.map((i) => i.str).join('');
  const normalizedFull = fullText.replace(/\s+/g, ' ');
  let startIdx = normalizedFull.toLowerCase().indexOf(normalized.toLowerCase());
  if (startIdx === -1) startIdx = fullText.indexOf(highlightText.trim());
  if (startIdx === -1) return [];

  let charCount = 0;
  const itemRanges: { start: number; end: number; item: TextItem }[] = [];
  for (const item of items) {
    const end = charCount + item.str.length;
    if (end > startIdx && charCount < startIdx + normalized.length) {
      itemRanges.push({ start: charCount, end, item });
    }
    charCount = end;
  }
  if (!itemRanges.length) return [];

  const scale = viewWidth / pageWidth;
  const rects: { left: number; top: number; width: number; height: number }[] = [];

  for (const { item } of itemRanges) {
    const [a, , , d, e, f] = item.transform;
    const w = Math.abs(a);
    const h = Math.abs(d);
    const left = e * scale;
    const top = (pageHeight - f - h) * scale;
    rects.push({ left, top, width: w * scale, height: h * scale });
  }

  return rects;
}

interface PdfPreviewWithHighlightProps {
  fileUrl: string;
  highlightText: string;
  onPdfLoad?: (numPages: number) => void;
}

export function PdfPreviewWithHighlight({
  fileUrl,
  highlightText,
  onPdfLoad,
}: PdfPreviewWithHighlightProps): JSX.Element {
  const [numPages, setNumPages] = useState<number>(1);
  const [pdf, setPdf] = useState<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }>; view: number[] }> } | null>(null);
  const [pageHeight, setPageHeight] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [highlightRects, setHighlightRects] = useState<{ left: number; top: number; width: number; height: number }[]>([]);

  const onDocumentLoadSuccess = useCallback(
    async (pdfDoc: unknown) => {
      const doc = pdfDoc as { numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }>; view: number[] }> };
      setNumPages(doc.numPages);
      onPdfLoad?.(doc.numPages);
      setPdf(doc);
      try {
        const page = await doc.getPage(1);
        const v = page?.view;
        if (v?.[2] && v?.[3]) {
          setPageWidth(v[2]);
          setPageHeight(v[3]);
        }
      } catch {
        // ignore
      }
    },
    [onPdfLoad]
  );

  useEffect(() => {
    if (!pdf || !pageWidth || !pageHeight || !highlightText.trim()) {
      setHighlightRects([]);
      return;
    }
    let cancelled = false;
    getTextContentFromPdf(pdf, 1).then((content) => {
      if (cancelled || !content?.items) return;
      const items = content.items.filter((i: unknown): i is TextItem => typeof i === 'object' && i !== null && 'str' in i && 'transform' in i && Array.isArray((i as TextItem).transform));
      const rects = getHighlightRects(
        items,
        highlightText,
        pageWidth,
        pageHeight,
        PAGE_WIDTH
      );
      setHighlightRects(rects);
    });
    return () => {
      cancelled = true;
    };
  }, [pdf, pageWidth, pageHeight, highlightText]);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-white/5 border border-white/10 backdrop-blur-sm shadow-xl">
      <Document
        file={fileUrl}
        onLoadSuccess={(doc: unknown) => void onDocumentLoadSuccess(doc)}
        loading={
          <div className="flex items-center justify-center min-h-[400px] text-white/60">
            Загрузка PDF…
          </div>
        }
        error={
          <div className="flex items-center justify-center min-h-[400px] text-red-400 text-sm">
            Не удалось загрузить PDF
          </div>
        }
      >
        {Array.from({ length: numPages }, (_, i) => (
          <div key={i} className="relative">
            <Page
              pageNumber={i + 1}
              width={PAGE_WIDTH}
              renderTextLayer
              renderAnnotationLayer
            />
            {i === 0 && highlightRects.length > 0 && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ width: PAGE_WIDTH }}
              >
                {highlightRects.map((r, idx) => (
                  <div
                    key={idx}
                    className="absolute bg-amber-400/50 border border-amber-400 rounded transition-all duration-300"
                    style={{
                      left: r.left,
                      top: r.top,
                      width: Math.max(r.width, 4),
                      height: r.height,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </Document>
    </div>
  );
}
