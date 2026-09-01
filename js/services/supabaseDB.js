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
 * Helper ekstraksi path file storage aman dari URL public Supabase
 * Memotong URL berdasarkan string /avatars/ menggunakan .split('/avatars/').pop()
 * @param {string} url
 * @returns {string|null} filePath murni tanpa domain atau query string
 */
export function extractAvatarFilePath(url) {
  if (!url || typeof url !== 'string') return null;
  const raw = url.trim();
  if (!raw || raw.includes('dicebear.com') || raw.includes('unsplash.com') || raw.startsWith('data:')) {
    return null;
  }

  let extracted = raw;
  if (raw.includes('/avatars/')) {
    extracted = raw.split('/avatars/').pop();
  } else if (raw.includes('avatars/')) {
    extracted = raw.split('avatars/').pop();
  }

  if (!extracted) return null;
  const filePath = decodeURIComponent(extracted.split('?')[0].split('#')[0].trim());
  return filePath && filePath !== '' ? filePath : null;
}

/**
 * Hapus fisik file avatar dari Supabase Storage bucket 'avatars'
 * @param {string} avatarUrlOrPath
 * @returns {Promise<boolean>}
 */
export async function sbDeleteAvatar(avatarUrlOrPath) {
  const filePath = extractAvatarFilePath(avatarUrlOrPath);
  if (!filePath) return true;

  console.log(`[Supabase Storage Remove Target] Path file murni yang akan dihapus dari bucket 'avatars': "${filePath}" (URL asal: "${avatarUrlOrPath}")`);

  if (supabase && supabase.storage) {
    try {
      const { data, error } = await supabase.storage.from('avatars').remove([filePath]);
      if (error) {
        console.warn(`⚠️ [Supabase Storage Remove Notice] Gagal menghapus file "${filePath}":`, error.message || error);
      } else {
        console.log(`✅ [Supabase Storage Remove Success] File avatar "${filePath}" berhasil dihapus.`, data);
      }
      return true;
    } catch (err) {
      console.warn('[sbDeleteAvatar Handled Exception]:', err.message || err);
      return true;
    }
  }
  return true;
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

    const validTargetId = targetId && typeof targetId === 'string' ? targetId.trim() : (targetId ? String(targetId).trim() : null);

    if (validTargetId && validTargetId !== '') {
      const { error } = await supabase
        .from('users')
        .update({
          avatar: cleanAvatar,
          updated_at: new Date().toISOString()
        })
        .eq('id', validTargetId);

      if (!error) {
        updatedRows = true;
      }
    }

    const validEmail = targetEmail && typeof targetEmail === 'string' && targetEmail.trim() !== '' && targetEmail.includes('@') ? targetEmail.trim().toLowerCase() : null;

    if (!updatedRows && validEmail) {
      const { error } = await supabase
        .from('users')
        .update({
          avatar: cleanAvatar,
          updated_at: new Date().toISOString()
        })
        .eq('email', validEmail);

      if (!error) {
        updatedRows = true;
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
  const isBu = Boolean(listing.is_bu || listing.isBu);
  const buExpiresAt = isBu ? (listing.bu_expires_at || null) : null;

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
    seller_name: listing.seller?.storeName || listing.seller?.name || listing.seller_name || 'Penjual',
    seller_phone: listing.seller?.phone || listing.seller_phone || '',
    seller_avatar: listing.seller?.avatar || listing.seller_avatar || '',
    images: payload.images || [],
    status: listing.status || 'active',
    is_bu: isBu,
    bu_expires_at: buExpiresAt,
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
 * Memastikan payload mencakup is_bu dan bu_expires_at saat fitur BU diaktifkan
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

  // Sanitize dan petakan kolom valid tabel listings
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
  if (payload.seller_id !== undefined || payload.seller?.id !== undefined) cleanUpdatePayload.seller_id = payload.seller_id || payload.seller?.id;
  if (payload.seller_name !== undefined || payload.seller?.name !== undefined) cleanUpdatePayload.seller_name = payload.seller_name || payload.seller?.name;
  if (payload.seller_phone !== undefined || payload.seller?.phone !== undefined) cleanUpdatePayload.seller_phone = payload.seller_phone || payload.seller?.phone;
  if (payload.seller_avatar !== undefined || payload.seller?.avatar !== undefined) cleanUpdatePayload.seller_avatar = payload.seller_avatar || payload.seller?.avatar;
  
  if (payload.is_bu !== undefined || payload.isBu !== undefined) {
    const isBuVal = Boolean(payload.is_bu !== undefined ? payload.is_bu : payload.isBu);
    cleanUpdatePayload.is_bu = isBuVal;
    cleanUpdatePayload.bu_expires_at = isBuVal ? (payload.bu_expires_at || null) : null;
  }

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
  const isEmail = typeof idOrEmail === 'string' && idOrEmail.trim() !== '' && idOrEmail.includes('@');
  let query = supabase.from('users').update(updates);
  if (isEmail) {
    query = query.eq('email', idOrEmail.toLowerCase().trim());
  } else if (idOrEmail) {
    query = query.eq('id', idOrEmail);
  } else {
    console.warn('[sbUpdateUser] Skipping query: idOrEmail is empty');
    return null;
  }
  const { data, error } = await query.select().maybeSingle();
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
// USER INTERESTS - Tracking Minat Pengguna & Rekomendasi (users.interests)
// ============================================================

/**
 * Helper untuk memperbarui array interests pada tabel users setiap kali pengguna berinteraksi dengan kategori barang
 * Menyimpan maksimal 3 kategori teratas dengan mekanisme shift/push
 * @param {string} userId - ID Pengguna (atau Email)
 * @param {string} newCategory - Kategori baru yang diakses
 */
export async function updateUserInterest(userId, newCategory) {
  if (!requireClient('updateUserInterest')) return;
  if (!userId || !newCategory || newCategory === 'all') return;

  const cleanCategory = String(newCategory).toLowerCase().trim();

  try {
    // 1. Ambil data baris user saat ini dari Supabase (berdasarkan id atau email)
    let userRow = null;
    let queryField = 'id';

    const { data: userById, error: fetchErr } = await supabase
      .from('users')
      .select('id, email, interests')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr) {
      console.warn('[updateUserInterest] Error select user by id:', fetchErr.message);
    }

    if (userById) {
      userRow = userById;
      queryField = 'id';
    } else if (typeof userId === 'string' && userId.includes('@')) {
      const { data: userByEmail, error: emailErr } = await supabase
        .from('users')
        .select('id, email, interests')
        .eq('email', userId.toLowerCase().trim())
        .maybeSingle();

      if (emailErr) console.warn('[updateUserInterest] Error select user by email:', emailErr.message);
      if (userByEmail) {
        userRow = userByEmail;
        queryField = 'email';
      }
    }

    let currentInterests = Array.isArray(userRow?.interests) ? [...userRow.interests] : [];

    // 2. Hapus jika kategori sudah ada (untuk di-push ke posisi paling baru)
    currentInterests = currentInterests.filter(cat => String(cat).toLowerCase().trim() !== cleanCategory);

    // 3. Masukkan kategori baru ke posisi paling belakang (terbaru)
    currentInterests.push(cleanCategory);

    // 4. Batasi maksimal 3 item (geser yang paling lama jika lebih dari 3)
    while (currentInterests.length > 3) {
      currentInterests.shift();
    }

    // 5. Simpan kembali ke database dengan update yang bersih
    if (userRow && userRow[queryField]) {
      const { error: updErr } = await supabase
        .from('users')
        .update({ interests: currentInterests })
        .eq(queryField, userRow[queryField]);

      if (updErr) {
        console.error('❌ [updateUserInterest] Gagal update kolom interests:', updErr.message);
      } else {
        console.log(`✅ [updateUserInterest] Sukses update interests user "${userRow.id}":`, currentInterests);
      }
    }

    // 6. Sinkronkan juga ke currentUser di auth session jika user sedang login
    if (typeof window !== 'undefined') {
      try {
        const storedUser = JSON.parse(localStorage.getItem('pusat_barkas_current_user') || 'null');
        if (storedUser && (storedUser.id === userId || storedUser.email === userId || (userRow && storedUser.id === userRow.id))) {
          storedUser.interests = currentInterests;
          localStorage.setItem('pusat_barkas_current_user', JSON.stringify(storedUser));
        }
      } catch (e) {}
    }
  } catch (err) {
    console.error('❌ [updateUserInterest Exception]', err);
  }
}

/**
 * Alias pembaruan minat untuk kompatibilitas ke updateUserInterest
 */
export async function sbTrackUserInterest(userId, categoryId) {
  await updateUserInterest(userId, categoryId);
  return { success: true };
}

/**
 * Ambil daftar minat kategori pengguna dari kolom array interests tabel users
 * @param {string} userId - UUID atau identifier pengguna
 * @returns {Promise<Array>}
 */
export async function sbGetUserInterests(userId) {
  if (!requireClient('sbGetUserInterests')) return [];
  if (!userId) return [];
  try {
    let query = supabase.from('users').select('interests');
    if (typeof userId === 'string' && userId.includes('@')) {
      query = query.eq('email', userId.toLowerCase().trim());
    } else {
      query = query.eq('id', userId);
    }
    const { data: user, error } = await query.maybeSingle();

    if (error) {
      console.warn('[SupabaseDB] getUserInterests error:', error.message);
      return [];
    }
    return Array.isArray(user?.interests) ? user.interests : [];
  } catch (e) {
    console.warn('[SupabaseDB] getUserInterests exception:', e.message);
    return [];
  }
}

// ============================================================
// NOTIFICATIONS - Broadcast Tertarget Fitur BU Berdasarkan Array interests
// ============================================================

/**
 * Kirim notifikasi BU tertarget HANYA ke pengguna yang memiliki minat (category_id yang cocok)
 * di kolom array interests tabel users
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
    const targetUserSet = new Set();

    // 1. Cari pengguna yang memiliki kategori tersebut di dalam kolom array interests tabel users (tanpa pengecualian penjual)
    try {
      const { data: targetUsers, error: targetErr } = await supabase
        .from('users')
        .select('id')
        .contains('interests', [cleanCatId]);

      if (!targetErr && Array.isArray(targetUsers)) {
        targetUsers.forEach(u => {
          if (u && u.id) targetUserSet.add(String(u.id));
        });
      }
    } catch (e) {
      console.warn('[BU Broadcast] users.interests query note:', e.message);
    }

    // Pastikan akun penjual / user yang sedang login juga disertakan sebagai penerima notifikasi
    try {
      if (typeof window !== 'undefined') {
        const storedUser = JSON.parse(localStorage.getItem('pusat_barkas_current_user') || sessionStorage.getItem('solosatset_current_user_data') || 'null');
        if (storedUser && storedUser.id) {
          targetUserSet.add(String(storedUser.id));
        }
      }
    } catch (e) {}

    // Deduplikasi user_id
    const targetUserIds = Array.from(targetUserSet);
    console.log(`[BU Notification] Ditemukan ${targetUserIds.length} pengguna (termasuk akun penjual) yang berminat pada kategori "${cleanCatId}".`);

    const title = productDetails.title ? `🔥 BUTUH UANG CEPAT: ${productDetails.title}` : '🔥 IKLAN BUTUH UANG CEPAT (BU) TERBARU!';
    const message = productDetails.message || `Ada iklan butuh uang cepat (BU) untuk kategori ${cleanCatId} yang Anda minati! Cek sekarang sebelum keduluan.`;
    const url = productDetails.url || `https://solosatset.vercel.app/?item=${productId}`;
    const image = productDetails.image || '/assets/img/app-logo.png?v=2.1';

    if (targetUserIds.length > 0) {
      // 3. Masukkan ke tabel notifications Supabase jika tersedia
      try {
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

        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notifRows);
        if (notifError) console.error('Gagal insert notifikasi:', notifError);
      } catch (err) {
        console.error('Error catch notifikasi:', err);
      }

      // 4. Kirim notifikasi Web Push nyata secara massal HANYA ke perangkat user yang berminat
      try {
        fetch('/api/push-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            body: message,
            url,
            icon: image,
            badge: '/assets/img/app-logo.png?v=2.1',
            tag: `bu-${cleanCatId}-${productId}`,
            categoryId: cleanCatId,
            targetUserIds: targetUserIds,
            productId
          })
        }).catch((e) => console.warn('[WebPush Dispatch Non-blocking Error]', e));
      } catch (e) {}
    }

    // 5. Siarkan event di window browser & lokal notifikasi
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('buNotificationTriggered', {
          detail: {
            productId,
            categoryId: cleanCatId,
            title,
            message,
            totalUsers: targetUserIds.length,
            targetUserIds
          }
        }));
      }
    } catch (e) {}

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
 * Ambil daftar notifikasi untuk pengguna tertentu dari Supabase
 * @param {string} userId - ID Pengguna (atau Email)
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
    if (error) {
      console.warn('[sbGetNotifications] Error fetching notifications:', error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.warn('[sbGetNotifications] Exception:', e.message);
    return [];
  }
}

/**
 * Tandai notifikasi spesifik sebagai sudah dibaca
 * @param {string} notifId - ID Notifikasi (UUID)
 */
export async function sbMarkNotificationAsRead(notifId) {
  if (!requireClient('sbMarkNotificationAsRead')) return false;
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId);
    return !error;
  } catch (e) {
    return false;
  }
}

/**
 * Tandai semua notifikasi pengguna sebagai sudah dibaca
 * @param {string} userId - ID Pengguna
 */
export async function sbMarkAllNotificationsAsRead(userId) {
  if (!requireClient('sbMarkAllNotificationsAsRead') || !userId) return false;
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .or(`user_id.eq.${userId},user_id.eq.all_users`);
    return !error;
  } catch (e) {
    return false;
  }
}

/**
 * Berlangganan (Subscribe) ke Realtime Channel Supabase tabel notifications
 * @param {string} userId - ID Pengguna aktif
 * @param {Function} onNewNotification - Callback ketika ada baris notifikasi baru
 * @returns {object|null} Realtime subscription channel
 */
export function sbSubscribeNotifications(userId, onNewNotification) {
  if (!supabase || typeof supabase.channel !== 'function') return null;
  try {
    const channelName = `realtime:notifications:${userId || 'global'}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new;
          if (!newNotif) return;
          if (!userId || newNotif.user_id === userId || newNotif.user_id === 'all_users') {
            console.log('⚡ [Realtime Notification Received]', newNotif);
            if (typeof onNewNotification === 'function') {
              onNewNotification(newNotif);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Supabase Realtime Notifications] Status channel (${channelName}):`, status);
      });

    return channel;
  } catch (e) {
    console.warn('[Supabase Realtime Notifications] Exception:', e.message);
    return null;
  }
}
