// ============================================
// FUCOM — Full Consistency Method
// ============================================
// Kaynak: Pamučar, D., Stević, Ž. & Sremac, S. (2018)
//
// Adımlar:
// 1. Her uzman, kriterleri önem derecesine göre sıralar.
// 2. Her uzman, ardışık sıralanmış kriterler arasındaki
//    karşılaştırmalı önem oranlarını (φ) belirler: φ(k/k+1).
// 3. Ağırlıklar w_j şu koşulları sağlayacak şekilde türetilir:
//      w(k) / w(k+1) = φ(k/k+1)   (tüm ardışık çiftler için)
//      Σ w_j = 1
//    Kapalı form çözümü:
//      w_n = 1 / (1 + Σ_{k=1}^{n-1} Π_{j=k}^{n-1} φ_j)
//      w_k = w_{k+1} × φ_k  (geriye doğru özyineleme)
// 4. Tam tutarlılıktan sapma (DFC) hesaplanarak
//    uzman değerlendirmelerinin tutarlılığı kontrol edilir.

const FucomCalculator = (() => {

    /**
     * Tek bir uzman için kriter ağırlıklarını hesaplar.
     *
     * @param {number[]} ranking     — Her kritere atanan önem sırası (1 = en önemli)
     * @param {number[]} comparisons — Ardışık kriterler arasındaki φ değerleri (uzunluk = n-1)
     * @returns {number[]}           — Orijinal kriter sırasındaki ağırlıklar
     */
    function calculateExpertWeights(ranking, comparisons) {
        const n = ranking.length;

        // Kriterleri önem sırasına göre sırala (küçükten büyüğe = en önemliden en önemsize)
        const sortedIndices = ranking
            .map((rank, idx) => ({ rank, idx }))
            .sort((a, b) => a.rank - b.rank)
            .map(item => item.idx);

        // En az önemli kriterin ağırlığını hesapla (sıralamanın son elemanı)
        // w_n = 1 / (1 + Σ_{k=1}^{n-1} Π_{j=k}^{n-1} φ_j)
        let denominator = 1;
        for (let k = 0; k < n - 1; k++) {
            let product = 1;
            for (let j = k; j < n - 1; j++) {
                product *= comparisons[j] || 1;
            }
            denominator += product;
        }

        const wLast = 1 / denominator;

        // Geriye doğru özyineleme: w_k = w_{k+1} × φ_k
        const sortedWeights = new Array(n);
        sortedWeights[n - 1] = wLast;
        for (let k = n - 2; k >= 0; k--) {
            sortedWeights[k] = sortedWeights[k + 1] * (comparisons[k] || 1);
        }

        // Ağırlıkları orijinal kriter sırasına geri eşle
        const weights = new Array(n);
        for (let i = 0; i < n; i++) {
            weights[sortedIndices[i]] = sortedWeights[i];
        }

        return weights;
    }

    /**
     * Tüm uzmanların ağırlıklarını geometrik ortalama ile birleştirir.
     *
     * Geometrik ortalama: w̄_j = (Π_{e=1}^{E} w_j^{(e)})^{1/E}
     * Ardından normalleştirme yapılarak Σ w̄_j = 1 sağlanır.
     *
     * @param {number[][]} allWeights — Her uzman için ağırlık vektörü dizisi
     * @returns {number[]}           — Birleştirilmiş ve normalleştirilmiş ağırlık vektörü
     */
    function combineWeights(allWeights) {
        const numCriteria = allWeights[0].length;
        const numExperts = allWeights.length;
        const combined = new Array(numCriteria).fill(0);

        // Geometrik ortalama hesapla
        for (let j = 0; j < numCriteria; j++) {
            let product = 1;
            for (let e = 0; e < numExperts; e++) {
                product *= allWeights[e][j];
            }
            combined[j] = Math.pow(product, 1 / numExperts);
        }

        // Normalleştir: her ağırlığı toplama böl (Σ w̄_j = 1)
        const sum = combined.reduce((a, b) => a + b, 0);
        return combined.map(w => w / sum);
    }

    /**
     * Tam Tutarlılıktan Sapma (DFC — Deviation from Full Consistency) hesabı.
     *
     * FUCOM'da tam tutarlılık koşulları:
     *   Koşul 1: w(k) / w(k+1) = φ(k/k+1)
     *   Koşul 2: w(k) / w(k+2) = φ(k/k+1) × φ(k+1/k+2)
     *
     * DFC değeri ne kadar küçükse, uzman değerlendirmesi o kadar tutarlıdır.
     * DFC = 0 → Tam tutarlılık
     * DFC < 0.01 → Kabul edilebilir tutarlılık düzeyi
     *
     * @param {number[]} weights     — Hesaplanan kriter ağırlıkları (sıralı)
     * @param {number[]} comparisons — Uzmanın girdiği φ değerleri
     * @param {number[]} ranking     — Kriter önem sıralaması
     * @returns {number}             — DFC değeri (0'a yakın = tutarlı)
     */
    function calculateDFC(weights, comparisons, ranking) {
        const n = ranking.length;

        // Kriterleri önem sırasına göre sırala
        const sortedIndices = ranking
            .map((rank, idx) => ({ rank, idx }))
            .sort((a, b) => a.rank - b.rank)
            .map(item => item.idx);

        // Sıralı ağırlıkları elde et
        const sortedW = sortedIndices.map(idx => weights[idx]);

        let totalDeviation = 0;
        let count = 0;

        // Koşul 1: w(k) / w(k+1) ile φ(k/k+1) arasındaki fark
        for (let k = 0; k < n - 1; k++) {
            if (sortedW[k + 1] > 0) {
                const actual = sortedW[k] / sortedW[k + 1];
                const expected = comparisons[k] || 1;
                totalDeviation += Math.abs(actual - expected);
                count++;
            }
        }

        // Koşul 2: w(k) / w(k+2) ile φ(k/k+1) × φ(k+1/k+2) arasındaki fark
        for (let k = 0; k < n - 2; k++) {
            if (sortedW[k + 2] > 0) {
                const actual = sortedW[k] / sortedW[k + 2];
                const expected = (comparisons[k] || 1) * (comparisons[k + 1] || 1);
                totalDeviation += Math.abs(actual - expected);
                count++;
            }
        }

        return count > 0 ? totalDeviation / count : 0;
    }

    /**
     * Tüm uzmanlar için FUCOM hesabını yürütür.
     *
     * @param {object[]} fucomData — Her uzman için { ranking, comparisons } dizisi
     * @returns {{
     *   expertWeights: number[][],   — Her uzmanın kriter ağırlıkları
     *   finalWeights: number[],      — Birleştirilmiş (ortalama) ağırlıklar
     *   dfcValues: number[]          — Her uzmanın DFC tutarlılık değeri
     * }}
     */
    function calculate(fucomData) {
        const expertWeights = fucomData.map(expert =>
            calculateExpertWeights(expert.ranking, expert.comparisons)
        );

        // Her uzman için DFC hesapla
        const dfcValues = fucomData.map((expert, idx) =>
            calculateDFC(expertWeights[idx], expert.comparisons, expert.ranking)
        );

        const finalWeights = combineWeights(expertWeights);
        return { expertWeights, finalWeights, dfcValues };
    }

    return { calculate, calculateExpertWeights, combineWeights, calculateDFC };
})();
