// ============================================
// Uygulama Kontrolcüsü — Ana uygulama mantığı
// ============================================
// Tüm sekme yönetimi, form render işlemleri, hesaplama tetikleme
// ve olay bağlama işlemlerini yürütür.
// XSS koruması için tüm kullanıcı girdileri DataManager.escapeHtml()
// ile kaçış uygulanarak DOM'a yazılır.

(function () {
    'use strict';

    let appData = {};

    // Son hesaplama sonuçlarını sakla (sonuç Excel dışa aktarma için)
    let lastFucomResult = null;
    let lastMarcosResult = null;
    let lastCombinedMatrix = null;

    // Kısa erişim: HTML kaçış fonksiyonu
    const esc = (str) => DataManager.escapeHtml(str);

    // ── Başlatma ──
    function init() {
        appData = StorageModule.load();
        appData = StorageModule.initFucom(appData);
        appData = StorageModule.initMarcos(appData);

        renderSetupTab();
        renderFucomTab();
        renderMarcosTab();
        bindEvents();

        // İlk girişte gizlilik bildirimini kontrol et
        checkPrivacyAcknowledgment();
    }

    /** Her sayfa yüklendiğinde gizlilik bildirimini gösterir */
    function checkPrivacyAcknowledgment() {
        const privacyModal = document.getElementById('privacyModal');
        if (privacyModal) privacyModal.classList.add('open');
    }

    // ── Bildirim (Toast) ──
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast ' + type + ' show';
        setTimeout(() => { toast.classList.remove('show'); }, 2500);
    }

    // ── Sekme Geçişi ──
    function switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        document.getElementById('tab-' + tabId).classList.add('active');
    }

    // ════════════════════════════════════════════
    // 1. SEKME: Tanımlar
    // ════════════════════════════════════════════

    /** Tanımlar sekmesini render eder (uzmanlar, kriterler, alternatifler). */
    function renderSetupTab() {
        const numExperts = appData.experts.length;
        const numCriteria = appData.criteria.length;
        const numAlternatives = appData.alternatives.length;

        // Uzman isimleri
        const expertContainer = document.getElementById('expertNames');
        expertContainer.innerHTML = appData.experts.map((name, i) => `
            <div class="form-group">
                <label>Uzman ${i + 1}</label>
                <input type="text" id="expert-${i}" value="${esc(name)}" placeholder="Uzman adı">
            </div>
        `).join('');

        // Kriterler (isim + fayda/maliyet tipi)
        const criteriaContainer = document.getElementById('criteriaList');
        criteriaContainer.innerHTML = appData.criteria.map((c, i) => `
            <div class="criteria-row">
                <div class="criteria-num">K${i + 1}</div>
                <input type="text" id="criteria-name-${i}" value="${esc(c.name)}" placeholder="Kriter adı">
                <select id="criteria-type-${i}">
                    <option value="benefit" ${c.type === 'benefit' ? 'selected' : ''}>Fayda (↑)</option>
                    <option value="cost" ${c.type === 'cost' ? 'selected' : ''}>Maliyet (↓)</option>
                </select>
            </div>
        `).join('');

        // Alternatifler
        const altContainer = document.getElementById('alternativeNames');
        altContainer.innerHTML = appData.alternatives.map((name, i) => `
            <div class="form-group">
                <label>Alternatif ${i + 1}</label>
                <input type="text" id="alt-${i}" value="${esc(name)}" placeholder="Alternatif adı">
            </div>
        `).join('');
    }

    /** Tanımlar sekmesindeki form verilerini kaydeder ve sonraki sekmeye geçer. */
    function saveSetup() {
        const numExperts = appData.experts.length;
        const numCriteria = appData.criteria.length;
        const numAlternatives = appData.alternatives.length;

        for (let i = 0; i < numExperts; i++) {
            appData.experts[i] = document.getElementById(`expert-${i}`).value || `Uzman ${i + 1}`;
        }
        for (let i = 0; i < numCriteria; i++) {
            appData.criteria[i].name = document.getElementById(`criteria-name-${i}`).value || `Kriter ${i + 1}`;
            appData.criteria[i].type = document.getElementById(`criteria-type-${i}`).value;
        }
        for (let i = 0; i < numAlternatives; i++) {
            appData.alternatives[i] = document.getElementById(`alt-${i}`).value || `Alternatif ${i + 1}`;
        }
        StorageModule.save(appData);
        renderFucomTab();
        renderMarcosTab();
        showToast('Tanımlar kaydedildi ✓');
        switchTab('fucom');
    }

    // ════════════════════════════════════════════
    // 2. SEKME: FUCOM Girişi
    // ════════════════════════════════════════════

    /** FUCOM sekmesini render eder — her uzman için sıralama ve φ giriş alanları. */
    function renderFucomTab() {
        const numCriteria = appData.criteria.length;
        const tabsContainer = document.getElementById('fucomExpertTabs');
        const panelsContainer = document.getElementById('fucomExpertPanels');

        // Uzman sekme butonları
        tabsContainer.innerHTML = appData.experts.map((name, i) => `
            <button class="expert-tab-btn ${i === 0 ? 'active' : ''}" data-expert-fucom="${i}">${esc(name)}</button>
        `).join('');

        // Her uzman için giriş paneli
        panelsContainer.innerHTML = appData.experts.map((name, i) => {
            const fucom = appData.fucom[i];
            const criteriaNames = appData.criteria.map(c => c.name);

            // Kriter önem sıralaması giriş alanları
            let rankingHTML = '<div class="fucom-section"><h4>Kriter Önem Sıralaması (1 = En Önemli)</h4><div class="ranking-grid">';
            for (let c = 0; c < numCriteria; c++) {
                rankingHTML += `
                    <div class="ranking-item">
                        <label>${esc(criteriaNames[c])}</label>
                        <input type="number" min="1" max="${numCriteria}" step="1"
                               class="fucom-rank" data-expert="${i}" data-criterion="${c}"
                               value="${fucom.ranking[c]}">
                    </div>
                `;
            }
            rankingHTML += '</div></div>';

            // Ardışık karşılaştırma (φ) giriş alanları
            let compHTML = '<div class="fucom-section"><h4>Ardışık Kriter Karşılaştırma Değerleri (φ)</h4>';
            compHTML += '<p class="card-desc">Sıralama sonucunda ardışık kriterler arasındaki önem oranını girin (≥1). Eşit önem = 1.</p>';
            compHTML += '<div class="comparison-grid">';
            for (let c = 0; c < numCriteria - 1; c++) {
                compHTML += `
                    <div class="comparison-item">
                        <span>φ(${c + 1}/${c + 2})</span>
                        <input type="number" min="1" max="9" step="0.1"
                               class="fucom-comp" data-expert="${i}" data-pair="${c}"
                               value="${fucom.comparisons[c]}">
                    </div>
                `;
            }
            compHTML += '</div></div>';

            return `<div class="expert-panel card ${i === 0 ? 'active' : ''}" data-expert-panel-fucom="${i}">
                <h3>${esc(name)} – FUCOM Girişi</h3>
                ${rankingHTML}${compHTML}
            </div>`;
        }).join('');

        // Uzman alt-sekme geçişi
        tabsContainer.querySelectorAll('.expert-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                tabsContainer.querySelectorAll('.expert-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const idx = btn.dataset.expertFucom;
                panelsContainer.querySelectorAll('.expert-panel').forEach(p => p.classList.remove('active'));
                panelsContainer.querySelector(`[data-expert-panel-fucom="${idx}"]`).classList.add('active');
            });
        });
    }

    /**
     * FUCOM sıralama girdilerini doğrular.
     * Her uzmanın sıralamasında tekrarlayan değer olup olmadığını kontrol eder.
     * @returns {boolean} — Doğrulama başarılıysa true
     */
    function validateFucomRankings() {
        const numCriteria = appData.criteria.length;

        for (let eIdx = 0; eIdx < appData.experts.length; eIdx++) {
            const rankings = appData.fucom[eIdx].ranking;
            const unique = new Set(rankings);

            // Aynı sıra numarasının birden fazla kullanılıp kullanılmadığını kontrol et
            if (unique.size !== rankings.length) {
                showToast(`${appData.experts[eIdx]}: Aynı sıra numarası birden fazla kullanılmış!`, 'error');
                return false;
            }

            // Sıra numaralarının geçerli aralıkta olup olmadığını kontrol et (1..n)
            for (const rank of rankings) {
                if (rank < 1 || rank > numCriteria) {
                    showToast(`${appData.experts[eIdx]}: Sıra numarası 1 ile ${numCriteria} arasında olmalıdır!`, 'error');
                    return false;
                }
            }
        }
        return true;
    }

    /** FUCOM verilerini form alanlarından okur, doğrular ve kaydeder. */
    function saveFucom() {
        // Tüm giriş alanlarından verileri oku
        document.querySelectorAll('.fucom-rank').forEach(input => {
            const e = parseInt(input.dataset.expert);
            const c = parseInt(input.dataset.criterion);
            appData.fucom[e].ranking[c] = parseInt(input.value) || 1;
        });
        document.querySelectorAll('.fucom-comp').forEach(input => {
            const e = parseInt(input.dataset.expert);
            const p = parseInt(input.dataset.pair);
            appData.fucom[e].comparisons[p] = parseFloat(input.value) || 1;
        });

        // Sıralama doğrulaması
        if (!validateFucomRankings()) return;

        StorageModule.save(appData);
        showToast('FUCOM verileri kaydedildi ✓');
        switchTab('marcos');
    }

    // ════════════════════════════════════════════
    // 3. SEKME: MARCOS Girişi
    // ════════════════════════════════════════════

    /** MARCOS sekmesini render eder — her uzman için karar matrisi tablosu. */
    function renderMarcosTab() {
        const numCriteria = appData.criteria.length;
        const tabsContainer = document.getElementById('marcosExpertTabs');
        const panelsContainer = document.getElementById('marcosExpertPanels');

        // Uzman sekme butonları
        tabsContainer.innerHTML = appData.experts.map((name, i) => `
            <button class="expert-tab-btn ${i === 0 ? 'active' : ''}" data-expert-marcos="${i}">${esc(name)}</button>
        `).join('');

        // Her uzman için karar matrisi giriş tablosu
        panelsContainer.innerHTML = appData.experts.map((name, eIdx) => {
            const matrix = appData.marcos[eIdx];
            const criteriaNames = appData.criteria.map(c => c.name);
            const altNames = appData.alternatives;

            let tableHTML = '<div class="marcos-table-wrapper"><table class="marcos-input-table"><thead><tr><th></th>';
            criteriaNames.forEach(cn => {
                tableHTML += `<th>${esc(cn)}</th>`;
            });
            tableHTML += '</tr></thead><tbody>';

            altNames.forEach((an, aIdx) => {
                tableHTML += `<tr><td>${esc(an)}</td>`;
                criteriaNames.forEach((_, cIdx) => {
                    tableHTML += `<td><input type="number" min="1" step="1"
                        class="marcos-val" data-expert="${eIdx}" data-alt="${aIdx}" data-crit="${cIdx}"
                        value="${matrix[aIdx][cIdx]}"></td>`;
                });
                tableHTML += '</tr>';
            });
            tableHTML += '</tbody></table></div>';

            return `<div class="expert-panel card ${eIdx === 0 ? 'active' : ''}" data-expert-panel-marcos="${eIdx}">
                <h3>${esc(name)} – Karar Matrisi</h3>
                <p class="card-desc">Her alternatifin her kritere göre değerlendirmesini sayısal olarak girin.</p>
                ${tableHTML}
            </div>`;
        }).join('');

        // Uzman alt-sekme geçişi
        tabsContainer.querySelectorAll('.expert-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                tabsContainer.querySelectorAll('.expert-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const idx = btn.dataset.expertMarcos;
                panelsContainer.querySelectorAll('.expert-panel').forEach(p => p.classList.remove('active'));
                panelsContainer.querySelector(`[data-expert-panel-marcos="${idx}"]`).classList.add('active');
            });
        });
    }

    /** MARCOS karar matrisi değerlerini form alanlarından okur ve kaydeder. */
    function saveMarcos() {
        document.querySelectorAll('.marcos-val').forEach(input => {
            const e = parseInt(input.dataset.expert);
            const a = parseInt(input.dataset.alt);
            const c = parseInt(input.dataset.crit);
            appData.marcos[e][a][c] = parseFloat(input.value) || 1;
        });
        StorageModule.save(appData);
    }

    // ════════════════════════════════════════════
    // 4. HESAPLAMA ve SONUÇLAR
    // ════════════════════════════════════════════

    /** Tüm hesaplamaları (FUCOM + MARCOS) yürütür ve sonuç sekmesini doldurur. */
    function runCalculations() {
        saveMarcos();

        const criteriaNames = appData.criteria.map(c => c.name);
        const altNames = appData.alternatives;
        const criteriaTypes = appData.criteria.map(c => c.type);

        // FUCOM hesabı — kriter ağırlıkları + DFC tutarlılık değerleri
        const fucomResult = FucomCalculator.calculate(appData.fucom);
        lastFucomResult = fucomResult;

        // MARCOS hesabı — uzman matrislerini birleştir ve sırala
        const combinedMatrix = MarcosCalculator.combineMatrices(appData.marcos);
        lastCombinedMatrix = combinedMatrix;
        const marcosResult = MarcosCalculator.calculate(combinedMatrix, fucomResult.finalWeights, criteriaTypes);
        lastMarcosResult = marcosResult;

        // Sonuç tablolarını render et
        renderFucomWeightsTable(fucomResult, criteriaNames);
        renderFucomFinalWeightsTable(fucomResult.finalWeights, criteriaNames);
        renderDFCTable(fucomResult);
        renderMarcosDecisionMatrix(combinedMatrix, criteriaNames, altNames);
        renderMarcosNormalizedMatrix(marcosResult.normalizedMatrix, criteriaNames, altNames);
        renderMarcosWeightedMatrix(marcosResult.weightedMatrix, criteriaNames, altNames);
        renderMarcosResultTable(marcosResult, altNames);

        // Grafikleri oluştur
        Visualization.renderFucomChart(criteriaNames, fucomResult.finalWeights, fucomResult.expertWeights);
        Visualization.renderMarcosChart(altNames, marcosResult.fK, marcosResult.ranks);

        // Adım Adım Rapor Sayfasını (Tab 6) Render et
        renderCalculationSteps(fucomResult, marcosResult, combinedMatrix, altNames, criteriaNames, criteriaTypes);

        // Sonuç Excel butonunu etkinleştir
        const btnExportResults = document.getElementById('btnExportResults');
        if (btnExportResults) btnExportResults.disabled = false;

        showToast('Hesaplama tamamlandı ✓');
        switchTab('results');
    }

    // ════════════════════════════════════════════
    // SONUÇ TABLOLARI
    // ════════════════════════════════════════════

    /** Her uzmanın FUCOM kriter ağırlıklarını tablo olarak gösterir. */
    function renderFucomWeightsTable(result, criteriaNames) {
        let html = '<table class="result-table"><thead><tr><th>Uzman</th>';
        criteriaNames.forEach(cn => { html += `<th>${esc(cn)}</th>`; });
        html += '</tr></thead><tbody>';
        result.expertWeights.forEach((weights, eIdx) => {
            html += `<tr><td>${esc(appData.experts[eIdx])}</td>`;
            weights.forEach(w => { html += `<td>${w.toFixed(4)}</td>`; });
            html += '</tr>';
        });
        html += '</tbody></table>';
        document.getElementById('fucomWeightsTable').innerHTML = html;
    }

    /** Birleştirilmiş FUCOM ağırlıklarını tablo olarak gösterir. */
    function renderFucomFinalWeightsTable(weights, criteriaNames) {
        let html = '<table class="result-table"><thead><tr><th>Kriter</th><th>Ağırlık</th><th>Yüzde (%)</th></tr></thead><tbody>';
        weights.forEach((w, i) => {
            html += `<tr><td>${esc(criteriaNames[i])}</td><td>${w.toFixed(4)}</td><td>%${(w * 100).toFixed(2)}</td></tr>`;
        });
        html += '</tbody></table>';
        document.getElementById('fucomFinalWeightsTable').innerHTML = html;
    }

    /**
     * Her uzmanın DFC (Tam Tutarlılıktan Sapma) değerini tablo olarak gösterir.
     * DFC < 0.01 → kabul edilebilir (yeşil), aksi halde uyarı (kırmızı).
     */
    function renderDFCTable(fucomResult) {
        const container = document.getElementById('dfcTable');
        if (!container) return;

        let html = '<table class="result-table"><thead><tr><th>Uzman</th><th>DFC Değeri</th><th>Durum</th></tr></thead><tbody>';
        fucomResult.dfcValues.forEach((dfc, eIdx) => {
            const status = dfc < 0.01 ? '✓ Tutarlı' : '⚠ Yüksek sapma';
            const statusClass = dfc < 0.01 ? 'rank-1' : 'rank-error';
            html += `<tr>
                <td>${esc(appData.experts[eIdx])}</td>
                <td>${dfc.toFixed(4)}</td>
                <td class="${statusClass}">${status}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    /** Birleştirilmiş karar matrisini tablo olarak gösterir. */
    function renderMarcosDecisionMatrix(matrix, criteriaNames, altNames) {
        let html = '<table class="result-table"><thead><tr><th>Alternatif</th>';
        criteriaNames.forEach(cn => { html += `<th>${esc(cn)}</th>`; });
        html += '</tr></thead><tbody>';
        matrix.forEach((row, i) => {
            html += `<tr><td>${esc(altNames[i])}</td>`;
            row.forEach(val => { html += `<td>${val.toFixed(2)}</td>`; });
            html += '</tr>';
        });
        html += '</tbody></table>';
        document.getElementById('marcosDecisionMatrix').innerHTML = html;
    }

    /** Normalize edilmiş matrisi tablo olarak gösterir. */
    function renderMarcosNormalizedMatrix(matrix, criteriaNames, altNames) {
        let html = '<table class="result-table"><thead><tr><th>Alternatif</th>';
        criteriaNames.forEach(cn => { html += `<th>${esc(cn)}</th>`; });
        html += '</tr></thead><tbody>';
        matrix.forEach((row, i) => {
            html += `<tr><td>${esc(altNames[i])}</td>`;
            row.forEach(val => { html += `<td>${val.toFixed(4)}</td>`; });
            html += '</tr>';
        });
        html += '</tbody></table>';
        document.getElementById('marcosNormalizedMatrix').innerHTML = html;
    }

    /** Ağırlıklı normalize matrisi tablo olarak gösterir. */
    function renderMarcosWeightedMatrix(matrix, criteriaNames, altNames) {
        let html = '<table class="result-table"><thead><tr><th>Alternatif</th>';
        criteriaNames.forEach(cn => { html += `<th>${esc(cn)}</th>`; });
        html += '</tr></thead><tbody>';
        matrix.forEach((row, i) => {
            html += `<tr><td>${esc(altNames[i])}</td>`;
            row.forEach(val => { html += `<td>${val.toFixed(4)}</td>`; });
            html += '</tr>';
        });
        html += '</tbody></table>';
        document.getElementById('marcosWeightedMatrix').innerHTML = html;
    }

    /** MARCOS nihai sonuç tablosunu gösterir (S_i, K_i⁺, K_i⁻, f(K_i), sıralama). */
    function renderMarcosResultTable(result, altNames) {
        let html = '<table class="result-table"><thead><tr>';
        html += '<th>Alternatif</th><th>Si</th><th>Ki+</th><th>Ki−</th><th>f(Ki+)</th><th>f(Ki−)</th><th>f(Ki)</th><th>Sıra</th>';
        html += '</tr></thead><tbody>';

        for (let i = 0; i < altNames.length; i++) {
            const rankClass = result.ranks[i] <= 3 ? `rank-${result.ranks[i]}` : '';
            html += `<tr>`;
            html += `<td>${esc(altNames[i])}</td>`;
            html += `<td>${result.sValues[i].toFixed(4)}</td>`;
            html += `<td>${result.kPlus[i].toFixed(4)}</td>`;
            html += `<td>${result.kMinus[i].toFixed(4)}</td>`;
            html += `<td>${result.fKPlus[i].toFixed(4)}</td>`;
            html += `<td>${result.fKMinus[i].toFixed(4)}</td>`;
            html += `<td class="${rankClass}">${result.fK[i].toFixed(4)}</td>`;
            html += `<td class="${rankClass}">${result.ranks[i]}</td>`;
            html += `</tr>`;
        }
        html += '</tbody></table>';
        document.getElementById('marcosResultTable').innerHTML = html;
    }

    /**
     * Adım Adım Hesaplama Raporunu (Tab 6) oluşturur.
     * Tüm FUCOM ve MARCOS hesaplamalarını detaylı şekilde gösterir.
     */
    function renderCalculationSteps(fucomResult, marcosResult, combinedMatrix, altNames, criteriaNames, criteriaTypes) {
        const container = document.getElementById('stepsContainer');
        if (!container) return;

        const n = criteriaNames.length;
        const numAlt = altNames.length;
        let html = '';

        // --- Hızlı Erişim (İçindekiler) ---
        html += `
            <div class="toc-card">
                <div class="toc-header">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                    <h3>Hızlı Erişim</h3>
                </div>
                <ul class="toc-list">
                    <li class="toc-item"><a href="#sec-fucom"><span class="step-badge">1</span> FUCOM Adımları</a></li>
                    <li class="toc-item"><a href="#sec-fucom-final"><span class="step-badge">✦</span> Birleştirilmiş Ağırlıklar</a></li>
                    <li class="toc-item"><a href="#sec-marcos"><span class="step-badge">2</span> MARCOS Adımları</a></li>
                    <li class="toc-item"><a href="#sec-marcos-final"><span class="step-badge">🏆</span> Nihai Sıralama</a></li>
                </ul>
            </div>
        `;

        // ╔══════════════════════════════════════════════════════════╗
        // ║  BÖLÜM 1: FUCOM HESAPLAMA ADIMLARI                     ║
        // ╚══════════════════════════════════════════════════════════╝
        html += `<div class="step-section" id="sec-fucom">`;
        html += `<div class="step-section-header">
            <span class="step-number">1</span>
            <div><h3>FUCOM Hesaplama Adımları</h3>
            <p>Her uzman için kriter ağırlıklarının belirlenmesi ve tutarlılık analizi</p></div>
        </div>`;
        html += `<div class="step-section-body">`;

        // ── Her uzman için detaylı FUCOM hesabı ──
        appData.fucom.forEach((expert, eIdx) => {
            const weights = fucomResult.expertWeights[eIdx];
            const dfc = fucomResult.dfcValues[eIdx];
            const sortedIndices = expert.ranking
                .map((rank, idx) => ({ rank, idx }))
                .sort((a, b) => a.rank - b.rank);
            const sortedNames = sortedIndices.map(item => criteriaNames[item.idx]);

            html += `<div class="expert-block" data-expert-toggle>`;
            html += `<div class="expert-block-header">
                <span class="expert-icon">${eIdx + 1}</span>
                <h5>${esc(appData.experts[eIdx])} Değerlendirmesi</h5>
                <span class="toggle-icon">▼</span>
            </div>`;
            html += `<div class="expert-block-body">`;

            // Adım 1: Kriter Sıralaması
            html += `<div class="step-card">
                <div class="step-card-title"><span class="step-mini-num">1</span> Kriter Önem Sıralaması</div>
                <div class="ranking-flow">`;
            sortedNames.forEach((name, k) => {
                html += `<span class="rank-item">${esc(name)}</span>`;
                if (k < sortedNames.length - 1) html += `<span class="rank-arrow">▶</span>`;
            });
            html += `</div>
                <div class="note-box"><span class="note-icon">ℹ</span><span>Kriterler en önemliden en az önemliye doğru sıralanmıştır.</span></div>
            </div>`;

            // Adım 2: Karşılaştırma (Φ) Değerleri
            html += `<div class="step-card">
                <div class="step-card-title"><span class="step-mini-num">2</span> Ardışık Karşılaştırma Değerleri (Φ)</div>
                <div class="formula-block">`;
            for (let k = 0; k < sortedIndices.length - 1; k++) {
                const c1 = sortedNames[k];
                const c2 = sortedNames[k + 1];
                const val = expert.comparisons[k] || 1;
                html += `Φ<sub>${esc(c1)}/${esc(c2)}</sub> = ${val}<br>`;
            }
            html += `</div></div>`;

            // Adım 3: Optimizasyon Denklemleri
            html += `<div class="step-card">
                <div class="step-card-title"><span class="step-mini-num">3</span> Optimizasyon Kısıt Denklemleri</div>
                <div class="formula-block">`;
            // Koşul 1: Ardışık
            html += `<strong>Koşul 1 — Ardışık Oranlar:</strong><br>`;
            for (let k = 0; k < sortedIndices.length - 1; k++) {
                const val = expert.comparisons[k] || 1;
                html += `w<sub>${esc(sortedNames[k])}</sub> / w<sub>${esc(sortedNames[k + 1])}</sub> = ${val}<br>`;
            }
            // Koşul 2: Geçişlilik
            if (sortedIndices.length > 2) {
                html += `<br><strong>Koşul 2 — Geçişlilik:</strong><br>`;
                for (let k = 0; k < sortedIndices.length - 2; k++) {
                    const val1 = expert.comparisons[k] || 1;
                    const val2 = expert.comparisons[k + 1] || 1;
                    html += `w<sub>${esc(sortedNames[k])}</sub> / w<sub>${esc(sortedNames[k + 2])}</sub> = ${val1} × ${val2} = ${(val1 * val2).toFixed(2)}<br>`;
                }
            }
            html += `<br><strong>Koşul 3 — Normalleştirme:</strong><br>Σ w<sub>j</sub> = 1`;
            html += `</div></div>`;

            // Adım 4: Ağırlık Hesaplama Detayı
            html += `<div class="step-card">
                <div class="step-card-title"><span class="step-mini-num">4</span> Ağırlık Hesaplama (Kapalı Form Çözüm)</div>`;

            // Payda hesabı
            let denominatorTerms = ['1'];
            let denominatorVal = 1;
            for (let k = 0; k < n - 1; k++) {
                let product = 1;
                let termParts = [];
                for (let j = k; j < n - 1; j++) {
                    product *= (expert.comparisons[j] || 1);
                    termParts.push((expert.comparisons[j] || 1).toString());
                }
                denominatorTerms.push(termParts.length > 1 ? `${termParts.join(' × ')} = ${product.toFixed(4)}` : `${product.toFixed(4)}`);
                denominatorVal += product;
            }

            html += `<div class="formula-block">`;
            html += `<strong>Payda hesabı:</strong><br>`;
            html += `D = 1 + Σ(Π Φ<sub>j</sub>) = ${denominatorTerms.join(' + ')}<br>`;
            html += `D = <strong>${denominatorVal.toFixed(6)}</strong><br><br>`;

            // w_n (en az önemli kriter ağırlığı)
            const wLast = 1 / denominatorVal;
            html += `<strong>En az önemli kriterin ağırlığı:</strong><br>`;
            html += `w<sub>${esc(sortedNames[n - 1])}</sub> = 1 / D = 1 / ${denominatorVal.toFixed(6)} = <strong>${wLast.toFixed(6)}</strong><br><br>`;

            // Geriye doğru özyineleme
            html += `<strong>Geriye doğru özyineleme:</strong><br>`;
            const sortedW = []; sortedW[n - 1] = wLast;
            for (let k = n - 2; k >= 0; k--) {
                sortedW[k] = sortedW[k + 1] * (expert.comparisons[k] || 1);
                html += `w<sub>${esc(sortedNames[k])}</sub> = w<sub>${esc(sortedNames[k + 1])}</sub> × Φ<sub>${k + 1}</sub> = ${sortedW[k + 1].toFixed(6)} × ${expert.comparisons[k] || 1} = <strong>${sortedW[k].toFixed(6)}</strong><br>`;
            }
            html += `</div>`;

            // Sonuç: Ağırlık etiketleri
            html += `<div class="calc-detail"><div class="calc-label">Hesaplanan Ağırlıklar:</div></div>`;
            html += `<div class="variable-chips">`;
            criteriaNames.forEach((cn, i) => {
                html += `<span class="variable-chip">w<sub>${esc(cn)}</sub> = ${weights[i].toFixed(4)}</span>`;
            });
            html += `</div></div>`;

            // Adım 5: DFC Tutarlılık
            html += `<div class="step-card">
                <div class="step-card-title"><span class="step-mini-num">5</span> Tam Tutarlılıktan Sapma (DFC)</div>`;
            const dfcOk = dfc < 0.01;
            html += `<div class="formula-block ${dfcOk ? 'formula-result' : 'formula-danger'}">`;
            html += `DFC = Σ|sapma| / N<br>`;
            // Koşul 1 sapmaları
            const sortedWeightsOrdered = sortedIndices.map(item => weights[item.idx]);
            html += `<br><strong>Koşul 1 Sapmaları:</strong><br>`;
            for (let k = 0; k < n - 1; k++) {
                if (sortedWeightsOrdered[k + 1] > 0) {
                    const actual = sortedWeightsOrdered[k] / sortedWeightsOrdered[k + 1];
                    const expected = expert.comparisons[k] || 1;
                    const dev = Math.abs(actual - expected);
                    html += `|${actual.toFixed(4)} − ${expected}| = ${dev.toFixed(6)}<br>`;
                }
            }
            // Koşul 2 sapmaları
            if (n > 2) {
                html += `<br><strong>Koşul 2 Sapmaları:</strong><br>`;
                for (let k = 0; k < n - 2; k++) {
                    if (sortedWeightsOrdered[k + 2] > 0) {
                        const actual = sortedWeightsOrdered[k] / sortedWeightsOrdered[k + 2];
                        const expected = (expert.comparisons[k] || 1) * (expert.comparisons[k + 1] || 1);
                        const dev = Math.abs(actual - expected);
                        html += `|${actual.toFixed(4)} − ${expected.toFixed(2)}| = ${dev.toFixed(6)}<br>`;
                    }
                }
            }
            html += `<br><strong>DFC = ${dfc.toFixed(6)}</strong>`;
            html += `</div>`;
            html += `<span class="result-badge ${dfcOk ? 'badge-success' : 'badge-danger'}">${dfcOk ? '✓ Tutarlı (DFC < 0.01)' : '⚠ Yüksek Sapma (DFC ≥ 0.01)'}</span>`;
            html += `</div>`;

            html += `</div></div>`; // expert-block-body, expert-block
        });

        // ── Birleştirilmiş (Geometrik Ortalama) Ağırlıklar ──
        html += `<hr class="step-separator">`;
        html += `<div class="step-card" id="sec-fucom-final">
            <div class="step-card-title"><span class="step-mini-num">✦</span> Birleştirilmiş Ağırlıklar (Geometrik Ortalama)</div>`;
        html += `<div class="formula-block">`;
        html += `<strong>Formül:</strong> w̄<sub>j</sub> = (Π w<sub>j</sub><sup>(e)</sup>)<sup>1/E</sup>, normalleştirilmiş.<br><br>`;
        criteriaNames.forEach((cn, j) => {
            const vals = fucomResult.expertWeights.map(w => w[j]);
            const product = vals.reduce((a, b) => a * b, 1);
            const geomMean = Math.pow(product, 1 / vals.length);
            html += `w̄<sub>${esc(cn)}</sub> = (${vals.map(v => v.toFixed(4)).join(' × ')})<sup>1/${vals.length}</sup> = ${geomMean.toFixed(6)}<br>`;
        });
        const rawGeo = criteriaNames.map((_, j) => {
            const vals = fucomResult.expertWeights.map(w => w[j]);
            return Math.pow(vals.reduce((a, b) => a * b, 1), 1 / vals.length);
        });
        const geoSum = rawGeo.reduce((a, b) => a + b, 0);
        html += `<br><strong>Normalleştirme toplam:</strong> ${geoSum.toFixed(6)}`;
        html += `</div>`;
        html += `<div class="calc-detail"><div class="calc-label">Nihai Birleştirilmiş Ağırlıklar:</div></div>`;
        html += `<div class="variable-chips">`;
        criteriaNames.forEach((cn, i) => {
            html += `<span class="variable-chip chip-success">w<sub>${esc(cn)}</sub> = ${fucomResult.finalWeights[i].toFixed(4)} (%${(fucomResult.finalWeights[i] * 100).toFixed(1)})</span>`;
        });
        html += `</div></div>`;

        html += `</div></div>`; // step-section-body, step-section

        // ╔══════════════════════════════════════════════════════════╗
        // ║  BÖLÜM 2: MARCOS HESAPLAMA ADIMLARI                    ║
        // ╚══════════════════════════════════════════════════════════╝
        html += `<div class="step-section" id="sec-marcos">`;
        html += `<div class="step-section-header">
            <span class="step-number">2</span>
            <div><h3>MARCOS Hesaplama Adımları</h3>
            <p>Alternatiflerin uzlaşık çözüme göre sıralanması</p></div>
        </div>`;
        html += `<div class="step-section-body">`;

        // ── Adım 1: Birleştirilmiş Karar Matrisi ──
        html += `<div class="step-card">
            <div class="step-card-title"><span class="step-mini-num">1</span> Birleştirilmiş Karar Matrisi (Uzman Ortalaması)</div>`;
        html += `<div class="note-box"><span class="note-icon">ℹ</span><span>Her hücre, tüm uzmanların o hücre için verdiği değerlerin aritmetik ortalamasıdır: x̄<sub>ij</sub> = (1/E) × Σ x<sub>ij</sub><sup>(e)</sup></span></div>`;
        html += `<div class="table-scroll"><table class="result-table"><thead><tr><th>Alternatif</th>`;
        criteriaNames.forEach(cn => { html += `<th>${esc(cn)}</th>`; });
        html += `</tr></thead><tbody>`;
        combinedMatrix.forEach((row, i) => {
            html += `<tr><td>${esc(altNames[i])}</td>`;
            row.forEach(val => { html += `<td>${val.toFixed(2)}</td>`; });
            html += `</tr>`;
        });
        html += `</tbody></table></div></div>`;

        // ── Adım 2: İdeal ve Anti-İdeal Çözümler ──
        html += `<div class="step-card">
            <div class="step-card-title"><span class="step-mini-num">2</span> İdeal (AI) ve Anti-İdeal (AAI) Çözüm Vektörleri</div>`;
        html += `<div class="formula-block">`;
        html += `<strong>Fayda (Benefit) Kriterleri:</strong> AI = max(x<sub>ij</sub>), AAI = min(x<sub>ij</sub>)<br>`;
        html += `<strong>Maliyet (Cost) Kriterleri:</strong> AI = min(x<sub>ij</sub>), AAI = max(x<sub>ij</sub>)<br><br>`;
        criteriaNames.forEach((cn, j) => {
            const colVals = combinedMatrix.map(row => row[j]);
            const type = criteriaTypes[j] === 'benefit' ? 'Fayda ↑' : 'Maliyet ↓';
            html += `<strong>${esc(cn)}</strong> (${type}): değerler=[${colVals.map(v => v.toFixed(2)).join(', ')}]<br>`;
            html += `  → AI = ${marcosResult.ai[j].toFixed(4)}, AAI = ${marcosResult.aai[j].toFixed(4)}<br>`;
        });
        html += `</div>`;

        // Genişletilmiş matris tablosu
        html += `<div class="table-scroll"><table class="result-table"><thead><tr><th>Satır</th>`;
        criteriaNames.forEach(cn => { html += `<th>${esc(cn)}</th>`; });
        html += `</tr></thead><tbody>`;
        html += `<tr style="background:rgba(220,38,38,0.04)"><td style="font-weight:600;color:var(--danger)">AAI</td>`;
        marcosResult.aai.forEach(val => { html += `<td>${val.toFixed(4)}</td>`; });
        html += `</tr>`;
        combinedMatrix.forEach((row, i) => {
            html += `<tr><td>${esc(altNames[i])}</td>`;
            row.forEach(val => { html += `<td>${val.toFixed(4)}</td>`; });
            html += `</tr>`;
        });
        html += `<tr style="background:rgba(22,163,74,0.04)"><td style="font-weight:600;color:var(--success)">AI</td>`;
        marcosResult.ai.forEach(val => { html += `<td>${val.toFixed(4)}</td>`; });
        html += `</tr></tbody></table></div></div>`;

        // ── Adım 3: Normalizasyon ──
        html += `<div class="step-card">
            <div class="step-card-title"><span class="step-mini-num">3</span> Matris Normalizasyonu</div>`;
        html += `<div class="formula-block">`;
        html += `<strong>Fayda Kriterleri:</strong> n<sub>ij</sub> = x<sub>ij</sub> / AI<sub>j</sub><br>`;
        html += `<strong>Maliyet Kriterleri:</strong> n<sub>ij</sub> = AI<sub>j</sub> / x<sub>ij</sub>`;
        html += `</div>`;
        html += `<div class="table-scroll"><table class="result-table"><thead><tr><th>Alternatif</th>`;
        criteriaNames.forEach(cn => { html += `<th>${esc(cn)}</th>`; });
        html += `</tr></thead><tbody>`;
        marcosResult.normalizedMatrix.forEach((row, i) => {
            html += `<tr><td>${esc(altNames[i])}</td>`;
            row.forEach(val => { html += `<td>${val.toFixed(4)}</td>`; });
            html += `</tr>`;
        });
        html += `</tbody></table></div></div>`;

        // ── Adım 4: Ağırlıklı Normalize Matris ──
        html += `<div class="step-card">
            <div class="step-card-title"><span class="step-mini-num">4</span> Ağırlıklı Normalize Matris</div>`;
        html += `<div class="formula-block">v<sub>ij</sub> = n<sub>ij</sub> × w<sub>j</sub></div>`;
        html += `<div class="table-scroll"><table class="result-table"><thead><tr><th>Alternatif</th>`;
        criteriaNames.forEach((cn, j) => { html += `<th>${esc(cn)} <small>(w=${fucomResult.finalWeights[j].toFixed(3)})</small></th>`; });
        html += `</tr></thead><tbody>`;
        marcosResult.weightedMatrix.forEach((row, i) => {
            html += `<tr><td>${esc(altNames[i])}</td>`;
            row.forEach(val => { html += `<td>${val.toFixed(4)}</td>`; });
            html += `</tr>`;
        });
        html += `</tbody></table></div></div>`;

        // ── Adım 5: S_i Toplamları ──
        html += `<div class="step-card">
            <div class="step-card-title"><span class="step-mini-num">5</span> S<sub>i</sub> Toplamları — Her Alternatif İçin Ağırlıklı Toplam</div>`;
        html += `<div class="formula-block">S<sub>i</sub> = Σ v<sub>ij</sub>  (her satırın toplamı)</div>`;
        html += `<div class="formula-block formula-result">`;
        altNames.forEach((alt, i) => {
            const wRow = marcosResult.weightedMatrix[i];
            html += `S<sub>${esc(alt)}</sub> = ${wRow.map(v => v.toFixed(4)).join(' + ')} = <strong>${marcosResult.sValues[i].toFixed(5)}</strong><br>`;
        });
        html += `<br>S<sub>AAI</sub> = <strong>${marcosResult.sAAI.toFixed(5)}</strong> &nbsp;|&nbsp; S<sub>AI</sub> = <strong>${marcosResult.sAI.toFixed(5)}</strong>`;
        html += `</div></div>`;

        // ── Adım 6: Fayda Dereceleri (K⁺, K⁻) ──
        html += `<div class="step-card">
            <div class="step-card-title"><span class="step-mini-num">6</span> Fayda Dereceleri (K<sup>+</sup>, K<sup>−</sup>)</div>`;
        html += `<div class="formula-block">K<sub>i</sub><sup>−</sup> = S<sub>i</sub> / S<sub>AAI</sub><br>K<sub>i</sub><sup>+</sup> = S<sub>i</sub> / S<sub>AI</sub></div>`;
        html += `<div class="formula-block formula-result">`;
        altNames.forEach((alt, i) => {
            html += `<strong>${esc(alt)}:</strong> K<sup>−</sup> = ${marcosResult.sValues[i].toFixed(5)} / ${marcosResult.sAAI.toFixed(5)} = <strong>${marcosResult.kMinus[i].toFixed(5)}</strong> &nbsp;|&nbsp; K<sup>+</sup> = ${marcosResult.sValues[i].toFixed(5)} / ${marcosResult.sAI.toFixed(5)} = <strong>${marcosResult.kPlus[i].toFixed(5)}</strong><br>`;
        });
        html += `</div></div>`;

        // ── Adım 7: Fayda Fonksiyonları ──
        html += `<div class="step-card">
            <div class="step-card-title"><span class="step-mini-num">7</span> Fayda Fonksiyonları f(K<sub>i</sub>)</div>`;
        html += `<div class="formula-block">`;
        html += `f(K<sub>i</sub><sup>−</sup>) = K<sub>i</sub><sup>+</sup> / (K<sub>i</sub><sup>+</sup> + K<sub>i</sub><sup>−</sup>)<br>`;
        html += `f(K<sub>i</sub><sup>+</sup>) = K<sub>i</sub><sup>−</sup> / (K<sub>i</sub><sup>+</sup> + K<sub>i</sub><sup>−</sup>)<br>`;
        html += `f(K<sub>i</sub>) = (K<sub>i</sub><sup>+</sup> + K<sub>i</sub><sup>−</sup>) / (1 + (1−f(K<sub>i</sub><sup>+</sup>))/f(K<sub>i</sub><sup>+</sup>) + (1−f(K<sub>i</sub><sup>−</sup>))/f(K<sub>i</sub><sup>−</sup>))`;
        html += `</div>`;
        html += `<div class="formula-block formula-result">`;
        altNames.forEach((alt, i) => {
            const kp = marcosResult.kPlus[i];
            const km = marcosResult.kMinus[i];
            const sum = kp + km;
            html += `<strong>${esc(alt)}:</strong><br>`;
            html += `&nbsp;&nbsp;f(K<sup>−</sup>) = ${kp.toFixed(5)} / (${kp.toFixed(5)} + ${km.toFixed(5)}) = <strong>${marcosResult.fKMinus[i].toFixed(5)}</strong><br>`;
            html += `&nbsp;&nbsp;f(K<sup>+</sup>) = ${km.toFixed(5)} / ${sum.toFixed(5)} = <strong>${marcosResult.fKPlus[i].toFixed(5)}</strong><br>`;
            html += `&nbsp;&nbsp;f(K) = ${sum.toFixed(5)} / (1 + ${((1 - marcosResult.fKPlus[i]) / marcosResult.fKPlus[i]).toFixed(5)} + ${((1 - marcosResult.fKMinus[i]) / marcosResult.fKMinus[i]).toFixed(5)}) = <strong style="color:var(--accent-primary)">${marcosResult.fK[i].toFixed(5)}</strong><br><br>`;
        });
        html += `</div></div>`;

        // ── Adım 8: Nihai Sıralama ──
        html += `<div class="step-card" id="sec-marcos-final">
            <div class="step-card-title"><span class="step-mini-num">8</span> Nihai Sıralama</div>`;
        html += `<div class="note-box note-success"><span class="note-icon">🏆</span><span>Alternatifler en yüksek f(K<sub>i</sub>) değerine göre sıralanır.</span></div>`;
        html += `<div class="table-scroll"><table class="result-table"><thead><tr>`;
        html += `<th>Sıra</th><th>Alternatif</th><th>S<sub>i</sub></th><th>K<sub>i</sub><sup>+</sup></th><th>K<sub>i</sub><sup>−</sup></th><th>f(K<sub>i</sub><sup>+</sup>)</th><th>f(K<sub>i</sub><sup>−</sup>)</th><th>f(K<sub>i</sub>)</th>`;
        html += `</tr></thead><tbody>`;

        // Sıralama indeksleri
        const sortedAlts = altNames.map((_, i) => i).sort((a, b) => marcosResult.fK[b] - marcosResult.fK[a]);
        sortedAlts.forEach((i, rank) => {
            const rankClass = rank < 3 ? `rank-${rank + 1}` : '';
            html += `<tr>`;
            html += `<td class="${rankClass}" style="font-weight:700">${rank + 1}</td>`;
            html += `<td style="text-align:left;font-weight:600">${esc(altNames[i])}</td>`;
            html += `<td>${marcosResult.sValues[i].toFixed(4)}</td>`;
            html += `<td>${marcosResult.kPlus[i].toFixed(4)}</td>`;
            html += `<td>${marcosResult.kMinus[i].toFixed(4)}</td>`;
            html += `<td>${marcosResult.fKPlus[i].toFixed(4)}</td>`;
            html += `<td>${marcosResult.fKMinus[i].toFixed(4)}</td>`;
            html += `<td class="${rankClass}" style="font-weight:700">${marcosResult.fK[i].toFixed(5)}</td>`;
            html += `</tr>`;
        });
        html += `</tbody></table></div></div>`;

        html += `</div></div>`; // step-section-body, step-section

        container.innerHTML = html;

        // Collapsible expert blok toggle işlevi
        bindStepToggles();
    }

    /** Expert blokları ve collapsible bölümleri açma/kapama işlevi. */
    function bindStepToggles() {
        document.querySelectorAll('[data-expert-toggle] .expert-block-header').forEach(header => {
            header.addEventListener('click', () => {
                const block = header.closest('.expert-block');
                block.classList.toggle('collapsed');
            });
        });
        document.querySelectorAll('.collapsible-header').forEach(header => {
            header.addEventListener('click', () => {
                header.classList.toggle('collapsed');
                const body = header.nextElementSibling;
                if (body && body.classList.contains('collapsible-body')) {
                    body.classList.toggle('collapsed');
                }
            });
        });
    }


    // ════════════════════════════════════════════
    // PDF DIŞA AKTARMA
    // ════════════════════════════════════════════

    /**
     * Adım Adım Hesaplama Raporunu PDF olarak dışa aktarır.
     * Tarayıcının print diyaloğunu kullanır; "PDF olarak kaydet" seçeneğiyle PDF üretilir.
     */
    function exportStepsPDF() {
        const container = document.getElementById('stepsContainer');
        if (!container || container.innerHTML.trim() === '' || container.querySelector('.card[style*="text-align: center"]')) {
            showToast('Önce "Raporu Yenile / Oluştur" veya hesaplama yapın!', 'error');
            return;
        }

        const reportDate = new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
        const title = 'MCDM Tez – Adım Adım Hesaplama Raporu';

        const printStyles = `
            @page { size: A4; margin: 18mm 15mm; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body {
                font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
                font-size: 11px;
                color: #1e293b;
                background: #fff;
                margin: 0;
                padding: 0;
            }
            .pdf-header {
                display: flex;
                align-items: center;
                gap: 12px;
                border-bottom: 3px solid #6366f1;
                padding-bottom: 12px;
                margin-bottom: 20px;
            }
            .pdf-logo {
                width: 40px; height: 40px;
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                border-radius: 10px;
                display: flex; align-items: center; justify-content: center;
                color: white; font-weight: 800; font-size: 18px;
                flex-shrink: 0;
            }
            .pdf-header h1 { font-size: 16px; margin: 0 0 3px; color: #1e293b; }
            .pdf-header p  { font-size: 10px; margin: 0; color: #64748b; }
            .step-section {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                margin-bottom: 18px;
                page-break-inside: avoid;
            }
            .step-section-header {
                display: flex;
                align-items: center;
                gap: 12px;
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                color: white;
                border-radius: 9px 9px 0 0;
                padding: 10px 14px;
            }
            .step-number {
                background: rgba(255,255,255,0.25);
                width: 28px; height: 28px;
                border-radius: 50%;
                display: inline-flex; align-items: center; justify-content: center;
                font-weight: 700; font-size: 13px;
                flex-shrink: 0;
            }
            .step-section-header h3 { font-size: 13px; margin: 0; }
            .step-section-header p  { font-size: 10px; margin: 2px 0 0; opacity: .85; }
            .step-section-body { padding: 12px 14px; }
            .step-card {
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 10px 12px;
                margin-bottom: 10px;
                page-break-inside: avoid;
            }
            .step-card-title {
                font-weight: 700;
                font-size: 11px;
                color: #6366f1;
                margin-bottom: 8px;
                display: flex; align-items: center; gap: 6px;
            }
            .step-mini-num {
                background: #6366f1;
                color: white;
                width: 20px; height: 20px;
                border-radius: 50%;
                display: inline-flex; align-items: center; justify-content: center;
                font-size: 10px; font-weight: 700;
                flex-shrink: 0;
            }
            .expert-block {
                border: 1px solid #c7d2fe;
                border-radius: 8px;
                margin-bottom: 10px;
                page-break-inside: avoid;
            }
            .expert-block-header {
                background: #eef2ff;
                padding: 8px 12px;
                display: flex; align-items: center; gap: 8px;
                border-radius: 7px 7px 0 0;
            }
            .expert-icon {
                background: #6366f1;
                color: white;
                width: 22px; height: 22px;
                border-radius: 50%;
                display: inline-flex; align-items: center; justify-content: center;
                font-size: 11px; font-weight: 700;
            }
            .expert-block-header h5 { font-size: 11px; margin: 0; color: #3730a3; }
            .toggle-icon { display: none; }
            .expert-block-body { padding: 10px 12px; }
            .formula-block {
                background: #f1f5f9;
                border-left: 3px solid #6366f1;
                border-radius: 0 6px 6px 0;
                padding: 8px 10px;
                font-size: 10px;
                margin: 6px 0;
                line-height: 1.7;
            }
            .formula-result { background: #f0fdf4; border-left-color: #16a34a; }
            .formula-danger { background: #fef2f2; border-left-color: #dc2626; }
            .result-badge {
                display: inline-block;
                padding: 3px 8px;
                border-radius: 9999px;
                font-size: 10px;
                font-weight: 600;
                margin-top: 4px;
            }
            .badge-success { background: #dcfce7; color: #166534; }
            .badge-danger  { background: #fee2e2; color: #991b1b; }
            .note-box {
                background: #eff6ff;
                border: 1px solid #bfdbfe;
                border-radius: 6px;
                padding: 7px 10px;
                font-size: 10px;
                margin: 6px 0;
                display: flex; gap: 6px;
            }
            .note-success { background: #f0fdf4; border-color: #bbf7d0; }
            .note-icon { font-size: 13px; }
            .ranking-flow { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; margin: 6px 0; }
            .rank-item {
                background: #eef2ff;
                color: #3730a3;
                border-radius: 5px;
                padding: 3px 8px;
                font-size: 10px;
                font-weight: 600;
            }
            .rank-arrow { color: #6366f1; font-size: 12px; }
            .variable-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
            .variable-chip {
                background: #eef2ff;
                color: #3730a3;
                border-radius: 5px;
                padding: 3px 8px;
                font-size: 10px;
                font-weight: 600;
            }
            .chip-success { background: #dcfce7; color: #166534; }
            .calc-detail { margin: 6px 0 2px; }
            .calc-label { font-size: 10px; font-weight: 600; color: #475569; }
            .step-separator { border: none; border-top: 2px dashed #c7d2fe; margin: 12px 0; }
            table.result-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 9.5px;
                margin-top: 6px;
            }
            table.result-table th {
                background: #6366f1;
                color: white;
                padding: 5px 6px;
                text-align: center;
                font-weight: 600;
            }
            table.result-table td {
                padding: 4px 6px;
                border-bottom: 1px solid #e2e8f0;
                text-align: center;
            }
            table.result-table tr:nth-child(even) td { background: #f8fafc; }
            .rank-1 { color: #d97706; font-weight: 700; }
            .rank-2 { color: #6366f1; font-weight: 700; }
            .rank-3 { color: #16a34a; font-weight: 700; }
            .table-scroll { overflow: visible; }
            .pdf-footer {
                text-align: center;
                font-size: 9px;
                color: #94a3b8;
                border-top: 1px solid #e2e8f0;
                margin-top: 20px;
                padding-top: 8px;
            }
        `;

        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) {
            showToast('Popup engelleyicisi etkin — lütfen izin verin ve tekrar deneyin.', 'error');
            return;
        }

        win.document.write(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>${printStyles}</style>
</head>
<body>
  <div class="pdf-header">
    <div class="pdf-logo">M</div>
    <div>
      <h1>${title}</h1>
      <p>İhsan Turhan &nbsp;|&nbsp; FUCOM &amp; MARCOS Çok Kriterli Karar Verme &nbsp;|&nbsp; ${reportDate}</p>
    </div>
  </div>
  ${container.innerHTML}
  <div class="pdf-footer">
    © 2026 İhsan Turhan – MCDM Tez Veri Değerlendirme &nbsp;|&nbsp; Bu rapor uygulama tarafından otomatik olarak oluşturulmuştur.
  </div>
</body>
</html>`);

        win.document.close();

        // Font yüklendikten sonra yazdır
        win.onload = function () {
            setTimeout(() => {
                win.focus();
                win.print();
                win.close();
            }, 600);
        };

        showToast('PDF diyaloğu açılıyor... "PDF olarak kaydet" seçin ✓');
    }

    // ════════════════════════════════════════════
    // VERİ YÖNETİMİ MODALI
    // ════════════════════════════════════════════

    const modal = document.getElementById('dataManagerModal');

    function openDataManager() {
        renderSavedList();
        modal.classList.add('open');
    }

    function closeDataManager() {
        modal.classList.remove('open');
    }

    /** Kayıtlı veri listesini modal içinde render eder. */
    function renderSavedList() {
        const listEl = document.getElementById('dmSavedList');
        const saves = DataManager.getSaves();

        if (saves.length === 0) {
            listEl.innerHTML = '<p class="dm-empty">Henüz kayıtlı veri bulunmuyor.</p>';
            return;
        }

        listEl.innerHTML = saves.map((s, i) => `
            <div class="dm-saved-item">
                <div class="dm-item-info">
                    <span class="dm-item-name">${esc(s.name)}</span>
                    <span class="dm-item-date">${DataManager.formatDate(s.date)}</span>
                </div>
                <div class="dm-item-actions">
                    <button class="dm-btn-load" data-load-idx="${i}">Yükle</button>
                    <button class="dm-btn-delete" data-del-idx="${i}">Sil</button>
                </div>
            </div>
        `).join('');

        // Yükleme butonları
        listEl.querySelectorAll('.dm-btn-load').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.loadIdx);
                const loadedData = DataManager.loadSave(idx);
                if (loadedData) {
                    appData = loadedData;
                    appData = StorageModule.initFucom(appData);
                    appData = StorageModule.initMarcos(appData);
                    StorageModule.save(appData);
                    reloadAllTabs();
                    closeDataManager();
                    showToast('Veri yüklendi ✓');
                }
            });
        });

        // Silme butonları
        listEl.querySelectorAll('.dm-btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.delIdx);
                const saves = DataManager.getSaves();
                const name = saves[idx] ? saves[idx].name : '';
                if (confirm(`"${name}" kaydı silinecek. Emin misiniz?`)) {
                    DataManager.deleteSave(idx);
                    renderSavedList();
                    showToast('Kayıt silindi', 'error');
                }
            });
        });
    }

    /** Tüm sekmeleri yeniden render eder ve başlangıç sekmesine döner. */
    function reloadAllTabs() {
        renderSetupTab();
        renderFucomTab();
        renderMarcosTab();
        Visualization.destroyCharts();
        switchTab('setup');
    }

    // ════════════════════════════════════════════
    // OLAY BAĞLAMA (EVENT BINDING)
    // ════════════════════════════════════════════

    function bindEvents() {
        // Sekme geçişleri
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // Tanımlar kaydet
        document.getElementById('btnSaveSetup').addEventListener('click', saveSetup);

        // FUCOM kaydet
        document.getElementById('btnSaveFucom').addEventListener('click', saveFucom);
        document.getElementById('btnBackToSetup').addEventListener('click', () => switchTab('setup'));

        // MARCOS hesapla
        document.getElementById('btnCalculate').addEventListener('click', () => {
            if (validateFucomRankings()) {
                try {
                    runCalculations();
                } catch (e) {
                    console.error('Hesaplama Hatası:', e);
                    showToast('Hesaplama sırasında bir hata oluştu: ' + e.message, 'error');
                }
            }
        });
        document.getElementById('btnBackToFucom').addEventListener('click', () => switchTab('fucom'));

        // Sonuçlar
        document.getElementById('btnBackToMarcos').addEventListener('click', () => switchTab('marcos'));
        document.getElementById('btnPrint').addEventListener('click', () => window.print());

        // Sonuçları Excel'e aktar
        const btnExportResults = document.getElementById('btnExportResults');
        if (btnExportResults) {
            btnExportResults.addEventListener('click', () => {
                if (!lastFucomResult || !lastMarcosResult) {
                    showToast('Önce hesaplama yapmalısınız!', 'error');
                    return;
                }
                try {
                    DataManager.exportResultsExcel(appData, lastFucomResult, lastMarcosResult, lastCombinedMatrix);
                    showToast('Sonuçlar Excel dosyası olarak indirildi ✓');
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        }

        // Tümünü sıfırla
        document.getElementById('btnResetAll').addEventListener('click', () => {
            if (confirm('Tüm veriler silinecek. Emin misiniz?')) {
                appData = StorageModule.reset();
                appData = StorageModule.initFucom(appData);
                appData = StorageModule.initMarcos(appData);
                reloadAllTabs();
                showToast('Tüm veriler sıfırlandı', 'error');
            }
        });

        // ── Veri Yönetimi Modalı ──
        document.getElementById('btnDataManager').addEventListener('click', openDataManager);
        document.getElementById('btnCloseModal').addEventListener('click', closeDataManager);

        // Arka plan tıklamasıyla modalı kapat
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeDataManager();
        });

        // Escape tuşuyla modalı kapat
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('open')) {
                closeDataManager();
            }
        });

        // Adlandırılmış kayıt oluştur
        document.getElementById('btnDmSave').addEventListener('click', () => {
            const nameInput = document.getElementById('dmSaveName');
            const name = nameInput.value.trim();
            if (!name) {
                showToast('Lütfen bir kayıt adı girin', 'error');
                nameInput.focus();
                return;
            }
            collectCurrentFormData();
            DataManager.saveAs(name, appData);
            StorageModule.save(appData);
            nameInput.value = '';
            renderSavedList();
            showToast(`"${name}" olarak kaydedildi ✓`);
        });

        // JSON dışa aktar
        document.getElementById('btnDmExport').addEventListener('click', () => {
            collectCurrentFormData();
            DataManager.exportJSON(appData);
            showToast('JSON dosyası indirildi ✓');
        });

        // JSON içe aktar
        const fileInput = document.getElementById('dmFileInput');
        document.getElementById('btnDmImport').addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const importedData = await DataManager.importJSON(file);
                appData = importedData;
                appData = StorageModule.initFucom(appData);
                appData = StorageModule.initMarcos(appData);
                StorageModule.save(appData);
                reloadAllTabs();
                closeDataManager();
                showToast('Veri başarıyla içe aktarıldı ✓');
            } catch (err) {
                showToast(err.message, 'error');
            }
            fileInput.value = '';
        });

        // Excel dışa aktar (tüm giriş verileri)
        document.getElementById('btnDmExcelExport').addEventListener('click', () => {
            try {
                collectCurrentFormData();
                DataManager.exportExcel(appData);
                showToast('Excel dosyası indirildi ✓');
            } catch (err) {
                showToast(err.message, 'error');
            }
        });

        // Excel içe aktar
        const excelFileInput = document.getElementById('dmExcelFileInput');
        document.getElementById('btnDmExcelImport').addEventListener('click', () => {
            excelFileInput.click();
        });

        excelFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const importedData = await DataManager.importExcel(file);
                appData = importedData;
                StorageModule.save(appData);
                reloadAllTabs();
                closeDataManager();
                showToast('Tüm veriler Excel dosyasından aktarıldı ✓');
            } catch (err) {
                showToast(err.message, 'error');
            }
            excelFileInput.value = '';
        });

        // ── Adım Adım Rapor – PDF ──
        const btnExportStepsPDF = document.getElementById('btnExportStepsPDF');
        if (btnExportStepsPDF) {
            btnExportStepsPDF.addEventListener('click', exportStepsPDF);
        }

        // Adım Adım Rapor – Excel (mevcut)
        const btnExportStepsExcel = document.getElementById('btnExportStepsExcel');
        if (btnExportStepsExcel) {
            btnExportStepsExcel.addEventListener('click', () => {
                if (!lastFucomResult || !lastMarcosResult) {
                    showToast('Önce hesaplama yapmalısınız!', 'error');
                    return;
                }
                try {
                    DataManager.exportStepsExcel(appData, lastFucomResult, lastMarcosResult, lastCombinedMatrix);
                    showToast('Rapor Excel dosyası olarak indirildi ✓');
                } catch (err) {
                    showToast('Excel aktarımında hata: ' + err.message, 'error');
                }
            });
        }

        // Raporu Yenile butonu
        const btnRefreshSteps = document.getElementById('btnRefreshSteps');
        if (btnRefreshSteps) {
            btnRefreshSteps.addEventListener('click', () => {
                if (!lastFucomResult || !lastMarcosResult) {
                    showToast('Önce "Hesapla ve Sonuçları Göster" adımını tamamlayın!', 'error');
                    return;
                }
                const criteriaNames = appData.criteria.map(c => c.name);
                const altNames = appData.alternatives;
                const criteriaTypes = appData.criteria.map(c => c.type);
                renderCalculationSteps(lastFucomResult, lastMarcosResult, lastCombinedMatrix, altNames, criteriaNames, criteriaTypes);
                showToast('Rapor yenilendi ✓');
            });
        }

        // ── Gizlilik Bildirimi Modalı ──
        const privacyModal = document.getElementById('privacyModal');
        const closePrivacyModal = () => {
            if (privacyModal) privacyModal.classList.remove('open');
        };

        const btnClosePrivacy = document.getElementById('btnClosePrivacy');
        const btnAcknowledgePrivacy = document.getElementById('btnAcknowledgePrivacy');
        
        if (btnClosePrivacy) btnClosePrivacy.addEventListener('click', closePrivacyModal);
        if (btnAcknowledgePrivacy) btnAcknowledgePrivacy.addEventListener('click', closePrivacyModal);

        // ── Başa Dön Butonu Olayları ──
        const btnScrollToTop = document.getElementById('btnScrollToTop');
        if (btnScrollToTop) {
            window.addEventListener('scroll', () => {
                if (window.scrollY > 400) {
                    btnScrollToTop.classList.add('show');
                } else {
                    btnScrollToTop.classList.remove('show');
                }
            });

            btnScrollToTop.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    }

    // ════════════════════════════════════════════
    // FORM VERİ TOPLAMA
    // ════════════════════════════════════════════

    /**
     * Tüm sekmelerdeki form alanlarından güncel verileri appData nesnesine toplar.
     * Kaydetme ve dışa aktarma işlemlerinden önce çağrılır.
     */
    function collectCurrentFormData() {
        const numExperts = appData.experts.length;
        const numCriteria = appData.criteria.length;
        const numAlternatives = appData.alternatives.length;

        // Tanımlar sekmesi
        for (let i = 0; i < numExperts; i++) {
            const el = document.getElementById(`expert-${i}`);
            if (el) appData.experts[i] = el.value || `Uzman ${i + 1}`;
        }
        for (let i = 0; i < numCriteria; i++) {
            const nameEl = document.getElementById(`criteria-name-${i}`);
            const typeEl = document.getElementById(`criteria-type-${i}`);
            if (nameEl) appData.criteria[i].name = nameEl.value || `Kriter ${i + 1}`;
            if (typeEl) appData.criteria[i].type = typeEl.value;
        }
        for (let i = 0; i < numAlternatives; i++) {
            const el = document.getElementById(`alt-${i}`);
            if (el) appData.alternatives[i] = el.value || `Alternatif ${i + 1}`;
        }

        // FUCOM giriş alanları
        document.querySelectorAll('.fucom-rank').forEach(input => {
            const e = parseInt(input.dataset.expert);
            const c = parseInt(input.dataset.criterion);
            appData.fucom[e].ranking[c] = parseInt(input.value) || 1;
        });
        document.querySelectorAll('.fucom-comp').forEach(input => {
            const e = parseInt(input.dataset.expert);
            const p = parseInt(input.dataset.pair);
            appData.fucom[e].comparisons[p] = parseFloat(input.value) || 1;
        });

        // MARCOS giriş alanları
        document.querySelectorAll('.marcos-val').forEach(input => {
            const e = parseInt(input.dataset.expert);
            const a = parseInt(input.dataset.alt);
            const c = parseInt(input.dataset.crit);
            appData.marcos[e][a][c] = parseFloat(input.value) || 1;
        });
    }

    // ── Uygulama Başlatma ──
    document.addEventListener('DOMContentLoaded', init);
})();
