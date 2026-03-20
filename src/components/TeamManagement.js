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
    </div>
  );
}
