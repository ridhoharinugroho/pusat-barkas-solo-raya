/**
 * Helper WhatsApp & Formatters
 * Pusat Jual Beli Solo Raya
 */

import { getRegionById } from '../data/regions.js';

export function formatRupiah(amount) {
  if (typeof amount !== 'number') {
    amount = parseInt(amount, 10) || 0;
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount);
}

export function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

export function formatDisplayPhone(phone) {
  if (!phone) return '-';
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('62')) {
    return '0' + cleaned.substring(2);
  }
  return phone;
}

export function generateWhatsAppUrl(listing, buyerName = '') {
  if (!listing || !listing.seller || !listing.seller.phone) return '#';
  
  const phone = cleanPhoneNumber(listing.seller.phone);
  const region = getRegionById(listing.regionId);
  const regionName = region ? region.name : listing.regionId || 'Solo Raya';
  const districtName = listing.district ? `Kec. ${listing.district}` : '';
  const locationText = districtName ? `${regionName}, ${districtName}` : regionName;
  const sellerName = listing.seller.displayName || 'Penjual';
  const priceFormatted = formatRupiah(listing.price);
  
  let greeting = `Halo ${sellerName}, permisi... 👋\n\n`;
  greeting += `Saya tertarik dengan iklan barang Anda di *Pusat Jual Beli Solo Raya*:\n`;
  greeting += `📦 *Barang:* ${listing.title}\n`;
  greeting += `💰 *Harga:* ${priceFormatted} (${listing.negoType === 'pas' ? 'Harga Pas' : 'Bisa Nego'})\n`;
  greeting += `📍 *Lokasi:* ${locationText}\n`;
  if (listing.codPoint) {
    greeting += `🤝 *Titik COD:* ${listing.codPoint}\n`;
  }
  greeting += `\nApakah barang tersebut masih tersedia dan bisa cek kondisi / COD?`;
  
  if (buyerName && buyerName.trim() !== '') {
    greeting += `\n\nTerima kasih,\n— ${buyerName.trim()}`;
  }

  const encodedMessage = encodeURIComponent(greeting);
  return `https://wa.me/${phone}?text=${encodedMessage}`;
}

export function generateShareWhatsAppUrl(listing) {
  if (!listing) return '#';
  const priceFormatted = formatRupiah(listing.price);
  const region = getRegionById(listing.regionId);
  const regionName = region ? region.name : 'Solo Raya';
  
  const text = `Cek barang murah ini lur! 🔥\n*${listing.title}*\nHarga: ${priceFormatted}\nLokasi: ${regionName} (${listing.district || '-'})\nInfo lengkap di Pusat Jual Beli Solo Raya.`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

export function timeAgo(dateString) {
  if (!dateString) return 'Baru saja';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Baru saja';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Kemarin';
  if (days < 30) return `${days} hari lalu`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} bulan lalu`;
  return `${Math.floor(months / 12)} tahun lalu`;
}

