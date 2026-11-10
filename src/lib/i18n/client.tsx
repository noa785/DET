'use client';
// src/lib/i18n/client.tsx
// Language for client components: useLang() gives { lang, t, setLang }.
// setLang saves the choice in a cookie for a year and reloads the page data in the new language.

import { createContext, useCallback, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LANG_COOKIE, makeT, type Lang, type T } from './core';

type Ctx = { lang: Lang; t: T; setLang: (l: Lang) => void };
const LangContext = createContext<Ctx>({ lang: 'en', t: makeT('en'), setLang: () => undefined });

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const router = useRouter();
  const setLang = useCallback((l: Lang) => {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    router.refresh();
  }, [router]);
  const value = useMemo(() => ({ lang, t: makeT(lang), setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
export const useLang = () => useContext(LangContext);
export const useT = () => useContext(LangContext).t;

/** The عربي / English switch. */
export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <button type="button" className={`lang-switch ${className}`} onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      title={lang === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'} lang={lang === 'ar' ? 'en' : 'ar'}>
      {lang === 'ar' ? 'English' : 'عربي'}
    </button>
  );
}
