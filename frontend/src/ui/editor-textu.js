// Společné okno pro psaní textu v markdownu (průvodní text alba, text článku, poznámky). Samotný editor
// (editor-textu-cm.js s CodeMirrorem) je přes polovinu skriptů programu, a tak se načte až při prvním otevření okna;
// start programu ho nemusí číst. Najetí myší nebo fokus na tlačítko, které okno otevírá (data-editor-textu),
// ho začne načítat předem, takže okno se otevře bez čekání.

/** @type {Promise<typeof import('./editor-textu-cm')>|null} */
let modul = null;
function nacist() {
    modul ||= import('./editor-textu-cm').then((m) => {
        m.pripravit();
        return m;
    }, (chyba) => {
        // Nepovedené načtení se při dalším otevření zkusí znovu
        modul = null;
        throw chyba;
    });
    return modul;
}

/**
 * Otevře okno s textem; vrátí upravený text (Použít), nebo null (Zrušit, Esc).
 * mluvci: text článku (perex a mluvčí se ukazují jako ve čtečce)
 * @param {{ nadpis?: string, text?: string, napoveda?: string, zastupny?: string, mluvci?: boolean }} moznosti
 * @returns {Promise<string|null>}
 */
export async function upravitText(moznosti = {}) {
    return (await nacist()).upravitText(moznosti);
}

// Načítání předem; volá ho main.js po načtení všech modulů
export function pripravit() {
    const predem = (e) => {
        if (!/** @type {Element} */ (e.target).closest?.('[data-editor-textu]')) return;
        document.removeEventListener('pointerover', predem);
        document.removeEventListener('focusin', predem);
        nacist().catch(() => { /* chybu ukáže až otevření okna */ });
    };
    document.addEventListener('pointerover', predem, { passive: true });
    document.addEventListener('focusin', predem);
}
