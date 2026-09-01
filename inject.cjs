const fs = require("fs");
const path = require("path");

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    if (file === "node_modules" || file === ".git" || file === "dist" || file === "build") return;
    const dirPath = path.join(dir, file);
    if (fs.statSync(dirPath).isDirectory()) {
      filelist = walkSync(dirPath, filelist);
    } else if (/\.(html|js|jsx|ts|tsx)$/.test(file)) {
      filelist.push(dirPath);
    }
  });
  return filelist;
};

const allFiles = walkSync(".");
const targetFile = allFiles.find(f => f.toLowerCase().includes("form") || f.toLowerCase().includes("toko") || f.toLowerCase().includes("listing") || f.toLowerCase().includes("app")) || "index.html";

const popupBUBundle = `
<!-- ================= POPUP QRIS BU OTOMATIS ================= -->
<div id="qrisPopupModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 9999; justify-content: center; align-items: center;">
  <div style="background: #fff; padding: 25px; border-radius: 12px; width: 320px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
    <h3 style="margin-top: 0; color: #333;">Scan QRIS Iklan BU</h3>
    <p style="font-size: 13px; color: #666; margin-bottom: 15px;">Bayar tepat sampai 3 digit terakhir agar terverifikasi otomatis.</p>
    <img src="/qris-toko.jpg" alt="QRIS" style="width: 200px; height: 200px; display: block; margin: 0 auto 15px auto; border-radius: 6px; border: 1px solid #eee;" />
    <p style="font-size: 14px; color: #444; margin: 0;">Total Tagihan Unik:</p>
    <p id="popupQrisTotal" style="font-size: 24px; font-weight: bold; color: #d9534f; margin: 5px 0 15px 0;"></p>
    <div id="popupStatusIndicator" style="padding: 10px; background: #fff3cd; color: #856404; border-radius: 6px; font-size: 13px; font-weight: bold; margin-bottom: 15px;">
      Menunggu pembayaran masuk...
    </div>
    <button type="button" onclick="closeQrisPopup()" style="background: #ccc; color: #333; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; width: 100%;">Batal / Tutup</button>
  </div>
</div>

<script>
let pollingInterval = null;

function generateBUPrice() {
  const basePrice = 2000;
  const uniqueCode = Math.floor(Math.random() * (500 - 100 + 1)) + 100;
  return { finalAmount: basePrice + uniqueCode, uniqueCode };
}

function handleBMToggleChange(isChecked, listingId) {
  window.currentListingId = listingId;
  const modal = document.getElementById("qrisPopupModal");
  
  if (isChecked) {
    const { finalAmount, uniqueCode } = generateBUPrice();
    window.currentExpectedAmount = finalAmount;
    
    document.getElementById("popupQrisTotal").innerText = "Rp " + finalAmount.toLocaleString("id-ID");
    document.getElementById("popupStatusIndicator").innerText = "Menunggu transfer (Kode unik: " + uniqueCode + ")...";
    document.getElementById("popupStatusIndicator").style.background = "#fff3cd";
    document.getElementById("popupStatusIndicator").style.color = "#856404";
    
    modal.style.display = "flex";
    startAutoPolling(listingId, finalAmount);
  } else {
    modal.style.display = "none";
    stopAutoPolling();
  }
}

function closeQrisPopup() {
  document.getElementById("qrisPopupModal").style.display = "none";
  stopAutoPolling();
  // Matikan toggle jika dibatalkan
  const toggle = document.querySelector("input[name=\\"is_bu\\"]") || document.getElementById("buToggle");
  if (toggle) toggle.checked = false;
}

function startAutoPolling(listingId, expectedAmount) {
  stopAutoPolling();
  pollingInterval = setInterval(async () => {
    try {
      const res = await fetch("/api/check-mutation?amount=" + expectedAmount);
      const data = await res.json();

      if (data.isPaid) {
        stopAutoPolling();
        const indicator = document.getElementById("popupStatusIndicator");
        indicator.innerText = "Pembayaran Berhasil & Terverifikasi!";
        indicator.style.background = "#d4edda";
        indicator.style.color = "#155724";

        if (window.supabaseClient && listingId) {
          await window.supabaseClient.from("listings").update({
            is_bu: true,
            payment_status: "paid",
            qris_verified: true,
            bu_activated_at: new Date().toISOString()
          }).eq("id", listingId);
        }

        setTimeout(() => {
          document.getElementById("qrisPopupModal").style.display = "none";
          alert("Iklan BU berhasil diaktifkan secara otomatis!");
        }, 1500);
      }
    } catch (e) {
      console.error("Polling error:", e);
    }
  }, 4000); // Cek mutasi otomatis setiap 4 detik
}

function stopAutoPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}
</script>
<!-- ================= END POPUP QRIS BU OTOMATIS ================= -->
`;

let fileContent = fs.readFileSync(targetFile, "utf8");
if (!fileContent.includes("qrisPopupModal")) {
  fileContent += "\n" + popupBUBundle;
  fs.writeFileSync(targetFile, fileContent, "utf8");
  console.log("Berhasil memasang Popup QRIS otomatis ke: " + targetFile);
} else {
  console.log("Popup QRIS sudah ada di dalam file.");
}
