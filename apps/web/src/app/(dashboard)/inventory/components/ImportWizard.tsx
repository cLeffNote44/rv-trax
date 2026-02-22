'use client';

import { useState, useRef, useCallback, type DragEvent } from 'react';
import { Upload, FileText, Check, AlertCircle, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportWizardProps {
  open: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type WizardStep = 'upload' | 'mapping' | 'preview' | 'import';

interface ColumnMapping {
  csvColumn: string;
  field: string;
}

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  imported: number;
  errors: ImportError[];
}

const REQUIRED_FIELDS = [
  { key: 'stock_number', label: 'Stock #' },
  { key: 'year', label: 'Year' },
  { key: 'make', label: 'Make' },
  { key: 'model', label: 'Model' },
  { key: 'unit_type', label: 'Type' },
] as const;

const OPTIONAL_FIELDS = [
  { key: 'vin', label: 'VIN' },
  { key: 'floorplan', label: 'Floorplan' },
  { key: 'length_ft', label: 'Length (ft)' },
  { key: 'msrp', label: 'MSRP' },
  { key: 'status', label: 'Status' },
  { key: 'current_zone', label: 'Zone' },
  { key: 'current_row', label: 'Row' },
  { key: 'current_spot', label: 'Spot' },
] as const;

const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

// Auto-detect column mapping from header names
function autoDetectMapping(headers: string[]): ColumnMapping[] {
  const aliases: Record<string, string[]> = {
    stock_number: ['stock', 'stock_number', 'stock#', 'stock no', 'stockno', 'stock_no'],
    year: ['year', 'yr'],
    make: ['make', 'manufacturer', 'brand'],
    model: ['model', 'model_name'],
    unit_type: ['type', 'unit_type', 'unit type', 'category'],
    vin: ['vin', 'vin_number', 'vin#', 'vehicle_id'],
    floorplan: ['floorplan', 'floor_plan', 'floor plan', 'layout'],
    length_ft: ['length', 'length_ft', 'length ft', 'size'],
    msrp: ['msrp', 'price', 'retail_price', 'retail price', 'sticker'],
    status: ['status', 'unit_status', 'availability'],
    current_zone: ['zone', 'current_zone', 'lot_zone'],
    current_row: ['row', 'current_row', 'lot_row'],
    current_spot: ['spot', 'current_spot', 'lot_spot', 'position'],
  };

  return headers.map((header) => {
    const normalized = header.toLowerCase().trim();
    let matchedField = '';
    for (const [field, fieldAliases] of Object.entries(aliases)) {
      if (fieldAliases.includes(normalized)) {
        matchedField = field;
        break;
      }
    }
    return { csvColumn: header, field: matchedField };
  });
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0]!.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) =>
    line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')),
  );
  return { headers, rows };
}

export default function ImportWizard({
  open,
  onClose,
  onImportComplete,
}: ImportWizardProps) {
  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetWizard = useCallback(() => {
    setStep('upload');
    setFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setMappings([]);
    setImporting(false);
    setResult(null);
  }, []);

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      return;
    }
    setFile(selectedFile);
    const text = await selectedFile.text();
    const { headers, rows } = parseCSV(text);
    setCsvHeaders(headers);
    setCsvRows(rows);
    setMappings(autoDetectMapping(headers));
    setStep('mapping');
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleMappingChange = (csvColumn: string, field: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.csvColumn === csvColumn ? { ...m, field } : m)),
    );
  };

  const isMappingValid = () => {
    const mappedFields = new Set(mappings.map((m) => m.field).filter(Boolean));
    return REQUIRED_FIELDS.every((f) => mappedFields.has(f.key));
  };

  const getPreviewData = () => {
    return csvRows.slice(0, 5).map((row) => {
      const mapped: Record<string, string> = {};
      mappings.forEach((m, idx) => {
        if (m.field && row[idx] !== undefined) {
          mapped[m.field] = row[idx]!;
        }
      });
      return mapped;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    setStep('import');

    try {
      // Simulate import process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // In production, this would call the API
      const errors: ImportError[] = [];
      let imported = 0;

      for (let i = 0; i < csvRows.length; i++) {
        const row = csvRows[i]!;
        const mappedRow: Record<string, string> = {};
        mappings.forEach((m, idx) => {
          if (m.field && row[idx]) {
            mappedRow[m.field] = row[idx]!;
          }
        });

        // Basic validation
        if (!mappedRow['stock_number']) {
          errors.push({ row: i + 2, field: 'stock_number', message: 'Missing stock number' });
          continue;
        }
        if (!mappedRow['year'] || isNaN(Number(mappedRow['year']))) {
          errors.push({ row: i + 2, field: 'year', message: 'Invalid year' });
          continue;
        }
        imported++;
      }

      setResult({ imported, errors });
    } catch {
      setResult({ imported: 0, errors: [{ row: 0, field: '', message: 'Import failed' }] });
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative z-10 mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Import Units from CSV
            </h2>
            <p className="text-sm text-slate-500">
              {step === 'upload' && 'Upload your CSV file'}
              {step === 'mapping' && 'Map columns to fields'}
              {step === 'preview' && 'Preview mapped data'}
              {step === 'import' && 'Importing units...'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex border-b border-slate-100 px-6 py-3">
          {(['upload', 'mapping', 'preview', 'import'] as WizardStep[]).map(
            (s, idx) => (
              <div key={s} className="flex flex-1 items-center">
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium',
                    step === s
                      ? 'bg-blue-600 text-white'
                      : idx <
                          ['upload', 'mapping', 'preview', 'import'].indexOf(step)
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-slate-100 text-slate-400',
                  )}
                >
                  {idx <
                  ['upload', 'mapping', 'preview', 'import'].indexOf(step) ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span className="ml-2 text-xs font-medium capitalize text-slate-600">
                  {s}
                </span>
                {idx < 3 && (
                  <div className="mx-3 h-px flex-1 bg-slate-200" />
                )}
              </div>
            ),
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors',
                dragOver
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-slate-300 hover:border-slate-400',
              )}
            >
              <Upload className="h-12 w-12 text-slate-300" />
              <p className="mt-4 text-sm font-medium text-slate-700">
                Drag & drop your CSV file here
              </p>
              <p className="mt-1 text-xs text-slate-400">or</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Browse Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />
              <p className="mt-4 text-xs text-slate-400">
                CSV files only. Max 10,000 rows.
              </p>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 'mapping' && (
            <div>
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-700">
                  {file?.name} - {csvRows.length} rows detected
                </span>
              </div>
              <div className="space-y-2">
                {mappings.map((mapping) => (
                  <div
                    key={mapping.csvColumn}
                    className="flex items-center gap-3"
                  >
                    <span className="w-40 truncate text-sm font-medium text-slate-700">
                      {mapping.csvColumn}
                    </span>
                    <span className="text-slate-400">-&gt;</span>
                    <select
                      value={mapping.field}
                      onChange={(e) =>
                        handleMappingChange(mapping.csvColumn, e.target.value)
                      }
                      className={cn(
                        'flex-1 rounded-lg border px-3 py-1.5 text-sm',
                        mapping.field
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-slate-300 text-slate-500',
                      )}
                    >
                      <option value="">-- Skip --</option>
                      {ALL_FIELDS.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                          {REQUIRED_FIELDS.some((r) => r.key === f.key)
                            ? ' *'
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {!isMappingValid() && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                  Required fields: Stock #, Year, Make, Model, Type
                </div>
              )}
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div>
              <p className="mb-3 text-sm text-slate-500">
                Preview of first 5 rows with mapped fields:
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {ALL_FIELDS.filter((f) =>
                        mappings.some((m) => m.field === f.key),
                      ).map((f) => (
                        <th
                          key={f.key}
                          className="px-3 py-2 text-left text-xs font-semibold text-slate-600"
                        >
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {getPreviewData().map((row, idx) => (
                      <tr key={idx}>
                        {ALL_FIELDS.filter((f) =>
                          mappings.some((m) => m.field === f.key),
                        ).map((f) => {
                          const val = row[f.key];
                          const isEmpty = !val || val.trim() === '';
                          const isRequired = REQUIRED_FIELDS.some(
                            (r) => r.key === f.key,
                          );
                          return (
                            <td
                              key={f.key}
                              className={cn(
                                'px-3 py-2',
                                isEmpty && isRequired
                                  ? 'bg-red-50 text-red-600'
                                  : 'text-slate-700',
                              )}
                            >
                              {val || '--'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                {csvRows.length} total rows will be imported
              </p>
            </div>
          )}

          {/* Step 4: Import */}
          {step === 'import' && (
            <div className="py-8 text-center">
              {importing ? (
                <>
                  <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
                  <p className="mt-4 text-sm font-medium text-slate-700">
                    Importing units...
                  </p>
                  <div className="mx-auto mt-4 h-2 w-64 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-600" />
                  </div>
                </>
              ) : result ? (
                <>
                  <div
                    className={cn(
                      'mx-auto flex h-16 w-16 items-center justify-center rounded-full',
                      result.errors.length === 0
                        ? 'bg-emerald-100'
                        : 'bg-amber-100',
                    )}
                  >
                    {result.errors.length === 0 ? (
                      <Check className="h-8 w-8 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-8 w-8 text-amber-600" />
                    )}
                  </div>
                  <p className="mt-4 text-lg font-semibold text-slate-900">
                    {result.imported} units imported
                  </p>
                  {result.errors.length > 0 && (
                    <div className="mx-auto mt-4 max-w-md text-left">
                      <p className="text-sm font-medium text-red-600">
                        {result.errors.length} errors:
                      </p>
                      <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-red-50 p-3">
                        {result.errors.map((err, idx) => (
                          <p key={idx} className="text-xs text-red-700">
                            Row {err.row}: {err.message}
                            {err.field ? ` (${err.field})` : ''}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          <div className="flex gap-2">
            {step === 'mapping' && (
              <>
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep('preview')}
                  disabled={!isMappingValid()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next: Preview
                </button>
              </>
            )}
            {step === 'preview' && (
              <>
                <button
                  type="button"
                  onClick={() => setStep('mapping')}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  Import {csvRows.length} Units
                </button>
              </>
            )}
            {step === 'import' && result && (
              <button
                type="button"
                onClick={() => {
                  onImportComplete?.();
                  handleClose();
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
