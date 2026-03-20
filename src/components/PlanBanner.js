import React from 'react';

/**
 * Banner that shows plan expiry warnings and expired state.
 * Renders nothing if the plan is active and not expiring soon.
 */
export default function PlanBanner({ plan, isExpired, isExpiringSoon, daysRemaining, onManagePlan }) {
  if (!isExpired && !isExpiringSoon) return null;

  if (isExpired) {
    return (
      <div className="bg-rose-500/10 border-b border-rose-500/20">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-rose-400" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span className="text-[12px] text-rose-200/90">
              Your <span className="font-semibold capitalize">{plan}</span> plan has expired. The dashboard is now in read-only mode.
              {' '}Upgrade your plan to continue saving and managing deals.
            </span>
          </div>
          {onManagePlan && (
            <button
              onClick={onManagePlan}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30 transition-colors"
            >
              Upgrade Plan
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20">
      <div className="max-w-[1600px] mx-auto px-6 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-amber-400" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="text-[12px] text-amber-200/90">
            Your <span className="font-semibold capitalize">{plan}</span> plan expires in{' '}
            <span className="font-semibold">{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span>.
            {' '}Upgrade to keep full access.
          </span>
        </div>
        {onManagePlan && (
          <button
            onClick={onManagePlan}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
          >
            Manage Plan
          </button>
        )}
      </div>
    </div>
  );
}
