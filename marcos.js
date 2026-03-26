// ============================================
// MARCOS — Measurement Alternatives and Ranking
//          according to COmpromise Solution
// ============================================
// Kaynak: Stević, Ž. et al. (2020)
//
// Adımlar:
// 1. Genişletilmiş başlangıç karar matrisini oluştur:
//    Anti-İdeal (AAI) ve İdeal (AI) çözümleri eklenir.
//    - Fayda kriterleri: AAI = min(x_ij), AI = max(x_ij)
//    - Maliyet kriterleri: AAI = max(x_ij), AI = min(x_ij)
//
// 2. Genişletilmiş matrisi normalize et:
//    - Fayda: n_ij = x_ij / x_ai
//    - Maliyet: n_ij = x_ai / x_ij
//    Burada x_ai = j. kriterin ideal değeri
//
// 3. Ağırlıklı normalize matrisi hesapla: v_ij = n_ij × w_j
//
// 4. Her alternatif için S_i toplamını hesapla: S_i = Σ v_ij
//
// 5. Fayda derecelerini hesapla:
//    K_i⁺ = S_i / S_ai   (ideale göre)
//    K_i⁻ = S_i / S_aai   (anti-ideale göre)
//
// 6. Fayda fonksiyonlarını hesapla:
//    f(K_i⁻) = K_i⁺ / (K_i⁺ + K_i⁻)
//    f(K_i⁺) = K_i⁻ / (K_i⁺ + K_i⁻)
//    f(K_i)  = (K_i⁺ + K_i⁻) / (1 + (1−f(K_i⁺))/f(K_i⁺) + (1−f(K_i⁻))/f(K_i⁻))
//
// 7. Alternatifleri f(K_i) değerine göre azalan sırada sırala.

const MarcosCalculator = (() => {

    /**
     * Birden fazla uzmanın karar matrislerini aritmetik ortalama ile birleştirir.
     *
     * x̄_ij = (1/E) × Σ_{e=1}^{E} x_ij^{(e)}
     *
     * @param {number[][][]} allMatrices — Her uzman için karar matrisi [uzman][alternatif][kriter]
     * @returns {number[][]}            — Birleştirilmiş karar matrisi [alternatif][kriter]
     */
    function combineMatrices(allMatrices) {
        const numAlt = allMatrices[0].length;
        const numCrit = allMatrices[0][0].length;
        const numExperts = allMatrices.length;
        const combined = [];

        for (let a = 0; a < numAlt; a++) {
            const row = [];
            for (let c = 0; c < numCrit; c++) {
                let sum = 0;
                for (let e = 0; e < numExperts; e++) {
                    sum += Number(allMatrices[e][a][c]) || 0;
                }
                row.push(sum / numExperts);
            }
            combined.push(row);
        }
        return combined;
    }

    /**
     * MARCOS algoritmasını uygular.
     *
     * @param {number[][]} decisionMatrix — Birleştirilmiş karar matrisi (alternatif × kriter)
     * @param {number[]}   weights        — FUCOM'dan elde edilen kriter ağırlıkları
     * @param {string[]}   criteriaTypes  — Her kriter için 'benefit' veya 'cost'
     * @returns {object}                  — Ara adımlar ve nihai sonuçları içeren nesne
     */
    function calculate(decisionMatrix, weights, criteriaTypes) {
        const numAlt = decisionMatrix.length;
        const numCrit = decisionMatrix[0].length;

        // Adım 1: Anti-İdeal (AAI) ve İdeal (AI) çözümleri belirle
        const aai = []; // Anti-İdeal çözüm
        const ai = [];  // İdeal çözüm

        for (let j = 0; j < numCrit; j++) {
            const colValues = decisionMatrix.map(row => row[j]);
            if (criteriaTypes[j] === 'benefit') {
                aai.push(Math.min(...colValues)); // Fayda → AAI = minimum
                ai.push(Math.max(...colValues));  // Fayda → AI  = maksimum
            } else {
                aai.push(Math.max(...colValues)); // Maliyet → AAI = maksimum
                ai.push(Math.min(...colValues));  // Maliyet → AI  = minimum
            }
        }

        // Adım 2: Genişletilmiş matris (AAI + alternatifler + AI)
        const extendedMatrix = [aai, ...decisionMatrix, ai];

        // Adım 3: Normalizasyon
        const normalizedMatrix = [];
        for (let i = 0; i < extendedMatrix.length; i++) {
            const row = [];
            for (let j = 0; j < numCrit; j++) {
                let val;
                if (criteriaTypes[j] === 'benefit') {
                    // Fayda kriteri: n_ij = x_ij / x_ai
                    val = extendedMatrix[i][j] / ai[j];
                } else {
                    // Maliyet kriteri: n_ij = x_ai / x_ij
                    val = ai[j] / extendedMatrix[i][j];
                }
                row.push(isFinite(val) ? val : 0);
            }
            normalizedMatrix.push(row);
        }

        // Adım 4: Ağırlıklı normalize matris — v_ij = n_ij × w_j
        const weightedMatrix = normalizedMatrix.map(row =>
            row.map((val, j) => val * weights[j])
        );

        // Adım 5: Her satır için S_i toplamını hesapla — S_i = Σ_j v_ij
        const sValues = weightedMatrix.map(row => row.reduce((a, b) => a + b, 0));

        const sAAI = sValues[0];                    // Anti-ideal çözümün S değeri
        const sAI = sValues[sValues.length - 1];    // İdeal çözümün S değeri
        const sAlternatives = sValues.slice(1, -1); // Alternatiflerin S değerleri

        // Adım 6: Fayda dereceleri
        // K_i⁺ = S_i / S_ai   (ideale göre göreceli konum)
        // K_i⁻ = S_i / S_aai  (anti-ideale göre göreceli konum)
        const kPlus = sAlternatives.map(s => s / sAI);
        const kMinus = sAlternatives.map(s => s / sAAI);

        // Adım 7: Fayda fonksiyonları
        const fKPlus = [];
        const fKMinus = [];
        const fK = [];

        for (let i = 0; i < numAlt; i++) {
            const kp = kPlus[i];
            const km = kMinus[i];

            // f(K_i⁻) = K_i⁺ / (K_i⁺ + K_i⁻)
            const fkm = kp / (kp + km);
            // f(K_i⁺) = K_i⁻ / (K_i⁺ + K_i⁻)
            const fkp = km / (kp + km);

            fKPlus.push(fkp);
            fKMinus.push(fkm);

            // f(K_i) = (K_i⁺ + K_i⁻) / (1 + (1−f(K_i⁺))/f(K_i⁺) + (1−f(K_i⁻))/f(K_i⁻))
            const fki = (kp + km) / (1 + ((1 - fkp) / fkp) + ((1 - fkm) / fkm));
            fK.push(isFinite(fki) ? fki : 0);
        }

        // Adım 8: f(K_i) değerine göre azalan sıralama
        const ranking = fK
            .map((val, idx) => ({ idx, val }))
            .sort((a, b) => b.val - a.val)
            .map((item, rank) => ({ ...item, rank: rank + 1 }));

        // Sıralama sonucunu alternatif indeksine göre dizi oluştur
        const ranks = new Array(numAlt);
        ranking.forEach(item => { ranks[item.idx] = item.rank; });

        return {
            decisionMatrix,
            aai,
            ai,
            normalizedMatrix: normalizedMatrix.slice(1, -1), // Yalnızca alternatifler
            weightedMatrix: weightedMatrix.slice(1, -1),
            sValues: sAlternatives,
            sAAI,
            sAI,
            kPlus,
            kMinus,
            fKPlus,
            fKMinus,
            fK,
            ranks,
            ranking
        };
    }

    return { calculate, combineMatrices };
})();
