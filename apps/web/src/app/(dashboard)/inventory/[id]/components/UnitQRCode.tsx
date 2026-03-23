'use client';

import { useRef, useCallback } from 'react';
import { QrCode, Download, Printer } from 'lucide-react';

interface UnitQRCodeProps {
  unitId: string;
  stockNumber: string;
  year: number;
  make: string;
  model: string;
}

/**
 * Generates a QR code as an SVG using a simple QR encoding.
 * In production, this would use a library like `qrcode` — here we generate
 * a URL-based QR via a public API for simplicity and zero-dependency.
 */
export function UnitQRCode({ unitId, stockNumber, year, make, model }: UnitQRCodeProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const qrData = `${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/inventory/${unitId}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}&margin=10`;

  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(qrImageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-${stockNumber}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(qrImageUrl, '_blank');
    }
  }, [qrImageUrl, stockNumber]);

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head><title>QR Code - ${stockNumber}</title></head>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui,-apple-system,sans-serif;">
          <img src="${qrImageUrl}" alt="QR Code" style="width:300px;height:300px;" />
          <div style="margin-top:16px;text-align:center;">
            <div style="font-size:24px;font-weight:bold;">${stockNumber}</div>
            <div style="font-size:16px;color:#666;margin-top:4px;">${year} ${make} ${model}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }, [qrImageUrl, stockNumber, year, make, model]);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
        <QrCode className="h-4 w-4 text-[var(--color-brand-600)]" />
        QR Code
      </h4>

      <div ref={printRef} className="flex flex-col items-center">
        <img
          src={qrImageUrl}
          alt={`QR code for unit ${stockNumber}`}
          className="h-40 w-40 rounded-lg border border-[var(--color-border)]"
          loading="lazy"
        />
        <div className="mt-2 text-center">
          <div className="text-sm font-bold text-[var(--color-text-primary)]">{stockNumber}</div>
          <div className="text-xs text-[var(--color-text-tertiary)]">
            {year} {make} {model}
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleDownload}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </button>
        <button
          onClick={handlePrint}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </button>
      </div>
    </div>
  );
}
