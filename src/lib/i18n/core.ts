// src/lib/i18n/core.ts
// DET is bilingual (English / Arabic). Every interface text is written in English in the code and
// passed through t(); the Arabic comes from the AR dictionary (src/lib/i18n/ar.ts). A text missing
// from the dictionary simply shows in English, so nothing ever breaks.

import { AR } from './ar';

export type Lang = 'en' | 'ar';
export const LANG_COOKIE = 'det_lang';
export const isLang = (x: unknown): x is Lang => x === 'en' || x === 'ar';

export type Vars = Record<string, string | number>;
export type T = (text: string, vars?: Vars) => string;

/** Translate an English interface text. {name} placeholders are filled from vars. */
export function translate(lang: Lang, text: string, vars?: Vars): string {
  const base = lang === 'ar' ? (AR[text] ?? text) : text;
  return vars ? base.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : base;
}
export const makeT = (lang: Lang): T => (text, vars) => translate(lang, text, vars);

/** Numbers and dates in the reader's language (Arabic keeps Western digits, as used at PNU). */
export const locale = (lang: Lang) => (lang === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB');
