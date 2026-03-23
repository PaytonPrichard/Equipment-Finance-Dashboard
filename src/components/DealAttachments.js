import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  uploadAttachment,
  fetchAttachments,
  getDownloadUrl,
  deleteAttachment,
  formatFileSize,
  validateFile,
} from '../lib/attachments';

const FILE_ICONS = {
  'application/pdf': { color: 'text-rose-400', label: 'PDF' },
  'application/msword': { color: 'text-blue-400', label: 'DOC' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { color: 'text-blue-400', label: 'DOCX' },
  'application/vnd.ms-excel': { color: 'text-emerald-400', label: 'XLS' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { color: 'text-emerald-400', label: 'XLSX' },
  'text/csv': { color: 'text-emerald-400', label: 'CSV' },
  'image/png': { color: 'text-amber-400', label: 'PNG' },
  'image/jpeg': { color: 'text-amber-400', label: 'JPG' },
  'image/webp': { color: 'text-amber-400', label: 'WEBP' },
};

function getFileIcon(mimeType) {
  return FILE_ICONS[mimeType] || { color: 'text-gray-500', label: 'FILE' };
}

export default function DealAttachments({ dealId, dealType }) {
  const { user, profile } = useAuth();
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!dealId) return;
    fetchAttachments(dealId).then(({ data }) => {
      setAttachments(data || []);
    });
  }, [dealId]);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setError(null);
    setUploading(true);

    for (const file of files) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        continue;
      }

      const { data, error: uploadError } = await uploadAttachment(
        file, dealId, dealType || 'pipeline', user.id, profile.org_id
      );

      if (uploadError) {
        setError(typeof uploadError === 'string' ? uploadError : 'Upload failed');
      } else if (data) {
        setAttachments(prev => [data, ...prev]);
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async (attachment) => {
    const { url, error: dlError } = await getDownloadUrl(attachment.storage_path);
    if (dlError) {
      setError(dlError);
      return;
    }
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleDelete = async (attachment) => {
    if (!window.confirm(`Delete "${attachment.file_name}"?`)) return;
    const { error: delError } = await deleteAttachment(attachment.id, attachment.storage_path);
    if (delError) {
      setError(delError);
      return;
    }
    setAttachments(prev => prev.filter(a => a.id !== attachment.id));
  };

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          Documents ({attachments.length})
        </span>
        <label className="cursor-pointer">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp"
            onChange={handleUpload}
            className="hidden"
          />
          <span className="text-[10px] font-medium text-gray-600 hover:text-gray-700 transition-colors flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {uploading ? 'Uploading...' : 'Attach'}
          </span>
        </label>
      </div>

      {error && (
        <div className="text-[10px] text-rose-400 mb-2 bg-rose-500/[0.06] border border-rose-500/15 rounded-lg px-2.5 py-1.5">
          {error}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map(att => {
            const icon = getFileIcon(att.file_type);
            return (
              <div
                key={att.id}
                className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5 group hover:bg-gray-50 transition-colors"
              >
                <span className={`text-[9px] font-bold ${icon.color} bg-gray-50 px-1.5 py-0.5 rounded`}>
                  {icon.label}
                </span>
                <button
                  onClick={() => handleDownload(att)}
                  className="text-[11px] text-gray-700 hover:text-gray-600 truncate flex-1 text-left transition-colors"
                  title={att.file_name}
                >
                  {att.file_name}
                </button>
                <span className="text-[9px] text-gray-400 flex-shrink-0">
                  {formatFileSize(att.file_size)}
                </span>
                {(att.uploaded_by === user?.id || profile?.role === 'admin') && (
                  <button
                    onClick={() => handleDelete(att)}
                    className="text-gray-300 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    title="Delete"
                    aria-label="Delete attachment"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {attachments.length === 0 && !uploading && (
        <p className="text-[10px] text-gray-400 italic">No documents attached</p>
      )}
    </div>
  );
}
