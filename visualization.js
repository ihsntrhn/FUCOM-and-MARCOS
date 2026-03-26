// ============================================
// Görselleştirme Modülü — Chart.js ile grafik oluşturma
// ============================================
// FUCOM kriter ağırlıkları ve MARCOS alternatif sıralamasını
// görsel olarak sunan grafikleri oluşturur ve yönetir.

const Visualization = (() => {

    let fucomChart = null;  // FUCOM ağırlık grafiği referansı
    let marcosChart = null; // MARCOS sıralama grafiği referansı

    // Kriter ağırlıkları için renk paleti (mor tonları)
    const COLORS = [
        '#4f46e5', '#7c3aed', '#6366f1', '#8b5cf6',
        '#a78bfa', '#4338ca', '#5b21b6', '#818cf8', '#c4b5fd'
    ];

    // Alternatif sıralaması için renk paleti (canlı tonlar)
    const COLORS_BRIGHT = [
        '#d97706', '#16a34a', '#2563eb', '#dc2626',
        '#7c3aed', '#db2777', '#0d9488', '#ea580c', '#0891b2'
    ];

    /**
     * Mevcut grafikleri yok eder.
     * Yeni verilerle yeniden oluşturmadan önce çağrılmalıdır.
     */
    function destroyCharts() {
        if (fucomChart) { fucomChart.destroy(); fucomChart = null; }
        if (marcosChart) { marcosChart.destroy(); marcosChart = null; }
    }

    /**
     * FUCOM birleştirilmiş kriter ağırlıklarını dikey çubuk grafiği olarak gösterir.
     * Y ekseni yüzde (%), X ekseni kriter isimleri.
     *
     * @param {string[]}   criteriaNames — Kriter isimleri
     * @param {number[]}   finalWeights  — Birleştirilmiş ağırlıklar
     * @param {number[][]} expertWeights — Her uzmanın ağırlıkları (ileride kullanılabilir)
     */
    function renderFucomChart(criteriaNames, finalWeights, expertWeights) {
        const ctx = document.getElementById('chartFucomWeights');
        if (!ctx) return;

        if (fucomChart) fucomChart.destroy();

        const datasets = [{
            label: 'Birleştirilmiş Ağırlık',
            data: finalWeights.map(w => +(w * 100).toFixed(2)),
            backgroundColor: COLORS.map(c => c + 'cc'),
            borderColor: COLORS,
            borderWidth: 2,
            borderRadius: 6,
            barPercentage: 0.7
        }];

        fucomChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: criteriaNames,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: '#4b5068', font: { family: 'Inter', size: 12 } }
                    },
                    tooltip: {
                        backgroundColor: '#ffffff',
                        titleColor: '#1a1d2e',
                        bodyColor: '#4b5068',
                        borderColor: 'rgba(0,0,0,0.1)',
                        borderWidth: 1,
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: %${ctx.raw.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#4b5068', font: { family: 'Inter', size: 11 } },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    y: {
                        ticks: {
                            color: '#4b5068',
                            font: { family: 'Inter', size: 11 },
                            callback: val => '%' + val
                        },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    }
                }
            }
        });
    }

    /**
     * MARCOS f(K_i) skorlarını yatay çubuk grafiği olarak gösterir.
     * Alternatifler sıralamasına göre (1. sıra en üstte) düzenlenir.
     *
     * @param {string[]} alternativeNames — Alternatif isimleri
     * @param {number[]} fK              — Her alternatifin f(K_i) skoru
     * @param {number[]} ranks           — Her alternatifin sıralama numarası
     */
    function renderMarcosChart(alternativeNames, fK, ranks) {
        const ctx = document.getElementById('chartMarcosRanking');
        if (!ctx) return;

        if (marcosChart) marcosChart.destroy();

        // f(K_i) değerine göre sırala (en yüksek = 1. sıra)
        const sorted = fK
            .map((val, idx) => ({ name: alternativeNames[idx], val, rank: ranks[idx] }))
            .sort((a, b) => a.rank - b.rank);

        marcosChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(s => s.name),
                datasets: [{
                    label: 'f(Ki) Skoru',
                    data: sorted.map(s => +s.val.toFixed(4)),
                    backgroundColor: sorted.map((_, i) => COLORS_BRIGHT[i % COLORS_BRIGHT.length] + 'cc'),
                    borderColor: sorted.map((_, i) => COLORS_BRIGHT[i % COLORS_BRIGHT.length]),
                    borderWidth: 2,
                    borderRadius: 6,
                    barPercentage: 0.65
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#ffffff',
                        titleColor: '#1a1d2e',
                        bodyColor: '#4b5068',
                        borderColor: 'rgba(0,0,0,0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#4b5068', font: { family: 'Inter', size: 11 } },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    y: {
                        ticks: { color: '#1a1d2e', font: { family: 'Inter', size: 12 } },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    return { renderFucomChart, renderMarcosChart, destroyCharts };
})();
