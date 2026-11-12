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
    // posun místo šířky: přechod běží v kompozitoru a nepřepočítává rozvržení pod animovaným kruhem
    if (pruh) pruh.style.transform = `translateX(${Math.round(Math.min(Math.max(podil, 0.06), 1) * 100) - 100}%)`;
}

/** Tlačítko pod krokem (např. „Pokračovat bez čekání“); slib se splní kliknutím. Bez textu tlačítko odebere. */
export function tlacitkoUvodu(text) {
    const u = uvod();
    u?.querySelector('.uvod-tlacitko')?.remove();
    if (!u || !text) return new Promise(() => {});
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'uvod-tlacitko';
    b.textContent = text;
    (u.querySelector('.uvod-obsah') || u).append(b);
    return new Promise(hotovo => b.addEventListener('click', () => { b.remove(); hotovo(); }, { once: true }));
}

/** Kroky přípravy: [[klíč, název], …]; všechny čekají. Na úvodu jsou jen jako řada teček (název v bublině),
 *  co se právě děje, říká jeden řádek pod pruhem a podrobnost pod ním – výpis se nehromadí pod sebou. */
const nazvyKroku = new Map();
export function seznamUvodu(kroky) {
    const ol = uvod()?.querySelector('.uvod-seznam');
    if (!ol) return;
    nazvyKroku.clear();
    ol.replaceChildren(...kroky.map(([klic, nazev]) => {
        nazvyKroku.set(klic, nazev);
        const li = document.createElement('li');
        li.className = 'ceka';
        li.dataset.krok = klic;
        li.title = nazev;
        li.setAttribute('aria-label', nazev);
        return li;
    }));
    const zacatek = performance.now();
    const cas = uvod()?.querySelector('.uvod-cas');
    const tik = () => {
        if (!cas?.isConnected) return;
        const hotovych = ol.querySelectorAll('li.hotovo, li.preskoceno, li.chyba').length;
        cas.textContent = `${hotovych} / ${kroky.length} · ${((performance.now() - zacatek) / 1000).toFixed(1).replace('.', ',')} s`;
        setTimeout(tik, 100);
    };
    tik();
}

const ZNACKY = { hotovo: '✓ ', preskoceno: '– ', chyba: '! ', bezi: '' };

/** Stav kroku: 'ceka' | 'bezi' | 'hotovo' | 'preskoceno' | 'chyba'; detail = podrobnost (počet, průběh) */
export function stavUvodu(klic, stavKroku, detail) {
    const li = uvod()?.querySelector(`.uvod-seznam [data-krok="${klic}"]`);
    if (!li) return;
    li.className = stavKroku;
    const nazev = nazvyKroku.get(klic) || '';
    if (detail !== undefined) li.dataset.detail = detail;
    const d = li.dataset.detail || (stavKroku === 'preskoceno' ? 'přeskočeno' : '');
    li.title = d ? `${nazev} · ${d}` : nazev;
    const radek = uvod()?.querySelector('.uvod-detail');
    if (radek && stavKroku in ZNACKY) radek.textContent = `${ZNACKY[stavKroku]}${nazev}${d ? ` · ${d}` : ''}`;
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

// Profilovky pro kruh na úvodní obrazovce příštího spuštění (public/uvod-start.js): náhodný výběr modelek s titulní
// fotkou, adresa přesně jako na kartě galerie (bývá v mezipaměti WebKitu) a výřez titulní fotky. Obrázky se rovnou
// načtou na pozadí, aby příště byly v mezipaměti. Se zámkem se profilovky neukládají (úvod je vidět před heslem).
const KLIC_PROFILOVEK = 'uvodProfilovky';
const POCET_PROFILOVEK = 14;
const NEJMENE_PROFILOVEK = 4;
const KANDIDATU = 24;
// Uloží se jen fotky, které se opravdu načetly (rozdělaná modelka může mít adresu titulní fotky, ze které nic
// nepřijde – v kruhu by pak byla jen šedá dlaždice); když se jich načte málo (bez připojení), zůstane minulý výběr
export function ulozitProfilovkyUvodu(modelky, adresaTitulni) {
    const sFotkou = modelky.filter(m => m.coverUrl && !adresaTitulni(m).startsWith('data:'));
    for (let i = sFotkou.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sFotkou[i], sFotkou[j]] = [sFotkou[j], sFotkou[i]];
    }
    const kandidati = sFotkou.slice(0, KANDIDATU).map(m => ({
        u: adresaTitulni(m), x: m.coverX ?? 50, y: m.coverY ?? 50, z: m.coverZoom || 1,
    }));
    const overit = p => new Promise((hotovo) => {
        const img = new Image();
        img.decoding = 'async';
        const konec = ok => () => hotovo(ok && img.naturalWidth > 1 ? p : null);
        img.onload = konec(true);
        img.onerror = konec(false);
        setTimeout(konec(false), 20000);
        img.src = p.u;
    });
    return Promise.all(kandidati.map(overit)).then((vysledky) => {
        const seznam = vysledky.filter(Boolean).slice(0, POCET_PROFILOVEK);
        if (seznam.length < NEJMENE_PROFILOVEK) return;
        try { localStorage.setItem(KLIC_PROFILOVEK, JSON.stringify(seznam)); } catch { /* jen pro toto spuštění */ }
    });
}
export function zapomenoutProfilovkyUvodu() {
    try { localStorage.removeItem(KLIC_PROFILOVEK); } catch { /* nic uloženo */ }
}
