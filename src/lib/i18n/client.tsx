'use client';
// src/lib/i18n/client.tsx
// Language for client components: useLang() gives { lang, t, setLang }.
// setLang saves the choice in a cookie for a year and reloads the page data in the new language.

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { LANG_COOKIE, makeT, type Lang, type T } from './core';

type Ctx = { lang: Lang; t: T; setLang: (l: Lang) => void };
const LangContext = createContext<Ctx>({ lang: 'en', t: makeT('en'), setLang: () => undefined });

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  // A full reload in the new language: the whole page (text and direction) changes at once.
  const setLang = useCallback((l: Lang) => {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }, []);
  const value = useMemo(() => ({ lang, t: makeT(lang), setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
export const useLang = () => useContext(LangContext);
export const useT = () => useContext(LangContext).t;

/** The العربية / English switch: a clear pill with a globe, and a busy state while the page reloads. */
export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang();
  const [busy, setBusy] = useState(false);
  const to: Lang = lang === 'ar' ? 'en' : 'ar';
  return (
    <button type="button" className={`lang-switch ${className}`} disabled={busy} aria-busy={busy}
      onClick={() => { setBusy(true); setLang(to); }}
      title={to === 'en' ? 'Switch to English' : 'التحويل إلى العربية'} lang={to}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      <span>{busy ? (to === 'en' ? 'Loading…' : 'جارٍ التحويل…') : to === 'en' ? 'English' : 'العربية'}</span>
    </button>
  );
}
