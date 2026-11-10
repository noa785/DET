// src/lib/i18n/ar.ts
// The Arabic dictionary: English text -> Arabic. Missing entries fall back to English.
import { AR_SHELL } from './ar/shell';
import { AR_ORDERS } from './ar/orders';
import { AR_PAGES } from './ar/pages';
import { AR_EXPORTS } from './ar/exports';
import { AR_SYNC } from './ar/sync';
import { AR_DATA } from './ar/data';

export const AR: Record<string, string> = { ...AR_EXPORTS, ...AR_PAGES, ...AR_ORDERS, ...AR_SHELL, ...AR_DATA, ...AR_SYNC };
