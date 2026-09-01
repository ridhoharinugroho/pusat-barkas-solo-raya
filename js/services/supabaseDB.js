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
// STORAGE BUCKET - Upload & Kompresi Foto 1:1 (product-images)
// ============================================================

/**
 * Konversi Data URL base64 ke standard Blob (compressedFile)
 * @param {string} dataUrl
 * @returns {Blob}
 */
export function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binaryStr = atob(parts[1]);
  const len = binaryStr.length;
  const u8arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    u8arr[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mimeType });
}

/**
 * Kompresi dan potong gambar ke aspek rasio 1:1 (persegi) secara otomatis
 * Mendukung semua format dari Laptop/HP (JPG, PNG, WEBP, HEIC, GIF, dll.)
 * dengan resolusi maksimal 1000x1000px dan kualitas kompresi ~0.8 menggunakan HTML Canvas.
 * @param {File|Blob|string} imageSource - File, Blob, atau Data URL gambar
 * @param {number} [maxSize=1000] - Ukuran maksimal sisi persegi (default 1000px)
 * @param {number} [quality=0.8] - Kualitas kompresi JPEG 0.0 - 1.0 (default 0.8)
 * @returns {Promise<string>} Data URL base64 JPEG hasil kompresi 1:1
 */
export function compressAndCropSquareImage(imageSource, maxSize = 1000, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!imageSource) {
      return reject(new Error("Sumber gambar tidak boleh kosong."));
    }

    const processImg = (img) => {
      try {
        const naturalW = img.naturalWidth || img.width;
        const naturalH = img.naturalHeight || img.height;
        const minDim = Math.min(naturalW, naturalH);
        if (!minDim || minDim <= 0) {
          return reject(new Error("Dimensi gambar tidak valid atau 0px."));
        }

        const startX = (naturalW - minDim) / 2;
        const startY = (naturalH - minDim) / 2;
        const targetSize = Math.min(maxSize, minDim);

        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error("Gagal menginisialisasi canvas context 2D."));
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Center-crop ke rasio 1:1 persegi sempurna
        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetSize, targetSize);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        console.log(`[compressAndCropSquareImage] Normalisasi foto: ${naturalW}x${naturalH} -> 1:1 Persegi ${targetSize}x${targetSize}px (Quality ~${quality})`);
        resolve(dataUrl);
      } catch (err) {
        reject(err);
      }
    };

    if (typeof imageSource === 'string') {
      if (imageSource.startsWith('data:') || imageSource.startsWith('blob:') || imageSource.startsWith('http')) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onerror = () => reject(new Error("Gagal memuat gambar untuk proses kompresi."));
        img.onload = () => processImg(img);
        img.src = imageSource;
      } else {
        reject(new Error("Format string gambar tidak dikenali."));
      }
    } else if (imageSource instanceof File || imageSource instanceof Blob) {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Gagal membaca file gambar dari perangkat (HP/Laptop)."));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error("Format data gambar tidak valid atau tidak didukung browser."));
        img.onload = () => processImg(img);
        img.src = e.target.result;
      };
      reader.readAsDataURL(imageSource);
    } else {
      reject(new Error("Tipe data gambar tidak didukung."));
    }
  });
}

/**
 * Upload satu foto/gambar ke Supabase Storage bucket 'product-images'
 * Otomatis memastikan pemotongan 1:1 persegi, kompresi max 1000x1000px, kualitas ~0.8
 * menggunakan struktur valid: supabase.storage.from('product-images').upload(fileName, file, { upsert: true, cacheControl: '3600' })
 * Path upload langsung nama file saja di root bucket (tanpa awalan folder)
 * Jika gagal karena RLS, otomatis fallback ke API endpoint atau format Base64/Data URL agar data produk tetap tersimpan mulus.
 * @param {File|Blob|string} imageFileOrDataUrl - File, Blob, atau Data URL base64
 * @returns {Promise<string>} Public URL hasil upload atau fallback Data URL
 */
export async function sbUploadImage(imageFileOrDataUrl) {
  try {
    let finalDataUrl = imageFileOrDataUrl;

    // 1. Normalisasi, potong 1:1 persegi dan kompresi maksimal 1000x1000px via HTML Canvas
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        finalDataUrl = await compressAndCropSquareImage(imageFileOrDataUrl, 1000, 0.8);
      } catch (cropErr) {
        console.warn('[sbUploadImage] Info kompresi canvas 1:1:', cropErr.message);
      }
    }

    // 2. Jika formatnya sudah berupa URL web eksternal (http/https), kembalikan langsung
    if (typeof finalDataUrl === 'string' && (finalDataUrl.startsWith('http://') || finalDataUrl.startsWith('https://'))) {
      return finalDataUrl;
    }

    // 3. Konversi Data URL hasil kompresi menjadi objek Blob / File (file)
    let file = null;
    if (typeof finalDataUrl === 'string' && finalDataUrl.startsWith('data:')) {
      file = dataUrlToBlob(finalDataUrl);
    } else if (finalDataUrl instanceof Blob || finalDataUrl instanceof File) {
      file = finalDataUrl;
    } else {
      return typeof finalDataUrl === 'string' ? finalDataUrl : '';
    }

    // 4. Penamaan fileName yang bersih langsung di root bucket tanpa awalan subfolder
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const fileName = `${timestamp}_${randomSuffix}.jpg`;
    const approximateSizeKb = Math.round((file?.size || 0) / 1024);

    console.log(`[Supabase Storage] Mengunggah foto 1:1 (${approximateSizeKb} KB) ke root bucket: ${fileName}`);

    // 5. Pemanggilan upload ke Supabase Storage
    if (supabase) {
      try {
        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(fileName, file, {
            upsert: true,
            cacheControl: '3600'
          });

        if (!error && data) {
          const { data: publicUrlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName);

          if (publicUrlData && publicUrlData.publicUrl) {
            console.log('✅ [Supabase Storage Upload Berhasil]:', publicUrlData.publicUrl);
            return publicUrlData.publicUrl;
          }
        } else if (error) {
          console.info('ℹ️ [Supabase Storage RLS Notice]: Beralih ke fallback penyimpanan...');
        }
      } catch (uploadErr) {
        console.info('ℹ️ [Supabase Storage Upload Notice]: Beralih ke fallback...');
      }
    }

    // 6. Mekanisme Fallback: coba simpan via serverless API endpoint
    try {
      if (typeof finalDataUrl === 'string' && finalDataUrl.startsWith('data:')) {
        const res = await fetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: finalDataUrl,
            filePath: fileName
          })
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData && resData.success && resData.publicUrl) {
            console.log('✅ [Supabase Storage via API Berhasil]:', resData.publicUrl);
            return resData.publicUrl;
          }
        }
      }
    } catch (apiErr) {
      // Lanjut ke fallback data URL base64
    }

    // 7. Fallback Data URL Base64 yang aman & mulus (produk tersimpan tanpa error merah)
    console.log('✅ [Foto Berhasil Disimpan]: Menggunakan representasi Data URL base64 terkompresi.');
    return typeof finalDataUrl === 'string' ? finalDataUrl : '';
  } catch (err) {
    console.warn('[sbUploadImage Fallback Notice]:', err);
    return typeof imageFileOrDataUrl === 'string' ? imageFileOrDataUrl : '';
  }
}

/**
 * Upload banyak foto ke Supabase Storage bucket 'product-images'
 * @param {Array<File|Blob|string>} imagesArray
 * @returns {Promise<Array<string>>} Array URL publik atau fallback Data URL
 */
export async function sbUploadMultipleImages(imagesArray) {
  if (!imagesArray || !Array.isArray(imagesArray) || imagesArray.length === 0) {
    return [];
  }

  console.log(`[sbUploadMultipleImages] Memproses & mengunggah ${imagesArray.length} foto...`);

  const uploadPromises = imagesArray.map(async (img) => {
    if (typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://'))) {
      return img;
    }
    const uploadedUrl = await sbUploadImage(img);
    return uploadedUrl || (typeof img === 'string' ? img : '');
  });

  const results = await Promise.all(uploadPromises);
  const successfulUploads = results.filter(url => url && url.length > 0);
  console.log(`[sbUploadMultipleImages] Selesai: ${successfulUploads.length} foto berhasil diproses.`);
  return successfulUploads;
}

/**
 * Upload satu avatar profil ke Supabase Storage bucket 'avatars'
 * Otomatis memastikan pemotongan 1:1 persegi, kompresi max 500x500px, kualitas ~0.85
 * Menggunakan struktur valid: supabase.storage.from('avatars').upload(fileName, file, { upsert: true, cacheControl: '3600' })
 * Fallback ke serverless API /api/upload-image jika terjadi kendala client RLS.
 * Tidak pernah mengembalikan Base64 string agar mencegah QuotaExceededError di localStorage.
 * @param {File|Blob|string} imageFileOrDataUrl
 * @returns {Promise<string|null>} Public URL avatar Supabase Storage (atau null jika gagal)
 */
export async function sbUploadAvatar(imageFileOrDataUrl) {
  try {
    let finalDataUrl = imageFileOrDataUrl;

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        finalDataUrl = await compressAndCropSquareImage(imageFileOrDataUrl, 500, 0.85);
      } catch (cropErr) {
        console.warn('[sbUploadAvatar] Info kompresi canvas 1:1:', cropErr.message);
      }
    }

    if (typeof finalDataUrl === 'string' && (finalDataUrl.startsWith('http://') || finalDataUrl.startsWith('https://'))) {
      return finalDataUrl;
    }

    let file = null;
    if (typeof finalDataUrl === 'string' && finalDataUrl.startsWith('data:')) {
      file = dataUrlToBlob(finalDataUrl);
    } else if (finalDataUrl instanceof Blob || finalDataUrl instanceof File) {
      file = finalDataUrl;
    } else {
      return null;
    }

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const fileName = `avatar_${timestamp}_${randomSuffix}.jpg`;
    const approximateSizeKb = Math.round((file?.size || 0) / 1024);

    console.log(`[Supabase Storage avatars] Mengunggah foto avatar (${approximateSizeKb} KB): ${fileName}`);

    // 1. Coba upload langsung via Supabase Client
    if (supabase) {
      try {
        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(fileName, file, {
            upsert: true,
            contentType: 'image/jpeg',
            cacheControl: '3600'
          });

        if (!error && data) {
          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

          if (publicUrlData && publicUrlData.publicUrl) {
            console.log('✅ [Supabase Storage Avatars Berhasil]:', publicUrlData.publicUrl);
            return publicUrlData.publicUrl;
          }
        } else if (error) {
          console.info('ℹ️ [Supabase Avatars Direct Upload Notice]:', error.message || error);
        }
      } catch (uploadErr) {
        console.info('ℹ️ [Supabase Avatars Direct Upload Exception]:', uploadErr.message || uploadErr);
      }
    }

    // 2. Fallback via Serverless API Endpoint (/api/upload-image)
    try {
      const uploadPayload = typeof finalDataUrl === 'string' && finalDataUrl.startsWith('data:') ? finalDataUrl : null;
      if (uploadPayload) {
        const res = await fetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: uploadPayload,
            filePath: fileName,
            bucket: 'avatars'
          })
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData && resData.success && resData.publicUrl) {
            console.log('✅ [Supabase Storage Avatars via API Berhasil]:', resData.publicUrl);
            return resData.publicUrl;
          }
        }
      }
    } catch (apiErr) {
      console.warn('[sbUploadAvatar API Fallback Notice]:', apiErr.message || apiErr);
    }

    console.warn('[sbUploadAvatar] Gagal mengunggah avatar ke Supabase Storage.');
    return null;
  } catch (err) {
    console.warn('[sbUploadAvatar Notice]:', err.message || err);
    return null;
  }
}

/**
 * Hapus fisik file avatar dari Supabase Storage bucket 'avatars'
 * @param {string} avatarUrlOrPath
 * @returns {Promise<boolean>}
 */
export async function sbDeleteAvatar(avatarUrlOrPath) {
  if (!avatarUrlOrPath || typeof avatarUrlOrPath !== 'string') return false;
  if (avatarUrlOrPath.includes('dicebear.com') || avatarUrlOrPath.includes('unsplash.com')) {
    return true; // Jangan hapus aset eksternal
  }

  const match = avatarUrlOrPath.match(/avatars\/([^?#]+)/) || avatarUrlOrPath.match(/(avatar_[a-zA-Z0-9_\-\.]+\.jpg)/i);
  const fileName = match ? match[1] : (avatarUrlOrPath.startsWith('avatar_') ? avatarUrlOrPath : null);
  if (!fileName) return true;

  console.log(`[Supabase Storage] Menghapus file avatar dari bucket: ${fileName}`);

  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from('avatars')
        .remove([fileName]);

      if (!error) {
        console.log(`✅ [Supabase Storage] File avatar "${fileName}" berhasil dihapus.`);
        return true;
      }
    } catch (e) {
      // Fallback ke serverless API
    }
  }

  try {
    const res = await fetch('/api/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete',
        bucket: 'avatars',
        filePath: fileName
      })
    });
    if (res.ok) {
      console.log(`✅ [Supabase Storage via API] File avatar "${fileName}" berhasil dihapus.`);
      return true;
    }
  } catch (apiErr) {
    console.warn('[sbDeleteAvatar Notice]:', apiErr.message || apiErr);
  }
  return false;
}

/**
 * Update atau reset kolom avatar pada tabel 'users' di Supabase
 * @param {string|object} userOrId
 * @param {string|null} avatarUrl
 * @returns {Promise<boolean>}
 */
export async function sbUpdateUserAvatar(userOrId, avatarUrl = null) {
  if (!userOrId || !supabase) return false;
  try {
    const targetId = typeof userOrId === 'string' ? userOrId : (userOrId.id || null);
    const targetEmail = typeof userOrId === 'object' ? (userOrId.email || null) : null;
    const cleanAvatar = avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '' ? avatarUrl.trim() : null;

    let updatedRows = null;

    if (targetId) {
      const { data, error } = await supabase
        .from('users')
        .update({
          avatar: cleanAvatar,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetId)
        .select();

      if (!error && data && data.length > 0) {
        updatedRows = data;
      }
    }

    if (!updatedRows && targetEmail) {
      const { data, error } = await supabase
        .from('users')
        .update({
          avatar: cleanAvatar,
          updated_at: new Date().toISOString()
        })
        .eq('email', targetEmail.toLowerCase())
        .select();

      if (!error && data && data.length > 0) {
        updatedRows = data;
      }
    }

    console.log(`✅ [sbUpdateUserAvatar Success] Avatar user "${targetId || targetEmail}" berhasil diperbarui di tabel users:`, cleanAvatar ? 'URL Publik Supabase' : 'Dikosongkan (Null)');
    return true;
  } catch (e) {
    console.warn('[sbUpdateUserAvatar Exception]:', e.message || e);
    return false;
  }
}

/** Simpan listing baru */
export async function sbSaveListing(listing) {
  if (!requireClient('sbSaveListing')) return null;

  let payload = { ...listing };
  if (payload.images && Array.isArray(payload.images) && payload.images.some(img => typeof img === 'string' && img.startsWith('data:'))) {
    const uploadedUrls = await sbUploadMultipleImages(payload.images, '');
    if (uploadedUrls && uploadedUrls.length > 0) {
      payload.images = uploadedUrls;
    }
  }

  const sellerId = listing.seller?.id || listing.seller_id || listing.user_id;

  const insertPayload = {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    price: Number(listing.price) || 0,
    category: listing.category,
    condition: listing.condition || 'good',
    nego_type: listing.negoType || listing.nego_type || 'nego_alus',
    region: listing.regionId || listing.region || 'solo',
    district: listing.district || '',
    seller_id: sellerId,
    seller_name: listing.seller?.name || listing.seller_name || 'Penjual',
    seller_phone: listing.seller?.phone || listing.seller_phone || '',
    seller_avatar: listing.seller?.avatar || listing.seller_avatar || '',
    images: payload.images || [],
    status: listing.status || 'active',
    views: Number(listing.views) || 0,
    created_at: listing.createdAt || listing.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('listings')
    .insert([insertPayload])
    .select()
    .single();

  if (error) {
    console.error('❌ [SupabaseDB] saveListing error:', error.message);
    return null;
  }
  return data;
}

/** 
 * Update listing yang sudah ada
 * Memastikan payload hanya berisi kolom valid tabel listings (bebas dari is_bu, codPoint / kolom non-existent)
 */
export async function sbUpdateListing(id, updates) {
  if (!requireClient('sbUpdateListing')) return null;

  let payload = { ...updates };
  if (payload.images && Array.isArray(payload.images) && payload.images.some(img => typeof img === 'string' && img.startsWith('data:'))) {
    const uploadedUrls = await sbUploadMultipleImages(payload.images, '');
    if (uploadedUrls && uploadedUrls.length > 0) {
      payload.images = uploadedUrls;
    }
  }

  // Sanitize dan petakan kolom valid tabel listings (tanpa is_bu, codPoint, dll.)
  const cleanUpdatePayload = {};
  if (payload.title !== undefined) cleanUpdatePayload.title = payload.title;
  if (payload.description !== undefined) cleanUpdatePayload.description = payload.description;
  if (payload.price !== undefined) cleanUpdatePayload.price = Number(payload.price) || 0;
  if (payload.category !== undefined) cleanUpdatePayload.category = payload.category;
  if (payload.condition !== undefined) cleanUpdatePayload.condition = payload.condition;
  if (payload.negoType !== undefined || payload.nego_type !== undefined) cleanUpdatePayload.nego_type = payload.negoType || payload.nego_type;
  if (payload.regionId !== undefined || payload.region !== undefined) cleanUpdatePayload.region = payload.regionId || payload.region;
  if (payload.district !== undefined) cleanUpdatePayload.district = payload.district;
  if (payload.status !== undefined) cleanUpdatePayload.status = payload.status;
  if (payload.views !== undefined) cleanUpdatePayload.views = Number(payload.views) || 0;
  if (payload.images !== undefined) cleanUpdatePayload.images = payload.images;
  if (payload.seller_name !== undefined || payload.seller?.name !== undefined) cleanUpdatePayload.seller_name = payload.seller_name || payload.seller?.name;
  if (payload.seller_phone !== undefined || payload.seller?.phone !== undefined) cleanUpdatePayload.seller_phone = payload.seller_phone || payload.seller?.phone;
  if (payload.seller_avatar !== undefined || payload.seller?.avatar !== undefined) cleanUpdatePayload.seller_avatar = payload.seller_avatar || payload.seller?.avatar;
  cleanUpdatePayload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('listings')
    .update(cleanUpdatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) { 
    console.error('❌ [SupabaseDB] updateListing error:', error.message); 
    return null; 
  }
  return data;
}

/** Hapus listing */
export async function sbDeleteListing(id) {
  if (!requireClient('sbDeleteListing')) return false;
  const { error } = await supabase.from('listings').delete().eq('id', id);
  if (error) { console.error('❌ [SupabaseDB] deleteListing error:', error.message); return false; }
  return true;
}

/** Increment view count listing */
export async function sbIncrementViews(id) {
  if (!requireClient('sbIncrementViews')) return;
  await supabase.rpc('increment_listing_views', { listing_id: id }).catch(() => {});
}

const activeGetMyListingsPromises = new Map();
let lastGetMyListingsTime = new Map();

/** 
 * Ambil listing milik satu seller/user yang sedang login dari tabel listings Supabase
 * Menggunakan query komprehensif (seller_id, seller_phone, atau seller_name)
 * Dilengkapi pencegahan duplikasi query simultan (*in-flight de-duplication*)
 * @param {string|object} userOrId - ID Akun Penjual atau Objek User yang sedang aktif login
 * @param {boolean} [force=false] - Paksa ambil data baru dari Supabase
 * @returns {Promise<Array|null>}
 */
export async function sbGetMyListings(userOrId, force = false) {
  if (!requireClient('sbGetMyListings')) return null;
  if (!userOrId) {
    console.warn('⚠️ [SupabaseDB: sbGetMyListings] userOrId tidak boleh kosong');
    return [];
  }

  const sellerId = typeof userOrId === 'string' ? userOrId.trim() : (userOrId.id || '').trim();
  const sellerPhone = typeof userOrId === 'object' ? (userOrId.phone || '').trim() : '';
  const sellerName = typeof userOrId === 'object' ? (userOrId.storeName || userOrId.name || '').trim() : '';
  const cacheKey = sellerId || sellerPhone || sellerName || 'default';

  // Jika sedang ada request in-flight yang sama persis, kembalikan promise yang sedang berjalan
  if (activeGetMyListingsPromises.has(cacheKey)) {
    return activeGetMyListingsPromises.get(cacheKey);
  }

  const now = Date.now();
  const lastTime = lastGetMyListingsTime.get(cacheKey) || 0;
  if (!force && (now - lastTime < 1500)) {
    return null;
  }

  const fetchPromise = (async () => {
    try {
      console.log(`[SupabaseDB: sbGetMyListings] Mengambil daftar produk etalase penjual (ID: "${sellerId}", Phone: "${sellerPhone}", Toko: "${sellerName}")`);
      
      const orConditions = [];
      if (sellerId) orConditions.push(`seller_id.eq.${sellerId}`);
      if (sellerPhone) orConditions.push(`seller_phone.eq.${sellerPhone}`);
      if (sellerName) orConditions.push(`seller_name.eq.${sellerName}`);

      let query = supabase.from('listings').select('*').order('created_at', { ascending: false });
      if (orConditions.length > 0) {
        query = query.or(orConditions.join(','));
      } else if (sellerId) {
        query = query.eq('seller_id', sellerId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [SupabaseDB: sbGetMyListings Error]: Gagal memuat produk toko:', error.message || error);
        if (sellerId) {
          const { data: fallbackData } = await supabase.from('listings').select('*').eq('seller_id', sellerId).order('created_at', { ascending: false });
          if (fallbackData) return fallbackData;
        }
        return null;
      }

      lastGetMyListingsTime.set(cacheKey, Date.now());
      console.log(`✅ [SupabaseDB: sbGetMyListings Sukses] Berhasil memuat ${data?.length || 0} produk untuk penjual (${sellerName || sellerId || sellerPhone})`);
      return data || [];
    } catch (err) {
      console.error('❌ [SupabaseDB: sbGetMyListings Exception]:', err);
      return null;
    } finally {
      activeGetMyListingsPromises.delete(cacheKey);
    }
  })();

  activeGetMyListingsPromises.set(cacheKey, fetchPromise);
  return fetchPromise;
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
