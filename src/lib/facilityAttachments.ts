// ============================================================
// Facility Attachments — documents for monitoring.
//
// Reuses the 'deal-documents' bucket and the storage-level helpers in
// attachments.ts (validateFile, getDownloadUrl, formatFileSize). Only the
// metadata table differs: facility_attachments, keyed by bigint facility_id
// with an optional covenant_test_id. See supabase_facility_attachments.sql.
// ============================================================

import { supabase } from './supabase';
import { isDemoMode } from './demoMode';
import { validateFile, BUCKET } from './attachments';

export interface FacilityAttachmentRow {
  id: string;
  org_id: string;
  facility_id: string;
  covenant_test_id: string | null;
  uploaded_by: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  created_at: string;
}

export async function uploadFacilityAttachment(
  file: File,
  facilityId: string,
  covenantTestId: string | null,
  userId: string,
  orgId: string,
): Promise<{ data: FacilityAttachmentRow | null; error: string | null }> {
  if (isDemoMode()) return { data: null, error: 'Documents are not available in the demo' };
  if (!supabase) return { data: null, error: 'Supabase not configured' };

  const validationError = validateFile(file);
  if (validationError) return { data: null, error: validationError };

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${orgId}/facility/${facilityId}/${timestamp}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { data: null, error: uploadError.message || 'Upload failed' };
  }

  const { data, error: insertError } = await supabase
    .from('facility_attachments')
    .insert({
      org_id: orgId,
      facility_id: facilityId,
      covenant_test_id: covenantTestId,
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

  return { data: data as FacilityAttachmentRow, error: null };
}

export async function fetchFacilityAttachments(facilityId: string): Promise<{ data: FacilityAttachmentRow[]; error: unknown }> {
  if (isDemoMode()) return { data: [], error: null };
  if (!supabase) return { data: [], error: null };

  const { data, error } = await supabase
    .from('facility_attachments')
    .select('*')
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: false });

  return { data: (data as FacilityAttachmentRow[]) || [], error };
}

export async function deleteFacilityAttachment(id: string, storagePath: string): Promise<{ error: string | null }> {
  if (isDemoMode()) return { error: 'Documents are not available in the demo' };
  if (!supabase) return { error: 'Supabase not configured' };

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (storageError) console.error('Storage delete error:', storageError);

  const { error: dbError } = await supabase.from('facility_attachments').delete().eq('id', id);
  return { error: (dbError as { message?: string } | null)?.message || null };
}
