// ---------------------------------------------------------------------------
// RV Trax API — DMS integration framework (adapter pattern)
// ---------------------------------------------------------------------------

// ── Shared types ------------------------------------------------------------

/**
 * Normalized unit representation from a DMS system.
 */
export interface DMSUnit {
  vin: string;
  stock_number: string;
  year: number;
  make: string;
  model: string;
  msrp: number | null;
  status: string;
}

/**
 * DMS Adapter interface — all DMS integrations implement this.
 */
export interface DMSAdapter {
  readonly provider: string;

  /** Test connection to the DMS system */
  testConnection(config: Record<string, unknown>): Promise<boolean>;

  /** Pull new/updated units from DMS */
  pullUnits(config: Record<string, unknown>): Promise<DMSUnit[]>;

  /** Push a status change to the DMS */
  pushStatusChange(
    config: Record<string, unknown>,
    unitVin: string,
    newStatus: string,
  ): Promise<boolean>;
}

// ── CSV Helpers --------------------------------------------------------------

/**
 * Parse a CSV string into an array of rows (arrays of cell values).
 * Handles double-quoted fields that may contain commas and newlines.
 */
function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  const len = raw.length;

  while (i < len) {
    const row: string[] = [];
    while (i < len) {
      let cell = '';

      if (raw[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        while (i < len) {
          if (raw[i] === '"') {
            if (i + 1 < len && raw[i + 1] === '"') {
              cell += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            cell += raw[i];
            i++;
          }
        }
        // Skip to delimiter or newline
        if (i < len && raw[i] === ',') i++;
        else if (i < len && (raw[i] === '\r' || raw[i] === '\n')) {
          if (raw[i] === '\r' && i + 1 < len && raw[i + 1] === '\n') i += 2;
          else i++;
          row.push(cell);
          break;
        }
      } else {
        // Unquoted field
        while (i < len && raw[i] !== ',' && raw[i] !== '\r' && raw[i] !== '\n') {
          cell += raw[i];
          i++;
        }
        if (i < len && raw[i] === ',') {
          i++;
        } else {
          // End of line
          if (i < len && raw[i] === '\r' && i + 1 < len && raw[i + 1] === '\n') i += 2;
          else if (i < len) i++;
          row.push(cell.trim());
          break;
        }
      }
      row.push(cell.trim());
    }

    // At end of input the last cell may not have been pushed
    if (i >= len && row.length === 0) break;
    if (row.length > 0) rows.push(row);
  }

  return rows;
}

/**
 * Default column mapping: CSV header name → DMSUnit field.
 * Case-insensitive matching. Supports common DMS export headers.
 */
const DEFAULT_COLUMN_MAP: Record<string, keyof DMSUnit> = {
  vin: 'vin',
  'vin number': 'vin',
  'stock': 'stock_number',
  'stock number': 'stock_number',
  'stock_number': 'stock_number',
  'stock #': 'stock_number',
  'stocknumber': 'stock_number',
  'stk': 'stock_number',
  'stk#': 'stock_number',
  year: 'year',
  'model year': 'year',
  make: 'make',
  'manufacturer': 'make',
  model: 'model',
  'model name': 'model',
  msrp: 'msrp',
  price: 'msrp',
  'list price': 'msrp',
  status: 'status',
  'unit status': 'status',
  'inventory status': 'status',
};

// ── CSV Import Adapter -------------------------------------------------------

class CsvImportAdapter implements DMSAdapter {
  readonly provider = 'csv_import';

  async testConnection(_config: Record<string, unknown>): Promise<boolean> {
    // CSV import is always "connected" since it reads uploaded data
    return true;
  }

  async pullUnits(config: Record<string, unknown>): Promise<DMSUnit[]> {
    const csvData = config['csv_data'];
    if (typeof csvData !== 'string' || !csvData.trim()) {
      throw new Error('No CSV data found. Upload a CSV file first.');
    }

    const hasHeader = config['has_header'] !== false; // default true
    const userMapping = config['column_mapping'] as Record<string, string> | undefined;

    const rows = parseCsv(csvData);
    if (rows.length === 0) {
      throw new Error('CSV file is empty.');
    }

    // Build column index mapping
    let headerRow: string[] | undefined;
    let dataStartIdx = 0;

    if (hasHeader && rows[0]) {
      headerRow = rows[0].map((h) => h.toLowerCase().trim());
      dataStartIdx = 1;
    }

    // Resolve column positions
    const fieldPositions: Partial<Record<keyof DMSUnit, number>> = {};

    if (headerRow) {
      // Try user-provided mapping first, then defaults
      for (let col = 0; col < headerRow.length; col++) {
        const header = headerRow[col]!;

        // Check user mapping
        if (userMapping) {
          for (const [csvCol, unitField] of Object.entries(userMapping)) {
            if (header === csvCol.toLowerCase().trim()) {
              fieldPositions[unitField as keyof DMSUnit] = col;
            }
          }
        }

        // Fall back to default mapping
        if (!Object.values(fieldPositions).includes(col)) {
          const mappedField = DEFAULT_COLUMN_MAP[header];
          if (mappedField && fieldPositions[mappedField] === undefined) {
            fieldPositions[mappedField] = col;
          }
        }
      }
    } else {
      // No header — expect columns in order: vin, stock_number, year, make, model, msrp, status
      const fields: (keyof DMSUnit)[] = ['vin', 'stock_number', 'year', 'make', 'model', 'msrp', 'status'];
      for (let i = 0; i < fields.length && i < (rows[0]?.length ?? 0); i++) {
        fieldPositions[fields[i]!] = i;
      }
    }

    // Validate required columns
    if (fieldPositions.vin === undefined) {
      throw new Error('CSV is missing a VIN column. Please check column headers.');
    }
    if (fieldPositions.stock_number === undefined) {
      throw new Error('CSV is missing a Stock Number column. Please check column headers.');
    }

    // Parse data rows
    const units: DMSUnit[] = [];

    for (let r = dataStartIdx; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((c) => !c)) continue; // skip blank rows

      const get = (field: keyof DMSUnit): string =>
        (fieldPositions[field] !== undefined ? row[fieldPositions[field]!] : '') ?? '';

      const vin = get('vin').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const stockNumber = get('stock_number');

      // Skip rows without VIN or stock number
      if (!vin || !stockNumber) continue;

      const yearStr = get('year');
      const year = parseInt(yearStr, 10);
      if (isNaN(year) || year < 1900 || year > 2100) continue; // skip invalid years

      const msrpStr = get('msrp').replace(/[$,\s]/g, '');
      const msrp = msrpStr ? parseFloat(msrpStr) : null;

      units.push({
        vin,
        stock_number: stockNumber,
        year,
        make: get('make') || 'Unknown',
        model: get('model') || 'Unknown',
        msrp: msrp !== null && !isNaN(msrp) ? msrp : null,
        status: get('status') || 'new_arrival',
      });
    }

    if (units.length === 0) {
      throw new Error('No valid units found in CSV. Check that VIN, Stock Number, and Year are present.');
    }

    return units;
  }

  async pushStatusChange(
    _config: Record<string, unknown>,
    _unitVin: string,
    _newStatus: string,
  ): Promise<boolean> {
    // CSV import is one-way (pull only)
    return false;
  }
}

// ── IDS Astra Adapter --------------------------------------------------------

class IdsAstraAdapter implements DMSAdapter {
  readonly provider = 'ids_astra';

  async testConnection(config: Record<string, unknown>): Promise<boolean> {
    const apiUrl = config['api_url'];
    const apiKey = config['api_key'];

    if (typeof apiUrl !== 'string' || typeof apiKey !== 'string') {
      return false;
    }

    try {
      const resp = await fetch(`${apiUrl}/api/v1/ping`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      });

      return resp.ok;
    } catch {
      return false;
    }
  }

  async pullUnits(config: Record<string, unknown>): Promise<DMSUnit[]> {
    const apiUrl = config['api_url'];
    const apiKey = config['api_key'];
    const dealerCode = config['dealer_code'];

    if (typeof apiUrl !== 'string' || typeof apiKey !== 'string') {
      throw new Error('IDS Astra requires api_url and api_key in config.');
    }

    // Fetch inventory from IDS Astra API
    const url = new URL(`${apiUrl}/api/v1/inventory`);
    if (typeof dealerCode === 'string') {
      url.searchParams.set('dealer_code', dealerCode);
    }
    url.searchParams.set('page_size', '1000');

    const resp = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) {
      throw new Error(`IDS Astra API returned ${resp.status}: ${resp.statusText}`);
    }

    const body = (await resp.json()) as {
      data?: Array<{
        vin?: string;
        stock_number?: string;
        year?: number;
        make?: string;
        model?: string;
        msrp?: number;
        status?: string;
        [key: string]: unknown;
      }>;
    };

    if (!body.data || !Array.isArray(body.data)) {
      return [];
    }

    return body.data
      .filter((item) => item.vin && item.stock_number)
      .map((item) => ({
        vin: String(item.vin).toUpperCase(),
        stock_number: String(item.stock_number),
        year: typeof item.year === 'number' ? item.year : parseInt(String(item.year), 10) || 0,
        make: String(item.make ?? 'Unknown'),
        model: String(item.model ?? 'Unknown'),
        msrp: typeof item.msrp === 'number' ? item.msrp : null,
        status: String(item.status ?? 'in_stock'),
      }));
  }

  async pushStatusChange(
    config: Record<string, unknown>,
    unitVin: string,
    newStatus: string,
  ): Promise<boolean> {
    const apiUrl = config['api_url'];
    const apiKey = config['api_key'];

    if (typeof apiUrl !== 'string' || typeof apiKey !== 'string') {
      return false;
    }

    try {
      const resp = await fetch(`${apiUrl}/api/v1/inventory/${unitVin}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
        signal: AbortSignal.timeout(10_000),
      });

      return resp.ok;
    } catch {
      return false;
    }
  }
}

// ── Lightspeed Adapter (placeholder) -----------------------------------------

class LightspeedAdapter implements DMSAdapter {
  readonly provider = 'lightspeed';

  async testConnection(config: Record<string, unknown>): Promise<boolean> {
    const baseUrl = config['base_url'];
    const clientId = config['client_id'];
    const clientSecret = config['client_secret'];
    if (
      typeof baseUrl === 'string' &&
      typeof clientId === 'string' &&
      typeof clientSecret === 'string'
    ) {
      // Lightspeed uses OAuth2 — would exchange credentials for token
      return true;
    }
    return false;
  }

  async pullUnits(_config: Record<string, unknown>): Promise<DMSUnit[]> {
    // Lightspeed integration requires OAuth2 token exchange + GraphQL queries.
    // Implementation deferred until Lightspeed API access is obtained.
    return [];
  }

  async pushStatusChange(
    _config: Record<string, unknown>,
    _unitVin: string,
    _newStatus: string,
  ): Promise<boolean> {
    return false;
  }
}

// ── Adapter registry ---------------------------------------------------------

const adapters: Record<string, DMSAdapter> = {
  ids_astra: new IdsAstraAdapter(),
  lightspeed: new LightspeedAdapter(),
  csv_import: new CsvImportAdapter(),
};

/**
 * Get adapter instance for a provider.
 * Throws if the provider is not supported.
 */
export function getAdapter(provider: string): DMSAdapter {
  const adapter = adapters[provider];
  if (!adapter) {
    throw new Error(`Unsupported DMS provider: ${provider}`);
  }
  return adapter;
}
