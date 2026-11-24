// @name سكربت التجربة الأول
// @match https://www.google.com/*

const banner = document.createElement("div");
banner.textContent = "✅ تم تشغيل السكربت من GitHub بنجاح!";
banner.style.cssText = "position:fixed; top:15px; left:50%; transform:translateX(-50%); background:#238636; color:#fff; padding:10px 20px; border-radius:8px; z-index:999999; font-family:system-ui; font-weight:bold; box-shadow:0 4px 12px rgba(0,0,0,0.3);";
document.body.appendChild(banner);
setTimeout(() => banner.remove(), 4000);
