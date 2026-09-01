// js/services/supabaseHelper.js
// Generic async helper for Supabase CRUD operations used across the app.
import { supabase } from '../../lib/supabase.js';

function ensureClient(fnName) {
  if (!supabase) {
    console.warn(`[SupabaseHelper] ${fnName}() called without client configuration.`);
    return false;
  }
  return true;
}

export async function sbFetchAll(table) {
  if (!ensureClient('sbFetchAll')) return null;
  const { data, error } = await supabase.from(table).select('*');
  if (error) {
    console.error(`[SupabaseHelper] fetchAll ${table}:`, error.message);
    return null;
  }
  return data;
}

export async function sbFetchById(table, id, column = 'id') {
  if (!ensureClient('sbFetchById')) return null;
  const { data, error } = await supabase.from(table).select('*').eq(column, id).single();
  if (error) {
    console.error(`[SupabaseHelper] fetchById ${table}.${column}=${id}:`, error.message);
    return null;
  }
  return data;
}

export async function sbInsert(table, payload) {
  if (!ensureClient('sbInsert')) return null;
  const { data, error } = await supabase.from(table).insert([payload]);
  if (error) {
    console.error(`[SupabaseHelper] insert into ${table}:`, error.message);
    return null;
  }
  return data;
}

export async function sbUpdate(table, payload, matchColumn = 'id') {
  if (!ensureClient('sbUpdate')) return null;
  const matchValue = payload ? payload[matchColumn] : null;
  if (!matchValue || String(matchValue).trim() === '') {
    console.warn(`[SupabaseHelper] sbUpdate dibatalkan: Kolom '${matchColumn}' kosong atau tidak valid pada payload.`, payload);
    return null;
  }
  const { data, error } = await supabase.from(table).update(payload).eq(matchColumn, matchValue);
  if (error) {
    console.error(`[SupabaseHelper] update ${table}:`, error.message);
    return null;
  }
  return data;
}

// Fungsi khusus untuk membaca profil pengguna murni dari tabel 'users' di Supabase
export async function sbFetchUserProfile(userIdOrEmail) {
  if (!ensureClient('sbFetchUserProfile')) return null;
  const target = userIdOrEmail && typeof userIdOrEmail === 'string' ? userIdOrEmail.trim() : '';
  if (!target) return null;

  const isEmail = target.includes('@');
  const column = isEmail ? 'email' : 'id';

  const { data, error } = await supabase.from('users').select('*').eq(column, isEmail ? target.toLowerCase() : target).maybeSingle();
  if (error) {
    console.error(`[SupabaseHelper] fetchUserProfile users.${column}=${target}:`, error.message);
    return null;
  }
  return data;
}

// Fungsi khusus untuk update profil user (termasuk region & district kecamatan) pada tabel 'users'
export async function sbUpdateUserProfile(userId, profileData) {
  if (!ensureClient('sbUpdateUserProfile')) return null;
  const validId = userId && typeof userId === 'string' ? userId.trim() : (userId ? String(userId) : '');
  if (!validId) {
    console.warn('[SupabaseHelper] sbUpdateUserProfile dibatalkan: userId kosong atau tidak valid.');
    return null;
  }

  const payload = {
    updated_at: new Date().toISOString()
  };

  if (profileData.name !== undefined) payload.name = profileData.name;
  if (profileData.storeName !== undefined || profileData.store_name !== undefined) {
    payload.store_name = profileData.storeName || profileData.store_name;
  }
  if (profileData.phone !== undefined) payload.phone = profileData.phone;
  if (profileData.region !== undefined) payload.region = profileData.region;
  if (profileData.district !== undefined) payload.district = profileData.district;
  if (profileData.bio !== undefined) payload.bio = profileData.bio;
  if (profileData.avatar !== undefined) payload.avatar = profileData.avatar;

  const { data, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', validId);

  if (error) {
    console.error('[SupabaseHelper] update user profile:', error.message);
    return null;
  }
  return data;
}

// Fungsi khusus untuk update kolom 'avatar' pada tabel users
export async function sbUpdateUserAvatar(userId, avatarUrl) {
  if (!ensureClient('sbUpdateUserAvatar')) return null;
  const validId = userId && typeof userId === 'string' ? userId.trim() : (userId ? String(userId) : '');
  if (!validId) {
    console.warn('[SupabaseHelper] sbUpdateUserAvatar dibatalkan: userId kosong atau tidak valid.');
    return null;
  }
  
  // Paksa set null jika avatarUrl kosong/null/undefined/string kosong
  const finalAvatar = (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '') ? avatarUrl.trim() : null;

  const { data, error } = await supabase
    .from('users')
    .update({ 
      avatar: finalAvatar, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', validId);

  if (error) {
    console.error('[SupabaseHelper] update user avatar:', error.message);
    return null;
  }
  return data;
}

export async function sbDelete(table, id, column = 'id') {
  if (!ensureClient('sbDelete')) return null;
  const { data, error } = await supabase.from(table).delete().eq(column, id);
  if (error) {
    console.error(`[SupabaseHelper] delete from ${table} where ${column}=${id}:`, error.message);
    return null;
  }
  return data;
}

// Convenience wrappers for common tables
export const fetchSiteSettings = () => sbFetchAll('site_settings');
export const fetchCustomTexts = () => sbFetchAll('custom_texts');
export const fetchListings = () => sbFetchAll('listings');
export const fetchFavorites = async (userId) => {
  const all = await sbFetchAll('favorites');
  return all?.filter(f => f.user_id === userId) ?? [];
};
export const fetchAppReviews = () => sbFetchAll('app_reviews');
