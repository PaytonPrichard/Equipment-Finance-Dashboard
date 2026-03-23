import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../hooks/useRole';
import { useOrgPlan } from '../hooks/useOrgPlan';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { ROLE_LABELS } from '../lib/permissions';
import { fetchPreferences, upsertPreferences } from '../lib/preferences';
import { DEFAULT_CRITERIA, validateCriteria } from '../lib/screeningCriteria';

const NAV_ITEMS = [
  { id: 'account', label: 'Account', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
  { id: 'team', label: 'Team', adminOnly: true, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
  { id: 'screening', label: 'Screening Policy', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg> },
  { id: 'branding', label: 'Branding', adminOnly: true, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg> },
  { id: 'billing', label: 'Billing', adminOnly: true, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg> },
];

function SettingsInput({ label, value, onChange, type = 'text', placeholder, hint, suffix }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value)}
          placeholder={placeholder}
          className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all"
          style={suffix ? { paddingRight: '2.5rem' } : undefined}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
      {hint && <p className="text-[9px] text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}

export default function SettingsPanel({ isOpen, onClose, onCriteriaChange, activeModule }) {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { can } = useRole();
  const { plan, daysRemaining, isExpired } = useOrgPlan();
  const { addToast } = useToast();
  const [section, setSection] = useState('account');
  const userId = user?.id;
  const orgId = profile?.org_id;
  const isAdmin = can('org.manage_users');

  // Team state
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('analyst');
  const [invites, setInvites] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [org, setOrg] = useState(null);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Branding state
  const [brandingLogoUrl, setBrandingLogoUrl] = useState('');
  const [brandingAccentColor, setBrandingAccentColor] = useState('#d4a843');
  const [brandingFooterText, setBrandingFooterText] = useState('');
  const [brandingMemoTitle, setBrandingMemoTitle] = useState('');

  // Screening criteria state
  const [criteria, setCriteria] = useState({ ...DEFAULT_CRITERIA });

  // Plan state
  const [planType, setPlanType] = useState('pilot');
  const [planExpiry, setPlanExpiry] = useState('');

  // Org settings state
  const [orgSettings, setOrgSettings] = useState({});

  // Load data when panel opens
  useEffect(() => {
    if (!isOpen || !orgId || !supabase) return;

    // Load team + org data
    if (isAdmin) {
      setLoadingTeam(true);
      Promise.all([
        supabase.from('profiles').select('*').eq('org_id', orgId).order('created_at', { ascending: true }),
        supabase.from('invites').select('*').eq('org_id', orgId).eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('organizations').select('*').eq('id', orgId).single(),
      ]).then(([membersRes, invitesRes, orgRes]) => {
        if (membersRes.data) setMembers(membersRes.data);
        if (invitesRes.data) setInvites(invitesRes.data);
        if (orgRes.data) {
          setOrg(orgRes.data);
          setPlanType(orgRes.data.plan || 'pilot');
          setPlanExpiry(orgRes.data.plan_expires_at ? orgRes.data.plan_expires_at.slice(0, 10) : '');
          setOrgSettings(orgRes.data.org_settings || {});
          const b = orgRes.data.branding || {};
          setBrandingLogoUrl(b.logoUrl || '');
          setBrandingAccentColor(b.accentColor || '#d4a843');
          setBrandingFooterText(b.footerText || '');
          setBrandingMemoTitle(b.memoTitle || '');
        }
        setLoadingTeam(false);
      });
    }

    // Load screening criteria
    if (userId) {
      fetchPreferences(userId).then(({ data }) => {
        const saved = validateCriteria(data?.screening_criteria);
        if (saved) {
          setCriteria(saved);
          if (onCriteriaChange) onCriteriaChange(saved);
        }
      });
    }
  }, [isOpen, orgId, userId, isAdmin, onCriteriaChange]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const saveToOrg = useCallback(async (data) => {
    if (!supabase || !orgId) return;
    const { error } = await supabase.from('organizations').update({ ...data, updated_at: new Date().toISOString() }).eq('id', orgId);
    if (error) addToast('Failed to save: ' + error.message, 'error');
    else {
      addToast('Settings saved', 'success');
      try { localStorage.removeItem('efd_profile_cache'); } catch (e) { /* */ }
      refreshProfile();
    }
  }, [orgId, addToast, refreshProfile]);

  const saveCriteria = useCallback(async (newCriteria) => {
    setCriteria(newCriteria);
    if (onCriteriaChange) onCriteriaChange(newCriteria);
    if (userId) upsertPreferences(userId, { screening_criteria: newCriteria }).catch(console.error);
  }, [userId, onCriteriaChange]);

  const updateCriteriaField = useCallback((key, value) => {
    const next = { ...criteria, [key]: value };
    saveCriteria(next);
  }, [criteria, saveCriteria]);

  const handleCreateInvite = useCallback(async () => {
    if (!supabase || !orgId || !userId) return;
    const code = Array.from(crypto.getRandomValues(new Uint8Array(15)), b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 36]).join('');
    const { data, error } = await supabase.from('invites').insert({
      org_id: orgId,
      created_by: userId,
      invite_code: code,
      email: inviteEmail.trim() || null,
      role: inviteRole,
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }).select().single();
    if (error) addToast('Failed to create invite', 'error');
    else { setInvites(prev => [data, ...prev]); setInviteEmail(''); addToast('Invite created', 'success'); }
  }, [orgId, userId, inviteEmail, inviteRole, addToast]);

  if (!isOpen) return null;

  const visibleNav = NAV_ITEMS.filter(n => !n.adminOnly || isAdmin);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <div className="relative w-full max-w-3xl max-h-[85vh] mx-4 rounded-2xl border border-white/[0.08] overflow-hidden animate-fade-in-up flex" style={{ background: 'rgba(17, 17, 22, 0.97)' }}>
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0 border-r border-white/[0.06] py-4 flex flex-col">
          <h2 className="text-sm font-bold text-white px-4 mb-4">Settings</h2>
          <nav className="flex-1 space-y-0.5 px-2">
            {visibleNav.map(item => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${
                  section === item.id ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span className={section === item.id ? 'text-gold-400' : 'text-slate-500'}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="px-2 pt-2 border-t border-white/[0.06] mt-2">
            <button
              onClick={() => { onClose(); signOut(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-slate-400 hover:text-rose-400 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              Sign Out
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Close button */}
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>

          {/* Account */}
          {section === 'account' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white mb-4">Account</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[12px] text-slate-400">Name</span>
                    <span className="text-[12px] text-white font-medium">{profile?.full_name || 'Not set'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                    <span className="text-[12px] text-slate-400">Email</span>
                    <span className="text-[12px] text-white font-medium">{user?.email}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                    <span className="text-[12px] text-slate-400">Role</span>
                    <span className="text-[12px] text-white font-medium">{ROLE_LABELS[profile?.role] || profile?.role}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                    <span className="text-[12px] text-slate-400">Organization</span>
                    <span className="text-[12px] text-white font-medium">{profile?.organizations?.name || 'None'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                    <span className="text-[12px] text-slate-400">Plan</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-white font-medium capitalize">{plan || 'Free'}</span>
                      {daysRemaining != null && <span className="text-[10px] text-slate-500">{daysRemaining} days left</span>}
                      {isExpired && <span className="text-[10px] text-rose-400">Expired</span>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <a href="mailto:joelpeter617@gmail.com?subject=Tranche%20Feedback" className="text-[12px] text-slate-400 hover:text-gold-400 transition-colors">
                  Send feedback
                </a>
              </div>
            </div>
          )}

          {/* Team */}
          {section === 'team' && isAdmin && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white mb-4">Team Members</h3>
                {loadingTeam ? (
                  <p className="text-[12px] text-slate-500">Loading...</p>
                ) : (
                  <div className="space-y-2">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                        <div>
                          <p className="text-[12px] text-white font-medium">{m.full_name || m.email}</p>
                          <p className="text-[10px] text-slate-500">{m.email}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">{ROLE_LABELS[m.role] || m.role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-3">Create Invite</h3>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Email (optional)"
                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[12px] placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[12px] focus:outline-none"
                  >
                    <option value="analyst">Analyst</option>
                    <option value="senior_analyst">Senior Analyst</option>
                    <option value="credit_committee">Credit Committee</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button onClick={handleCreateInvite} className="px-4 py-2 rounded-lg bg-white/[0.08] text-white text-[12px] font-semibold hover:bg-white/[0.12] transition-all">
                    Invite
                  </button>
                </div>
                {invites.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {invites.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-gold-400">{inv.invite_code}</span>
                          {inv.email && <span className="text-[10px] text-slate-500">{inv.email}</span>}
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(inv.invite_code); addToast('Code copied', 'success'); }} className="text-[10px] text-slate-500 hover:text-white transition-colors">Copy</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {isAdmin && (
                <div>
                  <h3 className="text-sm font-bold text-white mb-3">Plan Management</h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Plan Type</label>
                      <select value={planType} onChange={(e) => setPlanType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all">
                        <option value="free">Free</option>
                        <option value="pilot">Pilot</option>
                        <option value="starter">Starter</option>
                        <option value="growth">Growth</option>
                        <option value="institution">Institution</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Expiry</label>
                      <input type="date" value={planExpiry} onChange={(e) => setPlanExpiry(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all" />
                    </div>
                  </div>
                  <button onClick={() => saveToOrg({ plan: planType, plan_expires_at: planExpiry ? new Date(planExpiry + 'T23:59:59Z').toISOString() : null })} className="px-4 py-2 rounded-lg bg-white/[0.08] text-white text-[12px] font-semibold hover:bg-white/[0.12] transition-all">
                    Save Plan
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Screening Policy */}
          {section === 'screening' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Screening Policy</h3>
                <p className="text-[12px] text-slate-500 mb-4">Configure pass/flag/fail thresholds for deal screening.</p>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Score Thresholds</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <SettingsInput label="Pass (min score)" value={criteria.passScore} onChange={(v) => updateCriteriaField('passScore', v)} type="number" />
                      <SettingsInput label="Flag (min score)" value={criteria.flagScore} onChange={(v) => updateCriteriaField('flagScore', v)} type="number" />
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-800 relative overflow-hidden">
                      <div className="absolute left-0 top-0 h-full bg-rose-500/40 rounded-l-full" style={{ width: `${criteria.flagScore}%` }} />
                      <div className="absolute top-0 h-full bg-amber-500/40" style={{ left: `${criteria.flagScore}%`, width: `${criteria.passScore - criteria.flagScore}%` }} />
                      <div className="absolute top-0 h-full bg-emerald-500/40 rounded-r-full" style={{ left: `${criteria.passScore}%`, width: `${100 - criteria.passScore}%` }} />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Credit Policy Limits</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <SettingsInput label="Min DSCR" value={criteria.minDscr} onChange={(v) => updateCriteriaField('minDscr', v)} type="number" suffix="x" hint="Below 1.0x auto-fails." />
                      <SettingsInput label="Max Leverage" value={criteria.maxLeverage} onChange={(v) => updateCriteriaField('maxLeverage', v)} type="number" suffix="x" />
                      <SettingsInput label="Min Revenue" value={criteria.minRevenue} onChange={(v) => updateCriteriaField('minRevenue', v)} type="number" suffix="$" hint="Set to 0 to disable." />
                      <SettingsInput label="Min Years" value={criteria.minYearsInBusiness} onChange={(v) => updateCriteriaField('minYearsInBusiness', v)} type="number" suffix="yrs" />
                    </div>
                  </div>
                  {isAdmin && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Firm Credit Assumptions</h4>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <SettingsInput label="Base Spread" value={orgSettings.baseSpreadBps ?? 200} onChange={(v) => setOrgSettings(s => ({ ...s, baseSpreadBps: v }))} type="number" suffix="bps" hint="Default: 200" />
                        <SettingsInput label="Strong Credit Adj" value={orgSettings.creditSpreadStrong ?? -75} onChange={(v) => setOrgSettings(s => ({ ...s, creditSpreadStrong: v }))} type="number" suffix="bps" />
                        <SettingsInput label="Weak Credit Adj" value={orgSettings.creditSpreadWeak ?? 200} onChange={(v) => setOrgSettings(s => ({ ...s, creditSpreadWeak: v }))} type="number" suffix="bps" />
                        <SettingsInput label="Max AR Advance" value={orgSettings.maxAdvanceRateAR ?? 85} onChange={(v) => setOrgSettings(s => ({ ...s, maxAdvanceRateAR: v }))} type="number" suffix="%" />
                      </div>
                      <button onClick={() => saveToOrg({ org_settings: orgSettings })} className="px-4 py-2 rounded-lg bg-white/[0.08] text-white text-[12px] font-semibold hover:bg-white/[0.12] transition-all">
                        Save Firm Assumptions
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Branding */}
          {section === 'branding' && isAdmin && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Memo Branding</h3>
                <p className="text-[12px] text-slate-500 mb-4">Customize how exported screening memos look.</p>
                <div className="space-y-3">
                  <SettingsInput label="Logo URL" value={brandingLogoUrl} onChange={setBrandingLogoUrl} placeholder="https://yourfirm.com/logo.png" hint="Appears in the top-right corner of exported memos. Max height: 40px." />
                  {brandingLogoUrl && (
                    <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                      <p className="text-[9px] text-slate-600 mb-1.5">Preview:</p>
                      <img src={brandingLogoUrl} alt="Logo preview" style={{ maxHeight: 40, maxWidth: 180 }} onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Accent Color</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={brandingAccentColor} onChange={(e) => setBrandingAccentColor(e.target.value)} className="w-8 h-8 rounded-lg border border-white/[0.08] cursor-pointer bg-transparent" />
                        <input type="text" value={brandingAccentColor} onChange={(e) => setBrandingAccentColor(e.target.value)} className="flex-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all" />
                      </div>
                    </div>
                    <SettingsInput label="Memo Title" value={brandingMemoTitle} onChange={setBrandingMemoTitle} placeholder="e.g. Credit Screening Memo" />
                  </div>
                  <SettingsInput label="Footer Text" value={brandingFooterText} onChange={setBrandingFooterText} placeholder="e.g. Confidential" />
                  <button onClick={() => saveToOrg({ branding: { logoUrl: brandingLogoUrl, accentColor: brandingAccentColor, footerText: brandingFooterText, memoTitle: brandingMemoTitle } })} className="px-4 py-2 rounded-lg bg-white/[0.08] text-white text-[12px] font-semibold hover:bg-white/[0.12] transition-all">
                    Save Branding
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Billing */}
          {section === 'billing' && isAdmin && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Billing</h3>
                <p className="text-[12px] text-slate-500 mb-4">Manage your subscription and payment method.</p>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] text-white font-medium capitalize">{plan || 'Free'} Plan</p>
                      {daysRemaining != null && <p className="text-[10px] text-slate-500">{daysRemaining} days remaining</p>}
                      {isExpired && <p className="text-[10px] text-rose-400">Plan expired. Upgrade to continue.</p>}
                    </div>
                  </div>
                </div>
                <p className="text-[12px] text-slate-500">Stripe billing integration coming soon. Contact us for plan changes or pilot extensions.</p>
                <a href="mailto:joelpeter617@gmail.com?subject=Tranche%20Billing" className="inline-block mt-2 text-[12px] text-gold-400 hover:text-gold-300 transition-colors">
                  Contact about billing
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
