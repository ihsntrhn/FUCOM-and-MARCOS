#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Max ve Min hesaplamaları için pratik makrolar
#define MAX(a, b) ((a) > (b) ? (a) : (b))
#define MIN(a, b) ((a) < (b) ? (a) : (b))

// Kriter Tipleri (0: Maliyet, 1: Fayda)
typedef enum {
    COST = 0,
    BENEFIT = 1
} CriteriaType;

// MARCOS Sonuçlarını tutmak için yapı (Struct)
typedef struct {
    double* scores;
    int* ranks;
    int num_alt;
} MarcosResult;

/* ==========================================
 * FUCOM ALGORİTMASI
 * ========================================== */
double* calculate_fucom(const int* ranking, const double* comparisons, int n) {
    // Ağırlıklar için dinamik bellek tahsisi
    double* final_weights = (double*)malloc(n * sizeof(double));
    double* sorted_weights = (double*)malloc(n * sizeof(double));
    int* sorted_indices = (int*)malloc(n * sizeof(int));

    if (!final_weights || !sorted_weights || !sorted_indices) {
        printf("Hata: Bellek tahsis edilemedi!\n");
        exit(1);
    }

    // İndeksleri sıralamak için başlangıç değerlerini ata
    for (int i = 0; i < n; i++) sorted_indices[i] = i;

    // Kriterleri önem sırasına göre indeksle (Basit Bubble Sort)
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (ranking[sorted_indices[j]] > ranking[sorted_indices[j + 1]]) {
                int temp = sorted_indices[j];
                sorted_indices[j] = sorted_indices[j + 1];
                sorted_indices[j + 1] = temp;
            }
        }
    }

    // Payda hesaplaması (En az önemli kriterin
