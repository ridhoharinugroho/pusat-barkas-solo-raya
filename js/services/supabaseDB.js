/**
 * solosatset - Supabase Database Service
 * CRUD + Realtime untuk semua data utama aplikasi:
 * - listings (iklan barang)
 * - users (akun penjual)
 * - site_settings (pengaturan tampilan)
 * - custom_texts (teks branding)
 * - seller_reviews (ulasan penjual)
 *
 * Tabel-tabel ini perlu dibuat di Supabase SQL Editor.
 * Lihat schema di bawah atau jalankan: db/supabase_schema.sql
 */

import { supabase } from '../lib/supabase.js';

// Guard: jika Supabase belum dikonfigurasi, semua fungsi akan no-op
function requireClient(fnName) {
  if (!supabase) {
    console.warn(`[SupabaseDB] ${fnName}() dilewati - client belum terkonfigurasi.`);
    return false;
  }
  return true;
}

// ============================================================
// LISTINGS - Iklan Barang
// ============================================================

/** Ambil semua listing publik (status = active) */
export async function sbGetPublicListings() {
  if (!requireClient('sbGetPublicListings')) return null;
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) { console.error('[SupabaseDB] getPublicListings:', error.message); return null; }
  return data;
}

/** Ambil satu listing berdasarkan ID */
export async function sbGetListingById(id) {
  if (!requireClient('sbGetListingById')) return null;
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .single();
  if (error) { console.error('[SupabaseDB] getListingById:', error.message); return null; }
  return data;
}

/** Simpan listing baru */
export async function sbSaveListing(listing) {
  if (!requireClient('sbSaveListing')) return null;
  const { data, error } = await supabase
    .from('listings')
    .insert([listing])
    .select()
    .single();
  if (error) { console.error('[SupabaseDB] saveListing:', error.message); return null; }
  return data;
}

/** Update listing yang sudah ada */
export async function sbUpdateListing(id, updates) {
  if (!requireClient('sbUpdateListing')) return null;
  const { data, error } = await supabase
    .from('listings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('[SupabaseDB] updateListing:', error.message); return null; }
  return data;
}

/** Hapus listing */
export async function sbDeleteListing(id) {
  if (!requireClient('sbDeleteListing')) return false;
  const { error } = await supabase.from('listings').delete().eq('id', id);
  if (error) { console.error('[SupabaseDB] deleteListing:', error.message); return false; }
  return true;
}

/** Increment view count listing */
export async function sbIncrementViews(id) {
  if (!requireClient('sbIncrementViews')) return;
  await supabase.rpc('increment_listing_views', { listing_id: id }).catch(() => {});
}

/** Ambil listing milik satu seller */
export async function sbGetMyListings(sellerId) {
  if (!requireClient('sbGetMyListings')) return null;
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  if (error) { console.error('[SupabaseDB] getMyListings:', error.message); return null; }
  return data;
}

// ============================================================
// USERS - Akun Penjual
// ============================================================

/** Ambil semua user terdaftar */
export async function sbGetAllUsers() {
  if (!requireClient('sbGetAllUsers')) return null;
  const { data, error } = await supabase
    .from('users')
    .select('id,name,store_name,display_name,username,email,phone,region,district,avatar,bio,created_at,is_demo');
  if (error) { console.error('[SupabaseDB] getAllUsers:', error.message); return null; }
  return data;
}

/** Ambil satu user berdasarkan ID */
export async function sbGetUserById(id) {
  if (!requireClient('sbGetUserById')) return null;
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  if (error) { console.error('[SupabaseDB] getUserById:', error.message); return null; }
  return data;
}

/** Simpan user baru (registrasi) */
export async function sbRegisterUser(user) {
  if (!requireClient('sbRegisterUser')) return null;
  const { data, error } = await supabase
    .from('users')
    .insert([user])
    .select()
    .single();
  if (error) { console.error('[SupabaseDB] registerUser:', error.message); return null; }
  return data;
}

/** Update profil user berdasarkan ID atau Email */
export async function sbUpdateUser(idOrEmail, updates) {
  if (!requireClient('sbUpdateUser')) return null;
  let query = supabase.from('users').update(updates);
  if (typeof idOrEmail === 'string' && idOrEmail.includes('@')) {
    query = query.eq('email', idOrEmail.toLowerCase().trim());
  } else {
    query = query.eq('id', idOrEmail);
  }
  const { data, error } = await query.select().single();
  if (error) { console.error('[SupabaseDB] updateUser:', error.message); return null; }
  return data;
}

// ============================================================
// SITE SETTINGS - Pengaturan Tampilan Admin
// ============================================================

/** Ambil site settings */
export async function sbGetSiteSettings() {
  if (!requireClient('sbGetSiteSettings')) return null;
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 'global')
    .single();
  if (error) { console.error('[SupabaseDB] getSiteSettings:', error.message); return null; }
  return data?.settings || null;
}

/** Simpan/update site settings */
export async function sbSaveSiteSettings(settings) {
  if (!requireClient('sbSaveSiteSettings')) return false;
  const payload = {
    id: 'global',
    settings: { ...settings, updatedAt: new Date().toISOString() },
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase
    .from('site_settings')
    .upsert([payload], { onConflict: 'id' });
  if (error) { console.error('[SupabaseDB] saveSiteSettings:', error.message); return false; }
  return true;
}

// ============================================================
// CUSTOM TEXTS - Teks Branding
// ============================================================

/** Ambil custom texts */
export async function sbGetCustomTexts() {
  if (!requireClient('sbGetCustomTexts')) return null;
  const { data, error } = await supabase
    .from('custom_texts')
    .select('*')
    .eq('id', 'global')
    .single();
  if (error) { console.error('[SupabaseDB] getCustomTexts:', error.message); return null; }
  return data?.texts || null;
}

/** Simpan/update custom texts */
export async function sbSaveCustomTexts(texts) {
  if (!requireClient('sbSaveCustomTexts')) return false;
  const payload = {
    id: 'global',
    texts: { ...texts, updatedAt: new Date().toISOString() },
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase
    .from('custom_texts')
    .upsert([payload], { onConflict: 'id' });
  if (error) { console.error('[SupabaseDB] saveCustomTexts:', error.message); return false; }
  return true;
}

// ============================================================
// SELLER REVIEWS - Ulasan Penjual
// ============================================================

/** Ambil ulasan berdasarkan seller ID */
export async function sbGetSellerReviews(sellerId) {
  if (!requireClient('sbGetSellerReviews')) return null;
  const { data, error } = await supabase
    .from('seller_reviews')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  if (error) { console.error('[SupabaseDB] getSellerReviews:', error.message); return null; }
  return data;
}

/** Tambahkan ulasan baru */
export async function sbAddSellerReview(review) {
  if (!requireClient('sbAddSellerReview')) return null;
  const { data, error } = await supabase
    .from('seller_reviews')
    .insert([review])
    .select()
    .single();
  if (error) { console.error('[SupabaseDB] addSellerReview:', error.message); return null; }
  return data;
}

/** Hapus ulasan */
export async function sbDeleteSellerReview(reviewId) {
  if (!requireClient('sbDeleteSellerReview')) return false;
  const { error } = await supabase.from('seller_reviews').delete().eq('id', reviewId);
  if (error) { console.error('[SupabaseDB] deleteSellerReview:', error.message); return false; }
  return true;
}

// ============================================================
// REALTIME SUBSCRIPTIONS - Live Data Sync
// ============================================================

/**
 * Subscribe ke perubahan listings secara realtime
 * @param {function} onInsert - Callback saat listing baru ditambah
 * @param {function} onUpdate - Callback saat listing diupdate
 * @param {function} onDelete - Callback saat listing dihapus
 * @returns {object} channel - Panggil .unsubscribe() untuk berhenti
 */
export function sbSubscribeListings(onInsert, onUpdate, onDelete) {
  if (!requireClient('sbSubscribeListings')) return null;
  const channel = supabase
    .channel('realtime-listings')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'listings' }, (payload) => {
      if (onInsert) onInsert(payload.new);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'listings' }, (payload) => {
      if (onUpdate) onUpdate(payload.new, payload.old);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'listings' }, (payload) => {
      if (onDelete) onDelete(payload.old);
    })
    .subscribe((status) => {
      console.log('[Supabase Realtime] listings channel:', status);
    });
  return channel;
}

/**
 * Subscribe ke perubahan site_settings secara realtime
 * @param {function} onChange - Callback saat settings berubah
 * @returns {object} channel
 */
export function sbSubscribeSettings(onChange) {
  if (!requireClient('sbSubscribeSettings')) return null;
  const channel = supabase
    .channel('realtime-settings')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings', filter: 'id=eq.global' }, (payload) => {
      if (onChange && payload.new?.settings) onChange(payload.new.settings);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_texts', filter: 'id=eq.global' }, (payload) => {
      // Gunakan event 'siteTextsChanged' agar storage.js bisa menangkapnya
      if (payload.new?.texts) {
        window.dispatchEvent(new CustomEvent('siteTextsChanged', { detail: payload.new.texts }));
      }
    })
    .subscribe((status) => {
      console.log('[Supabase Realtime] settings channel:', status);
    });
  return channel;
}
