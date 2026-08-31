import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rwjqqoulqdmtsweuvbef.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Serverless Upload Image Endpoint
 * Accepts base64 image data and uploads directly to Supabase Storage 'product-images'
 */
export default async function handler(req, res) {
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

    const { imageData, filePath, folder = 'listings' } = body || {};
    if (!imageData) {
      return res.status(400).json({ success: false, error: 'imageData is required' });
    }

    const cleanRandomStr = Math.random().toString(36).substring(2, 10);
    const targetFilePath = filePath ? String(filePath).replace(/[^a-zA-Z0-9_\-\.]/g, '_') : `${Date.now()}_${cleanRandomStr}.jpg`;

    let buffer;
    let contentType = 'image/jpeg';

    if (imageData.startsWith('data:')) {
      const parts = imageData.split(';base64,');
      contentType = parts[0].replace('data:', '') || 'image/jpeg';
      buffer = Buffer.from(parts[1], 'base64');
    } else {
      buffer = Buffer.from(imageData, 'base64');
    }

    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(targetFilePath, buffer, {
        upsert: true,
        contentType: contentType,
        cacheControl: '31536000'
      });

    if (error) {
      console.error('❌ [Serverless Storage Upload Error]', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    const { data: publicUrlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(targetFilePath);

    return res.status(200).json({
      success: true,
      publicUrl: publicUrlData.publicUrl,
      filePath: targetFilePath
    });
  } catch (err) {
    console.error('❌ [Serverless Storage Upload Exception]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
