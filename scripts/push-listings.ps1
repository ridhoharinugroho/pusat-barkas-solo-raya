###############################################
# push-listings.ps1
# Upserts default demo listings (Honda Beat, iPhone 11, etc.) to Supabase /rest/v1/listings
###############################################

$supabaseUrl = 'https://rwjqqoulqdmtsweuvbef.supabase.co'
$supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY'

$apiUrl = "$supabaseUrl/rest/v1/listings"

$defaultListings = @(
    @{
        id            = 'barkas-001'
        title         = 'Honda Beat FI ESP 2018 Surat Lengkap Pajak Jalan Klaten'
        description   = 'Honda Beat ESP 2018 warna merah putih plat AD Klaten. Surat komplit STNK, BPKB, Faktur ready di rumah. Pajak tertib panjang sampai November 2026. Mesin halus kering no rembes, ban depan belakang tebal tubeless. Langsung pakai no PR!'
        price         = 9800000
        category      = 'kendaraan'
        condition     = 'good'
        nego_type     = 'nego_alus'
        region        = 'klaten'
        district      = 'Delanggu'
        seller_id     = 'user-102'
        seller_name   = 'Toko Pak Joko'
        seller_phone  = '085725012345'
        seller_avatar = 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80'
        images        = @('https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80')
        status        = 'active'
        views         = 450
        created_at    = '2026-08-20T11:45:00Z'
        updated_at    = '2026-08-20T11:45:00Z'
    },
    @{
        id            = 'barkas-002'
        title         = 'iPhone 11 128GB Black iBox Mulus Fullset BH 84%'
        description   = 'iPhone 11 128 GB Region PA/A (iBox Resmi Indonesia), sinyal semua operator aman seumur hidup. Face ID ON, TrueTone ON, 3uTools hijau semua 98%. Kelengkapan dusbook original, kabel c-to-lightning, bonus 3 case premium. COD dicek sepuasnya di kafe sekitar UMS.'
        price         = 3950000
        category      = 'elektronik'
        condition     = 'good'
        nego_type     = 'nego_alus'
        region        = 'sukoharjo'
        district      = 'Kartasura'
        seller_id     = 'user-103'
        seller_name   = 'Rian Gadget Kartasura'
        seller_phone  = '089678123456'
        seller_avatar = 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=150&q=80'
        images        = @('https://images.unsplash.com/photo-1591337676887-a217a6970a8a?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&q=80')
        status        = 'active'
        views         = 310
        created_at    = '2026-08-20T08:00:00Z'
        updated_at    = '2026-08-20T08:00:00Z'
    },
    @{
        id            = 'barkas-003'
        title         = 'Mesin Cuci Sharp 2 Tabung 8 Kg Bersih Siap Pakai'
        description   = 'Barang rumahan mesin cuci Sharp Aquamagic 2 tabung kapasitas 8 kg. Tabung cuci & pengering normal kencang semua. Selang pembuangan & kabel utuh. Dijual karena ganti yang 1 tabung otomatis. Monggo diangkut bawa pick-up / mobil sendiri ya lur.'
        price         = 850000
        category      = 'perabot'
        condition     = 'good'
        nego_type     = 'nego_tipis'
        region        = 'karanganyar'
        district      = 'Jaten'
        seller_id     = 'user-102'
        seller_name   = 'Toko Pak Joko'
        seller_phone  = '085725012345'
        seller_avatar = 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80'
        images        = @('https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=800&q=80')
        status        = 'active'
        views         = 89
        created_at    = '2026-08-19T14:15:00Z'
        updated_at    = '2026-08-19T14:15:00Z'
    },
    @{
        id            = 'barkas-004'
        title         = 'Meja Belajar Anak Sekolah & Rak Buku Kayu Jati Kokoh'
        description   = 'Meja belajar anak sekolah bahan kayu jati asli + rak buku susun. Rangka kokoh, laci normal, tidak goyang. Cocok untuk belajar anak SD/SMP/SMA maupun mahasiswa. Lokasi Gemolong Sragen.'
        price         = 350000
        category      = 'alat-sekolah'
        condition     = 'good'
        nego_type     = 'nego_alus'
        region        = 'sragen'
        district      = 'Gemolong'
        seller_id     = 'user-104'
        seller_name   = 'Siti Aisyah'
        seller_phone  = '081234567890'
        seller_avatar = 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80'
        images        = @('https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=800&q=80')
        status        = 'active'
        views         = 115
        created_at    = '2026-08-17T09:10:00Z'
        updated_at    = '2026-08-17T09:10:00Z'
    }
)

$payloadJson = $defaultListings | ConvertTo-Json -Depth 5

try {
    $response = Invoke-RestMethod -Method POST -Uri $apiUrl -Headers @{
        "apikey"        = $supabaseKey
        "Authorization" = "Bearer $supabaseKey"
        "Content-Type"  = "application/json"
        "Prefer"        = "return=representation, resolution=merge-duplicates"
    } -Body $payloadJson
    Write-Host "✅ Demo listings seeded successfully to Supabase!"
} catch {
    Write-Error "❌ Failed to seed listings: $_"
    exit 1
}
