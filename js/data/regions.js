/**
 * Data Wilayah Solo Raya (7 Kabupaten / Kota) & Daftar Kecamatan
 * Pusat Barkas Solo Raya
 */

export const SOLO_RAYA_REGIONS = [
  {
    id: "solo",
    name: "Kota Solo (Surakarta)",
    shortName: "Solo",
    badgeColor: "bg-red-100 text-red-800 border-red-200",
    accentColor: "#dc2626",
    popularSpots: ["Manahan", "Pasar Klewer", "Slamet Riyadi", "Singosaren", "Kentingan UNS", "Pasar Gede", "Mangkunegaran"],
    districts: [
      "Banjarsari",
      "Jebres",
      "Laweyan",
      "Pasar Kliwon",
      "Serengan"
    ]
  },
  {
    id: "karanganyar",
    name: "Kab. Karanganyar",
    shortName: "Karanganyar",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    accentColor: "#059669",
    popularSpots: ["Colomadu", "Alun-alun Karanganyar", "Palur", "Jaten", "Tawangmangu", "Tasikmadu", "Kebakkramat"],
    districts: [
      "Colomadu",
      "Jaten",
      "Karanganyar",
      "Karangpandan",
      "Tasikmadu",
      "Kebakkramat",
      "Gondangrejo",
      "Matesih",
      "Mojogedang",
      "Ngargoyoso",
      "Tawangmangu",
      "Jatipuro",
      "Jatiyoso",
      "Jumantono",
      "Jumapolo",
      "Kerjo",
      "Jenawi"
    ]
  },
  {
    id: "sukoharjo",
    name: "Kab. Sukoharjo",
    shortName: "Sukoharjo",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    accentColor: "#2563eb",
    popularSpots: ["Solo Baru (The Park/Hartono)", "Kartasura (Goro Assalam / UMS)", "Baki", "Alun-alun Sukoharjo", "Mojolaban"],
    districts: [
      "Kartasura",
      "Grogol (Solo Baru)",
      "Baki",
      "Sukoharjo Kota",
      "Mojolaban",
      "Gatak",
      "Bendosari",
      "Bulu",
      "Nguter",
      "Polokarto",
      "Tawangsari",
      "Weru"
    ]
  },
  {
    id: "wonogiri",
    name: "Kab. Wonogiri",
    shortName: "Wonogiri",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    accentColor: "#d97706",
    popularSpots: ["Alun-alun Giri Krida Bakti", "Selogiri", "Baturetno", "Pracimantoro", "Waduk Gajah Mungkur", "Ngadirojo"],
    districts: [
      "Wonogiri Kota",
      "Selogiri",
      "Baturetno",
      "Pracimantoro",
      "Ngadirojo",
      "Purwantoro",
      "Slogohimo",
      "Eromoko",
      "Giritontro",
      "Giriwoyo",
      "Manyaran",
      "Wuryantoro",
      "Sidoharjo",
      "Jatisrono",
      "Jatipurno",
      "Jatiroto",
      "Kismantoro",
      "Bulukerto",
      "Tirtomoyo"
    ]
  },
  {
    id: "sragen",
    name: "Kab. Sragen",
    shortName: "Sragen",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    accentColor: "#7c3aed",
    popularSpots: ["Alun-alun Sragen", "Gemolong", "Masaran", "Kalijambe (Sangiran)", "Gondang", "Plupuh"],
    districts: [
      "Sragen Kota",
      "Gemolong",
      "Masaran",
      "Kalijambe",
      "Gondang",
      "Plupuh",
      "Sambungmacan",
      "Karangmalang",
      "Ngrampal",
      "Sumberlawang",
      "Kedawung",
      "Tanon",
      "Gesi",
      "Mondokan",
      "Miri",
      "Sukodono",
      "Tangen",
      "Jenar"
    ]
  },
  {
    id: "boyolali",
    name: "Kab. Boyolali",
    shortName: "Boyolali",
    badgeColor: "bg-teal-100 text-teal-800 border-teal-200",
    accentColor: "#0d9488",
    popularSpots: ["Patung Susu Tumpah Boyolali", "Ngemplak (Bandara Adi Soemarmo)", "Banyudono / Pengging", "Selo", "Ampel"],
    districts: [
      "Boyolali Kota",
      "Mojosongo",
      "Ngemplak",
      "Banyudono",
      "Ampel",
      "Teras",
      "Sambi",
      "Sawit",
      "Simo",
      "Cepogo",
      "Selo",
      "Musuk",
      "Gladagsari",
      "Karanggede",
      "Klego",
      "Andong",
      "Nogosari",
      "Kemusu",
      "Juwangi"
    ]
  },
  {
    id: "klaten",
    name: "Kab. Klaten",
    shortName: "Klaten",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
    accentColor: "#4f46e5",
    popularSpots: ["Alun-alun Klaten", "Delanggu", "Prambanan", "Umbul Ponggok / Polanharjo", "Pedan", "Jogonalan"],
    districts: [
      "Klaten Kota",
      "Delanggu",
      "Prambanan",
      "Polanharjo",
      "Pedan",
      "Ceper",
      "Jogonalan",
      "Trucuk",
      "Cawas",
      "Wedi",
      "Tulung",
      "Bayat",
      "Karanganom",
      "Jatinom",
      "Juwiring",
      "Kalikotes",
      "Ngawen",
      "Kemalang"
    ]
  }
];

export function getRegionById(id) {
  return SOLO_RAYA_REGIONS.find((r) => r.id === id) || null;
}

export function getDistrictsByRegionId(regionId) {
  const region = getRegionById(regionId);
  return region ? region.districts : [];
}
