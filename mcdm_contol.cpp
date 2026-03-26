#include <iostream>
#include <vector>
#include <string>
#include <numeric>
#include <algorithm>
#include <stdexcept>
#include <iomanip>
#include <cmath>

namespace MCDMCalculator {

    // MARCOS sonuçlarını döndürmek için özel bir yapı (struct)
    struct MarcosResult {
        std::vector<double> scores;
        std::vector<int> ranks;
    };

    /**
     * FUCOM: Kriter ağırlıklarını hesaplar.
     * @param ranking Kriterlerin önem sırası
     * @param comparisons Ardışık phi değerleri
     * @return Kriter ağırlıkları vektörü
     */
    std::vector<double> calculate_fucom(const std::vector<int>& ranking, const std::vector<double>& comparisons) {
        int n = ranking.size();
        
        // Girdi kontrolü
        if (comparisons.size() != n - 1) {
            throw std::invalid_argument("Hata: Karşılaştırma (phi) sayısı, sıralama sayısından 1 eksik olmalıdır.");
        }

        // Kriterleri önem sırasına göre indeksle (orijinal sıralamayı kaybetmemek için)
        std::vector<int> sorted_indices(n);
        std::iota(sorted_indices.begin(), sorted_indices.end(), 0); // 0, 1, 2... doldurur
        std::sort(sorted_indices.begin(), sorted_indices.end(),
                  [&](int i1, int i2) { return ranking[i1] < ranking[i2]; });

        // Payda hesaplaması (En az önemli kriterin ağırlığını bulmak için)
        double denominator = 1.0;
        for (int k = 0; k < n - 1; ++k) {
            double product = 1.0;
            for (int j = k; j < n - 1; ++j) {
                product *= comparisons[j];
            }
            denominator += product;
        }

        // Geriye dönük ağırlık hesaplaması
        double w_last = 1.0 / denominator;
        std::vector<double> sorted_weights(n);
        sorted_weights[n - 1] = w_last;

        for (int k = n - 2; k >= 0; --k) {
            sorted_weights[k] = sorted_weights[k + 1] * comparisons[k];
        }

        // Ağırlıkları kullanıcının girdiği orijinal sıraya yerleştir
        std::vector<double> final_weights(n);
        for (int i = 0; i < n; ++i) {
            final_weights[sorted_indices[i]] = sorted_weights[i];
        }

        return final_weights;
    }

    /**
     * MARCOS: Alternatifleri değerlendirir ve sıralar.
     * @param matrix Karar matrisi (Alternatif x Kriter)
     * @param weights FUCOM'dan elde edilen ağırlıklar
     * @param criteria_types "
