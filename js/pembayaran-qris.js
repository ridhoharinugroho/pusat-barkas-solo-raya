// Inisialisasi Supabase Client jika belum ada
if (typeof window.supabaseClient === 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
  const SUPABASE_URL = 'https://rwjqqoulqdmtsweuvbef.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY';
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const listingId = urlParams.get('listing_id');
  const amount = Number(urlParams.get('amount'));
  
  if (!listingId || !amount || isNaN(amount)) {
    alert("Data pembayaran tidak valid.");
    window.location.href = 'toko-saya.html';
    return;
  }
  
  const qrisTotalAmount = document.getElementById('qrisTotalAmount');
  const btnCancelPayment = document.getElementById('btnCancelPayment');
  const statusText = document.getElementById('statusText');
  const statusIndicator = document.getElementById('statusIndicator');
  
  if (qrisTotalAmount) {
    qrisTotalAmount.innerText = `Rp ${amount.toLocaleString('id-ID')}`;
  }
  
  let pollingInterval = null;
  let isChecking = false;
  
  // Fungsi kembali dengan opsi hapus
  const handleCancel = async () => {
    if (confirm("Apakah Anda yakin ingin membatalkan pembayaran? Iklan BU (draf) Anda tidak akan ditayangkan.")) {
      btnCancelPayment.disabled = true;
      btnCancelPayment.innerText = "Membatalkan...";
      if (pollingInterval) clearInterval(pollingInterval);
      
      try {
        if (!window.supabaseClient) {
          console.error("Supabase client not initialized.");
          window.location.href = 'toko-saya.html';
          return;
        }

        // Hapus draf dari Supabase
        const { error } = await window.supabaseClient
          .from('listings')
          .delete()
          .eq('id', listingId);
          
        if (error) {
          console.error("Gagal menghapus draf:", error);
        } else {
          console.log("Draf berhasil dihapus.");
        }
      } catch (err) {
        console.error("Kesalahan saat membatalkan:", err);
      }
      
      window.location.href = 'toko-saya.html';
    }
  };
  
  btnCancelPayment?.addEventListener('click', handleCancel);
  
  // Mulai polling
  const startPolling = () => {
    if (pollingInterval) clearInterval(pollingInterval);
    
    pollingInterval = setInterval(async () => {
      if (isChecking) return;
      if (!window.supabaseClient) {
        console.warn("Menunggu inisialisasi Supabase client...");
        return;
      }
      isChecking = true;
      
      try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data, error } = await window.supabaseClient
          .from('mutations')
          .select('id')
          .eq('amount', amount)
          .gte('created_at', oneHourAgo)
          .limit(1);
          
        if (data && data.length > 0) {
          // Pembayaran ditemukan
          clearInterval(pollingInterval);
          pollingInterval = null;
          
          if (statusText) statusText.innerText = "Pembayaran Berhasil & Terverifikasi!";
          if (statusIndicator) {
            statusIndicator.className = "w-full p-3.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-bold mb-5 flex items-center justify-center gap-2 shadow-sm";
            statusIndicator.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i><span id="statusText">Pembayaran Berhasil & Terverifikasi!</span>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
          }
          
          // Update status listing di Supabase
          const { error: updateError } = await window.supabaseClient
            .from('listings')
            .update({
              is_bu: true,
              payment_status: 'paid',
              qris_verified: true,
              bu_activated_at: new Date().toISOString()
            })
            .eq('id', listingId);
            
          if (updateError) {
            console.error("Gagal update status BU:", updateError);
          } else {
            // Set flag sukses untuk dimunculkan toast di halaman toko
            sessionStorage.setItem('qris_success_listing_id', listingId);
          }
          
          btnCancelPayment.style.display = 'none'; // Sembunyikan tombol batal
          
          setTimeout(() => {
            window.location.href = 'toko-saya.html';
          }, 2500);
        }
      } catch (err) {
        console.error("Polling error:", err);
      } finally {
        isChecking = false;
      }
    }, 4000);
  };
  
  // Berikan sedikit jeda sebelum memulai polling (untuk memastikan insert supabase selesai)
  setTimeout(startPolling, 2000);
});
