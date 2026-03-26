// ============================================
// Depolama Modülü — localStorage ile veri saklama
// ============================================
// Uygulamanın tüm verilerini tarayıcının yerel deposunda (localStorage)
// JSON formatında saklar ve geri yükler.

const STORAGE_KEY = 'mcdm_thesis_data';

const StorageModule = (() => {

    /**
     * Varsayılan veri yapısını oluşturur.
     * 6 uzman, 9 kriter (tümü fayda tipi), 9 alternatif ile başlatılır.
     * FUCOM ve MARCOS dizileri daha sonra initFucom/initMarcos ile doldurulur.
     */
    const defaultData = () => ({
        experts: ['Uzman 1', 'Uzman 2', 'Uzman 3', 'Uzman 4', 'Uzman 5', 'Uzman 6'],
        criteria: [
            { name: 'Kriter 1', type: 'benefit' },
            { name: 'Kriter 2', type: 'benefit' },
            { name: 'Kriter 3', type: 'benefit' },
            { name: 'Kriter 4', type: 'benefit' },
            { name: 'Kriter 5', type: 'benefit' },
            { name: 'Kriter 6', type: 'benefit' },
            { name: 'Kriter 7', type: 'benefit' },
            { name: 'Kriter 8', type: 'benefit' },
            { name: 'Kriter 9', type: 'benefit' }
        ],
        alternatives: [
            'Alternatif 1', 'Alternatif 2', 'Alternatif 3',
            'Alternatif 4', 'Alternatif 5', 'Alternatif 6',
            'Alternatif 7', 'Alternatif 8', 'Alternatif 9'
        ],
        fucom: [],  // Her uzman için { ranking, comparisons } — initFucom() ile doldurulur
        marcos: []  // Her uzman için karar matrisi (alternatif × kriter) — initMarcos() ile doldurulur
    });

    /**
     * localStorage'dan veriyi yükler.
     * Eğer kayıtlı veri yoksa varsayılan yapıyı döndürür.
     * @returns {object} appData nesnesi
     */
    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                return JSON.parse(raw);
            }
        } catch (e) {
            console.warn('Depolama yükleme hatası:', e);
        }
        return defaultData();
    }

    /**
     * Veriyi localStorage'a kaydeder.
     * @param {object} data — appData nesnesi
     */
    function save(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Depolama kaydetme hatası:', e);
        }
    }

    /**
     * Tüm verileri sıfırlar ve varsayılan yapıyı döndürür.
     * @returns {object} Yeni varsayılan appData
     */
    function reset() {
        localStorage.removeItem(STORAGE_KEY);
        return defaultData();
    }

    /**
     * Her uzman için FUCOM veri yapısını başlatır.
     * Eğer mevcut veri yoksa veya uzman sayısı uyuşmuyorsa yeniden oluşturur.
     *
     * ranking[j]   : j. kritere atanan önem sırası (1 = en önemli)
     * comparisons[k]: Sıralamadaki ardışık kriterler arasındaki φ oranı (k. çift)
     *
     * @param {object} data — appData
     * @returns {object} FUCOM alanı güncellenmiş appData
     */
    function initFucom(data) {
        const numExperts = data.experts.length;
        const numCriteria = data.criteria.length;

        if (!data.fucom || data.fucom.length !== numExperts) {
            data.fucom = [];
            for (let e = 0; e < numExperts; e++) {
                data.fucom.push({
                    ranking: Array.from({ length: numCriteria }, (_, i) => i + 1),
                    comparisons: Array(numCriteria - 1).fill(1)
                });
            }
        }
        return data;
    }

    /**
     * Her uzman için MARCOS karar matrisini başlatır.
     * Eğer mevcut veri yoksa veya uzman sayısı uyuşmuyorsa yeniden oluşturur.
     * Matris boyutu: (alternatif sayısı) × (kriter sayısı), tüm değerler 1 ile başlatılır.
     *
     * @param {object} data — appData
     * @returns {object} MARCOS alanı güncellenmiş appData
     */
    function initMarcos(data) {
        const numExperts = data.experts.length;
        const numAlternatives = data.alternatives.length;
        const numCriteria = data.criteria.length;

        if (!data.marcos || data.marcos.length !== numExperts) {
            data.marcos = [];
            for (let e = 0; e < numExperts; e++) {
                const matrix = [];
                for (let a = 0; a < numAlternatives; a++) {
                    matrix.push(Array(numCriteria).fill(1));
                }
                data.marcos.push(matrix);
            }
        }
        return data;
    }

    return { load, save, reset, initFucom, initMarcos, defaultData };
})();
