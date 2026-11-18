let allPopulationData = [];
let currentFilteredData = [];
let currentUploadedFileName = "Data_Kependudukan";
let genderChartInstance = null;
let ageChartInstance = null;
let activeFamilyKeyFilter = null;
let currentModalFamilyKey = null;

const DEFAULT_AGE_RANGES = [
  { id: 'cat_1', label: '0–5 Tahun', min: 0, max: 5 },
  { id: 'cat_2', label: '6–15 Tahun', min: 6, max: 15 },
  { id: 'cat_3', label: '16–49 Tahun', min: 16, max: 49 },
  { id: 'cat_4', label: '50–59 Tahun', min: 50, max: 59 },
  { id: 'cat_5', label: '60+ Tahun', min: 60, max: null }
];

let customAgeRanges = loadSavedAgeRanges();

function loadSavedAgeRanges() {
  try {
    const saved = localStorage.getItem('portal_kependudukan_age_ranges');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Gagal memuat kategori usia tersimpan:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_AGE_RANGES));
}

// Elemen DOM Utama
const dropZone = document.getElementById('dropZone');
const excelInput = document.getElementById('excelInput');
const btnPilihFile = document.getElementById('btnPilihFile');
const btnReset = document.getElementById('btnReset');
const btnExportExcel = document.getElementById('btnExportExcel');
const btnExportPDF = document.getElementById('btnExportPDF');
const fileStatus = document.getElementById('fileStatus');
const dashboardContent = document.getElementById('dashboardContent');

const searchInput = document.getElementById('searchInput');
const filterGender = document.getElementById('filterGender');
const filterAgeGroup = document.getElementById('filterAgeGroup');

// Elemen Modal Keluarga
const familyModal = document.getElementById('familyModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCloseModalFooter = document.getElementById('btnCloseModalFooter');
const btnFilterThisFamily = document.getElementById('btnFilterThisFamily');

// Event Listeners Upload
btnPilihFile.addEventListener('click', (e) => {
  e.stopPropagation();
  excelInput.click();
});

dropZone.addEventListener('click', () => excelInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) {
    handleExcelFile(e.dataTransfer.files[0]);
  }
});

excelInput.addEventListener('change', (e) => {
  if (e.target.files.length) {
    handleExcelFile(e.target.files[0]);
  }
});

btnReset.addEventListener('click', () => {
  allPopulationData = [];
  currentFilteredData = [];
  activeFamilyKeyFilter = null;
  excelInput.value = '';
  searchInput.value = '';
  fileStatus.classList.add('hidden');
  dashboardContent.classList.add('hidden');
  btnReset.classList.add('hidden');
});

if (btnExportExcel) btnExportExcel.addEventListener('click', exportTableToExcel);
if (btnExportPDF) btnExportPDF.addEventListener('click', exportTableToPDF);

// Filter & Pencarian Real-time
searchInput.addEventListener('input', () => {
  activeFamilyKeyFilter = null;
  applyFilters();
});
filterGender.addEventListener('change', applyFilters);
filterAgeGroup.addEventListener('change', applyFilters);

// Event Listeners Modal Keluarga
btnCloseModal.addEventListener('click', closeFamilyModal);
btnCloseModalFooter.addEventListener('click', closeFamilyModal);
familyModal.addEventListener('click', (e) => {
  if (e.target === familyModal) closeFamilyModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !familyModal.classList.contains('hidden')) {
    closeFamilyModal();
  }
});

btnFilterThisFamily.addEventListener('click', () => {
  if (currentModalFamilyKey) {
    activeFamilyKeyFilter = currentModalFamilyKey;
    searchInput.value = '';
    filterGender.value = 'ALL';
    filterAgeGroup.value = 'ALL';
    closeFamilyModal();
    applyFilters();
  }
});

function closeFamilyModal() {
  familyModal.classList.add('hidden');
}

// ============================================================================
// PENGATURAN KATEGORI USIA KUSTOM (DINAMIS)
// ============================================================================
const btnToggleAgeConfig = document.getElementById('btnToggleAgeConfig');
const ageConfigPanel = document.getElementById('ageConfigPanel');
const ageRangesContainer = document.getElementById('ageRangesContainer');
const btnAddAgeRange = document.getElementById('btnAddAgeRange');
const btnResetAgeRanges = document.getElementById('btnResetAgeRanges');
const btnApplyAgeRanges = document.getElementById('btnApplyAgeRanges');

if (btnToggleAgeConfig) {
  btnToggleAgeConfig.addEventListener('click', () => {
    const isHidden = ageConfigPanel.classList.contains('hidden');
    if (isHidden) {
      renderAgeRangeInputs();
      ageConfigPanel.classList.remove('hidden');
      btnToggleAgeConfig.textContent = 'Tutup Pengaturan';
    } else {
      ageConfigPanel.classList.add('hidden');
      btnToggleAgeConfig.textContent = 'Atur Rentang Usia';
    }
  });
}

if (btnAddAgeRange) {
  btnAddAgeRange.addEventListener('click', () => {
    const rows = getAgeRangesFromInputs();
    const lastMax = rows.length && rows[rows.length - 1].max !== null ? rows[rows.length - 1].max + 1 : 0;
    rows.push({
      id: `cat_${Date.now()}`,
      label: '',
      min: lastMax,
      max: lastMax + 5
    });
    renderAgeRangeInputs(rows);
  });
}

if (btnResetAgeRanges) {
  btnResetAgeRanges.addEventListener('click', () => {
    customAgeRanges = JSON.parse(JSON.stringify(DEFAULT_AGE_RANGES));
    localStorage.removeItem('portal_kependudukan_age_ranges');
    renderAgeRangeInputs(customAgeRanges);
    reclassifyAllAgesAndRefresh();
  });
}

if (btnApplyAgeRanges) {
  btnApplyAgeRanges.addEventListener('click', () => {
    const newRanges = getAgeRangesFromInputs();
    if (!newRanges.length) {
      alert('Minimal harus ada 1 kategori usia.');
      return;
    }

    for (let i = 0; i < newRanges.length; i++) {
      const r = newRanges[i];
      if (isNaN(r.min) || r.min < 0) {
        alert(`Batas usia awal pada baris ke-${i + 1} tidak valid.`);
        return;
      }
      if (r.max !== null && r.max < r.min) {
        alert(`Usia akhir (${r.max}) tidak boleh lebih kecil dari usia awal (${r.min}) pada baris ke-${i + 1}.`);
        return;
      }
      if (!r.label) {
        r.label = r.max === null ? `${r.min}+ Tahun` : `${r.min}–${r.max} Tahun`;
      }
    }

    customAgeRanges = newRanges;
    localStorage.setItem('portal_kependudukan_age_ranges', JSON.stringify(customAgeRanges));
    renderAgeRangeInputs(customAgeRanges);
    reclassifyAllAgesAndRefresh();
  });
}

function renderAgeRangeInputs(ranges = customAgeRanges) {
  if (!ageRangesContainer) return;
  ageRangesContainer.innerHTML = ranges.map((r, idx) => `
    <div class="age-range-row grid grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
      <div class="col-span-5 sm:col-span-5">
        <label class="block text-[10px] font-semibold text-slate-400 uppercase mb-0.5">Nama Kategori</label>
        <input type="text" class="age-label w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
               placeholder="Misal: Baduta / Remaja" value="${escapeHtml(r.label)}" />
      </div>
      <div class="col-span-3 sm:col-span-3">
        <label class="block text-[10px] font-semibold text-slate-400 uppercase mb-0.5">Dari (Thn)</label>
        <input type="number" min="0" max="150" class="age-min w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
               value="${r.min}" />
      </div>
      <div class="col-span-3 sm:col-span-3">
        <label class="block text-[10px] font-semibold text-slate-400 uppercase mb-0.5">Sampai (Kosong = +)</label>
        <input type="number" min="0" max="150" class="age-max w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
               placeholder="Tak terbatas" value="${r.max !== null ? r.max : ''}" />
      </div>
      <div class="col-span-1 flex justify-end pt-3">
        <button type="button" onclick="removeAgeRangeRow(${idx})" title="Hapus kategori"
                class="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition cursor-pointer">
          ✕
        </button>
      </div>
    </div>
  `).join('');
}

function removeAgeRangeRow(index) {
  const current = getAgeRangesFromInputs();
  if (current.length <= 1) {
    alert('Minimal sisakan 1 kategori usia.');
    return;
  }
  current.splice(index, 1);
  renderAgeRangeInputs(current);
}

function getAgeRangesFromInputs() {
  const rows = document.querySelectorAll('#ageRangesContainer .age-range-row');
  const result = [];
  rows.forEach((row, idx) => {
    const label = row.querySelector('.age-label').value.trim();
    const minRaw = row.querySelector('.age-min').value.trim();
    const maxRaw = row.querySelector('.age-max').value.trim();
    result.push({
      id: `cat_${idx + 1}_${Date.now()}`,
      label,
      min: minRaw === '' ? NaN : parseInt(minRaw, 10),
      max: maxRaw === '' ? null : parseInt(maxRaw, 10)
    });
  });
  return result;
}

function syncAgeFilterDropdown() {
  if (!filterAgeGroup) return;
  const previousValue = filterAgeGroup.value;
  const optionsHtml = [
    `<option value="ALL">Semua Kelompok Umur</option>`,
    `<option value="PUS">Sasaran PUS (Istri 15–49 Thn)</option>`,
    ...customAgeRanges.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.label)}</option>`)
  ];
  filterAgeGroup.innerHTML = optionsHtml.join('');

  const stillExists = Array.from(filterAgeGroup.options).some(opt => opt.value === previousValue);
  filterAgeGroup.value = stillExists ? previousValue : 'ALL';
}

function reclassifyAllAgesAndRefresh() {
  syncAgeFilterDropdown();
  if (!allPopulationData.length) return;

  allPopulationData = allPopulationData.map(person => {
    if (typeof person.umur === 'number') {
      const cat = getAgeCategoryObj(person.umur);
      return {
        ...person,
        kategoriUmurId: cat ? cat.id : 'UNMATCHED',
        kategoriUmur: cat ? cat.label : 'Di Luar Kategori'
      };
    }
    return {
      ...person,
      kategoriUmurId: 'UNKNOWN',
      kategoriUmur: 'Tidak Diketahui'
    };
  });

  updateDashboard();
}

// ============================================================================
// UNIVERSAL DATA-FINGERPRINTING ENGINE (SCHEMA-AGNOSTIC PARSER)
// ============================================================================
function handleExcelFile(file) {
  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });

      if (!workbook.SheetNames.length) {
        alert("File Excel kosong atau tidak terbaca.");
        return;
      }

      const extracted = [];
      let sheetsReadCount = 0;

      workbook.SheetNames.forEach((sheetName) => {
        if (/^(rekap|grafik|chart|summary|ringkasan|petunjuk|panduan|keterangan)$/i.test(sheetName.trim())) {
          return;
        }

        const worksheet = workbook.Sheets[sheetName];
        const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        if (!rawMatrix.length) return;

        // Pangkas baris kosong beruntun di bagian bawah agar pemrosesan multi-sheet instan
        const matrix = trimTrailingEmptyRows(rawMatrix);
        if (!matrix.length) return;

        // Tahap 1: Ekstrak metadata wilayah dari kop atas tabel (Desa/Kelurahan, Dusun/RW, RT)
        const kopAddress = extractKopMetadata(matrix);

        // Tahap 2: Deteksi Header Multi-Baris & Titik Mulai Data
        const { startDataRow, colMap, hasTableHeader } = detectUniversalHeader(matrix);

        // Tahap 3: Pemindaian Sidik Jari Isi Kolom
        const finalColMap = inferColumnsByFingerprint(matrix, startDataRow, colMap);

        // Pastikan sheet punya kolom Nama serta indikator tabel penduduk (bukan halaman rekap KB)
        const hasAnyIdentityCol =
          hasTableHeader ||
          finalColMap.nik !== -1 ||
          finalColMap.noKK !== -1 ||
          finalColMap.hubungan !== -1 ||
          finalColMap.tglLahir !== -1 ||
          finalColMap.umur !== -1;

        if (finalColMap.nama === -1 || !hasAnyIdentityCol) return;

        let foundInSheet = 0;
        let lastSeenFamilyId = "";

        for (let r = startDataRow; r < matrix.length; r++) {
          const row = matrix[r];
          if (!row || row.length === 0) continue;

          if (isNoiseOrHeaderRow(row, finalColMap)) continue;

          const record = buildUniversalPersonRecord(row, finalColMap, kopAddress, sheetName, workbook.SheetNames.length);
          if (!record) continue;

          // Wariskan No. KK/KKI dari baris kepala keluarga di atasnya jika sel KK anggota dikosongkan
          if (!record.noKK && lastSeenFamilyId && !record.isExplicitHead) {
            record.noKK = lastSeenFamilyId;
          } else if (record.noKK) {
            lastSeenFamilyId = record.noKK;
          }

          extracted.push(record);
          foundInSheet++;
        }

        if (foundInSheet > 0) sheetsReadCount++;
      });

      if (!extracted.length) {
        alert("Data penduduk tidak ditemukan di seluruh halaman/sheet Excel ini.");
        return;
      }

      activeFamilyKeyFilter = null;
      currentUploadedFileName = file.name.replace(/\.[^/.]+$/, "");
      allPopulationData = assignFamilyGroupsAndHeads(extracted);

      const sheetInfo = sheetsReadCount > 1 ? ` (${sheetsReadCount} halaman/sheet)` : "";
      fileStatus.textContent = `✓ Berhasil membaca ${allPopulationData.length} data penduduk${sheetInfo} dari "${file.name}"`;
      fileStatus.classList.remove('hidden');
      dashboardContent.classList.remove('hidden');
      btnReset.classList.remove('hidden');

      updateDashboard();
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat membaca file Excel. Pastikan file tidak rusak.");
    }
  };

  reader.readAsArrayBuffer(file);
}

// Hentikan pembacaan setelah 15 baris kosong berturut-turut agar cepat
function trimTrailingEmptyRows(matrix) {
  let lastNonEmpty = -1;
  let emptyStreak = 0;

  for (let r = 0; r < matrix.length; r++) {
    const hasContent = matrix[r] && matrix[r].some(cell => String(cell ?? "").trim() !== "");
    if (hasContent) {
      lastNonEmpty = r;
      emptyStreak = 0;
    } else {
      emptyStreak++;
      if (lastNonEmpty !== -1 && emptyStreak >= 15) break;
    }
  }
  return lastNonEmpty === -1 ? [] : matrix.slice(0, lastNonEmpty + 1);
}

// Tahap 1: Ekstrak Informasi Wilayah dari Kop Atas (Misal: DESA / KELURAHAN : BOBONG, DUSUN / RW, RT)
function extractKopMetadata(matrix) {
  const parts = [];
  let desa = "";
  let dusun = "";
  let rt = "";

  const scanLimit = Math.min(matrix.length, 20);
  for (let r = 0; r < scanLimit; r++) {
    const row = matrix[r];
    if (!row) continue;

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "").trim();
      if (!cell) continue;
      const lower = cell.toLowerCase();

      const getNeighborValue = () => {
        if (cell.includes(':')) {
          const afterColon = cell.split(':').slice(1).join(':').trim();
          if (afterColon) return afterColon;
        }
        for (let k = c + 1; k < Math.min(row.length, c + 6); k++) {
          const val = String(row[k] ?? "").trim();
          if (val && val !== ':') return val.replace(/^:\s*/, '').trim();
        }
        return "";
      };

      if (!desa && (lower.startsWith('desa') || lower.includes('desa / kelurahan') || lower.includes('kelurahan'))) {
        const val = getNeighborValue();
        if (val && val.length < 40 && !/nama|nik|kk/i.test(val)) desa = val;
      } else if (!dusun && (lower.startsWith('dusun') || lower.startsWith('lingkungan'))) {
        const val = getNeighborValue();
        if (val && val.length < 40) dusun = val;
      } else if (!rt && (lower === 'rt' || lower.startsWith('rt ') || lower.startsWith('rt/'))) {
        const val = getNeighborValue();
        if (val && val.length < 20) rt = val;
      }
    }
  }

  if (dusun) parts.push(/dusun/i.test(dusun) ? dusun : `Dusun ${dusun}`);
  if (rt) parts.push(/rt/i.test(rt) ? rt : `RT ${rt}`);
  if (desa) parts.push(/desa|kelurahan/i.test(desa) ? desa : `Desa ${desa}`);

  return parts.join(', ');
}

// Tahap 2: Deteksi Header Multi-Baris (Gabungkan sel vertikal yang ter-merge)
function detectUniversalHeader(matrix) {
  const colMap = {
    nama: -1,
    noKK: -1,
    nik: -1,
    jk: -1,
    tglLahir: -1,
    umur: -1,
    alamat: -1,
    desa: -1,
    dusun: -1,
    rt: -1,
    hubungan: -1,
    statusPus: -1,
    statusKawin: -1
  };

  let bestHeaderRow = -1;
  let bestScore = 0;
  const maxScan = Math.min(matrix.length, 30);

  for (let r = 0; r < maxScan; r++) {
    const row = matrix[r];
    if (!row) continue;

    const combinedCells = row.map((cell, idx) => {
      const t0 = String(cell ?? "").trim();
      const t1 = (r + 1 < maxScan && matrix[r + 1]) ? String(matrix[r + 1][idx] ?? "").trim() : "";
      const isT1Number = /^\d+$/.test(t1);
      return `${t0} ${!isT1Number ? t1 : ""}`.toLowerCase().replace(/\s+/g, " ").trim();
    });

    let score = 0;
    if (combinedCells.some(c => /\bnama\b/.test(c))) score += 3;
    if (combinedCells.some(c => /\bnik\b|nomor induk|ktp/.test(c))) score += 3;
    if (combinedCells.some(c => /\bkk\b|\bkki\b|kartu keluarga|kode keluarga|no\.?\s*keluarga/.test(c))) score += 2;
    if (combinedCells.some(c => /lahir|ttl|tangal|tgl/.test(c))) score += 2;
    if (combinedCells.some(c => /kelamin|\bjk\b|l\/p|gender/.test(c))) score += 2;
    if (combinedCells.some(c => /hubungan|shdk|status keluarga/.test(c))) score += 2;
    if (combinedCells.some(c => /umur|usia/.test(c))) score += 1;
    if (combinedCells.some(c => /alamat|desa|dusun/.test(c))) score += 1;
    if (combinedCells.some(c => /\bpus\b|status pus/.test(c))) score += 1;

    if (score > bestScore && score >= 4) {
      bestScore = score;
      bestHeaderRow = r;
    }
  }

  if (bestHeaderRow !== -1) {
    const maxCols = Math.max(
      matrix[bestHeaderRow].length,
      (matrix[bestHeaderRow + 1] || []).length,
      (matrix[bestHeaderRow + 2] || []).length
    );

    for (let c = 0; c < maxCols; c++) {
      const parts = [];
      for (let offset = 0; offset <= 2; offset++) {
        if (bestHeaderRow + offset < matrix.length) {
          const val = String(matrix[bestHeaderRow + offset][c] ?? "").trim();
          if (val && !/^\d+$/.test(val)) parts.push(val);
        }
      }
      const cellText = parts.join(" ").toLowerCase().replace(/\s+/g, " ").trim();
      if (!cellText) continue;

      if (colMap.hubungan === -1 && (cellText.includes('hubungan') || cellText.includes('shdk') || cellText.includes('status keluarga'))) {
        colMap.hubungan = c;
      } else if (colMap.nama === -1 && (cellText.includes('nama') || cellText === 'penduduk') && !cellText.includes('ibu') && !cellText.includes('ayah') && !cellText.includes('desa') && !cellText.includes('kelurahan')) {
        colMap.nama = c;
      } else if (colMap.noKK === -1 && (cellText === 'kk' || cellText === 'kki' || cellText.includes('no. kk') || cellText.includes('no kk') || cellText.includes('nokk') || cellText.includes('kartu keluarga') || cellText.includes('kode keluarga'))) {
        colMap.noKK = c;
      } else if (colMap.nik === -1 && (cellText === 'nik' || cellText.includes('nomor induk') || cellText.includes('no. nik') || cellText.includes('no nik') || cellText.includes('ktp'))) {
        colMap.nik = c;
      } else if (colMap.jk === -1 && (cellText.includes('kelamin') || cellText === 'jk' || cellText === 'l/p' || cellText.includes('gender'))) {
        colMap.jk = c;
      } else if (colMap.tglLahir === -1 && (cellText.includes('lahir') || cellText === 'ttl' || cellText.includes('tangal') || cellText.includes('tgl'))) {
        colMap.tglLahir = c;
      } else if (colMap.umur === -1 && (cellText.includes('umur') || cellText.includes('usia'))) {
        colMap.umur = c;
      } else if (colMap.alamat === -1 && cellText.includes('alamat')) {
        colMap.alamat = c;
      } else if (colMap.desa === -1 && (cellText === 'desa' || cellText === 'kelurahan' || cellText.includes('nama desa'))) {
        colMap.desa = c;
      } else if (colMap.dusun === -1 && (cellText.includes('dusun') || cellText.includes('lingkungan'))) {
        colMap.dusun = c;
      } else if (colMap.rt === -1 && (cellText === 'rt' || cellText.startsWith('rt/') || cellText.startsWith('rt '))) {
        colMap.rt = c;
      } else if (colMap.statusPus === -1 && (cellText === 'pus' || cellText.includes('status pus'))) {
        colMap.statusPus = c;
      } else if (colMap.statusKawin === -1 && (cellText.includes('kawin') || cellText.includes('pernikahan') || cellText.includes('marital'))) {
        colMap.statusKawin = c;
      }
    }
  }

  let startDataRow = bestHeaderRow === -1 ? 0 : bestHeaderRow + 1;
  while (startDataRow < matrix.length) {
    const row = matrix[startDataRow];
    if (!row || row.every(c => String(c ?? "").trim() === "")) {
      startDataRow++;
      continue;
    }
    const nonEmpty = row.map(c => String(c ?? "").trim()).filter(Boolean);
    const allSmallNumbers = nonEmpty.length >= 3 && nonEmpty.every(v => /^\d{1,2}$/.test(v));
    const hasSubHeaderWords = nonEmpty.some(v => /^(tgl|bln|thn|tanggal|bulan|tahun|metode|kontrasepsi)$/i.test(v));
    if (allSmallNumbers || hasSubHeaderWords) {
      startDataRow++;
    } else {
      break;
    }
  }

  return { startDataRow, colMap, hasTableHeader: bestHeaderRow !== -1 };
}

// Tahap 3: Sidik Jari Data Universal (Ambang >= 1 & mengizinkan nama singkat 2 huruf)
function inferColumnsByFingerprint(matrix, startRow, colMap) {
  const sampleRows = [];
  for (let r = startRow; r < matrix.length && sampleRows.length < 45; r++) {
    const row = matrix[r];
    if (row && row.some(c => String(c ?? "").trim() !== "")) {
      sampleRows.push(row);
    }
  }
  if (!sampleRows.length) return colMap;

  const maxCols = Math.max(...sampleRows.map(r => r.length));
  const usedCols = new Set(Object.values(colMap).filter(idx => idx !== -1));

  const stats = [];
  for (let c = 0; c < maxCols; c++) {
    let nonEmpty = 0;
    let validNikCount = 0;
    let sixteenDigitCount = 0;
    let longIdCount = 0;
    let jkStrictCount = 0;
    let relationCount = 0;
    let dateCount = 0;
    let addressCount = 0;
    let humanNameCount = 0;
    const uniqueValues = new Set();

    for (const row of sampleRows) {
      const rawCell = row[c];
      const val = String(rawCell ?? "").replace(/^'/, "").trim();
      if (!val) continue;
      nonEmpty++;

      const digits = val.replace(/\D/g, "");
      if (digits.length >= 16 && digits.length <= 22) {
        longIdCount++;
        uniqueValues.add(digits);
        if (digits.length === 16) {
          sixteenDigitCount++;
          if (parseFromNIK(digits) !== null) validNikCount++;
        }
      }

      if (/^(l|p|laki-laki|perempuan|laki|pria|wanita|lk|pr)$/i.test(val)) {
        jkStrictCount++;
      }

      if (/^(kk|kepala keluarga|kepala rumah tangga|suami|istri|anak|menantu|cucu|orang tua|mertua|famili lain|pembantu|lainnya)$/i.test(val)) {
        relationCount++;
      }

      if (
        rawCell instanceof Date ||
        /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/.test(val) ||
        /\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/.test(val)
      ) {
        dateCount++;
      }

      if (/(dusun|desa|kelurahan|rt\s*\d|rw\s*\d|kecamatan|jalan|jl\.|blok)/i.test(val)) {
        addressCount++;
      }

      const isNonNameWord = /^(metode|mal|tradisional|obat tradisional|kk|istri|suami|anak|ya|tidak|pil|suntik|suntikan|implan|implant|iud|kondom|mop|mow|tidak memiliki|xx|wiraswasta|petani|pekebun|nelayan|pelajar|mahasiswa|irt|mengurus rumah tangga|belum\/tidak bekerja|tidak bekerja|pns|tni|polri|karyawan|buruh|guru|honorer|pedagang|islam|kristen|katolik|hindu|buddha|kawin|belum kawin|cerai|laki-laki|perempuan)$/i.test(val);
      if (!isNonNameWord && /^[a-zA-Z\s.,'`()\/-]{2,60}$/.test(val) && !/\d/.test(val)) {
        humanNameCount++;
      }
    }

    stats.push({
      colIdx: c,
      nonEmpty,
      validNikCount,
      sixteenDigitCount,
      longIdCount,
      uniqueRatio: longIdCount ? uniqueValues.size / longIdCount : 0,
      jkStrictCount,
      relationCount,
      dateCount,
      addressCount,
      humanNameCount
    });
  }

  // 1. Kunci NIK & No. KK / KKI
  const idCandidates = stats
    .filter(s => !usedCols.has(s.colIdx) && s.longIdCount >= 1)
    .sort((a, b) => b.validNikCount - a.validNikCount || b.sixteenDigitCount - a.sixteenDigitCount || b.uniqueRatio - a.uniqueRatio);

  if (colMap.nik === -1 && idCandidates.length > 0 && idCandidates[0].sixteenDigitCount >= 1) {
    colMap.nik = idCandidates[0].colIdx;
    usedCols.add(colMap.nik);
    if (colMap.noKK === -1 && idCandidates.length > 1) {
      colMap.noKK = idCandidates[1].colIdx;
      usedCols.add(colMap.noKK);
    }
  } else if (colMap.noKK === -1 && idCandidates.length > 0) {
    colMap.noKK = idCandidates[0].colIdx;
    usedCols.add(colMap.noKK);
  }

  // 2. Kunci Hubungan Keluarga
  if (colMap.hubungan === -1) {
    const bestRel = stats
      .filter(s => !usedCols.has(s.colIdx) && s.relationCount >= 1)
      .sort((a, b) => b.relationCount - a.relationCount)[0];
    if (bestRel) {
      colMap.hubungan = bestRel.colIdx;
      usedCols.add(colMap.hubungan);
    }
  }

  // 3. Kunci Jenis Kelamin
  if (colMap.jk === -1) {
    const bestJk = stats
      .filter(s => !usedCols.has(s.colIdx) && s.jkStrictCount >= 1 && (s.jkStrictCount / s.nonEmpty) >= 0.75)
      .sort((a, b) => b.jkStrictCount - a.jkStrictCount)[0];
    if (bestJk) {
      colMap.jk = bestJk.colIdx;
      usedCols.add(colMap.jk);
    }
  }

  // 4. Kunci Tanggal Lahir
  if (colMap.tglLahir === -1) {
    const bestDate = stats
      .filter(s => !usedCols.has(s.colIdx) && s.dateCount >= 1)
      .sort((a, b) => b.dateCount - a.dateCount)[0];
    if (bestDate) {
      colMap.tglLahir = bestDate.colIdx;
      usedCols.add(colMap.tglLahir);
    }
  }

  // 5. Kunci Alamat
  if (colMap.alamat === -1 && colMap.desa === -1) {
    const bestAddr = stats
      .filter(s => !usedCols.has(s.colIdx) && s.addressCount >= 1)
      .sort((a, b) => b.addressCount - a.addressCount)[0];
    if (bestAddr) {
      colMap.alamat = bestAddr.colIdx;
      usedCols.add(colMap.alamat);
    }
  }

  // 6. Kunci Nama Lengkap
  if (colMap.nama === -1) {
    const bestName = stats
      .filter(s => !usedCols.has(s.colIdx) && s.humanNameCount >= 1)
      .sort((a, b) => b.humanNameCount - a.humanNameCount)[0];
    if (bestName) {
      colMap.nama = bestName.colIdx;
      usedCols.add(colMap.nama);
    }
  }

  return colMap;
}

// Ambil isi sel dengan pemulihan otomatis jika sel tergeser 1 kolom ke kanan/kiri akibat merge Excel
function getCellWithShiftFallback(row, colIdx, validatorFn) {
  if (colIdx === -1) return "";
  const direct = String(row[colIdx] ?? "").trim();
  if (direct && (!validatorFn || validatorFn(direct))) return direct;

  if (!direct) {
    const right = String(row[colIdx + 1] ?? "").trim();
    if (right && (!validatorFn || validatorFn(right))) return right;
    if (colIdx > 0) {
      const left = String(row[colIdx - 1] ?? "").trim();
      if (left && (!validatorFn || validatorFn(left))) return left;
    }
  }
  return direct;
}

// Filter baris pengganggu & tabel rekap metode kontrasepsi
function isNoiseOrHeaderRow(row, colMap) {
  const rawNama = getCellWithShiftFallback(row, colMap.nama, v => isNaN(Number(v)));
  const rawNik = getCellWithShiftFallback(row, colMap.nik, v => /^\d{16}$/.test(v.replace(/\D/g, ""))).replace(/\D/g, "");

  if (!rawNama && rawNik.length !== 16) return true;
  if (rawNama && !isNaN(Number(rawNama))) return true;
  if (/^(total|jumlah|rekap|mengetahui|kepala desa|camat|nama lengkap|nama penduduk|nama|keterangan|catatan|nb|sumber|rekapitulasi|metode|mal|tradisional|obat tradisional|iud|mow|mop|implant|implan|suntik|suntikan|pil|kondom|pemerintah|swasta|lainnya)$/i.test(rawNama)) {
    return true;
  }
  if (/^(kolom\s+\d|rekapitulasi\s+data|peserta\s+kb)/i.test(rawNama)) return true;
  if (rawNama.includes(':')) return true;
  return false;
}

// Dekode NIK 16 Digit
function parseFromNIK(nikRaw) {
  const nik = String(nikRaw || "").replace(/\D/g, "");
  if (nik.length !== 16) return null;

  if (/^(\d)\1{15}$/.test(nik)) return null;

  const ddRaw = parseInt(nik.substring(6, 8), 10);
  const mm = parseInt(nik.substring(8, 10), 10);
  const yy = parseInt(nik.substring(10, 12), 10);

  if (isNaN(ddRaw)) return null;

  let jk = "Tidak Diketahui";
  let day = ddRaw;
  if (ddRaw >= 41 && ddRaw <= 71) {
    jk = "Perempuan";
    day = ddRaw - 40;
  } else if (ddRaw >= 1 && ddRaw <= 31) {
    jk = "Laki-laki";
  } else {
    return null;
  }

  let birthDate = null;
  if (!isNaN(mm) && !isNaN(yy) && mm >= 1 && mm <= 12) {
    const currentYearShort = new Date().getFullYear() % 100;
    const fullYear = yy <= currentYearShort ? 2000 + yy : 1900 + yy;
    const candidateDate = new Date(fullYear, mm - 1, day);
    if (candidateDate.getMonth() === mm - 1 && candidateDate.getDate() === day) {
      birthDate = candidateDate;
    }
  }

  return { jk, birthDate };
}

// Menyusun 1 Baris Data Penduduk
function buildUniversalPersonRecord(row, colMap, kopAddress, sheetName, totalSheets) {
  const namaRaw = getCellWithShiftFallback(row, colMap.nama, v => isNaN(Number(v)) && v.replace(/\D/g, "").length < 10);
  const nama = namaRaw || "-";

  const noKKRaw = getCellWithShiftFallback(row, colMap.noKK, v => v.replace(/\D/g, "").length >= 10);
  const noKK = noKKRaw.replace(/^'/, "").replace(/\s+/g, "").trim();

  let nikVal = getCellWithShiftFallback(row, colMap.nik, v => v.replace(/\D/g, "").length === 16)
    .replace(/^'/, "")
    .replace(/\s+/g, "")
    .trim();

  if (!nikVal || nikVal.replace(/\D/g, "").length !== 16) {
    const foundNikCell = row.find((cell, idx) => {
      if (idx === colMap.nama || idx === colMap.noKK) return false;
      const d = String(cell ?? "").replace(/\D/g, "");
      return d.length === 16;
    });
    if (foundNikCell) nikVal = String(foundNikCell).replace(/^'/, "").replace(/\s+/g, "").trim();
  }
  const nikInfo = parseFromNIK(nikVal);

  const hubungan = getCellWithShiftFallback(row, colMap.hubungan, v => /^[a-zA-Z\s]+$/.test(v));
  const isExplicitHead = /^(kk|kepala\s*keluarga|kepala\s*rumah\s*tangga)$/i.test(hubungan);

  const rawStatusPus = colMap.statusPus !== -1 ? String(row[colMap.statusPus] ?? "").trim().toUpperCase() : "";
  const rawStatusKawin = colMap.statusKawin !== -1 ? String(row[colMap.statusKawin] ?? "").trim().toUpperCase() : "";

  // 1. Jenis Kelamin
  let jk = "Tidak Diketahui";
  if (nikInfo && nikInfo.jk !== "Tidak Diketahui") {
    jk = nikInfo.jk;
  } else if (colMap.jk !== -1) {
    const rawJk = String(row[colMap.jk] ?? "").trim().toUpperCase();
    if (rawJk === 'L' || rawJk === 'LK' || rawJk === 'LAKI' || rawJk.startsWith('LAKI') || rawJk === 'PRIA' || rawJk === 'M' || rawJk === '1') {
      jk = "Laki-laki";
    } else if (rawJk === 'P' || rawJk === 'PR' || rawJk.startsWith('PEREMPUAN') || rawJk === 'WANITA' || rawJk === 'F' || rawJk === '2') {
      jk = "Perempuan";
    }
  }

  // 2. Tanggal Lahir
  let parsedDate = null;
  let fallbackTglStr = "-";

  if (colMap.tglLahir !== -1) {
    const idx = colMap.tglLahir;
    const c0 = row[idx];
    const c1 = row[idx + 1];
    const c2 = row[idx + 2];
    const c3 = row[idx + 3];

    const d1 = parseInt(String(c1 ?? "").trim(), 10);
    const m2 = parseInt(String(c2 ?? "").trim(), 10);
    const y3 = parseInt(String(c3 ?? "").trim(), 10);

    const d0 = parseInt(String(c0 ?? "").trim(), 10);
    const m1 = parseInt(String(c1 ?? "").trim(), 10);
    const y2 = parseInt(String(c2 ?? "").trim(), 10);

    if (!isNaN(d1) && d1 >= 1 && d1 <= 31 && !isNaN(m2) && m2 >= 1 && m2 <= 12 && !isNaN(y3) && y3 >= 1900 && y3 <= 2100) {
      parsedDate = new Date(y3, m2 - 1, d1);
    } else if (!isNaN(d0) && d0 >= 1 && d0 <= 31 && !isNaN(m1) && m1 >= 1 && m1 <= 12 && !isNaN(y2) && y2 >= 1900 && y2 <= 2100) {
      parsedDate = new Date(y2, m1 - 1, d0);
    } else {
      parsedDate = parseFlexibleDate(c0);
      if (!parsedDate && c1) parsedDate = parseFlexibleDate(c1);
      if (c0 && !parsedDate) fallbackTglStr = String(c0).trim();
    }
  }

  if (!parsedDate && nikInfo && nikInfo.birthDate) {
    parsedDate = nikInfo.birthDate;
  }

  const tglFormatted = parsedDate ? formatDateID(parsedDate) : fallbackTglStr;

  // 3. Hitung Umur
  const rawUmur = colMap.umur !== -1 ? row[colMap.umur] : "";
  let umur = null;
  if (parsedDate) {
    umur = calculateAge(parsedDate);
  } else if (rawUmur !== "" && !isNaN(parseInt(rawUmur, 10))) {
    umur = parseInt(rawUmur, 10);
  }

  // 4. Alamat
  const alamatFull = colMap.alamat !== -1 ? String(row[colMap.alamat] ?? "").trim() : "";
  const desa = colMap.desa !== -1 ? String(row[colMap.desa] ?? "").trim() : "";
  const dusun = colMap.dusun !== -1 ? String(row[colMap.dusun] ?? "").trim() : "";
  const rt = colMap.rt !== -1 ? String(row[colMap.rt] ?? "").trim() : "";

  const alamatGabungan = [];
  if (alamatFull) alamatGabungan.push(alamatFull);
  if (desa && !alamatFull.toLowerCase().includes(desa.toLowerCase())) alamatGabungan.push(desa);
  if (dusun && !alamatFull.toLowerCase().includes(dusun.toLowerCase())) alamatGabungan.push(dusun);
  if (rt && !alamatFull.toLowerCase().includes('rt')) alamatGabungan.push(`RT ${rt}`);

  let finalAlamat = alamatGabungan.length ? alamatGabungan.join(', ') : kopAddress;
  if (!finalAlamat) {
    finalAlamat = totalSheets > 1 ? sheetName : "-";
  }

  // Pagar 2: Baris penduduk sah jika memiliki Nama valid DAN minimal 1 indikator kependudukan nyata
  if (nama === "-" && nikVal === "") return null;
  const hasRealDemographicData =
    nikVal !== "" ||
    noKK !== "" ||
    hubungan !== "" ||
    jk !== "Tidak Diketahui" ||
    tglFormatted !== "-" ||
    umur !== null;

  if (!hasRealDemographicData) return null;

  const ageCatObj = umur !== null ? getAgeCategoryObj(umur) : null;

  return {
    nama,
    nik: nikVal || "-",
    noKK,
    hubungan,
    rawStatusPus,
    rawStatusKawin,
    isExplicitHead,
    isPUS: false,
    familyKey: "",
    globalIndex: 0,
    hasValidKK: false,
    isKepalaKeluarga: false,
    jk,
    tglLahir: tglFormatted,
    umur: umur !== null ? umur : "-",
    kategoriUmurId: umur !== null ? (ageCatObj ? ageCatObj.id : "UNMATCHED") : "UNKNOWN",
    kategoriUmur: umur !== null ? (ageCatObj ? ageCatObj.label : "Di Luar Kategori") : "Tidak Diketahui",
    alamat: finalAlamat
  };
}

// Pengelompokan Keluarga, Penanda Kepala Keluarga & Sasaran PUS (1 hitungan per pasangan keluarga)
function assignFamilyGroupsAndHeads(records) {
  const seenKKWithHead = new Set();
  const familyHasExplicitPUS = new Set();
  const familyHasEligibleWife = new Set();

  records.forEach(person => {
    const cleanKK = (person.noKK || "").replace(/\D/g, "");
    const isValidKK = cleanKK.length >= 10;

    if (isValidKK && person.isExplicitHead) {
      seenKKWithHead.add(cleanKK);
    }
    if (isValidKK && person.rawStatusPus === 'YA') {
      familyHasExplicitPUS.add(cleanKK);
    }

    const isWifeRel = /^(istri)$/i.test(person.hubungan);
    const isFemale = person.jk === "Perempuan";
    const isFertileAge = typeof person.umur === 'number' && person.umur >= 15 && person.umur <= 49;
    const isMarried = /^kawin$/i.test(person.rawStatusKawin);

    if (isValidKK && isWifeRel && isFertileAge) {
      familyHasEligibleWife.add(cleanKK);
    } else if (isValidKK && isFemale && isFertileAge && isMarried) {
      familyHasEligibleWife.add(cleanKK);
    }
  });

  const fallbackFirstSeenKK = new Set();
  const countedPusPerKK = new Set();

  return records.map((person, idx) => {
    const cleanKK = (person.noKK || "").replace(/\D/g, "");
    const hasValidKK = cleanKK.length >= 10;
    const groupKey = hasValidKK ? `KK_${cleanKK}` : `NO_KK_${idx}`;

    let isHead = false;
    if (person.isExplicitHead) {
      isHead = true;
    } else if (hasValidKK && !seenKKWithHead.has(cleanKK) && !fallbackFirstSeenKK.has(cleanKK)) {
      fallbackFirstSeenKK.add(cleanKK);
      const isChild = typeof person.umur === 'number' && person.umur < 17;
      isHead = !isChild;
    }

    let isPUS = false;
    if (hasValidKK) {
      if (!countedPusPerKK.has(cleanKK)) {
        if (familyHasExplicitPUS.has(cleanKK) && (isHead || /^(istri)$/i.test(person.hubungan) || person.rawStatusPus === 'YA')) {
          isPUS = true;
          countedPusPerKK.add(cleanKK);
        } else if (!familyHasExplicitPUS.has(cleanKK) && familyHasEligibleWife.has(cleanKK) && /^(istri)$/i.test(person.hubungan)) {
          isPUS = true;
          countedPusPerKK.add(cleanKK);
        }
      }
    } else {
      const isFemale = person.jk === "Perempuan";
      const isFertileAge = typeof person.umur === 'number' && person.umur >= 15 && person.umur <= 49;
      const isWifeOrMarried = /^(istri)$/i.test(person.hubungan) || /^kawin$/i.test(person.rawStatusKawin);
      if (person.rawStatusPus === 'YA' || (isFemale && isFertileAge && isWifeOrMarried)) {
        isPUS = true;
      }
    }

    return {
      ...person,
      familyKey: groupKey,
      hasValidKK,
      isKepalaKeluarga: isHead,
      isPUS,
      globalIndex: idx
    };
  });
}

// Buka Pop-up Satu Keluarga saat nama diklik
function openFamilyModal(globalIndex) {
  const clickedPerson = allPopulationData[globalIndex];
  if (!clickedPerson) return;

  currentModalFamilyKey = clickedPerson.familyKey;
  const familyMembers = allPopulationData.filter(p => p.familyKey === clickedPerson.familyKey);
  const head = familyMembers.find(m => m.isKepalaKeluarga) || familyMembers[0];

  document.getElementById('modalFamilyTitle').textContent = head.isKepalaKeluarga
    ? `Keluarga ${head.nama}`
    : `Data Penduduk: ${head.nama}`;
  document.getElementById('modalNoKK').textContent = `No. KK / KKI: ${head.noKK || 'Tidak Tercantum'}`;
  document.getElementById('modalFamilyCount').textContent = `Total: ${familyMembers.length} Anggota Keluarga`;
  document.getElementById('modalFamilyAddress').innerHTML = `<span class="font-bold text-slate-700">Alamat Keluarga:</span> ${escapeHtml(head.alamat)}`;

  const modalBody = document.getElementById('modalFamilyBody');
  modalBody.innerHTML = familyMembers.map((member, idx) => {
    const isClicked = member.globalIndex === globalIndex;
    const badgeJk = member.jk === "Laki-laki"
      ? `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">Laki-laki</span>`
      : member.jk === "Perempuan"
      ? `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-800">Perempuan</span>`
      : `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">${member.jk}</span>`;

    const statusBadge = member.isKepalaKeluarga
      ? `<span class="px-2 py-0.5 text-[11px] font-bold bg-blue-600 text-white rounded">Kepala Keluarga</span>`
      : `<span class="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-600 rounded">${escapeHtml(member.hubungan || 'Anggota Keluarga')}</span>`;

    return `
      <tr class="${isClicked ? 'bg-amber-50/90' : (member.isKepalaKeluarga ? 'bg-blue-50/60' : '')}">
        <td class="py-2.5 px-3 text-slate-500">${idx + 1}</td>
        <td class="py-2.5 px-3 ${member.isKepalaKeluarga ? 'font-extrabold text-blue-800' : 'font-semibold text-slate-800'}">
          ${escapeHtml(member.nama)}
          ${isClicked ? '<span class="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded">Dipilih</span>' : ''}
        </td>
        <td class="py-2.5 px-3">${statusBadge}</td>
        <td class="py-2.5 px-3 font-mono text-xs text-slate-600">${escapeHtml(member.nik)}</td>
        <td class="py-2.5 px-3">${badgeJk}</td>
        <td class="py-2.5 px-3 text-slate-600">${escapeHtml(member.tglLahir)}</td>
        <td class="py-2.5 px-3 font-semibold text-slate-700">${member.umur} Thn</td>
      </tr>
    `;
  }).join('');

  familyModal.classList.remove('hidden');
}

// Parser Tanggal Fleksibel
function parseFlexibleDate(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val)) return val;

  if (typeof val === 'number' && val > 1000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + val * 86400000);
  }

  const str = String(val).trim();

  const dmyMatch = str.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return new Date(y, m - 1, d);
  }

  const ymdMatch = str.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymdMatch) {
    return new Date(parseInt(ymdMatch[1], 10), parseInt(ymdMatch[2], 10) - 1, parseInt(ymdMatch[3], 10));
  }

  const bulanMap = {
    jan: 0, januari: 0, feb: 1, februari: 1, mar: 2, maret: 2,
    apr: 3, april: 3, mei: 4, jun: 5, juni: 5, jul: 6, juli: 6,
    agu: 7, agt: 7, agustus: 7, sep: 8, september: 8, okt: 9, oktober: 9,
    nov: 10, november: 10, des: 11, desember: 11
  };
  const textDateMatch = str.toLowerCase().match(/(\d{1,2})[\s\-]([a-z]{3,9})[\s\-](\d{4})/);
  if (textDateMatch && bulanMap.hasOwnProperty(textDateMatch[2])) {
    return new Date(parseInt(textDateMatch[3], 10), bulanMap[textDateMatch[2]], parseInt(textDateMatch[1], 10));
  }

  const fallback = new Date(str);
  return isNaN(fallback) ? null : fallback;
}

function formatDateID(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function calculateAge(birthDate) {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age < 0 ? 0 : age;
}

function getAgeCategoryObj(age) {
  for (const range of customAgeRanges) {
    const aboveMin = age >= range.min;
    const belowMax = range.max === null || age <= range.max;
    if (aboveMin && belowMax) return range;
  }
  return null;
}

function updateDashboard() {
  syncAgeFilterDropdown();

  const total = allPopulationData.length;
  let totalKK = 0;
  let laki = 0;
  let perempuan = 0;
  let nikBermasalah = 0;
  let jumlahPUS = 0;

  const ageCounts = {};
  customAgeRanges.forEach(r => { ageCounts[r.id] = 0; });

  for (const d of allPopulationData) {
    if (d.isKepalaKeluarga) totalKK++;
    if (d.isPUS) jumlahPUS++;
    if (d.jk === "Laki-laki") laki++;
    else if (d.jk === "Perempuan") perempuan++;
    else nikBermasalah++;

    if (ageCounts.hasOwnProperty(d.kategoriUmurId)) {
      ageCounts[d.kategoriUmurId]++;
    }
  }

  const persenL = total ? ((laki / total) * 100).toFixed(1) : 0;
  const persenP = total ? ((perempuan / total) * 100).toFixed(1) : 0;
  const persenNik = total ? ((nikBermasalah / total) * 100).toFixed(1) : 0;

  document.getElementById('statTotal').textContent = total.toLocaleString('id-ID');
  document.getElementById('statTotalKK').textContent = totalKK.toLocaleString('id-ID');
  document.getElementById('statLaki').textContent = laki.toLocaleString('id-ID');
  document.getElementById('statPerempuan').textContent = perempuan.toLocaleString('id-ID');
  document.getElementById('persenLaki').textContent = `${persenL}%`;
  document.getElementById('persenPerempuan').textContent = `${persenP}%`;

  const elStatNik = document.getElementById('statNikBermasalah');
  const elPersenNik = document.getElementById('persenNikBermasalah');
  if (elStatNik) elStatNik.textContent = nikBermasalah.toLocaleString('id-ID');
  if (elPersenNik) elPersenNik.textContent = `${persenNik}%`;

  const elStatPUS = document.getElementById('statPUS');
  if (elStatPUS) elStatPUS.textContent = jumlahPUS.toLocaleString('id-ID');

  const subtitleEl = document.getElementById('ageChartSubtitle');
  if (subtitleEl) {
    subtitleEl.textContent = `Distribusi berdasarkan ${customAgeRanges.length} kategori rentang usia aktif`;
  }

  renderCharts(laki, perempuan, ageCounts);
  renderSummaryBoxes(laki, perempuan, persenL, persenP, ageCounts);
  applyFilters();
}

function renderSummaryBoxes(laki, perempuan, persenL, persenP, ageCounts) {
  document.getElementById('genderSummaryTable').innerHTML = `
    <div class="bg-sky-50/70 rounded-xl p-3 flex justify-between items-center">
      <span class="font-semibold text-sky-900">Laki-laki</span>
      <span class="font-bold text-sky-700">${laki} (${persenL}%)</span>
    </div>
    <div class="bg-pink-50/70 rounded-xl p-3 flex justify-between items-center">
      <span class="font-semibold text-pink-900">Perempuan</span>
      <span class="font-bold text-pink-700">${perempuan} (${persenP}%)</span>
    </div>
  `;

  const summaryGrid = document.getElementById('ageSummaryGrid');
  summaryGrid.className = "mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-center text-xs";

  summaryGrid.innerHTML = customAgeRanges.map(item => `
    <div onclick="quickFilterAgeCategory('${escapeHtml(item.id)}')" title="Klik untuk memfilter ${escapeHtml(item.label)}"
         class="bg-slate-50 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-300 rounded-xl p-2 cursor-pointer transition">
      <div class="text-slate-500 font-medium truncate">${escapeHtml(item.label)}</div>
      <div class="text-sm font-extrabold text-blue-700 mt-0.5">${ageCounts[item.id] || 0}</div>
    </div>
  `).join('');
}

function quickFilterAgeCategory(categoryId) {
  activeFamilyKeyFilter = null;
  filterAgeGroup.value = categoryId;
  applyFilters();
  document.getElementById('tableBody').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCharts(laki, perempuan, ageCounts) {
  if (genderChartInstance) genderChartInstance.destroy();
  if (ageChartInstance) ageChartInstance.destroy();

  const ctxGender = document.getElementById('chartGender').getContext('2d');
  genderChartInstance = new Chart(ctxGender, {
    type: 'doughnut',
    data: {
      labels: ['Laki-laki', 'Perempuan'],
      datasets: [{
        data: [laki, perempuan],
        backgroundColor: ['#0284c7', '#db2777'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });

  const palette = ['#38bdf8', '#3b82f6', '#1d4ed8', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899'];
  const chartLabels = customAgeRanges.map(r => r.label);
  const chartValues = customAgeRanges.map(r => ageCounts[r.id] || 0);
  const chartColors = customAgeRanges.map((_, idx) => palette[idx % palette.length]);

  const ctxAge = document.getElementById('chartAge').getContext('2d');
  ageChartInstance = new Chart(ctxAge, {
    type: 'bar',
    data: {
      labels: chartLabels,
      datasets: [{
        label: 'Jumlah Jiwa',
        data: chartValues,
        backgroundColor: chartColors,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
}

function applyFilters() {
  const keyword = searchInput.value.toLowerCase().trim();
  const selectedGender = filterGender.value;
  const selectedAge = filterAgeGroup.value;

  const filtered = allPopulationData.filter(item => {
    if (activeFamilyKeyFilter) {
      return item.familyKey === activeFamilyKeyFilter;
    }

    const matchKeyword =
      item.nama.toLowerCase().includes(keyword) ||
      item.nik.toLowerCase().includes(keyword) ||
      item.alamat.toLowerCase().includes(keyword);
    const matchGender = selectedGender === "ALL" || item.jk === selectedGender;
    const matchAge =
      selectedAge === "ALL" ||
      (selectedAge === "PUS" ? item.isPUS : item.kategoriUmurId === selectedAge);
    return matchKeyword && matchGender && matchAge;
  });

  renderTable(filtered);
}

function clearFamilyFilter() {
  activeFamilyKeyFilter = null;
  applyFilters();
}

function filterNikBermasalah() {
  activeFamilyKeyFilter = null;
  searchInput.value = '';
  filterGender.value = 'Tidak Diketahui';
  filterAgeGroup.value = 'ALL';
  applyFilters();
  document.getElementById('tableBody').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function filterPUS() {
  activeFamilyKeyFilter = null;
  searchInput.value = '';
  filterGender.value = 'ALL';
  filterAgeGroup.value = 'PUS';
  applyFilters();
  document.getElementById('tableBody').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTable(data) {
  currentFilteredData = data;
  const tbody = document.getElementById('tableBody');
  const info = document.getElementById('tableCountInfo');

  if (!data.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="py-8 text-center text-slate-400">Tidak ada data yang cocok dengan pencarian/filter.</td>
      </tr>
    `;
    info.textContent = "Menampilkan 0 data";
    return;
  }

  tbody.innerHTML = data.map((row, idx) => {
    const badgeJk = row.jk === "Laki-laki"
      ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">Laki-laki</span>`
      : row.jk === "Perempuan"
      ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-800">Perempuan</span>`
      : `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">${row.jk}</span>`;

    const rowBgClass = row.isKepalaKeluarga
      ? "bg-blue-50/70 hover:bg-blue-100/80 border-t-2 border-blue-200"
      : "hover:bg-amber-50/60";

    const pusTag = row.isPUS
      ? `<span class="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white rounded">PUS</span>`
      : "";

    const namaCellHtml = row.isKepalaKeluarga
      ? `<div class="flex items-center gap-2">
           <span class="font-extrabold text-blue-800 group-hover:underline">${escapeHtml(row.nama)}</span>
           <span class="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white rounded">KK</span>
           ${pusTag}
         </div>`
      : `<div class="flex items-center gap-2 pl-3">
           <span class="font-normal text-slate-700 group-hover:text-blue-700 group-hover:underline">${escapeHtml(row.nama)}</span>
           ${pusTag}
         </div>`;

    return `
      <tr onclick="openFamilyModal(${row.globalIndex})" title="Klik untuk melihat satu keluarga lengkap" class="${rowBgClass} group cursor-pointer transition">
        <td class="py-3 px-4 ${row.isKepalaKeluarga ? 'font-bold text-blue-800' : 'text-slate-500'}">${idx + 1}</td>
        <td class="py-3 px-4">${namaCellHtml}</td>
        <td class="py-3 px-4 font-mono text-xs text-slate-600 tracking-wide">${escapeHtml(row.nik)}</td>
        <td class="py-3 px-4">${badgeJk}</td>
        <td class="py-3 px-4 text-slate-600">${escapeHtml(row.tglLahir)}</td>
        <td class="py-3 px-4 ${row.isKepalaKeluarga ? 'font-bold text-slate-800' : 'text-slate-700'}">${row.umur} Thn</td>
        <td class="py-3 px-4">
          <span class="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
            ${escapeHtml(row.kategoriUmur)}
          </span>
        </td>
        <td class="py-3 px-4 text-slate-600">${escapeHtml(row.alamat)}</td>
      </tr>
    `;
  }).join('');

  const totalKK = data.filter(d => d.isKepalaKeluarga).length;
  if (activeFamilyKeyFilter) {
    info.innerHTML = `Menampilkan <strong>1 Keluarga</strong> (${data.length} jiwa) &mdash; <button type="button" onclick="clearFamilyFilter()" class="text-blue-600 hover:underline font-semibold cursor-pointer">Tampilkan Semua Penduduk</button>`;
  } else {
    info.textContent = `Menampilkan ${data.length} jiwa (${totalKK} Kepala Keluarga) dari total ${allPopulationData.length} data penduduk • Klik nama untuk melihat satu keluarga`;
  }
}

// Export Rincian Data Penduduk ke Excel (.xlsx)
function exportTableToExcel() {
  if (!currentFilteredData.length) {
    alert("Tidak ada data penduduk untuk di-download.");
    return;
  }

  const exportRows = currentFilteredData.map((row, idx) => ({
    "No": idx + 1,
    "Status": row.isKepalaKeluarga ? "Kepala Keluarga" : (row.hubungan || "Anggota Keluarga"),
    "Status PUS": row.isPUS ? "PUS" : "-",
    "No. KK / KKI": row.noKK || "-",
    "Nama Lengkap": row.nama,
    "NIK": row.nik,
    "Jenis Kelamin": row.jk,
    "Tanggal Lahir": row.tglLahir,
    "Umur (Thn)": row.umur,
    "Kategori Umur": row.kategoriUmur,
    "Alamat": row.alamat
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data_Penduduk_Rapi");
  XLSX.writeFile(wb, `Rincian_${currentUploadedFileName}.xlsx`);
}

// Export Rincian Data Penduduk ke PDF (A4 Landscape)
function exportTableToPDF() {
  if (!currentFilteredData.length) {
    alert("Tidak ada data penduduk untuk di-download.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const totalJiwa = currentFilteredData.length;
  const totalKK = currentFilteredData.filter(d => d.isKepalaKeluarga).length;
  const totalLaki = currentFilteredData.filter(d => d.jk === "Laki-laki").length;
  const totalPerempuan = currentFilteredData.filter(d => d.jk === "Perempuan").length;

  const tanggalCetak = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 58, 138);
  doc.text("LAPORAN RINCIAN DATA KEPENDUDUKAN", 14, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Sumber File: ${currentUploadedFileName}  |  Tanggal Cetak: ${tanggalCetak}`, 14, 21);

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 24, 269, 9, 1.5, 1.5, 'F');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Total Penduduk: ${totalJiwa.toLocaleString('id-ID')} Jiwa    |    Total KK: ${totalKK.toLocaleString('id-ID')} Keluarga    |    Laki-laki: ${totalLaki.toLocaleString('id-ID')}    |    Perempuan: ${totalPerempuan.toLocaleString('id-ID')}`,
    18,
    29.8
  );

  const tableRows = currentFilteredData.map((row, idx) => [
    idx + 1,
    row.isKepalaKeluarga ? `${row.nama} (KK)` : `   ${row.nama}`,
    row.nik,
    row.jk,
    row.tglLahir,
    `${row.umur} Thn`,
    row.kategoriUmur,
    row.alamat
  ]);

  doc.autoTable({
    startY: 36,
    head: [[
      'No',
      'Nama Lengkap',
      'NIK',
      'Jenis Kelamin',
      'Tgl Lahir',
      'Umur',
      'Kategori',
      'Alamat (Desa/Dusun/RT)'
    ]],
    body: tableRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 52 },
      2: { cellWidth: 33, halign: 'center' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 'auto' }
    },
    didParseCell: function (data) {
      if (data.section === 'body') {
        const rowObj = currentFilteredData[data.row.index];
        if (rowObj && rowObj.isKepalaKeluarga) {
          data.cell.styles.fillColor = [239, 246, 255];
          if (data.column.index === 0 || data.column.index === 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [30, 64, 175];
          }
        }
      }
    },
    didDrawPage: function (data) {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Halaman ${data.pageNumber} dari ${pageCount}`,
        doc.internal.pageSize.getWidth() - 14,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'right' }
      );
    }
  });

  doc.save(`Rincian_${currentUploadedFileName}.pdf`);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
