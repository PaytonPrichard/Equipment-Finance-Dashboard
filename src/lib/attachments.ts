// ============================================================
// Document Attachments — Supabase Storage + Metadata
//
// Files are stored in a 'deal-documents' bucket.
// Metadata is stored in the 'deal_attachments' table.
// ============================================================

import { supabase } from './supabase';

export const BUCKET = 'deal-documents';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.webp', '.csv',
];

export interface AttachmentRow {
  id: string;
  deal_id: string;
  deal_type: string;
  org_id: string;
  uploaded_by: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  created_at: string;
}

const MIME_MAP: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.csv': ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.webp': ['image/webp'],
};

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 25 MB.`;
  }

  const ext = '.' + file.name.split('.').pop()!.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `File type "${ext}" is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
  }

  const allowedMimes = MIME_MAP[ext];
  if (allowedMimes && file.type && !allowedMimes.includes(file.type)) {
    return `File content doesn't match its extension (${ext}). Please verify the file.`;
  }

  return null;
}

export async function uploadAttachment(
  file: File,
  dealId: string,
  dealType: string,
  userId: string,
  orgId: string,
): Promise<{ data: AttachmentRow | null; error: string | null }> {
  if (!supabase) return { data: null, error: 'Supabase not configured' };

  const validationError = validateFile(file);
  if (validationError) return { data: null, error: validationError };

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${orgId}/${dealId}/${timestamp}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { data: null, error: uploadError.message || 'Upload failed' };
  }

  const { data, error: insertError } = await supabase
    .from('deal_attachments')
    .insert({
      deal_id: dealId,
      deal_type: dealType,
      org_id: orgId,
      uploaded_by: userId,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      storage_path: storagePath,
    })
    .select()
    .single();

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { data: null, error: insertError.message || 'Failed to save attachment record' };
  }

  return { data: data as AttachmentRow, error: null };
}

export async function fetchAttachments(dealId: string): Promise<{ data: AttachmentRow[]; error: unknown }> {
  if (!supabase) return { data: [], error: null };

  const { data, error } = await supabase
    .from('deal_attachments')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false });

  return { data: (data as AttachmentRow[]) || [], error };
}

export async function getDownloadUrl(storagePath: string): Promise<{ url: string | null; error: string | null }> {
  if (!supabase) return { url: null, error: 'Supabase not configured' };

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  return { url: data?.signedUrl || null, error: error?.message || null };
}

export async function deleteAttachment(attachmentId: string, storagePath: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured' };

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath]);

  if (storageError) {
    console.error('Storage delete error:', storageError);
  }

  const { error: dbError } = await supabase
    .from('deal_attachments')
    .delete()
    .eq('id', attachmentId);

  return { error: dbError?.message || null };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
