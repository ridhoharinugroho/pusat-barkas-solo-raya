/**
 * Data Kategori, Kondisi, dan Opsi Nego
 * Pusat Barkas Solo Raya
 */

export const CATEGORIES = [
  { id: "all", name: "Semua Kategori", shortName: "Lihat semua", icon: "layout-grid", count: 0 },
  { id: "elektronik", name: "Elektronik & Gadget", shortName: "Elektronik", icon: "smartphone", count: 0 },
  { id: "kendaraan", name: "Kendaraan & Otomotif", shortName: "Kendaraan", icon: "bike", count: 0 },
  { id: "perabot", name: "Perabot & Rumah Tangga", shortName: "Perabot", icon: "armchair", count: 0 },
  { id: "pakaian", name: "Pakaian & Aksesoris", shortName: "Pakaian", icon: "shirt", count: 0 },
  { id: "bayi-anak", name: "Perlengkapan Bayi & Anak", shortName: "Bayi & Anak", icon: "baby", count: 0 },
  { id: "pertukangan", name: "Pertukangan / Bahan Bangunan", shortName: "Pertukangan", icon: "hammer", count: 0 },
  { id: "hobi", name: "Hobi, Musik & Olahraga", shortName: "Hobi & Musik", icon: "trophy", count: 0 },
  { id: "hewan", name: "Hewan & Perlengkapan", shortName: "Hewan", icon: "cat", count: 0 },
  { id: "alat-sekolah", name: "Peralatan Sekolah", shortName: "Alat Sekolah", icon: "book-open", count: 0 },
  { id: "perawatan-diri", name: "Perawatan Diri", shortName: "Perawatan", icon: "sparkles", count: 0 },
  { id: "properti", name: "Properti", shortName: "Properti", icon: "building-2", count: 0 },
  { id: "jasa", name: "Jasa", shortName: "Jasa", icon: "wrench", count: 0 },
  { id: "lainnya", name: "Lain-lain / Aneka Barkas", shortName: "Lain-lain", icon: "package", count: 0 }
];

export const CONDITIONS = [
  { id: "new", label: "Baru (Kondisi Baru / Segel / Gres)", badgeClass: "bg-emerald-600 text-white border-emerald-600" },
  { id: "like_new", label: "Bekas - Seperti Baru (Like New)", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { id: "good", label: "Bekas - Mulus / Normal", badgeClass: "bg-blue-100 text-blue-800 border-blue-300" },
  { id: "fair", label: "Bekas - Wajar Pemakaian", badgeClass: "bg-amber-100 text-amber-800 border-amber-300" },
  { id: "repair", label: "Bekas - Butuh Servis / Bahan", badgeClass: "bg-rose-100 text-rose-800 border-rose-300" }
];

export const NEGO_TYPES = [
  { id: "nego_alus", label: "Nego Alus (Bisa Nego Sedikit)", short: "Nego Alus" },
  { id: "nego_tipis", label: "Nego Tipis / Bensin", short: "Nego Tipis" },
  { id: "nego_bebas", label: "Nego Sampai Jadi", short: "Nego Bebas" },
  { id: "pas", label: "Harga Pas / Nett", short: "Nett / Pas" }
];
