import React from 'react';
import { X, BookOpen, Lightbulb, Calculator, HelpCircle, ShieldAlert } from 'lucide-react';

export interface FeatureGuideContent {
  title: string;
  subtitle: string;
  badge?: string;
  overview: string;
  howToUse: string[];
  mathExplanation: {
    formulaName: string;
    formula?: string;
    description: string;
  }[];
  proTips: string[];
  disclaimer: string;
}

interface FeatureInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: FeatureGuideContent;
}

export const FeatureInfoModal: React.FC<FeatureInfoModalProps> = ({
  isOpen,
  onClose,
  content,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 animate-fadeIn">
      <div 
        className="bg-surface border border-[var(--color-white-10)] rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-text-secondary hover:text-text-primary bg-[var(--color-white-5)] hover:bg-[var(--color-white-10)] rounded-full transition-colors"
          title="Close guide"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-start gap-4 mb-6 pr-8 shrink-0">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shrink-0">
            <BookOpen size={26} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-text-primary">{content.title}</h2>
              {content.badge && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {content.badge}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-text-secondary mt-1">{content.subtitle}</p>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="overflow-y-auto flex-1 pr-2 space-y-6 custom-scrollbar text-sm text-text-secondary">
          
          {/* Section 1: Overview */}
          <div className="bg-[var(--color-white-2)] border border-[var(--color-white-5)] rounded-2xl p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary mb-2 flex items-center gap-2">
              <HelpCircle size={15} className="text-emerald-400" /> What does this feature do?
            </h3>
            <p className="text-xs sm:text-sm leading-relaxed text-text-primary/90">
              {content.overview}
            </p>
          </div>

          {/* Section 2: Step-by-Step Guide */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary mb-3 flex items-center gap-2">
              <Lightbulb size={15} className="text-gold" /> How to Use This Feature
            </h3>
            <div className="space-y-2">
              {content.howToUse.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-[var(--color-white-2)] border border-[var(--color-white-5)] rounded-xl p-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-xs sm:text-sm text-text-primary/90">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Financial Math & Formulas */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary mb-3 flex items-center gap-2">
              <Calculator size={15} className="text-sky-400" /> The Financial Math Behind It
            </h3>
            <div className="space-y-3">
              {content.mathExplanation.map((item, idx) => (
                <div key={idx} className="bg-[var(--color-white-2)] border border-[var(--color-white-5)] rounded-xl p-3.5 space-y-1.5">
                  <h4 className="text-xs font-bold text-text-primary">{item.formulaName}</h4>
                  {item.formula && (
                    <div className="bg-midnight/80 px-3 py-1.5 rounded-lg font-mono text-xs text-emerald-300 border border-[var(--color-white-5)] overflow-x-auto">
                      {item.formula}
                    </div>
                  )}
                  <p className="text-xs text-text-secondary leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Pro Tips */}
          {content.proTips.length > 0 && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-2">
                <Lightbulb size={15} /> Pro Tips for Pakistani Investors
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-xs text-text-secondary">
                {content.proTips.map((tip, idx) => (
                  <li key={idx} className="leading-relaxed">{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Section 5: Regulatory Disclaimer */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-400/90">
            <ShieldAlert size={16} className="shrink-0 mt-0.5 text-amber-400" />
            <p className="leading-relaxed">
              <strong className="text-amber-300">Disclaimer: </strong>
              {content.disclaimer}
            </p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="pt-4 mt-4 border-t border-[var(--color-white-5)] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-emerald-600/20"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeatureInfoModal;
