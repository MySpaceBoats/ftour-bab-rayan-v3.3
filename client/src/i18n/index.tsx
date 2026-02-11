import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { fr, Translations } from './fr';
import { ar } from './ar';
import { en } from './en';

export type Language = 'fr' | 'ar' | 'en';
export type Locale = Language;
export const SUPPORTED_LOCALES: Locale[] = ['fr', 'ar', 'en'];

interface I18nContextType {
  lang: Language;
  t: Translations;
  setLang: (lang: Language) => void;
  dir: 'ltr' | 'rtl';
  languages: { code: Language; name: string; nativeName: string }[];
}

const translations: Record<Language, Translations> = {
  fr,
  ar,
  en,
};

// Langues affichées avec leurs noms natifs uniquement (sans drapeaux)
const languages = [
  { code: 'fr' as Language, name: 'Français', nativeName: 'Français' },
  { code: 'ar' as Language, name: 'العربية', nativeName: 'العربية' },
  { code: 'en' as Language, name: 'English', nativeName: 'English' },
];

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = 'ftour-lang';

function getInitialLanguage(): Language {
  // Check localStorage first
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && translations[stored as Language]) {
    return stored as Language;
  }
  
  // Check URL path
  const path = window.location.pathname;
  const langFromPath = path.split('/')[1];
  if (langFromPath && translations[langFromPath as Language]) {
    return langFromPath as Language;
  }
  
  // Default to French
  return 'fr';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(getInitialLanguage);
  const t = translations[lang];
  const dir = t.dir as 'ltr' | 'rtl';

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
    
    // Update document direction and lang
    document.documentElement.dir = translations[newLang].dir;
    document.documentElement.lang = newLang;
    
    // Navigate to the same page with the new language prefix
    const currentPath = window.location.pathname;
    const pathParts = currentPath.split('/').filter(Boolean);
    
    // Check if first part is a language code
    if (pathParts.length > 0 && SUPPORTED_LOCALES.includes(pathParts[0] as Language)) {
      // Replace the language prefix
      pathParts[0] = newLang;
    } else {
      // Add language prefix
      pathParts.unshift(newLang);
    }
    
    const newPath = '/' + pathParts.join('/');
    if (newPath !== currentPath) {
      window.location.href = newPath;
    }
  }, []);

  useEffect(() => {
    // Set initial direction and lang
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);

  return (
    <I18nContext.Provider value={{ lang, t, setLang, dir, languages }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

export { translations, languages };
export type { Translations };
