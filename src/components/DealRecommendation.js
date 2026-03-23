import React from 'react';

export default function DealRecommendation({ recommendation, commentary }) {
  return (
    <div className={`rounded-2xl p-6 border ${recommendation.bgClass}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${recommendation.badgeBg} ${recommendation.textClass}`}>
          Screening Result
        </div>
      </div>
      <h3 className={`text-xl font-bold ${recommendation.textClass} mb-1`}>
        {recommendation.category}
      </h3>
      <p className="text-sm text-gray-500 mb-5">
        {recommendation.detail}
      </p>

      <div className="space-y-2">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Preliminary Assessment Notes
        </h4>
        <ul className="space-y-2.5">
          {commentary.map((comment, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] text-gray-700 leading-relaxed">
              <span className={`mt-2 w-1.5 h-1.5 rounded-full ${recommendation.textClass} bg-current flex-shrink-0`} />
              <span>{comment}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
