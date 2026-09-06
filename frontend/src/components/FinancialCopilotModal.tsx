import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, Sparkles, RefreshCw, User, Cpu } from 'lucide-react';
import client from '../api/client';
import { useLanguage } from '../context/LanguageContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface FinancialCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FinancialCopilotModal: React.FC<FinancialCopilotModalProps> = ({ isOpen, onClose }) => {
  const { language, setLanguage, isUrdu, t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiMetadata, setAiMetadata] = useState<{ provider: string; model: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize welcome message when language changes or on first mount
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: t('copilot_welcome'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const quickChips = [
    { label: t('chip_health'), query: isUrdu ? 'Mera portfolio kaisa perform kar raha hai?' : 'How is my portfolio performing overall?' },
    { label: t('chip_inflation'), query: isUrdu ? 'Kiya mere funds mehngai (inflation) ko beat kar rahe hain?' : 'Are my funds beating Pakistani inflation?' },
    { label: t('chip_zakat'), query: isUrdu ? 'Mujhe apne funds par Zakat kis tarah ada karni chahiye?' : 'How is Zakat calculated on my specific funds?' },
    { label: t('chip_top_fund'), query: isUrdu ? 'Mera konsa fund sab se zyada munafa de raha hai?' : 'Which of my funds is generating the highest return?' },
    { label: t('chip_tax'), query: isUrdu ? 'Section 63 VPS k zariye main kitna tax bacha sakta hoon?' : 'How can I save tax under Section 63 VPS?' },
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || inputValue).trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputValue('');
    setIsLoading(true);

    try {
      // Build history for context
      const historyPayload = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await client.post('/dashboard/copilot', {
        message: messageText,
        language: isUrdu ? 'ur' : 'en',
        history: historyPayload,
      });

      if (res.data && res.data.response) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: res.data.response,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        if (res.data.ai_provider && res.data.ai_model) {
          setAiMetadata({ provider: res.data.ai_provider, model: res.data.ai_model });
        }
      }
    } catch (err: any) {
      const errorText = isUrdu
        ? 'Maaf kijiye, is waqt AI mashweer se rabta nahi ho saka. Baraye meharbani dobara koshish kijiye.'
        : 'Sorry, unable to reach the AI Copilot right now. Please verify your connection and try again.';
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: errorText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: t('copilot_welcome'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-6 animate-fade-in">
      <div className="bg-surface border border-emerald-500/30 rounded-3xl w-full max-w-3xl h-[88vh] max-h-[780px] shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-surface-highlight/70 dark:bg-white/5 border-b border-[var(--color-white-10)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Bot size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-text-primary text-base sm:text-lg">{t('copilot_title')}</h3>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <Sparkles size={10} />
                  Qwen 2.5
                </span>
              </div>
              <p className="text-xs text-text-secondary flex items-center gap-1.5 mt-0.5">
                <Cpu size={12} className="text-emerald-500" />
                <span>{t('copilot_subtitle')}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher inside Chat */}
            <div className="flex items-center bg-surface border border-[var(--color-white-10)] rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  language === 'en'
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ur')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  language === 'ur'
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                🇵🇰 Roman Urdu
              </button>
            </div>

            <button
              onClick={handleResetChat}
              title={isUrdu ? 'Nayi chat shuru karein' : 'Reset chat'}
              className="p-2 text-text-secondary hover:text-text-primary rounded-xl hover:bg-[var(--color-white-5)] transition-colors"
            >
              <RefreshCw size={16} />
            </button>

            <button
              onClick={onClose}
              className="p-2 text-text-secondary hover:text-text-primary rounded-xl hover:bg-[var(--color-white-5)] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div key={m.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-1">
                    <Bot size={16} />
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-emerald-600 text-white rounded-tr-xs shadow-md shadow-emerald-600/15'
                      : 'bg-surface-highlight/70 dark:bg-white/5 border border-[var(--color-white-10)] text-text-primary rounded-tl-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans text-sm">{m.content}</div>
                  <div
                    className={`text-[10px] mt-2 font-mono ${
                      isUser ? 'text-emerald-100/80 text-right' : 'text-text-secondary'
                    }`}
                  >
                    {m.timestamp}
                  </div>
                </div>
                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-surface-highlight/80 text-text-primary border border-[var(--color-white-10)] flex items-center justify-center shrink-0 mt-1">
                    <User size={16} />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0 animate-pulse">
                <Bot size={16} />
              </div>
              <div className="bg-surface-highlight/70 dark:bg-white/5 border border-[var(--color-white-10)] rounded-2xl rounded-tl-xs px-4 py-3 flex items-center gap-2 text-xs text-text-secondary">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>{isUrdu ? 'Qwen 2.5 tajziya kar raha hai...' : 'Alibaba Cloud Qwen 2.5 is reasoning...'}</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Question Chips */}
        <div className="px-4 py-2 border-t border-[var(--color-white-10)] bg-surface-highlight/30 dark:bg-white/5 overflow-x-auto flex gap-2 no-scrollbar">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => handleSendMessage(chip.query)}
              className="text-xs shrink-0 px-3 py-1.5 rounded-full bg-surface border border-[var(--color-white-10)] hover:border-emerald-500/40 text-text-secondary hover:text-text-primary transition-all shadow-2xs font-medium flex items-center gap-1.5"
            >
              <Sparkles size={11} className="text-emerald-500" />
              <span>{chip.label}</span>
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-surface border-t border-[var(--color-white-10)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t('copilot_placeholder')}
              disabled={isLoading}
              className="flex-1 bg-surface-highlight/60 dark:bg-white/5 border border-[var(--color-white-10)] focus:border-emerald-500/50 rounded-2xl px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary/70 focus:outline-none transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="w-11 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white flex items-center justify-center transition-all shrink-0 shadow-md shadow-emerald-600/20"
            >
              <Send size={18} />
            </button>
          </form>
          <div className="flex items-center justify-between text-[10px] text-text-secondary/70 mt-2 px-1">
            <span>{isUrdu ? '🔒 Muhafiz: Koi bank account number ya CNIC AI ko nahi bheja jata.' : '🔒 Privacy: Zero bank account numbers or CNIC are transmitted to AI.'}</span>
            <span className="font-mono">{aiMetadata ? `${aiMetadata.provider} (${aiMetadata.model})` : 'Alibaba Cloud Model Studio'}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FinancialCopilotModal;
