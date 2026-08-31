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
 * Update / increment skor minat kategori pengguna di tabel user_interests Supabase
 * @param {string} userId - UUID pengguna
 * @param {string} categoryId - ID kategori barang (contoh: 'elektronik', 'kendaraan')
 * @param {number} [scoreIncrement=1] - Poin tambahan minat
 * @returns {Promise<boolean>}
 */
export async function sbTrackUserInterest(userId, categoryId, scoreIncrement = 1) {
  if (!requireClient('sbTrackUserInterest')) return false;
  if (!userId || !categoryId || categoryId === 'all') return false;

  try {
    // 1. Cek apakah record minat untuk user_id dan category_id sudah ada
    const { data: existing, error: selectErr } = await supabase
      .from('user_interests')
      .select('id, score')
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .maybeSingle();

    if (selectErr && selectErr.code !== 'PGRST116') {
      console.warn('[SupabaseDB] trackUserInterest select error:', selectErr.message);
    }

    if (existing && existing.id) {
      // 2. Jika sudah ada, update skor minat (+scoreIncrement)
      const newScore = (Number(existing.score) || 0) + scoreIncrement;
      const { error: updateErr } = await supabase
        .from('user_interests')
        .update({
          score: newScore,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (updateErr) {
        // Fallback update by user_id & category_id
        await supabase
          .from('user_interests')
          .update({ score: newScore })
          .eq('user_id', userId)
          .eq('category_id', categoryId);
      }
      return true;
    } else {
      // 3. Jika belum ada, insert baris minat baru
      const { error: insertErr } = await supabase
        .from('user_interests')
        .insert({
          user_id: userId,
          category_id: categoryId,
          score: scoreIncrement,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertErr) {
        // Coba insert tanpa created_at / updated_at jika kolom tidak ada
        const { error: simpleInsertErr } = await supabase
          .from('user_interests')
          .insert({
            user_id: userId,
            category_id: categoryId,
            score: scoreIncrement
          });
        if (simpleInsertErr) {
          console.warn('[SupabaseDB] trackUserInterest insert error:', simpleInsertErr.message);
          return false;
        }
      }
      return true;
    }
  } catch (err) {
    console.warn('[SupabaseDB: sbTrackUserInterest Exception]', err);
    return false;
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
// NOTIFICATIONS - Broadcast Massal Fitur BU (Butuh Uang)
// ============================================================

/**
 * Kirim notifikasi broadcast massal untuk produk BU ke SELURUH pengguna aktif (tanpa limit)
 * @param {string} productId - ID produk BU
 * @param {string} categoryId - Kategori produk
 * @param {object} [productDetails] - Metadata produk (title, price, image, etc.)
 * @returns {Promise<{success: boolean, userCount: number, error?: string}>}
 */
export async function sbBroadcastBuNotification(productId, categoryId, productDetails = {}) {
  if (!requireClient('sbBroadcastBuNotification')) return { success: false, userCount: 0 };
  if (!productId) return { success: false, userCount: 0, error: 'Product ID is required' };

  try {
    // 1. Ambil SELURUH pengguna aplikasi yang aktif (tanpa limit)
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, name, email, status')
      .neq('status', 'deleted');

    if (usersErr) {
      console.warn('[SupabaseDB] get users for notification warning:', usersErr.message);
    }

    const activeUsers = Array.isArray(users) && users.length > 0 ? users : [{ id: 'all_users', name: 'Warga Solo' }];
    const title = productDetails.title ? `🔥 BUTUH UANG CEPAT: ${productDetails.title}` : '🔥 IKLAN BUTUH UANG CEPAT (BU) TERBARU!';
    const message = productDetails.message || `Ada iklan butuh uang cepat (BU) baru di Solo Raya! Cek barang dan amankan sekarang.`;
    const url = productDetails.url || `https://solosatset.vercel.app/?item=${productId}`;
    const image = productDetails.image || '/assets/img/app-logo.png?v=2.1';

    // 2. Siapkan baris notifikasi untuk seluruh pengguna
    const notifRows = activeUsers.map(u => ({
      user_id: u.id,
      title: title,
      message: message,
      body: message,
      type: 'bu_broadcast',
      category_id: categoryId || 'umum',
      product_id: productId,
      listing_id: productId,
      url: url,
      image: image,
      is_read: false,
      created_at: new Date().toISOString()
    }));

    // 3. Masukkan ke tabel notifications Supabase
    const { error: insertErr } = await supabase
      .from('notifications')
      .insert(notifRows);

    if (insertErr) {
      console.warn('[SupabaseDB] insert notifications warning:', insertErr.message);
    }

    return {
      success: true,
      userCount: activeUsers.length,
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
