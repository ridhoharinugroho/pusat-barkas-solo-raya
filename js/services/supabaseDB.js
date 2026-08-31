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

// ============================================================
// STORAGE BUCKET - Upload Foto (product-images)
// ============================================================

/**
 * Upload satu foto/gambar ke Supabase Storage bucket 'product-images'
 * @param {File|Blob|string} imageFileOrDataUrl - File, Blob, atau Data URL base64
 * @param {string} [folder='listings'] - Subfolder di dalam bucket ('listings' atau 'avatars')
 * @returns {Promise<string|null>} Public URL hasil upload atau null jika gagal
 */
export async function sbUploadImage(imageFileOrDataUrl, folder = 'listings') {
  if (!requireClient('sbUploadImage')) return null;

  try {
    let fileBody = imageFileOrDataUrl;
    let contentType = 'image/jpeg';
    let fileExt = 'jpg';

    if (typeof imageFileOrDataUrl === 'string') {
      if (imageFileOrDataUrl.startsWith('http://') || imageFileOrDataUrl.startsWith('https://')) {
        return imageFileOrDataUrl;
      }
      if (imageFileOrDataUrl.startsWith('data:')) {
        const parts = imageFileOrDataUrl.split(';base64,');
        contentType = parts[0].replace('data:', '') || 'image/jpeg';
        fileExt = contentType.split('/')[1] || 'jpg';
        const byteCharacters = atob(parts[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        fileBody = new Blob([byteArray], { type: contentType });
      } else {
        return null;
      }
    } else if (imageFileOrDataUrl instanceof File || imageFileOrDataUrl instanceof Blob) {
      contentType = imageFileOrDataUrl.type || 'image/jpeg';
      fileExt = contentType.split('/')[1] || 'jpg';
    }

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const filePath = `${folder}/${uniqueId}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(filePath, fileBody, {
        cacheControl: '3600',
        upsert: true,
        contentType: contentType
      });

    if (error) {
      console.error('[Supabase Storage] Upload error:', error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    console.log('[Supabase Storage] Upload foto berhasil ke product-images:', publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('[Supabase Storage] Upload exception:', err);
    return null;
  }
}

/**
 * Upload banyak foto ke Supabase Storage bucket 'product-images'
 * @param {Array<File|Blob|string>} imagesArray
 * @param {string} [folder='listings']
 * @returns {Promise<Array<string>>} Array URL publik
 */
export async function sbUploadMultipleImages(imagesArray, folder = 'listings') {
  if (!imagesArray || !Array.isArray(imagesArray) || imagesArray.length === 0) {
    return [];
  }

  const uploadPromises = imagesArray.map(async (img) => {
    if (typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://'))) {
      return img;
    }
    const uploadedUrl = await sbUploadImage(img, folder);
    return uploadedUrl || (typeof img === 'string' ? img : '');
  });

  const results = await Promise.all(uploadPromises);
  return results.filter(url => url && url.length > 0);
}

/** Simpan listing baru */
export async function sbSaveListing(listing) {
  if (!requireClient('sbSaveListing')) return null;

  let payload = { ...listing };
  if (payload.images && Array.isArray(payload.images) && payload.images.some(img => typeof img === 'string' && img.startsWith('data:'))) {
    const uploadedUrls = await sbUploadMultipleImages(payload.images, 'listings');
    if (uploadedUrls && uploadedUrls.length > 0) {
      payload.images = uploadedUrls;
    }
  }

  const { data, error } = await supabase
    .from('listings')
    .insert([payload])
    .select()
    .single();
  if (error) { console.error('[SupabaseDB] saveListing:', error.message); return null; }
  return data;
}

/** Update listing yang sudah ada */
export async function sbUpdateListing(id, updates) {
  if (!requireClient('sbUpdateListing')) return null;

  let payload = { ...updates };
  if (payload.images && Array.isArray(payload.images) && payload.images.some(img => typeof img === 'string' && img.startsWith('data:'))) {
    const uploadedUrls = await sbUploadMultipleImages(payload.images, 'listings');
    if (uploadedUrls && uploadedUrls.length > 0) {
      payload.images = uploadedUrls;
    }
  }

  const { data, error } = await supabase
    .from('listings')
    .update({ ...payload, updated_at: new Date().toISOString() })
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
    .select('*');
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
  console.log('[SupabaseDB] Mengirim payload ulasan ke tabel seller_reviews Supabase:', review);
  try {
    const { data, error } = await supabase
      .from('seller_reviews')
      .insert([review])
      .select()
      .single();
    if (error) {
      console.error('[SupabaseDB Error] Gagal menyimpan ulasan ke tabel seller_reviews:', error.message || error, error);
      return null;
    }
    console.log('[SupabaseDB Success] Ulasan berhasil disimpan ke Supabase:', data);
    return data;
  } catch (err) {
    console.error('[SupabaseDB Exception] Kendala koneksi/eksekusi saat insert ulasan ke Supabase:', err);
    return null;
  }
}

/** Hapus ulasan */
export async function sbDeleteSellerReview(reviewId) {
  if (!requireClient('sbDeleteSellerReview')) return false;
  const { error } = await supabase.from('seller_reviews').delete().eq('id', reviewId);
  if (error) { console.error('[SupabaseDB] deleteSellerReview:', error.message); return false; }
  return true;
}

// ============================================================
// APP REVIEWS (ULASAN APLIKASI / KOMUNITAS)
// ============================================================

/** Ambil seluruh ulasan aplikasi dari Supabase */
export async function sbGetAppReviews() {
  if (!requireClient('sbGetAppReviews')) return null;
  try {
    const { data, error } = await supabase
      .from('app_reviews')
      .select('id, user_id, user_name, user_location, rating, category, review_text, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[SupabaseDB] getAppReviews notice:', error.message);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

/** Tambahkan ulasan aplikasi baru ke tabel app_reviews */
export async function sbAddAppReview(review) {
  if (!requireClient('sbAddAppReview')) return null;
  console.log('[SupabaseDB] Mengirim ulasan aplikasi ke tabel app_reviews Supabase:', review);
  try {
    const { data, error } = await supabase
      .from('app_reviews')
      .insert([review])
      .select()
      .single();
    if (error) {
      console.error('[SupabaseDB Error] Gagal insert ke tabel app_reviews:', error.message || error, error);
      return null;
    }
    console.log('[SupabaseDB Success] Ulasan aplikasi berhasil disimpan:', data);
    return data;
  } catch (err) {
    console.error('[SupabaseDB Exception] Kendala koneksi saat insert ke app_reviews:', err);
    return null;
  }
}

/** Hapus ulasan aplikasi */
export async function sbDeleteAppReview(reviewId) {
  if (!requireClient('sbDeleteAppReview')) return false;
  try {
    const { error } = await supabase.from('app_reviews').delete().eq('id', reviewId);
    if (error) { console.error('[SupabaseDB] deleteAppReview error:', error.message); return false; }
    return true;
  } catch (e) {
    return false;
  }
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

// ============================================================
// USER INTERESTS - Tracking Minat Pengguna & Rekomendasi
// ============================================================

/**
 * Update / increment skor minat kategori pengguna di tabel user_interests Supabase menggunakan .upsert()
 * @param {string} userId - UUID pengguna
 * @param {string} categoryId - ID kategori barang (contoh: 'elektronik', 'kendaraan')
 * @param {number} [scoreIncrement=1] - Poin tambahan minat
 * @returns {Promise<{success: boolean, score: number, error?: string}>}
 */
export async function sbTrackUserInterest(userId, categoryId, scoreIncrement = 1) {
  if (!requireClient('sbTrackUserInterest')) return { success: false, score: 0, error: 'Client not ready' };
  if (!userId || !categoryId || categoryId === 'all') {
    console.warn('[sbTrackUserInterest] Parameter tidak valid:', { userId, categoryId });
    return { success: false, score: 0, error: 'Invalid parameters' };
  }

  const cleanCatId = String(categoryId).toLowerCase().trim();
  console.log(`[sbTrackUserInterest] 🔄 Memproses minat: User=${userId}, Kategori=${cleanCatId}, Nilai Tambah=+${scoreIncrement}`);

  try {
    // 1. Cek apakah record minat untuk user_id dan category_id sudah ada
    let currentScore = 0;
    let existingId = null;

    const { data: existing, error: selectErr } = await supabase
      .from('user_interests')
      .select('id, score')
      .eq('user_id', userId)
      .eq('category_id', cleanCatId)
      .maybeSingle();

    if (selectErr && selectErr.code !== 'PGRST116') {
      console.warn('[sbTrackUserInterest] Info select record:', selectErr.message);
    }

    if (existing && existing.score !== undefined) {
      currentScore = Number(existing.score) || 0;
      existingId = existing.id;
    }

    const nextScore = currentScore + (Number(scoreIncrement) || 1);
    const nowIso = new Date().toISOString();

    const upsertPayload = {
      user_id: userId,
      category_id: cleanCatId,
      score: nextScore,
      updated_at: nowIso
    };

    if (existingId) {
      upsertPayload.id = existingId;
    }

    // 2. Eksekusi metode .upsert() ke tabel user_interests Supabase
    const { data: upsertData, error: upsertErr } = await supabase
      .from('user_interests')
      .upsert([upsertPayload], { onConflict: 'user_id,category_id' })
      .select();

    if (upsertErr) {
      console.warn('[sbTrackUserInterest] Upsert onConflict notice, mencoba fallback update/insert:', upsertErr.message);
      
      if (existingId) {
        const { error: updErr } = await supabase
          .from('user_interests')
          .update({ score: nextScore, updated_at: nowIso })
          .eq('id', existingId);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('user_interests')
          .insert([{ user_id: userId, category_id: cleanCatId, score: nextScore, created_at: nowIso, updated_at: nowIso }]);
        if (insErr) throw insErr;
      }
    }

    console.log(`✅ [sbTrackUserInterest SUKSES] User: ${userId} -> Kategori: "${cleanCatId}" (Skor Kumulatif: ${nextScore})`);
    return { success: true, score: nextScore };
  } catch (err) {
    console.error(`❌ [sbTrackUserInterest GAGAL] Gagal menyimpan data minat:`, {
      userId,
      categoryId: cleanCatId,
      error: err.message || err
    });

    // Fallback sync via Serverless endpoint jika browser RLS policy membatasi
    try {
      fetch('/api/track-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, categoryId: cleanCatId, scoreIncrement })
      }).catch(() => {});
    } catch (e) {}

    return { success: false, score: 0, error: err.message };
  }
}

/**
 * Ambil daftar minat kategori pengguna dari Supabase
 * @param {string} userId - UUID pengguna
 * @returns {Promise<Array|null>}
 */
export async function sbGetUserInterests(userId) {
  if (!requireClient('sbGetUserInterests')) return null;
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_interests')
      .select('*')
      .eq('user_id', userId)
      .order('score', { ascending: false });
    if (error) {
      console.warn('[SupabaseDB] getUserInterests error:', error.message);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

// ============================================================
// NOTIFICATIONS - Broadcast Tertarget Fitur BU Berdasarkan Minat Pengguna (user_interests)
// ============================================================

/**
 * Kirim notifikasi BU tertarget HANYA ke pengguna yang memiliki minat (category_id yang cocok)
 * di tabel user_interests tanpa batasan limit.
 * @param {string} productId - ID produk BU
 * @param {string} categoryId - Kategori produk
 * @param {object} [productDetails] - Metadata produk (title, price, image, etc.)
 * @returns {Promise<{success: boolean, userCount: number, error?: string, message?: string}>}
 */
export async function sbBroadcastBuNotification(productId, categoryId, productDetails = {}) {
  if (!requireClient('sbBroadcastBuNotification')) return { success: false, userCount: 0 };
  if (!productId) return { success: false, userCount: 0, error: 'Product ID is required' };

  const cleanCatId = String(categoryId || 'umum').toLowerCase().trim();

  try {
    // 1. Ambil SELURUH pengguna yang memiliki riwayat minat pada category_id ini (tanpa limit)
    const { data: interestedRows, error: interestErr } = await supabase
      .from('user_interests')
      .select('user_id, category_id, score')
      .eq('category_id', cleanCatId);

    if (interestErr) {
      console.warn('[SupabaseDB: user_interests Query Warning]', interestErr.message);
    }

    // 2. Ekstrak user_id unik yang memiliki minat pada kategori ini
    const uniqueUserIds = new Set();
    if (Array.isArray(interestedRows) && interestedRows.length > 0) {
      interestedRows.forEach(row => {
        if (row && row.user_id && (Number(row.score) > 0 || row.score === null || row.score === undefined)) {
          uniqueUserIds.add(String(row.user_id));
        }
      });
    }

    const targetUserIds = Array.from(uniqueUserIds);
    console.log(`[BU Notification] Ditemukan ${targetUserIds.length} pengguna dengan minat kategori "${cleanCatId}".`);

    if (targetUserIds.length === 0) {
      return {
        success: true,
        userCount: 0,
        message: `Tidak ada pengguna dengan catatan minat kategori "${cleanCatId}".`
      };
    }

    const title = productDetails.title ? `🔥 BUTUH UANG CEPAT: ${productDetails.title}` : '🔥 IKLAN BUTUH UANG CEPAT (BU) TERBARU!';
    const message = productDetails.message || `Ada iklan butuh uang cepat (BU) untuk kategori ${cleanCatId} yang Anda minati! Cek sekarang sebelum keduluan.`;
    const url = productDetails.url || `https://solosatset.vercel.app/?item=${productId}`;
    const image = productDetails.image || '/assets/img/app-logo.png?v=2.1';

    // 3. Siapkan baris notifikasi untuk SELURUH pengguna yang berminat (tanpa limit)
    const notifRows = targetUserIds.map(uid => ({
      user_id: uid,
      title: title,
      message: message,
      body: message,
      type: 'bu_interest',
      category_id: cleanCatId,
      product_id: productId,
      listing_id: productId,
      url: url,
      image: image,
      is_read: false,
      created_at: new Date().toISOString()
    }));

    // 4. Masukkan ke tabel notifications Supabase
    const { error: insertErr } = await supabase
      .from('notifications')
      .insert(notifRows);

    if (insertErr) {
      console.warn('[SupabaseDB] insert notifications warning:', insertErr.message);
    }

    return {
      success: true,
      userCount: targetUserIds.length,
      targetUserIds,
      title,
      message
    };
  } catch (err) {
    console.error('[SupabaseDB: sbBroadcastBuNotification Error]', err);
    return { success: false, userCount: 0, error: err.message };
  }
}

/**
 * Ambil daftar notifikasi untuk pengguna tertentu
 * @param {string} userId - ID Pengguna
 * @returns {Promise<Array>}
 */
export async function sbGetNotifications(userId) {
  if (!requireClient('sbGetNotifications')) return [];
  try {
    let query = supabase.from('notifications').select('*').order('created_at', { ascending: false });
    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.eq.all_users`);
    }
    const { data, error } = await query.limit(50);
    if (error) return [];
    return data || [];
  } catch (e) {
    return [];
  }
}
