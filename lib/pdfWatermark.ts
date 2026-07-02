// lib/pdfWatermark.ts
// Shared utility: Stamps the company watermark centered on every PDF page at 30% opacity.

import jsPDF from 'jspdf';

/**
 * Loads /watermark.png as a Base64 data URL.
 * Returns null if the image cannot be loaded (graceful degradation).
 */
export const loadWatermarkBase64 = async (): Promise<string | null> => {
    try {
        const res = await fetch('/watermark.png');
        if (!res.ok) return null;
        const blob = await res.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () =>
                typeof reader.result === 'string' ? resolve(reader.result) : resolve(null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
};

/**
 * Draws a centered, semi-transparent watermark on a single page.
 * Call this inside a page loop after setting doc.setPage(i).
 *
 * @param doc          - The jsPDF instance
 * @param watermarkB64 - Base64 PNG string from loadWatermarkBase64()
 * @param opacity      - Opacity between 0 and 1 (default 0.30 = 30%)
 */
export const drawWatermark = (
    doc: jsPDF,
    watermarkB64: string,
    opacity: number = 1.0
): void => {
    try {
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;

        // Watermark dimensions: fit 130mm wide, maintain aspect ratio ~1:1 (square logo)
        const wmW = 150;
        const wmH = 150;
        const wmX = (pageWidth - wmW) / 2;
        const wmY = (pageHeight - wmH) / 2;

        // Save current graphics state, apply opacity, draw image, then restore
        doc.saveGraphicsState();
        (doc as any).setGState(new (doc as any).GState({ opacity }));
        doc.addImage(watermarkB64, 'PNG', wmX, wmY, wmW, wmH);
        doc.restoreGraphicsState();
    } catch (err) {
        // Silently skip — watermark failure should never break the PDF
        console.warn('Watermark draw skipped:', err);
    }
};

/**
 * Convenience: stamps watermark on ALL pages of the document.
 * Call this after all content has been written and pages are finalised.
 *
 * @param doc          - The jsPDF instance
 * @param watermarkB64 - Base64 PNG string (null means skip silently)
 * @param opacity      - Opacity between 0 and 1 (default 0.30)
 */
export const stampWatermarkAllPages = (
    doc: jsPDF,
    watermarkB64: string | null,
    opacity: number = 0.30
): void => {
    if (!watermarkB64) return;
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        drawWatermark(doc, watermarkB64, opacity);
    }
};
