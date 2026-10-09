import React from 'react';
import type { Recommendation } from '../types';
import type { GatedRecommendation } from '../lib/recommendation';
import { recommendationStyle } from './recommendationStyle';

export interface DealRecommendationProps {
  recommendation: Recommendation | GatedRecommendation;
  commentary: string[];
}

export default function DealRecommendation({ recommendation, commentary }: DealRecommendationProps): React.ReactElement {
  const style = recommendationStyle(recommendation);
  const gated = recommendation as Partial<GatedRecommendation>;
  const failures = gated.failures || [];
  const conditions = gated.conditions || [];
  return (
    <div className={`rounded-2xl p-6 border ${style.bgClass}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${style.badgeBg} ${style.textClass}`}>
          Screening Result
        </div>
      </div>
      <h3 className={`text-xl font-bold ${style.textClass} mb-1`}>
        {recommendation.category}
      </h3>
      <p className="text-sm text-gray-500 mb-5">
        {recommendation.detail}
      </p>

      {failures.length > 0 && (
        <ConditionList title="Fails policy" items={failures} textClass="text-rose-700" />
      )}
      {conditions.length > 0 && (gated.tone === 'flag' || gated.tone === 'fail') && (
        <ConditionList
          title={gated.tone === 'flag' ? 'Conditions to advance' : 'Also flagged'}
          items={conditions}
          textClass="text-amber-700"
        />
      )}

      <div className="space-y-2">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Preliminary Assessment Notes
        </h4>
        <ul className="space-y-2.5">
          {commentary.map((comment, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] text-gray-700 leading-relaxed">
              <span className={`mt-2 w-1.5 h-1.5 rounded-full ${style.textClass} bg-current flex-shrink-0`} />
              <span>{comment}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ConditionList({ title, items, textClass }: { title: string; items: string[]; textClass: string }): React.ReactElement {
  return (
    <div className="mb-5">
      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">{title}</h4>
      <ol className="space-y-1.5">
        {items.map((text, i) => (
          <li key={i} className="flex gap-2.5 text-[13px] text-gray-800 leading-relaxed">
            <span className={`font-mono font-bold ${textClass} flex-shrink-0`}>{i + 1}.</span>
            <span>{text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
