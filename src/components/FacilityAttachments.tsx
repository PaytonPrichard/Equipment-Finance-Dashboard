// ============================================================
// FacilityAttachments — document list + upload for a scope.
//
// Scope is a facility (covenantTestId null) or a specific covenant test.
// The parent fetches the facility's attachments once and passes the filtered
// slice in; this component only renders and triggers upload/download/delete.
// ============================================================

import React, { useRef, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { isDemoMode } from '../lib/demoMode';
import { formatFileSize, getDownloadUrl } from '../lib/attachments';
import {
  uploadFacilityAttachment,
  deleteFacilityAttachment,
} from '../lib/facilityAttachments';
import type { FacilityAttachmentRow } from '../lib/facilityAttachments';

interface FacilityAttachmentsProps {
  facilityId: string;
  covenantTestId: string | null;
  orgId: string;
  userId: string;
  attachments: FacilityAttachmentRow[];
  onChange: () => void;
  emptyHint?: string;
}

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.csv';

export default function FacilityAttachments({
  facilityId, covenantTestId, orgId, userId, attachments, onChange, emptyHint,
}: FacilityAttachmentsProps): React.ReactElement {
  const { addToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const demo = isDemoMode();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    setBusy(true);
    const { error } = await uploadFacilityAttachment(file, facilityId, covenantTestId, userId, orgId);
    setBusy(false);
    if (error) { addToast(error, 'error'); return; }
    addToast('Document uploaded', 'success');
    onChange();
  }

  async function download(a: FacilityAttachmentRow): Promise<void> {
    const { url, error } = await getDownloadUrl(a.storage_path);
    if (error || !url) { addToast(error || 'Could not open document', 'error'); return; }
    window.open(url, '_blank', 'noopener');
  }

  async function remove(a: FacilityAttachmentRow): Promise<void> {
    const { error } = await deleteFacilityAttachment(a.id, a.storage_path);
    if (error) { addToast(error, 'error'); return; }
    onChange();
  }

  return (
    <div className="space-y-2">
      {attachments.length === 0 ? (
        <p className="text-[11px] text-gray-400">{emptyHint || 'No documents.'}</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-[11px]">
              <button
                onClick={() => download(a)}
                className="flex-1 min-w-0 text-left text-gray-700 hover:text-gold-600 truncate transition-colors"
                title={a.file_name}
              >
                {a.file_name}
              </button>
              <span className="text-gray-400 tabular-nums flex-shrink-0">{formatFileSize(a.file_size)}</span>
              <button
                onClick={() => remove(a)}
                className="text-gray-300 hover:text-rose-500 transition-colors flex-shrink-0 text-sm leading-none"
                title="Delete document"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {demo ? (
        <p className="text-[10px] text-gray-400">Document upload requires a signed-in account, not available in the demo.</p>
      ) : (
        <>
          <input ref={inputRef} type="file" onChange={onPick} className="hidden" accept={ACCEPT} />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="text-[11px] font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors"
          >
            {busy ? 'Uploading...' : '+ Attach document'}
          </button>
        </>
      )}
    </div>
  );
}
