function whenFirebaseReady(callback){
  if(window.db && window.ref && window.onValue && window.set){
    callback();
  }else{
    window.addEventListener("firebase-ready", callback, { once:true });
  }
}

let bookings = {};
let reviews = {};
let bookingRequests = {};
let gameRequests = {};
let promos = {};
let addons = {};

let bookingsRef;
let websiteRef;
let reviewsRef;
let bookingRequestsRef;
let gameRequestsRef;
let promosRef;
let addonsRef;

let websiteDataCache = {};
let currentReviewRating = 5;
let activeGameConsoleFilter = "all";
let activeGameSearch = "";
let currentReviewBookingId = "";
let pendingWhatsAppUrl = "";

// State untuk Add-on Counter Dinamis
let addonCounts = {};

let currentCalendarDate = new Date();
let selectedDateForBooking = "";

const DEFAULT_ADDONS = {
  addon_joycon: {
    id: "addon_joycon",
    name: "Extra Joy-Con Pair",
    category: "Nintendo Switch OLED",
    price: 25000,
    stock: 5,
    description: "Sepasang Joy-Con original Nintendo Switch untuk main berempat.",
    status: "active",
    active: true
  },
  addon_dualsense: {
    id: "addon_dualsense",
    name: "Extra DualSense PS5",
    category: "PS5",
    price: 30000,
    stock: 4,
    description: "Stik DualSense wireless original PlayStation 5 / Playbox.",
    status: "active",
    active: true
  }
};

const SPECIFIC_CONSOLE_TYPES = ["PS3", "PS4", "PS5", "Nintendo Switch OLED", "Nintendo Switch 2"];

function getConsoleCategoryFromType(type){
  if(type === "Nintendo Switch OLED" || type === "Nintendo Switch 2") return "Nintendo";
  if(type === "PS3" || type === "PS4" || type === "PS5") return "PlayStation";
  return (type && type.toLowerCase().includes("nintendo")) ? "Nintendo" : "PlayStation";
}

function isGameCompatibleWithConsole(game, consoleSpecificType, consoleCategory){
  if(!game) return false;
  const gameConsole = String(game.console || "").trim().toLowerCase();
  const targetCategory = String(consoleCategory || getConsoleCategoryFromType(consoleSpecificType)).trim().toLowerCase();
  if(gameConsole && targetCategory && gameConsole !== targetCategory) {
    return false;
  }

  let types = [];
  if(Array.isArray(game.specificTypes)){
    types = game.specificTypes.map(t => String(t).trim().toLowerCase());
  } else if(typeof game.specificTypes === "string" && game.specificTypes.trim()){
    types = game.specificTypes.split(",").map(t => t.trim().toLowerCase());
  } else if(game.specificType){
    types = [String(game.specificType).trim().toLowerCase()];
  }

  if(!types.length){
    return true;
  }

  if(!consoleSpecificType){
    return true;
  }

  return types.includes(String(consoleSpecificType).trim().toLowerCase());
}

const DEFAULT_GAME_PREVIEWS = [
  {
    title: "Mario Kart 8 Deluxe",
    console: "Nintendo",
    specificTypes: ["Nintendo Switch OLED", "Nintendo Switch 2"],
    youtube: "https://www.youtube.com/watch?v=tKlRN2YpxRE"
  },
  {
    title: "Zelda: Tears of the Kingdom",
    console: "Nintendo",
    specificTypes: ["Nintendo Switch OLED", "Nintendo Switch 2"],
    youtube: "https://www.youtube.com/watch?v=uHGShqcAHlQ"
  },
  {
    title: "Super Smash Bros. Ultimate",
    console: "Nintendo",
    specificTypes: ["Nintendo Switch OLED", "Nintendo Switch 2"],
    youtube: "https://www.youtube.com/watch?v=WShCN-AYHqA"
  },
  {
    title: "Animal Crossing",
    console: "Nintendo",
    specificTypes: ["Nintendo Switch OLED", "Nintendo Switch 2"],
    youtube: "https://www.youtube.com/watch?v=_3YNL0OWio0"
  },
  {
    title: "FIFA / FC",
    console: "PlayStation",
    specificTypes: ["PS4", "PS5"],
    youtube: "https://www.youtube.com/watch?v=XhP3Xh4LMA8"
  },
  {
    title: "Tekken",
    console: "PlayStation",
    specificTypes: ["PS5"],
    youtube: "https://www.youtube.com/watch?v=2hPuRQz6IlM"
  },
  {
    title: "GTA V",
    console: "PlayStation",
    specificTypes: ["PS3", "PS4", "PS5"],
    youtube: "https://www.youtube.com/watch?v=QkkoHAzjnUs"
  },
  {
    title: "Naruto Storm",
    console: "PlayStation",
    specificTypes: ["PS3", "PS4", "PS5"],
    youtube: "https://www.youtube.com/watch?v=K_xTet06SUo"
  }
];

const DEFAULT_UNITS = [
  {
    id: "nintendo",
    name: "Nintendo Switch OLED",
    category: "Nintendo",
    specificType: "Nintendo Switch OLED",
    description: "Main game favorit dengan layar OLED premium.",
    price: "80.000",
    status: "READY",
    badge: "READY",
    image: "",
    installedGames: [
      "Mario Kart 8 Deluxe",
      "Zelda: Tears of the Kingdom"
    ]
  },
  {
    id: "playbox",
    name: "Playbox",
    category: "PlayStation",
    specificType: "PS5",
    description: "Console game seru dengan banyak pilihan game.",
    price: "70.000",
    status: "READY",
    badge: "READY",
    image: "",
    installedGames: [
      "FIFA / FC",
      "GTA V"
    ]
  }
];

const DEFAULT_PROMOS = [
  {
    id: "promo_weekend",
    title: "Promo Weekend",
    category: "ALL",
    type: "fixed",
    value: 15000,
    minDays: 2,
    description: "Potongan Rp 15.000 untuk sewa min 2 hari di akhir pekan.",
    active: true
  },
  {
    id: "promo_weekday",
    title: "Promo Hemat Weekday",
    category: "ALL",
    type: "fixed",
    value: 10000,
    minDays: 1,
    description: "Potongan Rp 10.000 untuk main santai hari kerja.",
    active: true
  },
  {
    id: "promo_nintendo",
    title: "Promo Mabar Switch OLED",
    category: "Nintendo Switch OLED",
    type: "fixed",
    value: 20000,
    minDays: 2,
    description: "Khusus sewa Nintendo Switch OLED minimal 2 hari.",
    active: true
  },
  {
    id: "promo_ps",
    title: "Promo Playbox Seru",
    category: "PS5",
    type: "percent",
    value: 10,
    minDays: 1,
    description: "Diskon 10% sewa PlayStation / Playbox.",
    active: true
  }
];

const DEFAULT_DATA = {
  whatsappNumber: "6281235014308",
  publicWebUrl: "https://starzone-web.vercel.app",
  promoTitle: "Promo Weekend",
  promoBody: "Sewa sekarang dan konfirmasi via WhatsApp admin.",
  runningText: "NINTENDO SWITCH OLED | PLAYBOX READY | BOOKING VIA WHATSAPP | UPDATE REALTIME",
  storeStatus: "open",
  storeHours: "Buka sampai 22:00",
  openHour: 8,
  closeHour: 22,
  minuteInterval: 15,
  nintendoPrice: "80.000",
  playboxPrice: "70.000",
  nintendoBadge: "READY",
  playboxBadge: "READY",
  units: DEFAULT_UNITS,
  gamePreviews: DEFAULT_GAME_PREVIEWS,
  promos: DEFAULT_PROMOS,
  testimonials: [
    "Barang bagus, admin fast respon, recommended!",
    "Unit bersih dan cocok buat acara keluarga.",
    "Booking mudah, jadwalnya jelas, mantap."
  ],
  faqItems: [
    {
      question: "Apakah bisa antar jemput?",
      answer: "Bisa. Isi alamat lengkap dan jam antar pada form booking, lalu admin akan konfirmasi lewat WhatsApp."
    },
    {
      question: "Booking valid kapan?",
      answer: "Booking dianggap valid setelah admin membalas dan mengonfirmasi jadwal sewa."
    },
    {
      question: "Apakah jadwal realtime?",
      answer: "Iya. Jika admin mengubah status jadwal atau mengonfirmasi booking, tampilan kalender otomatis ter-update."
    },
    {
      question: "Kalau ingin tanya dulu?",
      answer: "Klik tombol WhatsApp atau isi form booking. Admin akan bantu cek unit, jadwal, dan harga."
    }
  ],
  termsItems: [
    "Customer wajib mengisi data booking dengan benar.",
    "Jadwal sewa hanya valid setelah dikonfirmasi oleh admin.",
    "Kerusakan atau kehilangan unit selama masa sewa menjadi tanggung jawab penyewa.",
    "Keterlambatan pengembalian dapat dikenakan biaya tambahan sesuai konfirmasi admin.",
    "Perubahan jadwal wajib dikonfirmasi melalui WhatsApp admin."
  ],
  logo: "",
  hero: "",
  nintendoImage: "",
  playboxImage: "",
  gallery1: "",
  gallery2: "",
  gallery3: "",
  gallery4: ""
};

const PLACEHOLDER = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#12121e"/><stop offset="1" stop-color="#1a1a2e"/></linearGradient></defs>
  <rect width="900" height="600" fill="url(#g)"/>
  <rect x="30" y="30" width="840" height="540" fill="none" stroke="#f5c518" stroke-width="6" stroke-dasharray="18 14" opacity="0.6"/>
  <text x="450" y="285" text-anchor="middle" font-family="monospace" font-size="38" fill="#f5c518">STARZONE</text>
  <text x="450" y="335" text-anchor="middle" font-family="monospace" font-size="22" fill="#00e5ff">Belum ada gambar</text>
</svg>`);

/* Enforce Minimum Date to Today */
function enforceMinBookingDate(){
  const tanggalInput = document.getElementById("tanggal");
  if(!tanggalInput) return;

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  tanggalInput.setAttribute("min", todayStr);
  if(tanggalInput.value && tanggalInput.value < todayStr){
    tanggalInput.value = todayStr;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  enforceMinBookingDate();
  initPixelOpeningIntro();
  initPixelDashboardLoop();
  setupPixelTimePicker(DEFAULT_DATA);
});

whenFirebaseReady(() => {
  bookingsRef = ref(window.db, "bookings");
  websiteRef = ref(window.db, "websiteData");
  reviewsRef = ref(window.db, "reviews");
  bookingRequestsRef = ref(window.db, "bookingRequests");
  gameRequestsRef = ref(window.db, "gameRequests");
  promosRef = ref(window.db, "promos");
  addonsRef = ref(window.db, "addons");

  enforceMinBookingDate();

  onValue(bookingsRef, (snapshot) => {
    bookings = snapshot.val() || {};
    renderMonthCalendar();
  });

  onValue(websiteRef, (snapshot) => {
    websiteDataCache = { ...DEFAULT_DATA, ...(snapshot.val() || {}) };
    loadWebsiteData(websiteDataCache);
    renderMonthCalendar();
    calculateLivePrice();
  });

  onValue(addonsRef, (snapshot) => {
    const val = snapshot.val();
    if(val && typeof val === "object"){
      addons = val;
    } else {
      addons = { ...DEFAULT_ADDONS };
    }
    renderDynamicAddons();
    calculateLivePrice();
  });

  onValue(promosRef, (snapshot) => {
    const val = snapshot.val();
    if(val && typeof val === "object"){
      promos = val;
    } else {
      promos = {};
      DEFAULT_PROMOS.forEach(p => { promos[p.id] = p; });
    }
    populatePromoSelect();
    calculateLivePrice();
    updatePromoBannerSlideshow();
  });

  onValue(reviewsRef, (snapshot) => {
    reviews = snapshot.val() || {};
    renderPublicReviews();
  });

  onValue(bookingRequestsRef, (snapshot) => {
    bookingRequests = snapshot.val() || {};
    prefillReviewFromBookingId();
    renderDynamicAddons();
    calculateLivePrice();
  });

  onValue(gameRequestsRef, (snapshot) => {
    gameRequests = snapshot.val() || {};
  });

  setReviewRating(5);
  initGamePreviewControls();
  checkBookingIdParam();
  calculateLivePrice();
});

function getNormalizedUnits(data = websiteDataCache){
  let rawUnits = data.units;
  if(rawUnits && !Array.isArray(rawUnits)){
    rawUnits = Object.values(rawUnits);
  }
  if(!Array.isArray(rawUnits) || !rawUnits.length){
    return [
      {
        id: "nintendo",
        name: "Nintendo Switch OLED",
        category: "Nintendo",
        specificType: "Nintendo Switch OLED",
        description: "Main game favorit dengan layar OLED premium.",
        price: data.nintendoPrice || DEFAULT_DATA.nintendoPrice,
        status: "READY",
        badge: data.nintendoBadge || DEFAULT_DATA.nintendoBadge,
        image: data.nintendoImage || "",
        installedGames: DEFAULT_UNITS[0].installedGames
      },
      {
        id: "playbox",
        name: "Playbox",
        category: "PlayStation",
        specificType: "PS5",
        description: "Console game seru dengan banyak pilihan game.",
        price: data.playboxPrice || DEFAULT_DATA.playboxPrice,
        status: "READY",
        badge: data.playboxBadge || DEFAULT_DATA.playboxBadge,
        image: data.playboxImage || "",
        installedGames: DEFAULT_UNITS[1].installedGames
      }
    ];
  }

  return rawUnits.map((u, idx) => {
    let games = u.installedGames || [];
    if(typeof games === "string"){
      games = games.split(",").map(g => g.trim()).filter(Boolean);
    } else if(!Array.isArray(games)){
      games = Object.values(games || {});
    }
    let fallbackImg = u.image || "";
    if(!fallbackImg && u.id === "nintendo") fallbackImg = data.nintendoImage || "";
    if(!fallbackImg && u.id === "playbox") fallbackImg = data.playboxImage || "";

    const normCat = u.category || (String(u.name || "").toLowerCase().includes("nintendo") ? "Nintendo" : "PlayStation");
    let normSpec = u.specificType || "";
    if(!normSpec || normSpec === "Nintendo Switch V2"){
      normSpec = (normCat === "Nintendo" ? "Nintendo Switch OLED" : "PS5");
    }

    const normStatus = String(u.status || "READY").toUpperCase();
    return {
      id: u.id || `unit_${idx + 1}`,
      name: u.name || `Unit ${idx + 1}`,
      category: normCat,
      specificType: normSpec,
      description: u.description || "Main game seru dengan kondisi terbaik.",
      price: u.price || "70.000",
      status: normStatus,
      badge: u.badge || normStatus,
      image: fallbackImg,
      installedGames: games
    };
  });
}

function parsePriceNumber(priceStr){
  if(typeof priceStr === "number") return priceStr;
  const cleaned = String(priceStr || "0").replace(/[^0-9]/g, "");
  return parseInt(cleaned, 10) || 0;
}

function formatRupiah(number){
  return "Rp " + (Number(number) || 0).toLocaleString("id-ID");
}

function parseDurationDays(durasiStr){
  if(!durasiStr) return 1;
  const match = String(durasiStr).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

function getRentalDateRange(startDateStr, days){
  if(!startDateStr) return [];
  const dates = [];
  const start = new Date(startDateStr + "T00:00:00");
  for(let i = 0; i < days; i++){
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

/* ========================================================
   FITUR 2: PENGELOLAAN ADD-ON DINAMIS (NODE /addons)
   ======================================================== */
function getSelectedConsoleCategory(){
  const paket = document.getElementById("paket")?.value || "";
  if(!paket) return "ALL";
  const units = getNormalizedUnits(websiteDataCache);
  const selectedUnit = units.find(u => u.name === paket);
  if(selectedUnit && selectedUnit.category) {
    return selectedUnit.category.toUpperCase();
  }
  if(paket.toLowerCase().includes("nintendo")) return "NINTENDO";
  if(paket.toLowerCase().includes("playbox") || paket.toLowerCase().includes("playstation")) return "PLAYSTATION";
  return "ALL";
}

function getSelectedConsoleSpecificType(){
  const paket = document.getElementById("paket")?.value || "";
  if(!paket) return "";
  const units = getNormalizedUnits(websiteDataCache);
  const selectedUnit = units.find(u => u.name === paket);
  if(selectedUnit && selectedUnit.specificType && selectedUnit.specificType !== "Nintendo Switch V2"){
    return selectedUnit.specificType;
  }
  const pLower = paket.toLowerCase();
  if(pLower.includes("oled")) return "Nintendo Switch OLED";
  if(pLower.includes("switch 2")) return "Nintendo Switch 2";
  if(pLower.includes("switch") || pLower.includes("nintendo")) return "Nintendo Switch OLED";
  if(pLower.includes("ps5") || pLower.includes("playbox")) return "PS5";
  if(pLower.includes("ps4")) return "PS4";
  if(pLower.includes("ps3")) return "PS3";
  return "";
}

/* ========================================================
   MANAJEMEN STOK ADD-ON DINAMIS BERBASIS TANGGAL
   (DATE-AWARE ADD-ON AVAILABILITY)
   ======================================================== */
function getAddonAvailableStock(addonId, startDateStr, days, bookingRequestsData = bookingRequests, addonsData = addons){
  const item = addonsData[addonId] || DEFAULT_ADDONS[addonId];
  if(!item) return 0;

  const totalStock = (typeof item.stock !== "undefined") ? parseInt(item.stock, 10) : 5;
  if(totalStock <= 0) return 0;

  // Jika tanggal mulai atau durasi belum diisi lengkap, tampilkan total stok fisik
  if(!startDateStr || !days || days <= 0){
    return totalStock;
  }

  const targetDates = getRentalDateRange(startDateStr, days);
  if(!targetDates.length) return totalStock;

  // Hitung pemakaian puncak pada setiap tanggal target yang bersimpangan dengan booking confirmed
  let maxUsed = 0;

  for(const targetDate of targetDates){
    let usedOnDate = 0;

    Object.values(bookingRequestsData || {}).forEach(bk => {
      if(!bk) return;
      const status = String(bk.status || "").toLowerCase().trim();
      // Hanya pesanan berstatus 'confirmed' yang memblokir/mengurangi stok
      if(status !== "confirmed") return;

      const bkDays = bk.durasiHari || parseDurationDays(bk.durasi) || 1;
      const bkDates = Array.isArray(bk.rentalDates) && bk.rentalDates.length
        ? bk.rentalDates
        : getRentalDateRange(bk.tanggal, bkDays);

      if(bkDates.includes(targetDate)){
        const bAddons = bk.addOns;
        if(Array.isArray(bAddons)){
          const found = bAddons.find(x => x && x.id === addonId);
          if(found){
            usedOnDate += (parseInt(found.qty, 10) || 0);
          }
        } else if(bAddons && typeof bAddons === "object"){
          const found = bAddons[addonId];
          if(found){
            if(typeof found === "number"){
              usedOnDate += found;
            } else if(typeof found === "object" && typeof found.qty !== "undefined"){
              usedOnDate += (parseInt(found.qty, 10) || 0);
            }
          }
        }
      }
    });

    if(usedOnDate > maxUsed){
      maxUsed = usedOnDate;
    }
  }

  return Math.max(0, totalStock - maxUsed);
}

function handleDateOrDurationChange(){
  renderDynamicAddons();
  calculateLivePrice();
  checkDateCollisionPreview();
}
window.handleDateOrDurationChange = handleDateOrDurationChange;

function renderDynamicAddons(){
  const container = document.getElementById("bookingAddonList");
  if(!container) return;

  const currentCat = getSelectedConsoleCategory();
  const currentSpecificType = getSelectedConsoleSpecificType();
  const paket = document.getElementById("paket")?.value || "";
  const tanggal = document.getElementById("tanggal")?.value || "";
  const durasiText = document.getElementById("durasi")?.value || "";
  const days = parseDurationDays(durasiText);
  const hasDateAndDuration = Boolean(tanggal && durasiText && days > 0);

  // Ambil hanya add-on berstatus active
  const activeAddons = Object.entries(addons || {})
    .map(([id, a]) => ({ id, ...(a || {}) }))
    .filter(a => (a.status === "active" || a.active === true));

  // Menyaring pilihan Add-on: hanya menampilkan Add-on berstatus active
  // yang bertarget ALL atau sesuai Tipe Spesifik Konsol / Kategori Konsol yang dipilih
  const filteredAddons = activeAddons.filter(a => {
    const target = String(a.category || "ALL").trim();
    if(target.toUpperCase() === "ALL") return true;

    if(!paket){
      return true;
    }

    if(currentSpecificType && target.toLowerCase() === currentSpecificType.toLowerCase()){
      return true;
    }

    if(currentCat && currentCat !== "ALL" && target.toUpperCase() === currentCat.toUpperCase()){
      return true;
    }

    return false;
  });

  // Bersihkan kuantiti counter untuk add-on yang sekarang tersembunyi
  Object.keys(addonCounts).forEach(id => {
    if(!filteredAddons.some(fa => fa.id === id)){
      addonCounts[id] = 0;
    }
  });

  // Auto-clamp: Sesuaikan kuantiti pilihan jika melebihi stok yang tersedia di tanggal ini
  filteredAddons.forEach(a => {
    const availStock = getAddonAvailableStock(a.id, tanggal, hasDateAndDuration ? days : 0);
    if((addonCounts[a.id] || 0) > availStock){
      addonCounts[a.id] = Math.max(0, availStock);
    }
  });

  if(!filteredAddons.length){
    container.innerHTML = `<p class="admin-small-text" style="color:var(--muted); padding:8px 0;">Tidak ada add-on khusus untuk tipe konsol ini.</p>`;
    return;
  }

  container.innerHTML = filteredAddons.map(a => {
    const totalStock = (typeof a.stock !== "undefined") ? parseInt(a.stock, 10) : 5;
    const availStock = getAddonAvailableStock(a.id, tanggal, hasDateAndDuration ? days : 0);
    const qty = addonCounts[a.id] || 0;
    const isOutOfStock = (availStock <= 0);
    const isMax = (qty >= availStock);

    let stockNoticeHtml = "";
    if(isOutOfStock){
      stockNoticeHtml = `<span class="addon-out-of-stock-badge">[Stok Habis di Tanggal Ini]</span>`;
    } else if(hasDateAndDuration){
      if(availStock < totalStock){
        stockNoticeHtml = `<span class="addon-stock-info date-aware">Sisa ${availStock} unit di tanggal ini (Total: ${totalStock})</span>`;
      } else {
        stockNoticeHtml = `<span class="addon-stock-info date-aware">Tersedia ${availStock} unit</span>`;
      }
    } else {
      stockNoticeHtml = `<span class="addon-stock-info">Stok: ${totalStock}</span>`;
    }

    return `
      <div class="addon-item-box ${isOutOfStock ? 'addon-out-of-stock' : ''}" id="addonBox_${a.id}">
        <div class="addon-info">
          <span class="addon-name">${escapeHtml(a.name)}</span>
          <span class="addon-sub">
            +${formatRupiah(a.price)} / hari • ${stockNoticeHtml}
          </span>
        </div>
        <div class="addon-counter-control">
          <button type="button" class="btn-addon-step" onclick="changeAddonQty('${a.id}', -1)" ${qty <= 0 ? 'disabled' : ''} aria-label="Kurangi ${escapeHtml(a.name)}">-</button>
          <span id="addonQty_${a.id}" class="addon-counter-value">${qty}</span>
          <button type="button" class="btn-addon-step" id="btnPlus_${a.id}" onclick="changeAddonQty('${a.id}', 1)" ${isMax || isOutOfStock ? 'disabled' : ''} aria-label="Tambah ${escapeHtml(a.name)}">+</button>
        </div>
      </div>
    `;
  }).join("");
}

function changeAddonQty(id, delta){
  const item = addons[id] || (DEFAULT_ADDONS[id] || null);
  if(!item) return;

  const tanggal = document.getElementById("tanggal")?.value || "";
  const durasiText = document.getElementById("durasi")?.value || "";
  const days = parseDurationDays(durasiText);
  const hasDateAndDuration = Boolean(tanggal && durasiText && days > 0);

  const maxStock = getAddonAvailableStock(id, tanggal, hasDateAndDuration ? days : 0);
  const current = addonCounts[id] || 0;
  const next = Math.max(0, Math.min(maxStock, current + delta));

  addonCounts[id] = next;

  const qtyEl = document.getElementById(`addonQty_${id}`);
  if(qtyEl) qtyEl.textContent = next;

  const btnPlus = document.getElementById(`btnPlus_${id}`);
  if(btnPlus){
    btnPlus.disabled = (next >= maxStock || maxStock <= 0);
  }

  const minusBtn = document.querySelector(`#addonBox_${id} button[onclick*="-1"]`);
  if(minusBtn){
    minusBtn.disabled = (next <= 0);
  }

  calculateLivePrice();
}

/* ========================================================
   FITUR 3: PROMO SPESIFIK KATEGORI KONSOL (ALL, NINTENDO, PLAYSTATION)
   ======================================================== */
function populatePromoSelect(){
  const promoEl = document.getElementById("promoSelect");
  if(!promoEl) return;

  const currentVal = promoEl.value;
  const currentCat = getSelectedConsoleCategory();
  const currentSpecificType = getSelectedConsoleSpecificType();

  promoEl.innerHTML = `<option value="">-- Tanpa Promo --</option>`;

  // Filter promo: aktif & kategori ALL atau sesuai kategori / tipe spesifik konsol terpilih
  const items = Object.entries(promos || {})
    .map(([id, p]) => ({ id, ...(p || {}) }))
    .filter(p => {
      if(p.active === false) return false;
      const pCat = String(p.category || "ALL").trim();
      if(pCat.toUpperCase() === "ALL") return true;
      if(!currentCat || currentCat === "ALL") return true;
      if(currentSpecificType && pCat.toLowerCase() === currentSpecificType.toLowerCase()) return true;
      return pCat.toUpperCase() === currentCat.toUpperCase();
    });

  items.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    const discountLabel = p.type === "percent"
      ? `Diskon ${p.value}%`
      : `Potongan ${formatRupiah(p.value)}`;
    const catLabel = p.category && p.category !== "ALL" ? `[${p.category}] ` : "";
    opt.textContent = `${catLabel}${p.title || "Promo"} (${discountLabel})`;
    promoEl.appendChild(opt);
  });

  // Jika promo yang dipilih sebelumnya masih cocok, pertahankan; jika tidak, reset
  if(currentVal && items.some(p => p.id === currentVal)){
    promoEl.value = currentVal;
  } else {
    promoEl.value = "";
  }
}

/* ========================================================
   FITUR PROMO REALTIME BANNER SLIDESHOW & DETAIL MODAL
   ======================================================== */
let promoSlideshowTimer = null;
let promoSlideshowIndex = 0;

function updatePromoBannerSlideshow(){
  const titleEl = document.getElementById("promoTitleText");
  const bodyEl = document.getElementById("promoBodyText");
  if(!titleEl || !bodyEl) return;

  const activeList = Object.values(promos || {}).filter(p => p && p.active !== false);

  if(!activeList.length){
    titleEl.textContent = websiteDataCache.promoTitle || DEFAULT_DATA.promoTitle || "Promo Weekend";
    bodyEl.textContent = websiteDataCache.promoBody || DEFAULT_DATA.promoBody || "Sewa sekarang dan konfirmasi via WhatsApp admin.";
    if(promoSlideshowTimer){
      clearInterval(promoSlideshowTimer);
      promoSlideshowTimer = null;
    }
    return;
  }

  const applyPromoToBanner = (p) => {
    titleEl.classList.remove("promo-title-fade");
    void titleEl.offsetWidth; // trigger reflow for smooth animation
    titleEl.classList.add("promo-title-fade");

    const discountLabel = p.type === "percent"
      ? `Diskon ${p.value}%`
      : `Potongan ${formatRupiah(p.value)}`;
    const catLabel = p.category && p.category !== "ALL" ? `[${p.category}] ` : "";
    titleEl.textContent = `★ ${catLabel}${p.title || "PROMO SPESIAL"} (${discountLabel}) ★`;

    let desc = p.description || "";
    if(p.minDays > 1){
      desc = (desc ? desc + " " : "") + `(Min. sewa ${p.minDays} hari)`;
    }
    bodyEl.textContent = desc || "Sewa sekarang dan pilih promo di form booking untuk klaim diskon!";
  };

  if(promoSlideshowIndex >= activeList.length) promoSlideshowIndex = 0;
  applyPromoToBanner(activeList[promoSlideshowIndex]);

  if(promoSlideshowTimer){
    clearInterval(promoSlideshowTimer);
    promoSlideshowTimer = null;
  }

  if(activeList.length > 1){
    promoSlideshowTimer = setInterval(() => {
      const currentActives = Object.values(promos || {}).filter(p => p && p.active !== false);
      if(!currentActives.length) return;
      promoSlideshowIndex = (promoSlideshowIndex + 1) % currentActives.length;
      applyPromoToBanner(currentActives[promoSlideshowIndex]);
    }, 4500);
  }
}

function openPromoDetailModal(){
  const modal = document.getElementById("promoDetailModal");
  const listEl = document.getElementById("promoDetailModalList");
  if(!modal || !listEl) return;

  const activeList = Object.values(promos || {}).filter(p => p && p.active !== false);

  if(!activeList.length){
    listEl.innerHTML = `
      <div style="text-align:center; padding: 24px 10px; color: var(--muted); font-size:14px;">
        Belum ada promo aktif saat ini. Pantau terus update promo dari STARZONE!
      </div>
    `;
  } else {
    listEl.innerHTML = activeList.map(p => {
      const discountLabel = p.type === "percent"
        ? `DISKON ${p.value}%`
        : `HEMAT ${formatRupiah(p.value)}`;
      const catBadge = p.category && p.category !== "ALL"
        ? `<span class="promo-badge-tag active">${escapeHtml(p.category)}</span>`
        : `<span class="promo-badge-tag active" style="border-color:var(--yellow); color:var(--yellow);">SEMUA KONSOL</span>`;
      const minDaysText = p.minDays > 1
        ? `<span>Min. Sewa: <strong style="color:var(--yellow);">${p.minDays} Hari</strong></span>`
        : `<span>Min. Sewa: <strong style="color:var(--yellow);">1 Hari</strong></span>`;

      return `
        <div class="promo-detail-card">
          <div class="promo-detail-header">
            <span class="promo-detail-title">${escapeHtml(p.title || "Promo")}</span>
            <span class="promo-discount-badge">${discountLabel}</span>
          </div>
          <div class="promo-detail-meta">
            ${catBadge}
            ${minDaysText}
          </div>
          ${p.description ? `<p class="promo-detail-desc">${escapeHtml(p.description)}</p>` : ""}
        </div>
      `;
    }).join("");
  }

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closePromoDetailModal(){
  const modal = document.getElementById("promoDetailModal");
  if(modal){
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

window.openPromoDetailModal = openPromoDetailModal;
window.closePromoDetailModal = closePromoDetailModal;

/* ========================================================
   FITUR 1: LIVE PRICE PREVIEW BOX
   ======================================================== */
function calculateLivePrice(){
  const paketEl = document.getElementById("paket");
  const durasiEl = document.getElementById("durasi");
  const promoEl = document.getElementById("promoSelect");

  const paket = paketEl ? paketEl.value : "";
  const durasiText = durasiEl ? durasiEl.value : "";
  const promoId = promoEl ? promoEl.value : "";

  const units = getNormalizedUnits(websiteDataCache);
  const selectedUnit = units.find(u => u.name === paket);
  const unitDailyPrice = selectedUnit ? parsePriceNumber(selectedUnit.price) : 0;

  const days = durasiText ? parseDurationDays(durasiText) : 0;
  const unitTotal = days > 0 ? unitDailyPrice * days : 0;

  // Add-on cost: Dihitung secara dinamis dari addonCounts
  let totalAddon = 0;
  const addonBreakdownParts = [];

  Object.entries(addonCounts).forEach(([addonId, qty]) => {
    if(qty > 0){
      const a = addons[addonId] || DEFAULT_ADDONS[addonId];
      if(a){
        const price = parseInt(a.price, 10) || 0;
        const sub = qty * price * (days > 0 ? days : 1);
        totalAddon += sub;
        addonBreakdownParts.push(`${a.name} (${qty}x)`);
      }
    }
  });

  // Promo calculation
  let discountAmount = 0;
  let promoTitle = "";
  if(promoId && promos[promoId]){
    const p = promos[promoId];
    promoTitle = p.title || "Promo";
    const minDays = p.minDays || 1;
    if(days >= minDays || days === 0){
      if(p.type === "percent"){
        discountAmount = Math.round(unitTotal * ((p.value || 0) / 100));
      } else {
        discountAmount = parseInt(p.value, 10) || 0;
      }
    }
  }

  const grandTotal = Math.max(0, (unitTotal + totalAddon) - discountAmount);

  // Update DOM UI
  const unitLabelEl = document.getElementById("calcUnitLabel");
  const unitValEl = document.getElementById("calcUnitVal");
  const addonLabelEl = document.getElementById("calcAddonLabel");
  const addonValEl = document.getElementById("calcAddonVal");
  const discountRowEl = document.getElementById("calcDiscountRow");
  const discountLabelEl = document.getElementById("calcDiscountLabel");
  const discountValEl = document.getElementById("calcDiscountVal");
  const totalAmountEl = document.getElementById("calcTotalAmount");

  if(unitLabelEl){
    unitLabelEl.textContent = selectedUnit
      ? `${selectedUnit.name} (${days} hari)`
      : `Sewa Unit (${days} hari)`;
  }
  if(unitValEl){
    unitValEl.textContent = formatRupiah(unitTotal);
  }

  if(addonLabelEl){
    addonLabelEl.textContent = addonBreakdownParts.length
      ? `Add-on (${addonBreakdownParts.join(", ")})`
      : "Aksesori Add-on";
  }
  if(addonValEl){
    addonValEl.textContent = formatRupiah(totalAddon);
  }

  if(discountRowEl){
    if(discountAmount > 0){
      discountRowEl.style.display = "flex";
      if(discountLabelEl) discountLabelEl.textContent = `Diskon (${promoTitle})`;
      if(discountValEl) discountValEl.textContent = `-${formatRupiah(discountAmount)}`;
    } else {
      discountRowEl.style.display = "none";
    }
  }

  if(totalAmountEl){
    totalAmountEl.textContent = formatRupiah(grandTotal);
  }

  return {
    unitTotal,
    totalAddon,
    discountAmount,
    grandTotal,
    days
  };
}

/* ========================================================
   FITUR 4: LOGIKA KALENDER HAKIKI (ABAIKAN COMING SOON & MAINTENANCE)
   ======================================================== */
function changeMonth(delta){
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
  renderMonthCalendar();
}

function renderMonthCalendar(){
  const titleEl = document.getElementById("calendarMonthTitle");
  const gridEl = document.getElementById("calendarMonthGrid");
  if(!gridEl) return;

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  if(titleEl){
    const monthName = currentCalendarDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    titleEl.textContent = monthName.toUpperCase();
  }

  gridEl.innerHTML = "";

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDaysInMonth = new Date(year, month, 0).getDate();

  // Senin = 0, Minggu = 6
  let startDayIndex = (firstDay.getDay() + 6) % 7;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  
  const allUnits = getNormalizedUnits(websiteDataCache);

  // ABAIKAN unit yang berstatus COMING SOON atau MAINTENANCE dari kapasitas total kalender!
  const activeRentalUnits = allUnits.filter(u => {
    const st = String(u.status || "READY").toUpperCase();
    return st === "READY" || st === "ACTIVE";
  });
  const totalCap = activeRentalUnits.length;

  // Trailing days from previous month
  for(let i = startDayIndex - 1; i >= 0; i--){
    const dayNum = prevDaysInMonth - i;
    const cell = document.createElement("div");
    cell.className = "cal-day-cell other-month disabled";
    cell.innerHTML = `<span class="cal-date-number">${dayNum}</span>`;
    gridEl.appendChild(cell);
  }

  // Days in current month
  for(let day = 1; day <= daysInMonth; day++){
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const cell = document.createElement("div");
    cell.className = "cal-day-cell";

    const isToday = (dateStr === todayStr);
    const isPast = (dateStr < todayStr);

    if(isToday) cell.classList.add("today");

    const daySchedule = bookings[dateStr] || {};
    
    // Hitung berapa unit aktif yang sudah berstatus Booked
    const bookedActiveUnits = activeRentalUnits.filter(u => daySchedule[u.id] === "Booked").length;

    let statusType = "ready";
    let statusLabel = "Ready";

    if(totalCap > 0 && bookedActiveUnits === totalCap){
      statusType = "booked";
      statusLabel = "Full Booked";
    } else if(bookedActiveUnits > 0){
      statusType = "partial";
      statusLabel = "Sebagian Booked";
    } else {
      statusType = "ready";
      statusLabel = "Ready";
    }

    if(isPast){
      cell.classList.add("disabled");
      cell.innerHTML = `
        <span class="cal-date-number">${day}</span>
        <span class="cal-status-pill" style="opacity:0.4;">Lewat</span>
      `;
    } else {
      cell.classList.add(`status-${statusType}`);
      cell.innerHTML = `
        <span class="cal-date-number">${day}</span>
        <span class="cal-status-pill status-${statusType}">${statusLabel}</span>
      `;
      cell.onclick = () => openDateAvailabilityModal(dateStr);
    }

    gridEl.appendChild(cell);
  }

  // Remaining cells to make grid multiple of 7
  const totalCells = startDayIndex + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for(let i = 1; i <= remaining; i++){
    const cell = document.createElement("div");
    cell.className = "cal-day-cell other-month disabled";
    cell.innerHTML = `<span class="cal-date-number">${i}</span>`;
    gridEl.appendChild(cell);
  }
}

function openDateAvailabilityModal(dateStr){
  selectedDateForBooking = dateStr;
  const modal = document.getElementById("unitAvailabilityModal");
  const dateHeader = document.getElementById("unitAvailDateHeader");
  const listEl = document.getElementById("unitAvailList");
  const bookBtn = document.getElementById("bookThisDateBtn");
  if(!modal) return;

  const d = new Date(dateStr + "T00:00:00");
  const displayDate = d.toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  if(dateHeader) dateHeader.textContent = displayDate;

  const units = getNormalizedUnits(websiteDataCache);
  const daySchedule = bookings[dateStr] || {};
  let anyReady = false;

  let html = "";
  units.forEach(u => {
    const rawStatus = String(u.status || "READY").toUpperCase();
    const isMaintenance = (rawStatus === "MAINTENANCE");
    const isComingSoon = (rawStatus === "COMING SOON");
    const isBooked = (daySchedule[u.id] === "Booked");

    let badgeClass = "ready";
    let badgeText = "READY";

    if(isMaintenance){
      badgeClass = "maintenance";
      badgeText = "MAINTENANCE";
    } else if(isComingSoon){
      badgeClass = "coming-soon";
      badgeText = "COMING SOON";
    } else if(isBooked){
      badgeClass = "booked";
      badgeText = "BOOKED";
    } else {
      badgeClass = "ready";
      badgeText = "READY";
      anyReady = true;
    }

    html += `
      <div class="unit-avail-item">
        <div class="unit-avail-info">
          <span class="unit-avail-name">${escapeHtml(u.name)}</span>
          <span class="unit-avail-price">${formatRupiah(parsePriceNumber(u.price))} / hari</span>
        </div>
        <span class="unit-avail-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
      </div>
    `;
  });

  if(listEl) listEl.innerHTML = html;

  if(bookBtn){
    if(anyReady){
      bookBtn.disabled = false;
      bookBtn.style.opacity = "1";
      bookBtn.textContent = "★ SEWA TANGGAL INI ★";
    } else {
      bookBtn.disabled = true;
      bookBtn.style.opacity = "0.4";
      bookBtn.textContent = "SEMUA UNIT TIDAK TERSEDIA";
    }
  }

  modal.classList.add("active");
}

function closeUnitAvailModal(){
  const modal = document.getElementById("unitAvailabilityModal");
  if(modal) modal.classList.remove("active");
}

function applyDateToBookingForm(){
  if(!selectedDateForBooking) return;
  const tanggalInput = document.getElementById("tanggal");
  if(tanggalInput){
    tanggalInput.value = selectedDateForBooking;
  }
  closeUnitAvailModal();

  const bookingSection = document.getElementById("booking");
  if(bookingSection){
    bookingSection.scrollIntoView({ behavior: "smooth" });
  }

  renderDynamicAddons();
  calculateLivePrice();
  checkDateCollisionPreview();
}

/* ========================================================
   FITUR 5: SISTEM ANTI-BENTROK RENTANG HARI (MULTI-DAY COLLISION)
   ======================================================== */
function checkMultiDayCollision(unitId, startDateStr, days){
  if(!unitId || !startDateStr || !days) return { hasCollision: false, dates: [] };
  const dates = getRentalDateRange(startDateStr, days);
  for(const d of dates){
    const dayData = bookings[d];
    if(dayData && dayData[unitId] === "Booked"){
      return {
        hasCollision: true,
        conflictingDate: d,
        dates
      };
    }
  }
  return {
    hasCollision: false,
    conflictingDate: null,
    dates
  };
}

function checkDateCollisionPreview(){
  const paket = document.getElementById("paket")?.value || "";
  const tanggal = document.getElementById("tanggal")?.value || "";
  const durasiText = document.getElementById("durasi")?.value || "";
  if(!paket || !tanggal || !durasiText) return;

  const units = getNormalizedUnits(websiteDataCache);
  const selectedUnit = units.find(u => u.name === paket);
  const consoleKey = selectedUnit ? selectedUnit.id : (paket.includes("Nintendo") ? "nintendo" : "playbox");
  const days = parseDurationDays(durasiText);

  const collision = checkMultiDayCollision(consoleKey, tanggal, days);
  if(collision.hasCollision){
    const d = new Date(collision.conflictingDate + "T00:00:00");
    const dateFormatted = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    alert(`⚠️ PERINGATAN JADWAL BENTROK!\n\nUnit ${paket} sudah ter-booking pada tanggal ${dateFormatted} di dalam rentang ${durasiText} yang kamu pilih.\n\nSilakan pilih tanggal mulai yang lain atau kurangi durasi sewa.`);
  }
}

/* ========================================================
   FITUR 6: ALUR WHATSAPP, MODAL SUKSES, & AUTO-RESET FORM
   ======================================================== */
function getSelectedJamAntar(){
  const jam = document.getElementById("jamAntarJam")?.value || "";
  const menit = document.getElementById("jamAntarMenit")?.value || "";
  if(!jam || !menit) return "";
  return `${jam}:${menit}`;
}

function setupPixelTimePicker(data = websiteDataCache){
  const jamSelect = document.getElementById("jamAntarJam");
  const menitSelect = document.getElementById("jamAntarMenit");
  if(!jamSelect || !menitSelect) return;

  const openHour = typeof data.openHour === "number" ? data.openHour : 8;
  const closeHour = typeof data.closeHour === "number" ? data.closeHour : 22;
  const interval = parseInt(data.minuteInterval, 10) || 15;

  const currentJam = jamSelect.value;
  const currentMenit = menitSelect.value;

  jamSelect.innerHTML = `<option value="" disabled selected hidden>Jam</option>`;
  for(let h = openHour; h <= closeHour; h++){
    const str = String(h).padStart(2, "0");
    const opt = document.createElement("option");
    opt.value = str;
    opt.textContent = str;
    jamSelect.appendChild(opt);
  }

  menitSelect.innerHTML = `<option value="" disabled selected hidden>Menit</option>`;
  for(let m = 0; m < 60; m += interval){
    const str = String(m).padStart(2, "0");
    const opt = document.createElement("option");
    opt.value = str;
    opt.textContent = str;
    menitSelect.appendChild(opt);
  }

  if(currentJam) jamSelect.value = currentJam;
  if(currentMenit) menitSelect.value = currentMenit;
}

function getSelectedBookingGames(){
  const checkboxes = document.querySelectorAll('input[name="selectedBookingGames"]:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

async function saveBookingRequest(data){
  if(!bookingRequestsRef){
    throw new Error("Firebase belum siap.");
  }
  const id = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await set(ref(window.db, `bookingRequests/${id}`), {
    ...data,
    status: "pending",
    createdAt: Date.now()
  });
  return id;
}

async function sendWhatsApp(){
  enforceMinBookingDate();

  const nama = document.getElementById("nama")?.value.trim() || "";
  const nomor = document.getElementById("nomor")?.value.trim() || "";
  const paket = document.getElementById("paket")?.value || "";
  const tanggal = document.getElementById("tanggal")?.value || "";
  const jamAntar = getSelectedJamAntar();
  const durasi = document.getElementById("durasi")?.value || "";
  const alamat = document.getElementById("alamat")?.value.trim() || "";
  const jaminanSetuju = document.getElementById("jaminanSetuju")?.checked === true;
  const promoId = document.getElementById("promoSelect")?.value || "";
  const selectedGames = getSelectedBookingGames();

  if(!nama || !nomor || !paket || !tanggal || !jamAntar || !durasi || !alamat){
    alert("Semua data wajib diisi! Pastikan Paket, Tanggal, Jam, Menit, dan Durasi Sewa sudah dipilih.");
    return;
  }

  const minDate = document.getElementById("tanggal")?.getAttribute("min") || "";
  if(minDate && tanggal < minDate){
    alert("Tanggal sewa tidak valid! Tidak boleh memilih tanggal yang sudah terlewat.");
    document.getElementById("tanggal")?.focus();
    return;
  }

  const units = getNormalizedUnits(websiteDataCache);
  const selectedUnit = units.find(u => u.name === paket);
  const consoleKey = selectedUnit ? selectedUnit.id : (paket.includes("Nintendo") ? "nintendo" : "playbox");

  if(selectedUnit && String(selectedUnit.status || "READY").toUpperCase() !== "READY"){
    alert(`Maaf, unit ${paket} sedang dalam status ${selectedUnit.status}. Silakan pilih unit lainnya.`);
    return;
  }

  const days = parseDurationDays(durasi);

  // FITUR 5: Cek Bentrok Multi-Day Rentang Hari
  const collision = checkMultiDayCollision(consoleKey, tanggal, days);
  if(collision.hasCollision){
    const d = new Date(collision.conflictingDate + "T00:00:00");
    const dateFormatted = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    alert(`⚠️ BOOKING DIBATALKAN - JADWAL BENTROK!\n\nUnit ${paket} sudah ter-booking pada tanggal ${dateFormatted} di dalam rentang ${durasi} yang Anda pilih.\n\nSilakan pilih tanggal mulai yang lain atau kurangi durasi sewa.`);
    return;
  }

  if(!jaminanSetuju){
    alert("Untuk melanjutkan booking, Anda harus menyetujui syarat penyerahan jaminan KTP atau SIM asli.");
    document.getElementById("jaminanSetuju")?.focus();
    return;
  }

  // VALIDASI ANTI-OVERBOOK (DOUBLE CHECK REALTIME KE FIREBASE)
  const chosenAddons = Object.entries(addonCounts).filter(([_, q]) => q > 0);
  if(chosenAddons.length > 0){
    try{
      const [freshBkSnap, freshAddonsSnap] = await Promise.all([
        get(bookingRequestsRef),
        get(addonsRef)
      ]);
      const freshBookings = freshBkSnap.val() || {};
      const freshAddons = freshAddonsSnap.val() || addons;

      for(const [aId, reqQty] of chosenAddons){
        const realAvail = getAddonAvailableStock(aId, tanggal, days, freshBookings, freshAddons);
        if(reqQty > realAvail){
          alert("Maaf, stok add-on baru saja habis di tanggal yang Anda pilih.");
          bookingRequests = freshBookings;
          addons = freshAddons;
          renderDynamicAddons();
          calculateLivePrice();
          return;
        }
      }
    }catch(errCheck){
      console.warn("Pengecekan realtime gagal, menggunakan data lokal:", errCheck);
    }
  }

  // Kalkulasi Harga & Add-on
  const priceInfo = calculateLivePrice();
  const installedGames = selectedUnit && Array.isArray(selectedUnit.installedGames) ? selectedUnit.installedGames : [];

  const addOnDetails = [];
  Object.entries(addonCounts).forEach(([addonId, qty]) => {
    if(qty > 0){
      const a = addons[addonId] || DEFAULT_ADDONS[addonId];
      if(a){
        const price = parseInt(a.price, 10) || 0;
        addOnDetails.push({
          id: addonId,
          name: a.name,
          qty,
          pricePerDay: price,
          subtotal: qty * price * days
        });
      }
    }
  });

  const promoUsed = promoId && promos[promoId] ? promos[promoId] : null;

  const bookingData = {
    nama,
    nomor,
    paket,
    unitId: consoleKey,
    installedGames,
    selectedGames,
    tanggal,
    rentalDates: collision.dates,
    jamAntar,
    durasi,
    durasiHari: days,
    alamat,
    addOns: addOnDetails,
    promo: promoUsed ? { id: promoUsed.id, title: promoUsed.title, category: promoUsed.category || "ALL", discount: priceInfo.discountAmount } : null,
    totalBayar: priceInfo.grandTotal,
    jaminan: "KTP/SIM asli",
    status: "pending",
    createdAt: Date.now()
  };

  try{
    await saveBookingRequest(bookingData);
  }catch(error){
    alert("Gagal menyimpan riwayat booking: " + error.message);
    return;
  }

  // Format Pesan WhatsApp Lengkap
  const installedText = installedGames.length ? installedGames.join(", ") : "-";
  const gamesText = selectedGames.length ? selectedGames.join(", ") : "Tidak ada tambahan (Game bawaan)";
  
  let addonText = "Tidak ada";
  if(addOnDetails.length){
    addonText = addOnDetails.map(a => `${a.name} (${a.qty}x) = ${formatRupiah(a.subtotal)}`).join(", ");
  }

  let promoText = "Tidak pakai promo";
  if(promoUsed && priceInfo.discountAmount > 0){
    promoText = `${promoUsed.title} (-${formatRupiah(priceInfo.discountAmount)})`;
  }

  const endDate = collision.dates.length > 1 ? collision.dates[collision.dates.length - 1] : tanggal;
  const dateRangeDisplay = collision.dates.length > 1
    ? `${formatBookingDate(tanggal)} s/d ${formatBookingDate(endDate)} (${days} Hari)`
    : `${formatBookingDate(tanggal)} (${days} Hari)`;

  const message = `Halo Admin StarZone 🌟\n\nSaya ingin booking rental console dengan detail berikut:\n\n▶ DATA PENYEWA:\n• Nama : ${nama}\n• No WhatsApp : ${nomor}\n• Alamat Antar : ${alamat}\n\n▶ DETAIL SEWA:\n• Paket Konsol : ${paket}\n• Tanggal Sewa : ${dateRangeDisplay}\n• Antar Jam : ${jamAntar} WIB\n• Game Bawaan : ${installedText}\n• Request Game : ${gamesText}\n• Aksesori Add-on : ${addonText}\n• Promo : ${promoText}\n\n▶ RINCIAN BIAYA:\n• Sewa Konsol : ${formatRupiah(priceInfo.unitTotal)}\n• Biaya Add-on : ${formatRupiah(priceInfo.totalAddon)}\n• Diskon Promo : -${formatRupiah(priceInfo.discountAmount)}\n• TOTAL ESTIMASI BAYAR : ${formatRupiah(priceInfo.grandTotal)}\n\n▶ JAMINAN:\n• Siap menyerahkan KTP/SIM asli saat serah terima unit (Syarat disetujui).\n\nMohon dicek dan dikonfirmasi ya Admin, terima kasih!`;

  const phone = normalizePhone(websiteDataCache.whatsappNumber);
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  pendingWhatsAppUrl = waUrl;

  // a. Buka tab baru langsung ke WhatsApp Admin
  window.open(waUrl, "_blank");

  // b. Tampilkan Modal Pop-up Custom piksel neon "★ BOOKING BERHASIL! ★"
  showBookingSuccessModal({
    nama,
    paket,
    gamesText,
    addonText,
    promoText,
    totalText: formatRupiah(priceInfo.grandTotal),
    tanggal: dateRangeDisplay,
    jamAntar: `${jamAntar} WIB`,
    durasi
  });

  // c. BERSAMAAN DENGAN MUNCULNYA POP-UP, SELURUH ISIAN FORM BOOKING WAJIB DI-RESET KOSONG/DEFAULT
  resetBookingFormFields();
}

function resetBookingFormFields(){
  const namaEl = document.getElementById("nama");
  const nomorEl = document.getElementById("nomor");
  const paketEl = document.getElementById("paket");
  const tanggalEl = document.getElementById("tanggal");
  const jamEl = document.getElementById("jamAntarJam");
  const menitEl = document.getElementById("jamAntarMenit");
  const durasiEl = document.getElementById("durasi");
  const alamatEl = document.getElementById("alamat");
  const jaminanEl = document.getElementById("jaminanSetuju");
  const promoEl = document.getElementById("promoSelect");
  const gameBox = document.getElementById("unitGameSelectionBox");
  const gameCheckboxes = document.getElementById("unitGameCheckboxes");

  if(namaEl) namaEl.value = "";
  if(nomorEl) nomorEl.value = "";
  if(alamatEl) alamatEl.value = "";

  if(paketEl){
    paketEl.selectedIndex = 0;
    paketEl.value = "";
  }

  if(gameCheckboxes){
    gameCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    gameCheckboxes.innerHTML = "";
  }
  if(gameBox) gameBox.style.setProperty("display", "none", "important");

  const noticeBox = document.getElementById("unitGamePreviewNoticeBox");
  if(noticeBox) noticeBox.style.setProperty("display", "none", "important");

  // Reset Addon Counters Dinamis
  addonCounts = {};
  renderDynamicAddons();

  // Reset Promo
  if(promoEl) promoEl.selectedIndex = 0;

  // Reset Tanggal & Waktu
  if(tanggalEl){
    tanggalEl.value = "";
    enforceMinBookingDate();
  }
  if(jamEl) jamEl.selectedIndex = 0;
  if(menitEl) menitEl.selectedIndex = 0;
  if(durasiEl) durasiEl.selectedIndex = 0;
  if(jaminanEl) jaminanEl.checked = false;

  // Reset Live Price Calculator ke 0
  calculateLivePrice();
}

function showBookingSuccessModal(summary){
  const modal = document.getElementById("bookingSuccessModal");
  if(!modal) return;

  setText("modalSumNama", summary.nama || "-");
  setText("modalSumPaket", summary.paket || "-");
  setText("modalSumGames", summary.gamesText || "-");
  setText("modalSumAddon", summary.addonText || "-");
  setText("modalSumPromo", summary.promoText || "-");
  setText("modalSumTotal", summary.totalText || "-");
  setText("modalSumTanggal", summary.tanggal || "-");
  setText("modalSumJam", summary.jamAntar || "-");
  setText("modalSumDurasi", summary.durasi || "-");

  modal.classList.add("active");
}

function closeBookingSuccessModal(){
  const modal = document.getElementById("bookingSuccessModal");
  if(modal) modal.classList.remove("active");
}

function proceedToWhatsAppFromModal(){
  if(pendingWhatsAppUrl){
    window.open(pendingWhatsAppUrl, "_blank");
  }
  closeBookingSuccessModal();
}

/* ========================================================
   HELPER FUNCTIONS & DYNAMIC UI LOGIC
   ======================================================== */
function normalizePhone(phone){
  let cleaned = String(phone || DEFAULT_DATA.whatsappNumber).replace(/[^0-9]/g, "");
  if(cleaned.startsWith("0")) cleaned = "62" + cleaned.slice(1);
  if(!cleaned.startsWith("62")) cleaned = "62" + cleaned;
  return cleaned;
}

function formatBookingDate(dateString){
  if(!dateString) return "-";
  const d = new Date(dateString + "T00:00:00");
  if(isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function escapeHtml(text){
  return String(text).replace(/[&<>"']/g, function(match){
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[match];
  });
}

function setText(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = value;
}

function setImage(id, value){
  const el = document.getElementById(id);
  if(el) el.src = value || PLACEHOLDER;
}

function renderTicker(text){
  const ticker = document.getElementById("tickerContent");
  if(!ticker) return;

  const raw = text || DEFAULT_DATA.runningText;
  const items = raw.split("|").map(t => t.trim()).filter(Boolean);
  const source = items.length ? items : DEFAULT_DATA.runningText.split("|").map(t => t.trim());
  const repeated = [...source, ...source];
  ticker.innerHTML = repeated.map(item => `<span>⭐ ${escapeHtml(item)}</span>`).join("");
}

function renderDynamicCatalog(data){
  const catalogGrid = document.getElementById("catalogGrid");
  if(!catalogGrid) return;

  const units = getNormalizedUnits(data);
  catalogGrid.innerHTML = "";

  units.forEach(unit => {
    const card = document.createElement("div");
    card.classList.add("product-card");

    const badgeClass = unit.category === "PlayStation" ? "badge-pink" : "";
    const btnClass = unit.category === "PlayStation" ? "btn-pink" : "";
    const isReady = unit.status === "READY";

    let installedHtml = "";
    if(Array.isArray(unit.installedGames) && unit.installedGames.length){
      installedHtml = `
        <div class="game-tags" style="margin: 10px 0;">
          <small style="color:var(--muted); font-size:11px; display:block; margin-bottom:4px;">GAME TERPASANG:</small>
          ${unit.installedGames.map(g => `<span role="link" onclick="openGameTagYoutube('${escapeHtml(g)}')">${escapeHtml(g)}</span>`).join("")}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="status-badge ${badgeClass}">${escapeHtml(unit.badge || unit.status)}</div>
      <img src="${unit.image || PLACEHOLDER}" alt="${escapeHtml(unit.name)}">
      <div class="product-content">
        <h3>${escapeHtml(unit.name)}</h3>
        <p>${escapeHtml(unit.description)}</p>
        ${installedHtml}
        <div class="price">${formatRupiah(parsePriceNumber(unit.price))} / hari</div>
        <a href="#booking" class="btn btn-block ${btnClass}" onclick="selectUnitForBooking('${escapeHtml(unit.name)}')">
          ${isReady ? "Sewa Sekarang" : "Lihat Jadwal"}
        </a>
      </div>
    `;
    catalogGrid.appendChild(card);
  });
}

function populatePackageSelect(units){
  const select = document.getElementById("paket");
  if(!select) return;

  const currentVal = select.value;
  select.innerHTML = `<option value="" disabled selected hidden>Pilih Paket</option>`;

  units.forEach(unit => {
    const opt = document.createElement("option");
    opt.value = unit.name;
    const statusUpper = String(unit.status || "READY").trim().toUpperCase();
    const isComingSoon = statusUpper === "COMING SOON";
    const isMaintenance = statusUpper === "MAINTENANCE";

    if(isComingSoon || isMaintenance){
      opt.disabled = true;
      opt.textContent = `[${statusUpper}] ${unit.name} - ${formatRupiah(parsePriceNumber(unit.price))}/hari`;
    } else {
      opt.textContent = `${unit.name} - ${formatRupiah(parsePriceNumber(unit.price))}/hari`;
    }
    select.appendChild(opt);
  });

  if(currentVal && units.some(u => u.name === currentVal && !["COMING SOON", "MAINTENANCE"].includes(String(u.status || "READY").trim().toUpperCase()))){
    select.value = currentVal;
  } else if(currentVal && units.some(u => u.name === currentVal && ["COMING SOON", "MAINTENANCE"].includes(String(u.status || "READY").trim().toUpperCase()))){
    select.value = "";
  }
}

function selectUnitForBooking(unitName){
  const select = document.getElementById("paket");
  if(!select) return;

  const units = getNormalizedUnits(websiteDataCache);
  const target = units.find(u => u.name === unitName);
  const statusUpper = target ? String(target.status || "READY").trim().toUpperCase() : "READY";
  if (statusUpper === "COMING SOON" || statusUpper === "MAINTENANCE") {
    alert(`⚠️ Unit "${unitName}" sedang berstatus ${statusUpper} dan belum dapat disewa.`);
    return;
  }

  select.value = unitName;
  handlePackageSelectChange();
  calculateLivePrice();
  checkDateCollisionPreview();

  const booking = document.getElementById("booking");
  if(booking){
    booking.scrollIntoView({ behavior: "smooth" });
  }
}

function handlePackageSelectChange(){
  const paket = document.getElementById("paket")?.value || "";
  const gameBox = document.getElementById("unitGameSelectionBox");
  const gameCheckboxes = document.getElementById("unitGameCheckboxes");
  const titleEl = document.getElementById("unitGameSelectionTitle");
  const noticeBox = document.getElementById("unitGamePreviewNoticeBox");
  const noticeText = document.getElementById("unitGamePreviewNoticeText");

  // Filter pilihan Add-on & Promo berdasarkan kategori konsol
  renderDynamicAddons();
  populatePromoSelect();

  if(!paket){
    if(gameBox){
      gameBox.style.setProperty("display", "none", "important");
    }
    if(gameCheckboxes){
      gameCheckboxes.innerHTML = "";
    }
    if(noticeBox){
      noticeBox.style.setProperty("display", "none", "important");
    }
    return;
  }

  const units = getNormalizedUnits(websiteDataCache);
  const selectedUnit = units.find(u => u.name === paket);
  const rawCat = selectedUnit ? (selectedUnit.category || (paket.toLowerCase().includes("nintendo") ? "Nintendo" : "PlayStation")) : (paket.toLowerCase().includes("nintendo") ? "Nintendo" : "PlayStation");
  const category = (rawCat.toLowerCase() === "nintendo") ? "Nintendo" : "PlayStation";
  let specificType = selectedUnit?.specificType || (category === "Nintendo" ? "Nintendo Switch OLED" : "PS5");
  if(specificType === "Nintendo Switch V2"){
    specificType = (category === "Nintendo" ? "Nintendo Switch OLED" : "PS5");
  }

  const installedGames = Array.isArray(selectedUnit?.installedGames) ? selectedUnit.installedGames : [];
  const installedSet = new Set(installedGames.map(g => String(g).trim().toLowerCase()));

  const allGames = (websiteDataCache.gamePreviews && websiteDataCache.gamePreviews.length)
    ? websiteDataCache.gamePreviews
    : DEFAULT_GAME_PREVIEWS;

  // Filter Master Game berdasarkan TIPE SPESIFIK KONSOL yang dipilih (tanpa Switch V2)
  const consoleMasterGames = allGames.filter(g => isGameCompatibleWithConsole(g, specificType, category));

  // Hitung: sisaGame = (Master Game Tipe Konsol) MINUS (Game yang Terinstall di Unit)
  const sisaGame = consoleMasterGames.filter(g => !installedSet.has(String(g.title || "").trim().toLowerCase()));

  // ========================================================
  // STRICT MUTUAL EXCLUSIVE IF-ELSE LOGIC:
  // ========================================================
  if(sisaGame.length > 0){
    // KONDISI A (sisaGame.length > 0):
    // 1. WAJIB TAMPILKAN container checkbox "Pilih Game Tambahan" berisi sisa game
    if(titleEl){
      titleEl.textContent = `PILIH GAME TAMBAHAN UNTUK ${(specificType || category).toUpperCase()}:`;
    }

    if(gameCheckboxes){
      gameCheckboxes.innerHTML = sisaGame.map(g => `
        <label class="game-checkbox-label" style="display:inline-flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" name="selectedBookingGames" value="${escapeHtml(g.title)}" style="width:20px !important; height:20px !important; flex-shrink:0 !important; margin:0 !important;">
          <span>${escapeHtml(g.title)}</span>
        </label>
      `).join("");
    }

    if(gameBox){
      gameBox.style.setProperty("display", "block", "important");
    }

    // 2. WAJIB SEMBUNYIKAN SEPENUHNYA (display: none !important) kotak banner notice
    if(noticeBox){
      noticeBox.style.setProperty("display", "none", "important");
    }
  } else {
    // KONDISI B (sisaGame.length === 0):
    // 1. WAJIB SEMBUNYIKAN SEPENUHNYA (display: none !important) container area checkbox
    if(gameBox){
      gameBox.style.setProperty("display", "none", "important");
    }
    if(gameCheckboxes){
      gameCheckboxes.innerHTML = "";
    }

    // 2. BARU TAMPILKAN kotak banner notice (display: flex !important)
    if(noticeText){
      noticeText.textContent = "Semua game yang berada di preview sudah ada di dalam unit ini.";
    }
    if(noticeBox){
      noticeBox.style.setProperty("display", "flex", "important");
    }
  }
}

function openGameTagYoutube(gameTitle){
  const allGames = (websiteDataCache.gamePreviews && websiteDataCache.gamePreviews.length)
    ? websiteDataCache.gamePreviews
    : DEFAULT_GAME_PREVIEWS;
  const match = allGames.find(g => String(g.title).toLowerCase() === String(gameTitle).toLowerCase());
  if(match && match.youtube){
    window.open(match.youtube, "_blank");
  } else {
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(gameTitle + " gameplay trailer")}`, "_blank");
  }
}

function renderPublicReviews(){
  const list = document.getElementById("testimonialList");
  if(!list) return;

  const approved = Object.values(reviews || {}).filter(r => r && r.approved !== false);
  if(!approved.length){
    list.innerHTML = `<div class="testimonial-card"><div>⭐⭐⭐⭐⭐</div><p>Barang bagus, admin fast respon, recommended!</p><b>Customer StarZone</b></div>`;
    return;
  }

  list.innerHTML = approved.slice(-6).reverse().map(r => `
    <div class="testimonial-card">
      <div>${"⭐".repeat(Math.min(5, Math.max(1, r.rating || 5)))}</div>
      <p>"${escapeHtml(r.message || "")}"</p>
      <b>${escapeHtml(r.name || "Customer")}</b>
    </div>
  `).join("");
}

function renderFaqItems(items){
  const faqList = document.getElementById("faqList");
  if(!faqList) return;
  const safeItems = Array.isArray(items) && items.length ? items : DEFAULT_DATA.faqItems;
  faqList.innerHTML = safeItems.filter(f => f && f.question && f.question.trim()).map(item => `
    <div class="faq-card">
      <h3>${escapeHtml(item.question)}</h3>
      <p>${escapeHtml(item.answer || "")}</p>
    </div>
  `).join("");
}

function renderTermsItems(items){
  const termsList = document.getElementById("termsList");
  if(!termsList) return;
  const safeItems = Array.isArray(items) && items.length ? items : DEFAULT_DATA.termsItems;
  termsList.innerHTML = safeItems.filter(Boolean).map(term => `
    <li>${escapeHtml(term)}</li>
  `).join("");
}

function loadWebsiteData(data){
  const hasActivePromos = Object.values(promos || {}).some(p => p && p.active !== false);
  if(!hasActivePromos){
    setText("promoTitleText", data.promoTitle || DEFAULT_DATA.promoTitle);
    setText("promoBodyText", data.promoBody || DEFAULT_DATA.promoBody);
  } else {
    updatePromoBannerSlideshow();
  }
  renderTicker(data.runningText || DEFAULT_DATA.runningText);

  const statusText = document.getElementById("storeStatusText");
  if(statusText){
    const isOpen = (data.storeStatus || "open") === "open";
    statusText.textContent = isOpen ? "OPEN" : "TUTUP";
    statusText.className = `store-status ${isOpen ? "open" : "closed"}`;
  }
  setText("storeHoursText", data.storeHours || DEFAULT_DATA.storeHours);

  const units = getNormalizedUnits(data);
  const nintendoUnit = units.find(u => u.id === "nintendo" || u.category === "Nintendo") || units[0];
  const playboxUnit = units.find(u => u.id === "playbox" || u.category === "PlayStation") || units[1];

  setText("dashNintendoBadge", nintendoUnit ? nintendoUnit.badge : "READY");
  setText("dashPlayboxBadge", playboxUnit ? playboxUnit.badge : "COMINGSOON");
  setText("dashNintendoPrice", nintendoUnit ? formatRupiah(parsePriceNumber(nintendoUnit.price)) : "Rp 100.000");
  setText("dashPlayboxPrice", playboxUnit ? formatRupiah(parsePriceNumber(playboxUnit.price)) : "Rp 250.000");

  setImage("websiteLogo", data.logo || "assets/logo-starzone-nobackground.jpeg");
  setImage("galleryImg1", data.gallery1);
  setImage("galleryImg2", data.gallery2);
  setImage("galleryImg3", data.gallery3);
  setImage("galleryImg4", data.gallery4);

  renderDynamicCatalog(data);
  populatePackageSelect(units);
  handlePackageSelectChange();
  setupPixelTimePicker(data);
  renderFaqItems(data.faqItems);
  renderTermsItems(data.termsItems);

  if(window.location.pathname.includes("games.html")){
    renderGamePreviewPage(data.gamePreviews || DEFAULT_GAME_PREVIEWS);
  }
}

/* ========================================================
   GAMES & REVIEW PAGES INTERACTION
   ======================================================== */
function setReviewRating(value){
  currentReviewRating = value;
  const ratingInput = document.getElementById("reviewRating");
  if(ratingInput) ratingInput.value = value;

  const buttons = document.querySelectorAll("#starRating button");
  buttons.forEach((btn, idx) => {
    btn.style.color = idx < value ? "var(--yellow)" : "var(--muted)";
  });
}

function checkBookingIdParam(){
  const params = new URLSearchParams(window.location.search);
  const bkId = params.get("bookingId");
  if(!bkId) return;
  currentReviewBookingId = bkId;
  prefillReviewFromBookingId();
}

function prefillReviewFromBookingId(){
  if(!currentReviewBookingId || !bookingRequests) return;
  const item = bookingRequests[currentReviewBookingId];
  if(!item) return;

  const nameInput = document.getElementById("reviewName");
  if(nameInput && !nameInput.value){
    nameInput.value = item.nama || "";
  }

  const infoWrap = document.getElementById("bookingReviewInfo");
  const labelEl = document.getElementById("bookingReviewLabel");
  if(infoWrap && labelEl){
    infoWrap.style.display = "block";
    labelEl.textContent = `VERIFIKASI SEWA: ${item.nama || "Customer"} (${item.paket || "Konsol"})`;
  }
}

async function submitReview(){
  const name = document.getElementById("reviewName")?.value.trim() || "";
  const rating = parseInt(document.getElementById("reviewRating")?.value || currentReviewRating, 10);
  const message = document.getElementById("reviewMessage")?.value.trim() || "";
  const alertEl = document.getElementById("reviewAlert");
  const successEl = document.getElementById("reviewSuccess");

  if(alertEl) alertEl.style.display = "none";
  if(successEl) successEl.style.display = "none";

  if(!name || !message){
    if(alertEl){
      alertEl.textContent = "Nama dan Ulasan wajib diisi!";
      alertEl.style.display = "block";
    }
    return;
  }

  const reviewId = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const reviewData = {
    name,
    rating,
    message,
    bookingId: currentReviewBookingId || null,
    approved: true,
    createdAt: Date.now()
  };

  try{
    await set(ref(window.db, `reviews/${reviewId}`), reviewData);
    if(successEl) successEl.style.display = "block";
    if(document.getElementById("reviewName")) document.getElementById("reviewName").value = "";
    if(document.getElementById("reviewMessage")) document.getElementById("reviewMessage").value = "";
    setReviewRating(5);
  }catch(err){
    if(alertEl){
      alertEl.textContent = "Gagal mengirim review: " + err.message;
      alertEl.style.display = "block";
    }
  }
}

function initGamePreviewControls(){
  const searchInput = document.getElementById("gameSearchInput");
  if(searchInput){
    searchInput.addEventListener("input", (e) => {
      activeGameSearch = (e.target.value || "").toLowerCase();
      const allGames = (websiteDataCache.gamePreviews && websiteDataCache.gamePreviews.length)
        ? websiteDataCache.gamePreviews
        : DEFAULT_GAME_PREVIEWS;
      renderGamePreviewPage(allGames);
    });
  }
}

function setGameConsoleFilter(filter = "all"){
  activeGameConsoleFilter = filter;
  document.querySelectorAll("[data-console-filter]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.consoleFilter === filter);
  });
  const allGames = (websiteDataCache.gamePreviews && websiteDataCache.gamePreviews.length)
    ? websiteDataCache.gamePreviews
    : DEFAULT_GAME_PREVIEWS;
  renderGamePreviewPage(allGames);
}

function getYoutubeId(url){
  if(!url) return "";
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : "";
}

function renderGamePreviewPage(items){
  const grid = document.getElementById("gamePreviewList");
  if(!grid) return;

  let list = Array.isArray(items) && items.length ? items : DEFAULT_GAME_PREVIEWS;

  if(activeGameConsoleFilter !== "all"){
    if(activeGameConsoleFilter === "Nintendo" || activeGameConsoleFilter === "PlayStation"){
      list = list.filter(g => String(g.console || "").toLowerCase() === activeGameConsoleFilter.toLowerCase());
    } else {
      list = list.filter(g => isGameCompatibleWithConsole(g, activeGameConsoleFilter, getConsoleCategoryFromType(activeGameConsoleFilter)));
    }
  }
  if(activeGameSearch){
    list = list.filter(g => String(g.title || "").toLowerCase().includes(activeGameSearch));
  }

  if(!list.length){
    grid.innerHTML = `<p class="empty-text">Tidak ada game yang sesuai pencarian/filter.</p>`;
    return;
  }

  grid.innerHTML = list.map(item => {
    const ytId = getYoutubeId(item.youtube);
    const thumb = ytId
      ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
      : PLACEHOLDER;
    const badgeColor = String(item.console).toLowerCase() === "nintendo" ? "" : "badge-pink";

    let specs = Array.isArray(item.specificTypes) && item.specificTypes.length
      ? item.specificTypes.filter(t => t !== "Nintendo Switch V2").join(" | ")
      : (item.specificType && item.specificType !== "Nintendo Switch V2" ? item.specificType : (String(item.console).toLowerCase() === "nintendo" ? "Switch OLED | Switch 2" : "PS3 | PS4 | PS5"));

    return `
      <div class="product-card game-preview-card">
        <div class="status-badge ${badgeColor}">${escapeHtml(item.console || "Console")}</div>
        <img src="${thumb}" alt="${escapeHtml(item.title)}">
        <div class="product-content">
          <h3>${escapeHtml(item.title)}</h3>
          <span class="compat-badge" style="display:inline-block; margin-top:4px; font-size:12px; color:var(--cyan); background:rgba(0,229,255,0.08); padding:3px 8px; border-radius:3px; border:1px solid rgba(0,229,255,0.25);">🎮 ${escapeHtml(specs)}</span>
          <a href="${escapeHtml(item.youtube)}" target="_blank" class="btn btn-block btn-cyan" style="margin-top:10px;">
            ▶ Tonton Trailer
          </a>
        </div>
      </div>
    `;
  }).join("");
}

async function submitGameRequest(){
  const userName = document.getElementById("reqUserName")?.value.trim() || "";
  const consoleCategory = document.getElementById("reqConsoleCategory")?.value || "Nintendo";
  const gameTitle = document.getElementById("reqGameTitle")?.value.trim() || "";
  const notes = document.getElementById("reqGameNotes")?.value.trim() || "";
  const alertEl = document.getElementById("gameReqAlert");
  const successEl = document.getElementById("gameReqSuccess");

  if(alertEl) alertEl.style.display = "none";
  if(successEl) successEl.style.display = "none";

  if(!gameTitle){
    if(alertEl){
      alertEl.textContent = "Judul Game yang diinginkan wajib diisi!";
      alertEl.style.display = "block";
    }
    return;
  }

  const reqId = `greq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const reqData = {
    userName: userName || "Anonim",
    consoleCategory,
    gameTitle,
    notes,
    createdAt: Date.now()
  };

  try{
    await set(ref(window.db, `gameRequests/${reqId}`), reqData);
    if(successEl) successEl.style.display = "block";
    if(document.getElementById("reqUserName")) document.getElementById("reqUserName").value = "";
    if(document.getElementById("reqGameTitle")) document.getElementById("reqGameTitle").value = "";
    if(document.getElementById("reqGameNotes")) document.getElementById("reqGameNotes").value = "";
  }catch(e){
    if(alertEl){
      alertEl.textContent = "Gagal mengirim request game: " + e.message;
      alertEl.style.display = "block";
    }
  }
}

/* ========================================================
   STARZONE PIXEL OPENING INTRO & DASHBOARD LOOP ANIMATIONS
   (DIPERTAHANKAN 100%)
   ======================================================== */
function initPixelOpeningIntro(){
  const loader = document.getElementById("szIntroLoader");
  if(!loader) return;

  const starsContainer = document.getElementById("szIntroStars");
  const streaksContainer = document.getElementById("szIntroStreaks");

  if(starsContainer){
    starsContainer.innerHTML = "";
    for(let i = 0; i < 40; i++){
      const s = document.createElement("span");
      s.className = "sz-star";
      s.style.left = `${Math.random() * 100}%`;
      s.style.top = `${Math.random() * 60}%`;
      s.style.animationDelay = `${Math.random() * 2}s`;
      starsContainer.appendChild(s);
    }
  }

  if(streaksContainer){
    streaksContainer.innerHTML = "";
    for(let i = 0; i < 8; i++){
      const streak = document.createElement("span");
      streak.className = "sz-streak";
      streak.style.left = `${Math.random() * 100}%`;
      streak.style.top = `${Math.random() * 50}%`;
      streak.style.animationDelay = `${Math.random() * 3}s`;
      streaksContainer.appendChild(streak);
    }
  }

  const skipBtn = document.getElementById("szIntroSkip");
  const closeIntro = () => {
    loader.classList.add("sz-intro-fade-out");
    setTimeout(() => {
      loader.style.display = "none";
    }, 600);
  };

  if(skipBtn){
    skipBtn.onclick = closeIntro;
  }

  setTimeout(closeIntro, 4800);
}

function initPixelDashboardLoop(){
  const stars = document.getElementById("pixelDashboardStars");
  const streaks = document.getElementById("pixelDashboardStreaks");

  if(stars){
    stars.innerHTML = "";
    for(let i = 0; i < 25; i++){
      const star = document.createElement("span");
      star.style.position = "absolute";
      star.style.width = "2px";
      star.style.height = "2px";
      star.style.backgroundColor = "#ffffff";
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 60}%`;
      star.style.opacity = `${0.3 + Math.random() * 0.7}`;
      stars.appendChild(star);
    }
  }

  if(streaks){
    streaks.innerHTML = "";
    for(let i = 0; i < 4; i++){
      const st = document.createElement("span");
      st.className = "pixel-streak";
      st.style.top = `${10 + Math.random() * 40}%`;
      st.style.animationDelay = `${Math.random() * 2}s`;
      streaks.appendChild(st);
    }
  }
}
