// ============================================
// Veri Yönetim Modülü — Kayıt, içe/dışa aktarma işlemleri
// ============================================
// Adlandırılmış kayıtları localStorage'da saklar.
// JSON ve Excel formatlarında içe/dışa aktarma sağlar.
// Hesaplama sonuçlarını tez raporu için Excel'e aktarır.

const DataManager = (() => {
    const SAVES_KEY = 'mcdm_thesis_saves';

    // ── HTML karakter kaçışı (XSS koruması) ──
    // Kullanıcı girdilerini innerHTML ile göstermeden önce
    // özel HTML karakterlerini güvenli eşdeğerleriyle değiştirir.
    const _escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    /**
     * Metin içindeki HTML özel karakterlerini kaçış dizileriyle değiştirir.
     * @param {string} str — Kaçış uygulanacak metin
     * @returns {string}   — Güvenli metin
     */
    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, ch => _escapeMap[ch]);
    }

    // ────────────────────────────────────────────
    // Kayıtlı veri setleri (localStorage)
    // ────────────────────────────────────────────

    /**
     * Tüm kayıtlı veri setlerini getirir.
     * @returns {object[]} — { name, date, data } dizisi
     */
    function getSaves() {
        try {
            const raw = localStorage.getItem(SAVES_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.warn('Kayıtlı veriler okunamadı:', e);
            return [];
        }
    }

    /** @private Kayıtları localStorage'a yazar. */
    function _writeSaves(saves) {
        localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
    }

    /**
     * Mevcut veriyi adlandırılmış kayıt olarak saklar.
     * Aynı isimde kayıt varsa üzerine yazar.
     * @param {string} name — Kayıt adı
     * @param {object} data — appData nesnesi
     */
    function saveAs(name, data) {
        const saves = getSaves();
        const existing = saves.findIndex(s => s.name === name);
        const entry = {
            name,
            date: new Date().toISOString(),
            data: JSON.parse(JSON.stringify(data)) // derin kopya
        };
        if (existing >= 0) {
            saves[existing] = entry;
        } else {
            saves.push(entry);
        }
        _writeSaves(saves);
    }

    /**
     * Belirtilen indeksteki kayıtlı veriyi yükler.
     * @param {number} index — Kayıt indeksi
     * @returns {object|null} — appData nesnesi veya null
     */
    function loadSave(index) {
        const saves = getSaves();
        if (index >= 0 && index < saves.length) {
            return JSON.parse(JSON.stringify(saves[index].data));
        }
        return null;
    }

    /**
     * Belirtilen indeksteki kaydı siler.
     * @param {number} index — Silinecek kayıt indeksi
     */
    function deleteSave(index) {
        const saves = getSaves();
        if (index >= 0 && index < saves.length) {
            saves.splice(index, 1);
            _writeSaves(saves);
        }
    }

    // ────────────────────────────────────────────
    // JSON içe/dışa aktarma
    // ────────────────────────────────────────────

    /**
     * Mevcut veriyi JSON dosyası olarak tarayıcıdan indirir.
     * @param {object} data     — appData nesnesi
     * @param {string} [filename] — İsteğe bağlı dosya adı
     */
    function exportJSON(data, filename) {
        const fname = filename || 'mcdm_veri_' + new Date().toISOString().slice(0, 10) + '.json';
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * JSON dosyasından veri içe aktarır.
     * Temel doğrulama yaparak experts, criteria ve alternatives alanlarını kontrol eder.
     * @param {File} file — Seçilen .json dosyası
     * @returns {Promise<object>} — appData nesnesi
     */
    function importJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!data.experts || !data.criteria || !data.alternatives) {
                        reject(new Error('Geçersiz dosya formatı: experts, criteria veya alternatives alanları eksik.'));
                        return;
                    }
                    resolve(data);
                } catch (err) {
                    reject(new Error('JSON dosyası okunamadı: ' + err.message));
                }
            };
            reader.onerror = () => reject(new Error('Dosya okuma hatası.'));
            reader.readAsText(file);
        });
    }

    // ────────────────────────────────────────────
    // Yardımcı fonksiyonlar
    // ────────────────────────────────────────────

    /**
     * ISO tarih dizesini Türkçe formata çevirir (GG.AA.YYYY SS:DD).
     * @param {string} isoString — ISO 8601 tarih dizesi
     * @returns {string}         — Formatlanmış tarih metni
     */
    function formatDate(isoString) {
        const d = new Date(isoString);
        const gun = d.getDate().toString().padStart(2, '0');
        const ay = (d.getMonth() + 1).toString().padStart(2, '0');
        const yil = d.getFullYear();
        const saat = d.getHours().toString().padStart(2, '0');
        const dakika = d.getMinutes().toString().padStart(2, '0');
        return `${gun}.${ay}.${yil} ${saat}:${dakika}`;
    }

    // ────────────────────────────────────────────
    // Excel ile tüm giriş verilerini dışa/içe aktarma
    // ────────────────────────────────────────────

    /**
     * Tüm uygulama giriş verilerini Excel dosyası olarak dışa aktarır.
     *
     * Sayfa yapısı:
     *   1) Tanımlar        — Uzman isimleri, kriterler (ad + tip), alternatifler
     *   2) FUCOM-Uzman1..N — Her uzmanın kriter sıralaması ve φ değerleri
     *   3) MARCOS-Uzman1..N — Her uzmanın karar matrisi (alternatif × kriter)
     *
     * @param {object} data — appData nesnesi
     */
    function exportExcel(data) {
        if (typeof XLSX === 'undefined') {
            throw new Error('SheetJS (XLSX) kütüphanesi yüklenemedi.');
        }

        const wb = XLSX.utils.book_new();
        const criteriaNames = data.criteria.map(c => c.name);
        const altNames = data.alternatives;
        const numCrit = criteriaNames.length;

        // ── Sayfa 1: Tanımlar ──
        const setupData = [
            ['MCDM Tez Veri – Tüm Veriler'],
            [],
            ['UZMAN İSİMLERİ'],
            ['No', 'İsim']
        ];
        data.experts.forEach((name, i) => {
            setupData.push([i + 1, name]);
        });
        setupData.push([]);
        setupData.push(['KRİTERLER']);
        setupData.push(['No', 'Kriter Adı', 'Tip (benefit/cost)']);
        data.criteria.forEach((c, i) => {
            setupData.push([i + 1, c.name, c.type]);
        });
        setupData.push([]);
        setupData.push(['ALTERNATİFLER']);
        setupData.push(['No', 'Alternatif Adı']);
        data.alternatives.forEach((name, i) => {
            setupData.push([i + 1, name]);
        });

        const wsSetup = XLSX.utils.aoa_to_sheet(setupData);
        wsSetup['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, wsSetup, 'Tanımlar');

        // ── Sayfalar 2..N+1: Her uzman için FUCOM verileri ──
        data.experts.forEach((expertName, eIdx) => {
            const fucom = data.fucom[eIdx];
            const wsData = [
                [`FUCOM Verileri – ${expertName}`],
                [],
                ['KRİTER ÖNEM SIRALAMASI'],
                ['Kriter', 'Sıralama Değeri']
            ];
            for (let c = 0; c < numCrit; c++) {
                wsData.push([criteriaNames[c], fucom.ranking[c]]);
            }
            wsData.push([]);
            wsData.push(['ARDIŞIK KARŞILAŞTIRMA DEĞERLERİ (φ)']);
            wsData.push(['Karşılaştırma', 'Değer']);
            for (let c = 0; c < numCrit - 1; c++) {
                wsData.push([`φ(${c + 1}/${c + 2})`, fucom.comparisons[c]]);
            }

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            ws['!cols'] = [{ wch: 22 }, { wch: 18 }];
            const sheetName = ('FUCOM-' + expertName).substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        // ── Sayfalar N+2..2N+1: Her uzman için MARCOS karar matrisi ──
        data.experts.forEach((expertName, eIdx) => {
            const matrix = data.marcos[eIdx];
            const header = ['Alternatif / Kriter', ...criteriaNames];
            const wsData = [header];

            altNames.forEach((altName, aIdx) => {
                const row = [altName, ...matrix[aIdx].map(v => Number(v))];
                wsData.push(row);
            });

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            ws['!cols'] = [{ wch: 20 }, ...criteriaNames.map(() => ({ wch: 14 }))];
            const sheetName = ('MARCOS-' + expertName).substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        const fname = 'mcdm_tum_veri_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        XLSX.writeFile(wb, fname);
    }

    /**
     * Excel dosyasından tüm uygulama verilerini içe aktarır.
     *
     * Beklenen sayfa sırası:
     *   Tanımlar → FUCOM-Uzman1..N → MARCOS-Uzman1..N
     *
     * @param {File} file — Seçilen .xlsx dosyası
     * @returns {Promise<object>} — Tam appData nesnesi { experts, criteria, alternatives, fucom, marcos }
     */
    function importExcel(file) {
        return new Promise((resolve, reject) => {
            if (typeof XLSX === 'undefined') {
                reject(new Error('SheetJS (XLSX) kütüphanesi yüklenemedi.'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const rawData = new Uint8Array(e.target.result);
                    const wb = XLSX.read(rawData, { type: 'array' });

                    if (wb.SheetNames.length < 3) {
                        reject(new Error('Excel dosyası geçersiz: En az 3 sayfa (Tanımlar, FUCOM, MARCOS) bekleniyor.'));
                        return;
                    }

                    // ── 1) Tanımlar sayfasını oku ──
                    const wsSetup = wb.Sheets[wb.SheetNames[0]];
                    const setupRows = XLSX.utils.sheet_to_json(wsSetup, { header: 1 });

                    const experts = [];
                    const criteria = [];
                    const alternatives = [];
                    let section = '';

                    for (let r = 0; r < setupRows.length; r++) {
                        const row = setupRows[r];
                        const cell0 = String(row[0] || '').trim();

                        if (cell0 === 'UZMAN İSİMLERİ') { section = 'experts'; continue; }
                        if (cell0 === 'KRİTERLER') { section = 'criteria'; continue; }
                        if (cell0 === 'ALTERNATİFLER') { section = 'alternatives'; continue; }
                        if (cell0 === 'No') continue;
                        if (!cell0 || cell0 === 'MCDM Tez Veri – Tüm Veriler') continue;

                        if (section === 'experts' && row[1]) {
                            experts.push(String(row[1]));
                        } else if (section === 'criteria' && row[1]) {
                            criteria.push({
                                name: String(row[1]),
                                type: (String(row[2] || 'benefit')).toLowerCase() === 'cost' ? 'cost' : 'benefit'
                            });
                        } else if (section === 'alternatives' && row[1]) {
                            alternatives.push(String(row[1]));
                        }
                    }

                    if (experts.length === 0 || criteria.length === 0 || alternatives.length === 0) {
                        reject(new Error('Tanımlar sayfasında uzman, kriter veya alternatif bilgisi bulunamadı.'));
                        return;
                    }

                    const numExperts = experts.length;
                    const numCrit = criteria.length;
                    const numAlt = alternatives.length;

                    const expectedSheets = 1 + numExperts + numExperts;
                    if (wb.SheetNames.length < expectedSheets) {
                        reject(new Error(`Excel dosyasında ${expectedSheets} sayfa bekleniyor, ${wb.SheetNames.length} sayfa bulundu.`));
                        return;
                    }

                    // ── 2) FUCOM sayfalarını oku ──
                    const fucom = [];
                    for (let eIdx = 0; eIdx < numExperts; eIdx++) {
                        const wsF = wb.Sheets[wb.SheetNames[1 + eIdx]];
                        const fRows = XLSX.utils.sheet_to_json(wsF, { header: 1 });

                        const ranking = [];
                        const comparisons = [];
                        let fSection = '';

                        for (let r = 0; r < fRows.length; r++) {
                            const row = fRows[r];
                            const cell0 = String(row[0] || '').trim();

                            if (cell0 === 'KRİTER ÖNEM SIRALAMASI') { fSection = 'ranking'; continue; }
                            if (cell0 === 'ARDIŞIK KARŞILAŞTIRMA DEĞERLERİ (φ)') { fSection = 'comparisons'; continue; }
                            if (cell0 === 'Kriter' || cell0 === 'Karşılaştırma' || !cell0) continue;
                            if (cell0.startsWith('FUCOM Verileri')) continue;

                            if (fSection === 'ranking' && row[1] !== undefined) {
                                ranking.push(parseInt(row[1]) || 1);
                            } else if (fSection === 'comparisons' && row[1] !== undefined) {
                                comparisons.push(parseFloat(row[1]) || 1);
                            }
                        }

                        fucom.push({
                            ranking: ranking.length === numCrit ? ranking : Array.from({ length: numCrit }, (_, i) => i + 1),
                            comparisons: comparisons.length === numCrit - 1 ? comparisons : Array(numCrit - 1).fill(1)
                        });
                    }

                    // ── 3) MARCOS sayfalarını oku ──
                    const marcos = [];
                    for (let eIdx = 0; eIdx < numExperts; eIdx++) {
                        const wsM = wb.Sheets[wb.SheetNames[1 + numExperts + eIdx]];
                        const mRows = XLSX.utils.sheet_to_json(wsM, { header: 1 });

                        const matrix = [];
                        for (let aIdx = 0; aIdx < numAlt; aIdx++) {
                            const row = [];
                            const sheetRow = mRows[aIdx + 1];
                            if (!sheetRow) {
                                reject(new Error(`MARCOS sayfası ${eIdx + 1} - Satır ${aIdx + 2} bulunamadı.`));
                                return;
                            }
                            for (let cIdx = 0; cIdx < numCrit; cIdx++) {
                                const val = parseFloat(sheetRow[cIdx + 1]);
                                row.push(isNaN(val) ? 1 : val);
                            }
                            matrix.push(row);
                        }
                        marcos.push(matrix);
                    }

                    resolve({ experts, criteria, alternatives, fucom, marcos });
                } catch (err) {
                    reject(new Error('Excel dosyası okunamadı: ' + err.message));
                }
            };
            reader.onerror = () => reject(new Error('Dosya okuma hatası.'));
            reader.readAsArrayBuffer(file);
        });
    }

    // ────────────────────────────────────────────
    // Hesaplama sonuçlarını Excel'e aktarma
    // ────────────────────────────────────────────

    /**
     * FUCOM ve MARCOS hesaplama sonuçlarını tez raporu için Excel dosyasına aktarır.
     *
     * Sayfa yapısı:
     *   1) FUCOM Ağırlıkları      — Her uzmanın kriter ağırlıkları + DFC + birleştirilmiş ağırlıklar
     *   2) Birleştirilmiş Matris   — Uzman matrislerinin aritmetik ortalaması
     *   3) Normalize Matris        — Normalize edilmiş karar matrisi
     *   4) Ağırlıklı Matris        — Ağırlıklı normalize matris
     *   5) MARCOS Sonuçları        — S_i, K_i⁺, K_i⁻, f(K_i⁺), f(K_i⁻), f(K_i), Sıra
     *
     * @param {object} appData      — Uygulama verileri
     * @param {object} fucomResult  — FucomCalculator.calculate() çıktısı
     * @param {object} marcosResult — MarcosCalculator.calculate() çıktısı
     * @param {number[][]} combinedMatrix — Birleştirilmiş karar matrisi
     */
    function exportResultsExcel(appData, fucomResult, marcosResult, combinedMatrix) {
        if (typeof XLSX === 'undefined') {
            throw new Error('SheetJS (XLSX) kütüphanesi yüklenemedi.');
        }

        const wb = XLSX.utils.book_new();
        const criteriaNames = appData.criteria.map(c => c.name);
        const altNames = appData.alternatives;

        // ── Sayfa 1: FUCOM Kriter Ağırlıkları ──
        const fucomData = [
            ['FUCOM — Kriter Ağırlıkları'],
            [],
            ['Her Uzmanın Kriter Ağırlıkları'],
            ['Uzman', ...criteriaNames, 'DFC']
        ];
        fucomResult.expertWeights.forEach((weights, eIdx) => {
            const dfc = fucomResult.dfcValues ? fucomResult.dfcValues[eIdx] : '-';
            fucomData.push([
                appData.experts[eIdx],
                ...weights.map(w => +w.toFixed(4)),
                typeof dfc === 'number' ? +dfc.toFixed(4) : dfc
            ]);
        });
        fucomData.push([]);
        fucomData.push(['Birleştirilmiş (Ortalama) Ağırlıklar']);
        fucomData.push(['Kriter', 'Ağırlık (w_j)', 'Yüzde (%)']);
        fucomResult.finalWeights.forEach((w, i) => {
            fucomData.push([criteriaNames[i], +w.toFixed(4), +(w * 100).toFixed(2)]);
        });

        const wsFucom = XLSX.utils.aoa_to_sheet(fucomData);
        wsFucom['!cols'] = [{ wch: 18 }, ...criteriaNames.map(() => ({ wch: 12 })), { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsFucom, 'FUCOM Ağırlıkları');

        // ── Sayfa 2: Birleştirilmiş Karar Matrisi ──
        const combinedData = [
            ['Birleştirilmiş Karar Matrisi (Aritmetik Ortalama)'],
            [],
            ['Alternatif', ...criteriaNames]
        ];
        combinedMatrix.forEach((row, i) => {
            combinedData.push([altNames[i], ...row.map(v => +v.toFixed(2))]);
        });

        const wsCombined = XLSX.utils.aoa_to_sheet(combinedData);
        wsCombined['!cols'] = [{ wch: 20 }, ...criteriaNames.map(() => ({ wch: 12 }))];
        XLSX.utils.book_append_sheet(wb, wsCombined, 'Birleştirilmiş Matris');

        // ── Sayfa 3: Normalize Edilmiş Matris ──
        const normData = [
            ['Normalize Edilmiş Matris'],
            [],
            ['Alternatif', ...criteriaNames]
        ];
        marcosResult.normalizedMatrix.forEach((row, i) => {
            normData.push([altNames[i], ...row.map(v => +v.toFixed(4))]);
        });

        const wsNorm = XLSX.utils.aoa_to_sheet(normData);
        wsNorm['!cols'] = [{ wch: 20 }, ...criteriaNames.map(() => ({ wch: 12 }))];
        XLSX.utils.book_append_sheet(wb, wsNorm, 'Normalize Matris');

        // ── Sayfa 4: Ağırlıklı Normalize Matris ──
        const wgtData = [
            ['Ağırlıklı Normalize Matris (v_ij = n_ij × w_j)'],
            [],
            ['Alternatif', ...criteriaNames]
        ];
        marcosResult.weightedMatrix.forEach((row, i) => {
            wgtData.push([altNames[i], ...row.map(v => +v.toFixed(4))]);
        });

        const wsWgt = XLSX.utils.aoa_to_sheet(wgtData);
        wsWgt['!cols'] = [{ wch: 20 }, ...criteriaNames.map(() => ({ wch: 12 }))];
        XLSX.utils.book_append_sheet(wb, wsWgt, 'Ağırlıklı Matris');

        // ── Sayfa 5: MARCOS Nihai Sonuçları ──
        const resultData = [
            ['MARCOS — Alternatif Sıralaması'],
            [],
            ['S(AAI)', +marcosResult.sAAI.toFixed(4), '', 'S(AI)', +marcosResult.sAI.toFixed(4)],
            [],
            ['Alternatif', 'S_i', 'K_i⁺', 'K_i⁻', 'f(K_i⁺)', 'f(K_i⁻)', 'f(K_i)', 'Sıra']
        ];
        for (let i = 0; i < altNames.length; i++) {
            resultData.push([
                altNames[i],
                +marcosResult.sValues[i].toFixed(4),
                +marcosResult.kPlus[i].toFixed(4),
                +marcosResult.kMinus[i].toFixed(4),
                +marcosResult.fKPlus[i].toFixed(4),
                +marcosResult.fKMinus[i].toFixed(4),
                +marcosResult.fK[i].toFixed(4),
                marcosResult.ranks[i]
            ]);
        }

        const wsResult = XLSX.utils.aoa_to_sheet(resultData);
        wsResult['!cols'] = [
            { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
            { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }
        ];
        XLSX.utils.book_append_sheet(wb, wsResult, 'MARCOS Sonuçları');

        const fname = 'mcdm_sonuclar_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        XLSX.writeFile(wb, fname);
    }

    return {
        escapeHtml,
        getSaves, saveAs, loadSave, deleteSave,
        exportJSON, importJSON,
        exportExcel, importExcel,
        exportResultsExcel,
        formatDate
    };
})();
