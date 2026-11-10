// src/lib/i18n/server.ts
// The language of the current request, from the det_lang cookie (English by default).

import { cookies } from 'next/headers';
import { LANG_COOKIE, isLang, makeT, type Lang } from './core';

export function getLang(): Lang {
  try {
    const v = cookies().get(LANG_COOKIE)?.value;
    return isLang(v) ? v : 'en';
  } catch { return 'en'; }
}
export const getT = () => makeT(getLang());
