import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rwjqqoulqdmtsweuvbef.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Serverless User Interest Tracking & Upsert Endpoint
 */
export default async function handler(req, res) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const { userId, categoryId, scoreIncrement = 1 } = body || {};
    if (!userId || !categoryId || categoryId === 'all') {
      return res.status(400).json({ success: false, error: 'Missing userId or categoryId' });
    }

    const cleanCatId = String(categoryId).toLowerCase().trim();

    // 1. Ambil array interests pengguna saat ini dari tabel users
    let uInterests = [];
    try {
      const { data: uData, error: uErr } = await supabase
        .from('users')
        .select('interests')
        .eq('id', userId)
        .maybeSingle();

      if (uErr) {
        console.warn('[Serverless Track Interest] users select warning:', uErr.message);
      }
      uInterests = Array.isArray(uData?.interests) ? [...uData.interests] : [];
    } catch (e) {}

    // 2. Hapus kategori lama jika ada dan push ke urutan paling baru
    uInterests = uInterests.filter(c => String(c).toLowerCase().trim() !== cleanCatId);
    uInterests.push(cleanCatId);

    // 3. Batasi maksimal 3 item (geser item terlama jika > 3)
    while (uInterests.length > 3) {
      uInterests.shift();
    }

    // 4. Simpan kembali ke kolom interests pada tabel users
    const { error: updError } = await supabase
      .from('users')
      .update({ interests: uInterests })
      .eq('id', userId);

    if (updError) {
      console.error('[Serverless Track Interest] Update error:', updError.message);
      return res.status(200).json({ success: false, error: updError.message });
    }

    return res.status(200).json({
      success: true,
      userId,
      categoryId: cleanCatId,
      interests: uInterests
    });
  } catch (error) {
    console.error('[Serverless Track Interest Error]', error);
    return res.status(200).json({ success: false, error: error.message });
  }
}
