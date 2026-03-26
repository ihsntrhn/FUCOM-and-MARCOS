import numpy as np
from typing import List, Tuple, Union

class MCDMCalculator:
    """
    Çok Kriterli Karar Verme (MCDM) süreçleri için FUCOM ve MARCOS algoritmaları.
    Bu sınıf akademik çalışmalar referans alınarak pratik kullanım için tasarlanmıştır.
    """

    @staticmethod
    def calculate_fucom(ranking: List[int], comparisons: List[float]) -> np.ndarray:
        """
        FUCOM yöntemi ile kriter ağırlıklarını hesaplar.
        """
        # Girdi kontrolü: Karşılaştırma sayısı, kriter sayısından 1 eksik olmalı
        if len(comparisons) != len(ranking) - 1:
            raise ValueError("Karşılaştırma (phi) değerlerinin sayısı, sıralama listesinden 1 eksik olmalıdır.")

        n = len(ranking)
        sorted_indices = np.argsort(ranking)
        
        # Payda hesaplaması (En az önemli kriterin ağırlığını bulmak için)
        denominator = 1.0
        for k in range(n - 1):
            product = 1.0
            for j in range(k, n - 1):
                product *= comparisons[j]
            denominator += product
        
        # Geriye dönük ağırlık hesaplaması
        w_last = 1.0 / denominator
        sorted_weights = np.zeros(n)
        sorted_weights[-1] = w_last
        
        for k in range(n - 2, -1, -1):
            sorted_weights[k] = sorted_weights[k + 1] * comparisons[k]
            
        # Ağırlıkları kullanıcının girdiği orijinal sıraya yerleştir
        final_weights = np.zeros(n)
        for i, original_idx in enumerate(sorted_indices):
            final_weights[original_idx] = sorted_weights[i]
            
        return final_weights

    @staticmethod
    def calculate_marcos(matrix: List[List[float]], weights: Union[List[float], np.ndarray], criteria_types: List[str]) -> Tuple[np.ndarray, np.ndarray]:
        """
        MARCOS yöntemi ile alternatifleri değerlendirir ve sıralar.
        """
        mat = np.array(matrix, dtype=float)
        num_alt, num_crit = mat.shape
        
        # Boyut kontrolü
        if num_crit != len(weights) or num_crit != len(criteria_types):
            raise ValueError("Matris sütun sayısı, ağırlık sayısı ve kriter tipleri (benefit/cost) birbiriyle eşleşmelidir.")
        
        # İdeal (AI) ve Anti-İdeal (AAI) değerleri bul
        ai, aai = np.zeros(num_crit), np.zeros(num_crit)
        
        for j in range(num_crit):
            col = mat[:, j]
            if criteria_types[j] == 'benefit':
                ai[j], aai[j] = np.max(col), np.min(col)
            elif criteria_types[j] == 'cost':
                ai[j], aai[j] = np.min(col), np.max(col)
            else:
                raise ValueError(f"Geçersiz kriter tipi: '{criteria_types[j]}'. Sadece 'benefit' veya 'cost' kullanın.")

        # Matrisi genişlet (En başa AAI, en sona AI ekle)
        extended_matrix = np.vstack([aai, mat, ai])
        norm_matrix = np.zeros_like(extended_matrix)
        
        # Normalizasyon işlemi
        for j in range(num_crit):
            if criteria_types[j] == 'benefit':
                norm_matrix[:, j] = extended_matrix[:, j] / ai[j]
            else:
                norm_matrix[:, j] = ai[j] / extended_matrix[:, j]
        
        # Ağırlıklandırılmış matris ve satır toplamları (Si)
        weighted_matrix = norm_matrix * weights
        s_values = np.sum(weighted_matrix, axis=1)
        
        s_aai = s_values[0]
        s_ai = s_values[-1]
        s_alternatives = s_values[1:-1]
        
        # Fayda dereceleri (K- ve K+)
        k_plus = s_alternatives / s_ai
        k_minus = s_alternatives / s_aai
        
        # Nihai fayda fonksiyonu f(K) hesabı
        f_k_plus = k_minus / (k_plus + k_minus)
        f_k_minus = k_plus / (k_plus + k_minus)
        
        # Sıfıra bölünme hatasını önlemek için küçük bir payda kontrolü (iyi bir pratiktir)
        f_k = (k_plus + k_minus) / (1 + ((1 - f_k_plus) / np.maximum(f_k_plus, 1e-10)) + ((1 - f_k_minus) / np.maximum(f_k_minus, 1e-10)))
        
        # Sıralama (En yüksek skor 1. sırayı alır)
        ranks = np.argsort(-f_k) + 1
        
        return f_k, ranks

# ==========================================
# ÖRNEK KULLANIM VE TEST ALANI
# ==========================================
if __name__ == "__main__":
    print("--- MCDM Analizi Başlıyor ---\n")

    # 1. Aşama: FUCOM ile Ağırlıkların Bulunması
    kriter_siralamasi = [1, 2, 3] # Önem sırasına göre kriterler
    kiyaslama_degerleri = [1.2, 1.5] # phi değerleri
    
    hesaplanan_agirliklar = MCDMCalculator.calculate_fucom(kriter_siralamasi, kiyaslama_degerleri)
    
    print("1. FUCOM Sonuçları:")
    print(f"Kriter Ağırlıkları: {np.round(hesaplanan_agirliklar, 4)}\n")

    # 2. Aşama: MARCOS ile Alternatiflerin Sıralanması
    # Dikkat: 3 kriterimiz var, o yüzden matriste her alternatifin 3 değeri olmalı
    karar_matrisi = [
        [80, 70, 90],  # Alternatif 1
        [90, 60, 80],  # Alternatif 2
        [75, 85, 85]   # Alternatif 3
    ]
    kriter_tipleri = ['benefit', 'cost', 'benefit']
    
    skorlar, siralamalar = MCDMCalculator.calculate_marcos(karar_matrisi, hesaplanan_agirliklar, kriter_tipleri)
    
    print("2. MARCOS Sonuçları:")
    for i, (skor, sira) in enumerate(zip(skorlar, siralamalar)):
        print(f"Alternatif {i+1} -> Skor: {skor:.4f} | Sıra: {sira}")
