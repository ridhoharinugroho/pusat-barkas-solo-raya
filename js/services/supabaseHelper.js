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
  const matchValue = payload[matchColumn];
  if (!matchValue) {
    return null;
  }
  const { data, error } = await supabase.from(table).update(payload).eq(matchColumn, matchValue);
  if (error) {
    console.error(`[SupabaseHelper] update ${table}:`, error.message);
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
