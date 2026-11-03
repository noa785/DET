// src/lib/det/gsheets.ts
// A small Google Sheets client for the DET sync, signed in as a Google service account.
// The service account is a separate identity, so it works with accounts under Advanced Protection:
// each Google Sheet is simply shared with the service account's email as an editor.
// Env: GOOGLE_SERVICE_ACCOUNT_JSON = the whole JSON key file of the service account.

import { createSign } from 'crypto';

type Key = { client_email: string; private_key: string };
let cached: { token: string; exp: number } | null = null;

function key(): Key {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');
  const j = JSON.parse(raw) as Key;
  if (!j.client_email || !j.private_key) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not a service account key');
  return { client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, '\n') };
}
export function serviceAccountEmail(): string | null {
  try { return key().client_email; } catch { return null; }
}

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const k = key();
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: k.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(k.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const j = await res.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !j.access_token) throw new Error(`Google sign-in failed: ${j.error_description ?? res.status}`);
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

export type Cell = string | number | boolean | null;
type Tab = { sheetId: number; title: string; rows: number; cols: number; hidden: boolean };

/** The column letter of a 1-based column number (1 = A, 27 = AA). */
export function colLetter(n: number): string {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
const q = (tab: string) => `'${tab.replace(/'/g, "''")}'`;
export const a1 = (tab: string, row: number, col: number, rows = 1, cols = 1) =>
  `${q(tab)}!${colLetter(col)}${row}:${colLetter(col + cols - 1)}${row + rows - 1}`;

/** Google Sheets date serial number to "yyyy-mm-dd". */
export function serialToIso(n: number): string {
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86_400_000).toISOString().slice(0, 10);
}
/** A value as it should be typed into a cell: text that starts like a formula stays text. */
export function typed(x: Cell | undefined): Cell {
  if (x === null || x === undefined) return '';
  if (typeof x === 'string' && /^[=+]/.test(x)) return `'${x}`;
  return x;
}

export class Book {
  private tabs: Map<string, Tab> | null = null;
  constructor(public readonly id: string) {}

  private async call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.id}${path}`, {
      method: init?.method ?? 'GET',
      headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    });
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 403 || res.status === 404) throw new Error(`No access to the file (${res.status}). Share it with ${serviceAccountEmail()} as Editor.`);
      throw new Error(`Google Sheets ${res.status}: ${t.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  }

  async tab(title: string): Promise<Tab | undefined> {
    if (!this.tabs) {
      const m = await this.call<{ sheets: { properties: { sheetId: number; title: string; hidden?: boolean; gridProperties: { rowCount: number; columnCount: number } } }[] }>(
        '?fields=sheets.properties(sheetId,title,hidden,gridProperties(rowCount,columnCount))');
      this.tabs = new Map(m.sheets.map(s => [s.properties.title, {
        sheetId: s.properties.sheetId, title: s.properties.title, hidden: !!s.properties.hidden,
        rows: s.properties.gridProperties.rowCount, cols: s.properties.gridProperties.columnCount,
      }]));
    }
    return this.tabs.get(title);
  }
  async addTab(title: string, opts: { hidden?: boolean; index?: number } = {}): Promise<Tab> {
    await this.batch([{ addSheet: { properties: { title, hidden: !!opts.hidden, ...(opts.index !== undefined ? { index: opts.index } : {}) } } }]);
    this.tabs = null;
    return (await this.tab(title))!;
  }

  /** Every value of a tab (rows as Google stores them; dates as serial numbers). */
  async read(title: string): Promise<Cell[][]> {
    const r = await this.call<{ values?: Cell[][] }>(
      `/values/${encodeURIComponent(q(title))}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER&majorDimension=ROWS`);
    return r.values ?? [];
  }
  /** Writes several ranges in one call (typed as a person would, so dates become dates). */
  async write(data: { range: string; values: Cell[][] }[]): Promise<void> {
    if (!data.length) return;
    await this.call('/values:batchUpdate', { method: 'POST', body: { valueInputOption: 'USER_ENTERED', data: data.map(d => ({ ...d, values: d.values.map(r => r.map(typed)) })) } });
  }
  async append(title: string, values: Cell[][]): Promise<void> {
    if (!values.length) return;
    await this.call(`/values/${encodeURIComponent(q(title) + '!A1')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: { values: values.map(r => r.map(typed)) } });
  }
  async clear(ranges: string[]): Promise<void> {
    if (ranges.length) await this.call('/values:batchClear', { method: 'POST', body: { ranges } });
  }
  async batch(requests: object[]): Promise<void> {
    if (requests.length) await this.call(':batchUpdate', { method: 'POST', body: { requests } });
  }
}

/** Grid range of a tab (0-based, end exclusive) for batchUpdate requests. */
export const grid = (sheetId: number, row: number, col: number, rows: number, cols: number) =>
  ({ sheetId, startRowIndex: row - 1, endRowIndex: row - 1 + rows, startColumnIndex: col - 1, endColumnIndex: col - 1 + cols });
