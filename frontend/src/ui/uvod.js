// Úvodní obrazovka při spuštění (kostra je v index.html, aby byla vidět hned): ukazuje, co se právě připravuje,
// a zmizí, až je první pohled sestavený i s náhledy. Program tak naběhne hotový, ne po kouscích.

const uvod = () => document.getElementById('uvod');

/** Krok přípravy: text a jak daleko příprava je (0–1) */
export function krokUvodu(text, podil) {
    const u = uvod();
    if (!u) return;
    const krok = u.querySelector('.uvod-krok');
    const pruh = /** @type {HTMLElement | null} */ (u.querySelector('.uvod-pruh i'));
    if (krok) krok.textContent = text;
    if (pruh) pruh.style.width = `${Math.round(Math.min(Math.max(podil, 0.06), 1) * 100)}%`;
}

export function verzeUvodu(verze) {
    const v = uvod()?.querySelector('.uvod-verze');
    if (v && verze) v.textContent = `verze ${verze}`;
}

/** Schová úvod (zámek ukáže své okno; po odemčení se ukáže znovu) */
export function ukazatUvod(ukazat) {
    uvod()?.classList.toggle('skryty', !ukazat);
}

/** Konec úvodu: dojede pruh a obrazovka zmizí */
export function skrytUvod() {
    const u = uvod();
    if (!u) return;
    krokUvodu('Hotovo', 1);
    u.classList.add('skryty');
    setTimeout(() => u.remove(), 300);
}

// Obrázky, které jsou v okně vidět a ještě se nenačetly; počká na ně nejvýš do limitu (pomalý Disk úvod nezdrží)
export function pockatNaNahledy(limit) {
    const vyska = window.innerHeight;
    const cekajici = [...document.querySelectorAll('#app img')].filter((img) => {
        const i = /** @type {HTMLImageElement} */ (img);
        if (i.complete || !i.getAttribute('src')) return false;
        const r = i.getBoundingClientRect();
        return r.width > 0 && r.bottom > 0 && r.top < vyska;
    });
    if (!cekajici.length) return Promise.resolve();
    return Promise.race([
        Promise.all(cekajici.map(i => new Promise((hotovo) => {
            i.addEventListener('load', hotovo, { once: true });
            i.addEventListener('error', hotovo, { once: true });
        }))),
        new Promise(hotovo => setTimeout(hotovo, limit)),
    ]);
}
