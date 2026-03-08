import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations } from '../translations';

export type Language = 'en' | 'si' | 'ta';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  translate: (text: string, isNameOrNumber?: boolean) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('app_language') as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  const translate = (text: string, isNameOrNumber: boolean = false): string => {
    if (language === 'en' || !text || isNameOrNumber) return text;
    
    // Check dictionary
    if (translations[text] && translations[text][language]) {
      return translations[text][language];
    }
    
    return text; // Fallback to English
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, translate }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const T: React.FC<{ children: string; isNameOrNumber?: boolean }> = ({ children, isNameOrNumber }) => {
  const { translate } = useLanguage();
  return <>{translate(children, isNameOrNumber)}</>;
};
