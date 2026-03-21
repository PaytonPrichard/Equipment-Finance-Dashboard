// ============================================================
// Document Attachments — Supabase Storage + Metadata
//
// Files are stored in a 'deal-documents' bucket.
// Metadata is stored in the 'deal_attachments' table.
//
// Setup required:
//   1. Create 'deal-documents' storage bucket in Supabase
//   2. Run the deal_attachments migration (see supabase_attachments.sql)
//   3. Set RLS policies on the bucket and table
// ============================================================

import { supabase } from './supabase';

const BUCKET = 'deal-documents';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/csv',
];

const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.webp', '.csv',
];

/**
 * Validate a file before upload.
 */
export function validateFile(file) {
  if (file.size > MAX_FILE_SIZE) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 25 MB.`;
  }

  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `File type "${ext}" is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
  }

  return null;
}

/**
 * Upload a document and create a metadata record.
 *
 * @param {File} file — the file to upload
 * @param {string} dealId — pipeline_deal ID
 * @param {string} dealType — 'pipeline' or 'saved'
 * @param {string} userId — current user ID
 * @param {string} orgId — current org ID
 * @returns {{ data, error }}
 */
export async function uploadAttachment(file, dealId, dealType, userId, orgId) {
  if (!supabase) return { data: null, error: 'Supabase not configured' };

  const validationError = validateFile(file);
  if (validationError) return { data: null, error: validationError };

  // Generate a unique storage path: org/deal/timestamp_filename
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${orgId}/${dealId}/${timestamp}_${safeName}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return { data: null, error: uploadError.message || 'Upload failed' };
  }

  // Create metadata record
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
    // Clean up the uploaded file if metadata insert fails
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { data: null, error: insertError.message || 'Failed to save attachment record' };
  }

  return { data, error: null };
}

/**
 * Fetch all attachments for a deal.
 */
export async function fetchAttachments(dealId) {
  if (!supabase) return { data: [], error: null };

  const { data, error } = await supabase
    .from('deal_attachments')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}

/**
 * Get a temporary download URL for an attachment.
 */
export async function getDownloadUrl(storagePath) {
  if (!supabase) return { url: null, error: 'Supabase not configured' };

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  return { url: data?.signedUrl || null, error: error?.message || null };
}

/**
 * Delete an attachment (storage file + metadata record).
 */
export async function deleteAttachment(attachmentId, storagePath) {
  if (!supabase) return { error: 'Supabase not configured' };

  // Delete storage file
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (storageError) {
    console.error('Storage delete error:', storageError);
  }

  // Delete metadata record
  const { error: dbError } = await supabase
    .from('deal_attachments')
    .delete()
    .eq('id', attachmentId);

  return { error: dbError?.message || null };
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
