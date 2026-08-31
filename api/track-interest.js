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

    // 1. Ambil data eksisting
    const { data: existing } = await supabase
      .from('user_interests')
      .select('id, score')
      .eq('user_id', userId)
      .eq('category_id', cleanCatId)
      .maybeSingle();

    const currentScore = existing && existing.score !== undefined ? (Number(existing.score) || 0) : 0;
    const nextScore = currentScore + (Number(scoreIncrement) || 1);
    const nowIso = new Date().toISOString();

    const payload = {
      user_id: userId,
      category_id: cleanCatId,
      score: nextScore,
      updated_at: nowIso
    };

    if (existing && existing.id) {
      payload.id = existing.id;
    }

    // 2. Upsert
    const { data, error } = await supabase
      .from('user_interests')
      .upsert([payload], { onConflict: 'user_id,category_id' })
      .select();

    if (error) {
      console.warn('[Serverless Track Interest] Upsert error:', error.message);
      // Fallback
      if (existing && existing.id) {
        await supabase.from('user_interests').update({ score: nextScore, updated_at: nowIso }).eq('id', existing.id);
      } else {
        await supabase.from('user_interests').insert([{ user_id: userId, category_id: cleanCatId, score: nextScore, created_at: nowIso, updated_at: nowIso }]);
      }
    }

    return res.status(200).json({
      success: true,
      userId,
      categoryId: cleanCatId,
      score: nextScore
    });
  } catch (error) {
    console.error('[Serverless Track Interest Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
