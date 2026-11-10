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

/** The language switch: two options side by side, the current one highlighted; a busy state while the page reloads. */
export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang();
  const [busy, setBusy] = useState<Lang | null>(null);
  const pick = (l: Lang) => { if (l === lang || busy) return; setBusy(l); setLang(l); };
  return (
    <div className={`lang-switch ${busy ? 'is-busy' : ''} ${className}`} role="group" aria-label="Language / اللغة" dir="ltr">
      <button type="button" lang="ar" className={`ls-opt ls-ar ${lang === 'ar' ? 'on' : ''}`} aria-pressed={lang === 'ar'} onClick={() => pick('ar')}>
        {busy === 'ar' ? <span className="ls-spin" aria-hidden="true" /> : null}العربية
      </button>
      <button type="button" lang="en" className={`ls-opt ls-en ${lang === 'en' ? 'on' : ''}`} aria-pressed={lang === 'en'} onClick={() => pick('en')}>
        {busy === 'en' ? <span className="ls-spin" aria-hidden="true" /> : null}English
      </button>
    </div>
  );
}
