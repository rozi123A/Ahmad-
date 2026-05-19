import React, { createContext, useContext, useState, useEffect } from 'react';
import translations from './i18n';

const LanguageContext = createContext();

export const LANGUAGES = [
  { code: 'ar', label: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  { code: 'en', label: 'English', flag: '🇬🇧', dir: 'ltr' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺', dir: 'ltr' },
];

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'ar');

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    localStorage.setItem('lang', lang);
  }, [lang]);

  const t = (key) => translations[lang]?.[key] || translations['ar']?.[key] || key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLang = () => useContext(LanguageContext);
