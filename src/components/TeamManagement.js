import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../hooks/useRole';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { ROLE_LABELS } from '../lib/permissions';

const ROLES = ['analyst', 'senior_analyst', 'credit_committee', 'admin'];

function generateInviteCode() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20).toUpperCase();
}

function formatDate(isoString) {
  if (!isoString) return '--';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function TeamManagement() {
  const { user, profile, refreshProfile } = useAuth();
  const { can } = useRole();
  const { addToast } = useToast();

  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('analyst');
  const [creatingInvite, setCreatingInvite] = useState(false);

  // Discount code state
  const [discountCode, setDiscountCode] = useState('');
  const [redeemingCode, setRedeemingCode] = useState(false);

  // Org settings state (credit policy defaults)
  const [orgSettings, setOrgSettings] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Branding state
  const [brandingLogoUrl, setBrandingLogoUrl] = useState('');
  const [brandingAccentColor, setBrandingAccentColor] = useState('#d4a843');
  const [brandingFooterText, setBrandingFooterText] = useState('');
  const [brandingMemoTitle, setBrandingMemoTitle] = useState('');
  const [savingBranding, setSavingBranding] = useState(false);

  // Plan management state
  const [planType, setPlanType] = useState('pilot');
  const [planExpiry, setPlanExpiry] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  // Transfer admin state
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferConfirmText, setTransferConfirmText] = useState('');
  const [transferring, setTransferring] = useState(false);

  const orgId = profile?.org_id;

  const fetchData = useCallback(async () => {
    if (!supabase || !orgId) return;
    setLoading(true);

    try {
      const [membersRes, invitesRes, orgRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('org_id', orgId)
          .order('created_at', { ascending: true }),
        supabase
          .from('invites')
          .select('*')
          .eq('org_id', orgId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single(),
      ]);

      if (membersRes.error) {
        addToast('Failed to load team members: ' + membersRes.error.message, 'error');
      } else {
        setMembers(membersRes.data || []);
      }

      if (invitesRes.error) {
        addToast('Failed to load invites: ' + invitesRes.error.message, 'error');
      } else {
        setInvites(invitesRes.data || []);
      }

      if (orgRes.error) {
        addToast('Failed to load organization: ' + orgRes.error.message, 'error');
      } else {
        setOrg(orgRes.data);
        // Load plan settings
        setPlanType(orgRes.data?.plan || 'pilot');
        setPlanExpiry(orgRes.data?.plan_expires_at ? orgRes.data.plan_expires_at.slice(0, 10) : '');
        setOrgSettings(orgRes.data?.org_settings || {});
        // Load branding settings
        const b = orgRes.data?.branding || {};
        setBrandingLogoUrl(b.logoUrl || '');
        setBrandingAccentColor(b.accentColor || '#d4a843');
        setBrandingFooterText(b.footerText || '');
        setBrandingMemoTitle(b.memoTitle || '');
      }
    } catch (err) {
      addToast('An unexpected error occurred while loading team data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---------- Actions ----------

  const handleChangeRole = async (userId, newRole) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
      .eq('org_id', orgId);

    if (error) {
      addToast('Failed to update role: ' + error.message, 'error');
    } else {
      addToast('Role updated successfully.', 'success');
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m))
      );
      // If the current user changed their own role, refresh context
      if (userId === user?.id) {
        refreshProfile();
      }
    }
  };

  const handleRemoveMember = async (userId, memberName) => {
    const confirmed = window.confirm(
      `Remove ${memberName || 'this user'} from the organization? They will lose access to all org data.`
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from('profiles')
      .update({ org_id: null, role: 'analyst' })
      .eq('id', userId);

    if (error) {
      addToast('Failed to remove member: ' + error.message, 'error');
    } else {
      addToast('Member removed from organization.', 'success');
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    }
  };

  const handleTransferAdmin = async () => {
    if (!transferTarget) return;
    setTransferring(true);

    const { data, error } = await supabase.rpc('transfer_admin', {
      p_new_admin_id: transferTarget.id,
    });

    if (error) {
      addToast('Failed to transfer admin: ' + error.message, 'error');
    } else if (data?.error) {
      addToast(data.error, 'error');
    } else {
      addToast(`Admin transferred to ${transferTarget.full_name || transferTarget.email}.`, 'success');
      setTransferTarget(null);
      setTransferConfirmText('');
      refreshProfile();
      fetchData();
    }
    setTransferring(false);
  };

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    setCreatingInvite(true);

    const invite_code = generateInviteCode();
    const payload = {
      org_id: orgId,
      role: inviteRole,
      invite_code,
      created_by: user.id,
    };
    if (inviteEmail.trim()) {
      payload.email = inviteEmail.trim().toLowerCase();
    }

    const { error } = await supabase.from('invites').insert(payload);

    if (error) {
      addToast('Failed to create invite: ' + error.message, 'error');
    } else {
      addToast(`Invite created: ${invite_code}`, 'success');
      setInviteEmail('');
      setInviteRole('analyst');
      fetchData();
    }
    setCreatingInvite(false);
  };

  const handleRevokeInvite = async (inviteId) => {
    const { error } = await supabase
      .from('invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId);

    if (error) {
      addToast('Failed to revoke invite: ' + error.message, 'error');
    } else {
      addToast('Invite revoked.', 'success');
      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code).then(
      () => addToast('Invite code copied to clipboard.', 'success'),
      () => addToast('Failed to copy code.', 'error')
    );
  };

  const handleRedeemDiscount = async (e) => {
    e.preventDefault();
    const trimmed = discountCode.trim();
    if (!trimmed) return;

    setRedeemingCode(true);

    const { error } = await supabase.rpc('redeem_discount_code', {
      p_code: trimmed,
      p_org_id: orgId,
    });

    if (error) {
      addToast('Failed to redeem code: ' + error.message, 'error');
    } else {
      addToast('Code redeemed successfully! Your plan has been updated.', 'success');
      setDiscountCode('');
      // Refresh org data to show updated plan
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();
      if (orgData) setOrg(orgData);
    }
    setRedeemingCode(false);
  };

  // ---------- Guard ----------

  if (!can('org.manage_users')) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500 text-sm">
          You don't have permission to manage the team.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-12 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-gold-500/30 border-t-gold-400 rounded-full animate-spin" />
          <span className="text-[12px] text-slate-500">Loading team data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Team Management</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Manage members, invites, and organization settings
            {org?.name && (
              <span className="text-slate-600"> — {org.name}</span>
            )}
          </p>
        </div>
      </div>

      {/* Plan Status */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          Plan Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-[11px] text-slate-500 mb-0.5">Current Plan</div>
            <div className="text-sm font-semibold text-slate-200">
              {org?.plan || 'Free'}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-0.5">Plan Expires</div>
            <div className="text-sm font-semibold text-slate-200">
              {org?.plan_expires_at ? formatDate(org.plan_expires_at) : 'No expiry'}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-0.5">Members</div>
            <div className="text-sm font-semibold text-slate-200">
              {members.length}
              {org?.member_limit != null && (
                <span className="text-slate-500 font-normal"> / {org.member_limit}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Team Members */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Team Members
          </h3>
        </div>

        {members.length === 0 ? (
          <div className="px-5 pb-5 text-[12px] text-slate-600">No members found.</div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1fr_160px_120px_80px] gap-2 px-5 py-2 border-b border-white/[0.04] bg-white/[0.01]">
              {['Name', 'Email', 'Role', 'Joined', ''].map((h) => (
                <div
                  key={h || 'actions'}
                  className="text-[10px] font-bold text-slate-600 uppercase tracking-widest"
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Table rows */}
            <div className="divide-y divide-white/[0.03]">
              {members.map((member) => {
                const isSelf = member.id === user?.id;

                return (
                  <div
                    key={member.id}
                    className="grid grid-cols-[1fr_1fr_160px_120px_80px] gap-2 px-5 py-3 items-center"
                  >
                    {/* Name */}
                    <div className="text-[12px] text-slate-300 truncate">
                      {member.full_name || '--'}
                      {isSelf && (
                        <span className="ml-1.5 text-[10px] text-slate-600">(you)</span>
                      )}
                    </div>

                    {/* Email */}
                    <div
                      className="text-[12px] text-slate-400 truncate"
                      title={member.email}
                    >
                      {member.email || '--'}
                    </div>

                    {/* Role dropdown */}
                    <div>
                      <select
                        value={member.role || 'analyst'}
                        onChange={(e) => handleChangeRole(member.id, e.target.value)}
                        disabled={isSelf}
                        className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-gold-500/30 focus:border-gold-500/20 appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed w-full"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 8px center',
                          paddingRight: '28px',
                        }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r] || r}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Join date */}
                    <div className="text-[11px] text-slate-500 font-mono">
                      {formatDate(member.created_at)}
                    </div>

                    {/* Remove button */}
                    <div className="text-right">
                      {!isSelf && (
                        <button
                          onClick={() =>
                            handleRemoveMember(member.id, member.full_name)
                          }
                          className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-rose-400 bg-rose-500/[0.08] border border-rose-500/15 hover:bg-rose-500/[0.15] transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Transfer Admin */}
      {members.filter((m) => m.id !== user?.id).length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            Transfer Admin
          </h3>
          <p className="text-[11px] text-slate-600 mb-4">
            Permanently hand off admin rights to another team member. You will be demoted to Senior Analyst.
          </p>

          {!transferTarget ? (
            <div className="flex items-center gap-3 flex-wrap">
              <select
                onChange={(e) => {
                  const m = members.find((m) => m.id === e.target.value);
                  if (m) setTransferTarget(m);
                }}
                defaultValue=""
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-gold-500/30 focus:border-gold-500/20 appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                  paddingRight: '32px',
                }}
              >
                <option value="" disabled>Select a team member...</option>
                {members
                  .filter((m) => m.id !== user?.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name || m.email} ({ROLE_LABELS[m.role] || m.role})
                    </option>
                  ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/15">
                <p className="text-[12px] text-amber-300 font-medium mb-1">
                  Are you sure you want to transfer admin to {transferTarget.full_name || transferTarget.email}?
                </p>
                <p className="text-[11px] text-amber-400/70">
                  This action is immediate. You will lose admin access and be set to Senior Analyst.
                </p>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest block mb-1.5">
                  Type TRANSFER to confirm
                </label>
                <input
                  type="text"
                  value={transferConfirmText}
                  onChange={(e) => setTransferConfirmText(e.target.value)}
                  placeholder="TRANSFER"
                  className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-gold-500/30 focus:border-gold-500/20 transition-all w-48 font-mono uppercase tracking-wider"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTransferAdmin}
                  disabled={transferConfirmText !== 'TRANSFER' || transferring}
                  className="pill-btn px-4 py-2 rounded-xl text-[12px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {transferring ? 'Transferring...' : 'Confirm Transfer'}
                </button>
                <button
                  onClick={() => { setTransferTarget(null); setTransferConfirmText(''); }}
                  className="pill-btn px-4 py-2 rounded-xl text-[12px] font-medium text-slate-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Invite */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
          Create Invite
        </h3>
        <form onSubmit={handleCreateInvite} className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
              Email (optional)
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-gold-500/30 focus:border-gold-500/20 transition-all"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
              Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-gold-500/30 focus:border-gold-500/20 appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
                paddingRight: '32px',
              }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r] || r}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={creatingInvite}
            className="pill-btn px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-gradient-to-r from-gold-500 to-gold-600 text-white shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 hover:from-gold-400 hover:to-gold-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {creatingInvite ? 'Creating...' : 'Generate Invite'}
          </button>
        </form>
      </div>

      {/* Pending Invites */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Pending Invites
          </h3>
        </div>

        {invites.length === 0 ? (
          <div className="px-5 pb-5 text-[12px] text-slate-600">
            No pending invites.
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[120px_1fr_120px_120px_140px] gap-2 px-5 py-2 border-b border-white/[0.04] bg-white/[0.01]">
              {['Code', 'Email', 'Role', 'Expires', ''].map((h) => (
                <div
                  key={h || 'actions'}
                  className="text-[10px] font-bold text-slate-600 uppercase tracking-widest"
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Table rows */}
            <div className="divide-y divide-white/[0.03]">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="grid grid-cols-[120px_1fr_120px_120px_140px] gap-2 px-5 py-3 items-center"
                >
                  {/* Code */}
                  <div className="text-[12px] text-gold-400 font-mono font-bold tracking-wider">
                    {invite.invite_code}
                  </div>

                  {/* Email */}
                  <div className="text-[12px] text-slate-400 truncate">
                    {invite.email || '--'}
                  </div>

                  {/* Role */}
                  <div className="text-[11px] text-slate-300">
                    {ROLE_LABELS[invite.role] || invite.role || 'Analyst'}
                  </div>

                  {/* Expires */}
                  <div className="text-[11px] text-slate-500 font-mono">
                    {invite.expires_at ? formatDate(invite.expires_at) : 'No expiry'}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => handleCopyCode(invite.invite_code)}
                      className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-300 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => handleRevokeInvite(invite.id)}
                      className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-rose-400 bg-rose-500/[0.08] border border-rose-500/15 hover:bg-rose-500/[0.15] transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Discount / Pilot Code */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
          Redeem Code
        </h3>
        <p className="text-[12px] text-slate-500 mb-3">
          Enter a discount or pilot code to upgrade your organization's plan.
        </p>
        <form onSubmit={handleRedeemDiscount} className="flex items-end gap-3">
          <div className="flex flex-col gap-1 flex-1 max-w-xs">
            <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
              Code
            </label>
            <input
              type="text"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              placeholder="PILOT-XXXX"
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-gold-500/30 focus:border-gold-500/20 transition-all font-mono uppercase tracking-wider"
            />
          </div>

          <button
            type="submit"
            disabled={redeemingCode || !discountCode.trim()}
            className="pill-btn px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {redeemingCode ? 'Redeeming...' : 'Redeem'}
          </button>
        </form>
      </div>

      {/* Plan Management */}
      {can('org.manage_users') && (
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-7 h-7 rounded-lg bg-gold-500/10 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold-400" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Plan Management</h3>
              <p className="text-[10px] text-slate-500">Set plan type and expiry for this organization</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Plan Type</label>
              <select
                value={planType}
                onChange={(e) => setPlanType(e.target.value)}
                className="w-full px-3.5 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all"
              >
                <option value="free">Free</option>
                <option value="pilot">Pilot</option>
                <option value="analyst">Analyst</option>
                <option value="team">Team</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Expiry Date</label>
              <input
                type="date"
                value={planExpiry}
                onChange={(e) => setPlanExpiry(e.target.value)}
                className="w-full px-3.5 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all"
              />
            </div>
          </div>

          <button
            onClick={async () => {
              if (!supabase || !orgId) return;
              setSavingPlan(true);
              const { error } = await supabase
                .from('organizations')
                .update({
                  plan: planType,
                  plan_expires_at: planExpiry ? new Date(planExpiry + 'T23:59:59Z').toISOString() : null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', orgId);
              setSavingPlan(false);
              if (error) addToast('Failed to update plan: ' + error.message, 'error');
              else addToast('Plan updated', 'success');
            }}
            disabled={savingPlan}
            className="px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-gradient-to-r from-gold-500 to-gold-600 text-white shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 disabled:opacity-50 transition-all"
          >
            {savingPlan ? 'Saving...' : 'Save Plan'}
          </button>
        </div>
      )}

      {/* Credit Policy Defaults */}
      {can('org.manage_users') && (
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-7 h-7 rounded-lg bg-gold-500/10 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold-400" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Credit Policy Defaults</h3>
              <p className="text-[10px] text-slate-500">Set your firm's standard underwriting assumptions</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Base Spread (bps)</label>
                <input
                  type="number"
                  value={orgSettings.baseSpreadBps ?? 200}
                  onChange={(e) => setOrgSettings(s => ({ ...s, baseSpreadBps: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3.5 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all"
                />
                <p className="text-[9px] text-slate-600 mt-1">Default: 200 bps for equipment, 250 for AR, 275 for inventory</p>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Strong Credit Adj (bps)</label>
                <input
                  type="number"
                  value={orgSettings.creditSpreadStrong ?? -75}
                  onChange={(e) => setOrgSettings(s => ({ ...s, creditSpreadStrong: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3.5 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Weak Credit Adj (bps)</label>
                <input
                  type="number"
                  value={orgSettings.creditSpreadWeak ?? 200}
                  onChange={(e) => setOrgSettings(s => ({ ...s, creditSpreadWeak: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3.5 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Max AR Advance Rate (%)</label>
                <input
                  type="number"
                  value={orgSettings.maxAdvanceRateAR ?? 85}
                  onChange={(e) => setOrgSettings(s => ({ ...s, maxAdvanceRateAR: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3.5 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all"
                  max="100"
                />
              </div>
            </div>

            <button
              onClick={async () => {
                if (!supabase || !orgId) return;
                setSavingSettings(true);
                const { error } = await supabase
                  .from('organizations')
                  .update({ org_settings: orgSettings, updated_at: new Date().toISOString() })
                  .eq('id', orgId);
                setSavingSettings(false);
                if (error) addToast('Failed to save settings: ' + error.message, 'error');
                else {
                  addToast('Credit policy saved', 'success');
                  try { localStorage.removeItem('efd_profile_cache'); } catch (e) { /* ignore */ }
                }
              }}
              disabled={savingSettings}
              className="px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-gradient-to-r from-gold-500 to-gold-600 text-white shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 disabled:opacity-50 transition-all"
            >
              {savingSettings ? 'Saving...' : 'Save Credit Policy'}
            </button>
          </div>
        </div>
      )}

      {/* Memo Branding Settings */}
      {can('org.manage_users') && (
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-7 h-7 rounded-lg bg-gold-500/10 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold-400" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Memo Branding</h3>
              <p className="text-[10px] text-slate-500">Customize how exported screening memos look</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Logo URL</label>
              <input
                type="url"
                value={brandingLogoUrl}
                onChange={(e) => setBrandingLogoUrl(e.target.value)}
                placeholder="https://yourfirm.com/logo.png"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-500/40 transition-all"
              />
              <p className="text-[10px] text-slate-600 mt-1">Appears in the top-right corner of exported memos. Max height: 40px.</p>
              {brandingLogoUrl && (
                <div className="mt-2 p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                  <p className="text-[9px] text-slate-600 mb-1.5">Preview:</p>
                  <img src={brandingLogoUrl} alt="Logo preview" style={{ maxHeight: 40, maxWidth: 180 }} onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandingAccentColor}
                    onChange={(e) => setBrandingAccentColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-white/[0.08] cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={brandingAccentColor}
                    onChange={(e) => setBrandingAccentColor(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Memo Title</label>
                <input
                  type="text"
                  value={brandingMemoTitle}
                  onChange={(e) => setBrandingMemoTitle(e.target.value)}
                  placeholder="e.g. Credit Screening Memo"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Footer Text</label>
              <input
                type="text"
                value={brandingFooterText}
                onChange={(e) => setBrandingFooterText(e.target.value)}
                placeholder="e.g. Confidential — Internal Use Only"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all"
              />
            </div>

            <button
              onClick={async () => {
                if (!supabase || !orgId) return;
                setSavingBranding(true);
                const { error } = await supabase
                  .from('organizations')
                  .update({
                    branding: {
                      logoUrl: brandingLogoUrl,
                      accentColor: brandingAccentColor,
                      footerText: brandingFooterText,
                      memoTitle: brandingMemoTitle,
                    },
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', orgId);
                setSavingBranding(false);
                if (error) {
                  addToast('Failed to save branding: ' + error.message, 'error');
                } else {
                  addToast('Branding saved', 'success');
                  // Clear profile cache so branding is picked up on next load
                  try { localStorage.removeItem('efd_profile_cache'); } catch (e) { /* ignore */ }
                  refreshProfile();
                }
              }}
              disabled={savingBranding}
              className="pill-btn px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-gradient-to-r from-gold-500 to-gold-600 text-white shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 hover:from-gold-400 hover:to-gold-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {savingBranding ? 'Saving...' : 'Save Branding'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
