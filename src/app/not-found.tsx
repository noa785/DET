// src/app/not-found.tsx
import { getT } from '@/lib/i18n/server';

export default function NotFound() {
  const t = getT();
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="text-center">
        <div className="text-6xl font-display font-black text-[#1f2d45] mb-4">404</div>
        <div className="text-xl font-bold text-[var(--text)] mb-2">{t('Page not found')}</div>
        <p className="text-[var(--text-3)] mb-6">{t("The page you're looking for doesn't exist.")}</p>
        <a href="/dashboard" className="pes-btn-primary inline-block">{t('← Back to Dashboard')}</a>
      </div>
    </div>
  );
}
