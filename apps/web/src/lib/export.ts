// ---------------------------------------------------------------------------
// RV Trax — Export / Print utilities
// ---------------------------------------------------------------------------

/**
 * Export data as CSV and trigger download.
 */
export function exportToCsv(filename: string, headers: string[], rows: string[][]): void {
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => {
          // Escape cells that contain commas, quotes, or newlines
          if (/[,"\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
          return cell;
        })
        .join(','),
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Trigger browser print dialog for the current page.
 * Optionally accepts a CSS selector to print only a specific element.
 */
export function printElement(selector?: string): void {
  if (!selector) {
    window.print();
    return;
  }
  // Create a print-only iframe with just the selected content
  const element = document.querySelector(selector);
  if (!element) return;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  // Copy stylesheets
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((s) => {
    doc.head.appendChild(s.cloneNode(true));
  });
  doc.body.innerHTML = element.outerHTML;

  iframe.contentWindow!.print();
  setTimeout(() => document.body.removeChild(iframe), 1000);
}

/**
 * Export data as JSON and trigger download.
 */
export function exportToJson(filename: string, data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
