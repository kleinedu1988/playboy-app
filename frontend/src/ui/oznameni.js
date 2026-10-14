// Oznámení dole v okně a ochrana formulářů proti dvojímu odeslání

// Krátké oznámení dole v okně; s akcí zůstane, dokud ho uživatel nezavře
let toastCasovac = null;
let infoCasovac = null;

export function oznamit(text, akce = null) {
    const toast = document.getElementById('toast');
    // Oznámení s akcí (Vrátit) se nesmí přepsat obyčejným oznámením: to se ukáže zvlášť nad ním
    if (!akce && !toast.classList.contains('hidden') && !document.getElementById('toastAction').classList.contains('hidden')) {
        const info = document.getElementById('toastInfo');
        document.getElementById('toastInfoText').textContent = text;
        info.classList.remove('hidden');
        clearTimeout(infoCasovac);
        infoCasovac = setTimeout(() => info.classList.add('hidden'), 7000);
        return;
    }
    const tlacitko = document.getElementById('toastAction');
    document.getElementById('toastText').textContent = text;
    tlacitko.classList.toggle('hidden', !akce);
    if (akce) {
        tlacitko.textContent = akce.text;
        tlacitko.onclick = () => {
            toast.classList.add('hidden');
            akce.akce();
        };
    }
    toast.classList.remove('hidden');
    clearTimeout(toastCasovac);
    if (!akce) toastCasovac = setTimeout(() => toast.classList.add('hidden'), 7000);
}
// Volá se po vložení kostry okna
export function pripravitOznameni() {
    document.getElementById('toastClose').onclick = () => document.getElementById('toast').classList.add('hidden');
}

// Dokud obsluha běží, další odeslání téhož formuláře se ignoruje a jeho tlačítko je vypnuté.
// Ukládání čeká na ověření odkazů po síti; druhý klik by jinak vložil fotky nebo modelku dvakrát.
export function jednou(obsluha) {
    let bezi = false;
    return async (e) => {
        e?.preventDefault();
        if (bezi) return;
        const zdroj = e?.currentTarget;
        const tlacitko = e?.submitter || (zdroj?.tagName === 'BUTTON' ? zdroj : zdroj?.querySelector('[type="submit"]'));
        bezi = true;
        if (tlacitko) tlacitko.disabled = true;
        try {
            await obsluha(e);
        } finally {
            bezi = false;
            if (tlacitko) tlacitko.disabled = false;
        }
    };
}

