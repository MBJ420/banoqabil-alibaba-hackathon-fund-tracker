import React, { createContext, useContext, useState } from 'react';

export type Language = 'en' | 'ur';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  isUrdu: boolean;
  t: (key: string, fallback?: string) => string;
}

const DICTIONARY: Record<string, { en: string; ur: string }> = {
  // Top Header & Navigation
  app_name: { en: 'Pakistan Fund Tracker', ur: 'Pakistan Fund Tracker' },
  tagline: { en: 'AI-Powered Wealth & Mutual Fund Intelligence', ur: 'AI-Powered Maliyati Intelligence' },
  manage_data: { en: 'Manage Data', ur: 'Data Manage Kijiye' },
  data_ledger: { en: 'Data Ledger', ur: 'Data Manage Kijiye' },
  view_history: { en: 'View All History', ur: 'Mukammal History Dekhein' },
  view_statement_history: { en: 'View statement history', ur: 'Statement ki history dekhiye' },
  export_csv: { en: 'Export CSV', ur: 'CSV Download Karein' },
  export_pdf: { en: 'Export PDF', ur: 'PDF Download Karein' },
  zakat_calc: { en: 'Zakat Calc', ur: 'Zakat Calculator' },
  guide: { en: 'Guide', ur: 'Madad / Guide' },
  sign_out: { en: 'Sign Out', ur: 'Sign Out' },
  ai_copilot: { en: 'AI Copilot', ur: 'AI Maliyati Mashweer' },
  ai_copilot_badge: { en: 'Urdu Copilot', ur: 'Urdu Mashweer' },

  // Sidebar Items
  all_institutions: { en: 'All Institutions', ur: 'Tamam Banks' },
  market_news: { en: 'Market News', ur: 'Market Khabrain' },
  ai_analysis: { en: 'AI Analysis', ur: 'AI Tajziya' },
  portfolio_suggestions: { en: 'Portfolio Suggestions', ur: 'Portfolio Mashwaray' },
  inflation_simulator: { en: 'Inflation Simulator', ur: 'Mehngai (Inflation) Simulator' },
  tax_optimizer: { en: 'Tax Optimizer', ur: 'Tax Bachat Optimizer' },
  benchmark_analyzer: { en: 'Benchmark Analyzer', ur: 'Market Muqabla (Benchmark)' },

  // KPI Cards
  net_worth: { en: 'Total Net Worth', ur: 'Kul Maliyat (Net Worth)' },
  invested_capital: { en: 'Invested Capital', ur: 'Kul Sarmayakari (Invested)' },
  gain_loss: { en: 'Total Gain / Loss', ur: 'Kul Nafa / Nuqsan' },
  top_performer: { en: 'Top Performer', ur: 'Behtareen Munafa Fund' },

  // Dashboard Sections
  portfolio_growth: { en: 'Portfolio Growth Trajectory', ur: 'Portfolio ki Taraqqi ka Chart' },
  asset_allocation: { en: 'Asset Allocation', ur: 'Sarmaye ki Taqseem' },
  recent_updates: { en: 'Recent Portfolio Updates', ur: 'Taza Tareen Portfolio Updates' },
  holdings_breakdown: { en: 'Holdings Breakdown', ur: 'Sarmayakari ki Tafseelat' },
  fund_name: { en: 'Fund Name', ur: 'Fund ka Naam' },
  bank_amc: { en: 'Bank / AMC', ur: 'Bank / Idara' },
  category: { en: 'Category', ur: 'Qisam' },
  nav_price: { en: 'NAV Price', ur: 'Unit Qeemat (NAV)' },
  current_units: { en: 'Units', ur: 'Units' },
  current_value: { en: 'Market Value', ur: 'Maliyat' },
  one_month_return: { en: '1M Return', ur: '1 Mah ka Nafa' },

  // Copilot Strings
  copilot_title: { en: 'AI Financial Copilot', ur: 'Maliyati Mashweer (AI Copilot)' },
  copilot_subtitle: { en: 'Powered by Alibaba Cloud Qwen 2.5', ur: 'Alibaba Cloud Qwen 2.5 se chalne wala' },
  copilot_welcome: {
    en: 'Assalam-o-Alaikum! I am your AI Financial Copilot. How can I assist with your mutual funds, inflation hedging, or Zakat calculation today?',
    ur: 'Assalam-o-Alaikum! Main aapka Maliyati Mashweer hoon. Aapke mutual funds, mehngai (inflation) se bachat, ya Zakat k hisaab kitab mein main kya madad kar sakta hoon?'
  },
  copilot_placeholder: {
    en: 'Ask anything about your portfolio or Pakistani funds...',
    ur: 'Apne portfolio ya mutual funds k barey mein kuch bhi poochein...'
  },
  chip_health: {
    en: 'How is my portfolio performing overall?',
    ur: 'Mera portfolio kaisa perform kar raha hai?'
  },
  chip_inflation: {
    en: 'Are my funds beating Pakistani inflation?',
    ur: 'Kiya mere funds mehngai (inflation) ko beat kar rahe hain?'
  },
  chip_zakat: {
    en: 'How is Zakat calculated on my specific funds?',
    ur: 'Mujhe apne funds par Zakat kis tarah ada karni chahiye?'
  },
  chip_top_fund: {
    en: 'Which of my funds is generating the highest return?',
    ur: 'Mera konsa fund sab se zyada munafa de raha hai?'
  },
  chip_tax: {
    en: 'How can I save tax under Section 63 VPS?',
    ur: 'Section 63 VPS k zariye main kitna tax bacha sakta hoon?'
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('preferred_language');
    return (saved === 'ur' || saved === 'en') ? saved : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('preferred_language', lang);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ur' : 'en');
  };

  const isUrdu = language === 'ur';

  const t = (key: string, fallback?: string): string => {
    const entry = DICTIONARY[key];
    if (entry) {
      return entry[language] || fallback || entry.en || key;
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, isUrdu, t }}>
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

export default LanguageContext;
