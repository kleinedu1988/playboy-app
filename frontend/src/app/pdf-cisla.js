// Prohlížeč PDF čísla (⋯ › Otevřít PDF čísla…, 0.02.035): pdf.js v rozhraní (načte se až při prvním otevření),
// soubor vybraný v dialogu vydá Go na /pdf/<token> (pdf_cisla.go). Vlevo náhledy stran (kreslí se, až se ukážou),
// vpravo strana nebo dvoustrana přizpůsobená oknu, lupa. Klávesy: ←/→ a PageUp/PageDown listují, Home/End,
// +/− lupa, 0 přizpůsobit, D dvoustrana, Esc zavře. Označování stran a export pro Disk jsou další kroky (0.02.037+).
import { VybratPDF } from './backend';
import { dalsiLupa, dalsiZobrazeni, meritkoZobrazeni, stranyZobrazeni } from '../lib/pdf-cisla';
import { drzetFokus } from '../ui/dom';
import { oznamit } from '../ui/oznameni';

/** @type {any} */
let pdfjs = null;
async function nacistPdfjs() {
    if (pdfjs) return pdfjs;
    pdfjs = await import('pdfjs-dist');
    // @ts-ignore – adresa workeru od Vite
    const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    return pdfjs;
}

/** @type {HTMLElement | null} */
let okno = null;
/** @type {any} */
let dokument = null;
let nazev = '';
let strana = 1;
let dvoustrana = true;
let lupa = 1;
/** @type {{ sirka: number, vyska: number }[]} */
let rozmery = [];
/** @type {any[]} */
let kresleni = [];
let poradiKresleni = 0;
/** @type {IntersectionObserver | null} */
let pozorovatel = null;

const SIRKA_NAHLEDU = 112;

function vytvoritOkno() {
    okno = document.createElement('div');
    okno.className = 'pdf-okno hidden';
    okno.setAttribute('role', 'dialog');
    okno.setAttribute('aria-modal', 'true');
    okno.setAttribute('aria-label', 'PDF čísla');
    okno.tabIndex = -1;
    okno.innerHTML = `<header class="pdf-lista">
            <b class="pdf-nazev" data-pdf-nazev></b>
            <span class="pdf-strana" data-pdf-strana aria-live="polite"></span>
            <span class="pdf-mezera"></span>
            <button type="button" class="btn btn-secondary btn-small" data-pdf-dvoustrana aria-pressed="true" title="Dvoustrana (D)">Dvoustrana</button>
            <button type="button" class="btn btn-secondary btn-small" data-pdf-lupa="-1" aria-label="Zmenšit (−)">−</button>
            <button type="button" class="btn btn-secondary btn-small pdf-lupa" data-pdf-prizpusobit title="Přizpůsobit oknu (0)"></button>
            <button type="button" class="btn btn-secondary btn-small" data-pdf-lupa="1" aria-label="Zvětšit (+)">+</button>
            <button type="button" class="btn btn-secondary btn-small" data-pdf-jine>Otevřít jiné…</button>
            <button type="button" class="btn btn-secondary btn-small" data-pdf-zavrit aria-label="Zavřít (Esc)">✕</button>
        </header>
        <div class="pdf-telo">
            <nav class="pdf-nahledy" data-pdf-nahledy aria-label="Strany"></nav>
            <div class="pdf-plocha" data-pdf-plocha>
                <button type="button" class="pdf-sipka pdf-sipka-zpet" data-pdf-listovat="-1" aria-label="Předchozí (←)">‹</button>
                <div class="pdf-strany" data-pdf-strany></div>
                <button type="button" class="pdf-sipka pdf-sipka-dal" data-pdf-listovat="1" aria-label="Další (→)">›</button>
            </div>
        </div>`;
    document.body.append(okno);
    drzetFokus(okno);
    okno.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target).closest('button');
        if (!t) return;
        if (t.dataset.pdfZavrit !== undefined) zavrit();
        else if (t.dataset.pdfJine !== undefined) otevritPdfCisla();
        else if (t.dataset.pdfDvoustrana !== undefined) prepnoutDvoustranu();
        else if (t.dataset.pdfPrizpusobit !== undefined) nastavitLupu(1);
        else if (t.dataset.pdfLupa) nastavitLupu(dalsiLupa(lupa, Number(t.dataset.pdfLupa)));
        else if (t.dataset.pdfListovat) jitNa(dalsiZobrazeni(strana, rozmery.length, dvoustrana, Number(t.dataset.pdfListovat) > 0 ? 1 : -1));
        else if (t.dataset.pdfNa) jitNa(Number(t.dataset.pdfNa));
    });
    okno.addEventListener('keydown', (e) => {
        if (e.target instanceof HTMLInputElement) return;
        const pocet = rozmery.length;
        const akce = {
            ArrowRight: () => jitNa(dalsiZobrazeni(strana, pocet, dvoustrana, 1)), PageDown: () => jitNa(dalsiZobrazeni(strana, pocet, dvoustrana, 1)),
            ArrowLeft: () => jitNa(dalsiZobrazeni(strana, pocet, dvoustrana, -1)), PageUp: () => jitNa(dalsiZobrazeni(strana, pocet, dvoustrana, -1)),
            Home: () => jitNa(1), End: () => jitNa(pocet), Escape: zavrit,
            '+': () => nastavitLupu(dalsiLupa(lupa, 1)), '=': () => nastavitLupu(dalsiLupa(lupa, 1)), '-': () => nastavitLupu(dalsiLupa(lupa, -1)),
            0: () => nastavitLupu(1), d: prepnoutDvoustranu, D: prepnoutDvoustranu,
        }[e.key];
        if (!akce || e.ctrlKey || e.altKey || e.metaKey) return;
        e.preventDefault();
        e.stopPropagation();
        akce();
    });
    // Ctrl + kolečko = lupa
    okno.querySelector('[data-pdf-plocha]').addEventListener('wheel', (e) => {
        const k = /** @type {WheelEvent} */ (e);
        if (!k.ctrlKey) return;
        k.preventDefault();
        nastavitLupu(dalsiLupa(lupa, k.deltaY < 0 ? 1 : -1));
    }, { passive: false });
    window.addEventListener('resize', () => { if (dokument && !okno.classList.contains('hidden')) vykreslitStrany(); });
}

function zavrit() {
    okno?.classList.add('hidden');
    pozorovatel?.disconnect();
    kresleni.forEach(k => k.cancel?.());
    dokument?.destroy();
    dokument = null;
}

function prepnoutDvoustranu() {
    dvoustrana = !dvoustrana;
    okno.querySelector('[data-pdf-dvoustrana]').setAttribute('aria-pressed', String(dvoustrana));
    vykreslitStrany();
}

function nastavitLupu(l) {
    lupa = l;
    vykreslitStrany();
}

function jitNa(s) {
    strana = stranyZobrazeni(s, rozmery.length, dvoustrana)[0] || 1;
    vykreslitStrany();
}

// Strana do plátna v měřítku (body PDF → CSS px), ostře podle hustoty displeje; vrací úlohu pdf.js
async function nakreslit(cislo, platno, meritko) {
    const page = await dokument.getPage(cislo);
    const viewport = page.getViewport({ scale: meritko });
    const hustota = window.devicePixelRatio || 1;
    platno.width = Math.floor(viewport.width * hustota);
    platno.height = Math.floor(viewport.height * hustota);
    platno.style.width = `${Math.floor(viewport.width)}px`;
    platno.style.height = `${Math.floor(viewport.height)}px`;
    const uloha = page.render({ canvasContext: platno.getContext('2d'), viewport, transform: hustota !== 1 ? [hustota, 0, 0, hustota, 0, 0] : undefined });
    return uloha;
}

async function vykreslitStrany() {
    if (!dokument || !okno) return;
    const poradi = ++poradiKresleni;
    kresleni.forEach(k => k.cancel?.());
    kresleni = [];
    const cisla = stranyZobrazeni(strana, rozmery.length, dvoustrana);
    const plocha = /** @type {HTMLElement} */ (okno.querySelector('[data-pdf-plocha]'));
    const meritko = meritkoZobrazeni(cisla.map(c => rozmery[c - 1]), plocha.clientWidth - 24, plocha.clientHeight - 24, lupa);
    const kontejner = okno.querySelector('[data-pdf-strany]');
    const platna = cisla.map(c => Object.assign(document.createElement('canvas'), { className: 'pdf-platno', ariaLabel: `Strana ${c}` }));
    kontejner.replaceChildren(...platna);
    kontejner.classList.toggle('pdf-vetsi', lupa > 1);
    okno.querySelector('[data-pdf-strana]').textContent = `${cisla.length > 1 ? `strany ${cisla.join('–')}` : `strana ${cisla[0]}`} z ${rozmery.length}`;
    okno.querySelector('.pdf-lupa').textContent = `${Math.round(lupa * 100)} %`;
    okno.querySelectorAll('[data-pdf-na]').forEach(b => b.classList.toggle('aktivni', cisla.includes(Number(/** @type {HTMLElement} */ (b).dataset.pdfNa))));
    okno.querySelector('.pdf-nahled.aktivni')?.scrollIntoView({ block: 'nearest' });
    for (let i = 0; i < cisla.length; i++) {
        if (poradi !== poradiKresleni) return;
        try {
            const uloha = await nakreslit(cisla[i], platna[i], meritko);
            kresleni.push(uloha);
            await uloha.promise;
        } catch (e) {
            if (e?.name !== 'RenderingCancelledException') console.warn('PDF strana', e);
        }
    }
}

// Náhledy stran: tlačítka hned, obrázek až když se náhled ukáže (200 stran se nekreslí naráz)
function vytvoritNahledy() {
    const seznam = okno.querySelector('[data-pdf-nahledy]');
    pozorovatel?.disconnect();
    pozorovatel = new IntersectionObserver((zaznamy) => {
        for (const z of zaznamy) {
            if (!z.isIntersecting) continue;
            const b = /** @type {HTMLElement} */ (z.target);
            pozorovatel.unobserve(b);
            const c = Number(b.dataset.pdfNa);
            const platno = b.querySelector('canvas');
            const r = rozmery[c - 1];
            nakreslit(c, platno, SIRKA_NAHLEDU / r.sirka).then(u => u.promise).catch(() => {});
        }
    }, { root: seznam, rootMargin: '400px 0px' });
    seznam.innerHTML = rozmery.map((r, i) => `<button type="button" class="pdf-nahled" data-pdf-na="${i + 1}" aria-label="Strana ${i + 1}">
        <canvas style="width:${SIRKA_NAHLEDU}px;height:${Math.round(SIRKA_NAHLEDU * r.vyska / r.sirka)}px"></canvas><small>${i + 1}</small></button>`).join('');
    seznam.querySelectorAll('.pdf-nahled').forEach(b => pozorovatel.observe(b));
}

export async function otevritPdfCisla() {
    const vybrane = await VybratPDF();
    if (!vybrane?.adresa) return;
    if (!okno) vytvoritOkno();
    const zacatek = performance.now();
    oznamit(`Otevírám ${vybrane.nazev}…`);
    try {
        const p = await nacistPdfjs();
        const data = await (await fetch(vybrane.adresa)).arrayBuffer();
        const novy = await p.getDocument({ data }).promise;
        zavrit();
        dokument = novy;
        nazev = vybrane.nazev;
        // Rozměry všech stran předem (rychlé, bez kreslení): náhledy mají správnou výšku hned
        rozmery = [];
        for (let i = 1; i <= dokument.numPages; i++) {
            const v = (await dokument.getPage(i)).getViewport({ scale: 1 });
            rozmery.push({ sirka: v.width, vyska: v.height });
        }
    } catch (e) {
        console.warn('PDF', e);
        oznamit(`PDF „${vybrane.nazev}“ se nepodařilo otevřít.`);
        return;
    }
    strana = 1;
    lupa = 1;
    okno.querySelector('[data-pdf-nazev]').textContent = nazev;
    okno.classList.remove('hidden');
    okno.focus();
    vytvoritNahledy();
    await vykreslitStrany();
    const sekund = (performance.now() - zacatek) / 1000;
    oznamit(`${nazev}: ${rozmery.length} stran, otevřeno za ${sekund.toFixed(1).replace('.', ',')} s.`);
}
