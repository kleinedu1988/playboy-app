// Prohlížeč stran článku: skeny jako rozevřený časopis (dvojstrana) nebo po jedné straně, dole pás náhledů
import { esc, nazevVydani, obrazek } from '../lib/format';
import { VELIKOST_NAHLEDU } from './obrazky';

// Sken se čte, potřebuje víc než plakát; Disk bez přípony dá nejvýše 1600 px, w2000 si řekne o víc
const VELIKOST_STRANY = 'w2000';

const ctecka = document.getElementById('ctecka');
const plocha = document.getElementById('cteckaStrana');
const pas = document.getElementById('cteckaPas');

let clanek = null;
let skupiny = [];
let aktualni = 0;
let rezim = 2;

// Číslo strany skenu; bez známé první strany jen pořadí
const cisloStrany = i => clanek.strana ? clanek.strana + i : 0;

// Skupiny stran podle rozložení. V časopise jsou liché strany vpravo: článek začínající lichou stranou
// má první sken samostatně (vpravo), dál jdou dvojice sudá + lichá.
function sestavitSkupiny() {
    const pocet = clanek.skenyUrl.length;
    skupiny = [];
    if (rezim === 1) {
        for (let i = 0; i < pocet; i++) skupiny.push([i]);
        return;
    }
    let i = 0;
    if (clanek.strana % 2 === 1) skupiny.push([i++]);
    for (; i < pocet; i += 2) skupiny.push(i + 1 < pocet ? [i, i + 1] : [i]);
}

const popisStran = indexy => {
    const cisla = indexy.map(i => cisloStrany(i) || i + 1);
    return cisla.length > 1 ? `${cisla[0]}–${cisla.at(-1)}` : `${cisla[0]}`;
};

function vykreslit() {
    const indexy = skupiny[aktualni];
    const pocet = clanek.skenyUrl.length;
    const rozsah = clanek.strana ? `z ${clanek.strana}–${clanek.strana + pocet - 1}` : `z ${pocet}`;
    document.getElementById('cteckaStrany').textContent =
        `${nazevVydani(clanek.vydani)} · ${indexy.length > 1 ? 'strany' : clanek.strana ? 'strana' : 'sken'} ${popisStran(indexy)} ${rozsah}`;
    plocha.className = `ctecka-dvojstrana ${indexy.length > 1 ? 'dve' : 'jedna'}`;
    plocha.innerHTML = indexy.map(i => `
        <figure><img src="${esc(obrazek(clanek.skenyUrl[i], VELIKOST_STRANY))}" alt="Strana ${cisloStrany(i) || i + 1}" draggable="false" />
            <figcaption>${cisloStrany(i) || ''}</figcaption></figure>`).join('');
    pas.querySelectorAll('[data-skupina]').forEach(b => b.classList.toggle('active', parseInt(b.dataset.skupina) === aktualni));
    pas.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    ctecka.querySelector('[data-krok-ctecky="-1"]').toggleAttribute('disabled', aktualni === 0);
    ctecka.querySelector('[data-krok-ctecky="1"]').toggleAttribute('disabled', aktualni === skupiny.length - 1);
}

function prestavet(index = skupiny[aktualni]?.[0] || 0) {
    sestavitSkupiny();
    aktualni = Math.max(0, skupiny.findIndex(s => s.includes(index)));
    ctecka.querySelectorAll('[data-rezim-ctecky]').forEach(b => b.classList.toggle('active', parseInt(b.dataset.rezimCtecky) === rezim));
    pas.innerHTML = skupiny.map((s, k) => `
        <button type="button" data-skupina="${k}" title="${s.length > 1 ? 'Strany' : 'Strana'} ${popisStran(s)}">
            ${s.map(i => `<img src="${esc(obrazek(clanek.skenyUrl[i], VELIKOST_NAHLEDU))}" alt="" loading="lazy" draggable="false" />`).join('')}
        </button>`).join('');
    vykreslit();
}

// Otevření na skenu s daným pořadím
export function otevritCtecku(c, index = 0) {
    if (!c?.skenyUrl?.length) return;
    clanek = c;
    document.getElementById('cteckaNazev').textContent = c.nazev;
    ctecka.classList.remove('hidden');
    prestavet(index);
    // Fokus na okno, ne na první tlačítko: šipky listují a žádná volba nevypadá zvolená
    ctecka.focus();
}

function krok(smer) {
    const novy = Math.min(skupiny.length - 1, Math.max(0, aktualni + smer));
    if (novy === aktualni) return;
    aktualni = novy;
    vykreslit();
}

function nastavitRezim(novy) {
    if (novy === rezim) return;
    rezim = novy;
    try { localStorage.setItem('rezimCtecky', String(rezim)); } catch { /* jen se nezapamatuje */ }
    prestavet();
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    try { rezim = localStorage.getItem('rezimCtecky') === '1' ? 1 : 2; } catch { /* dvojstrana */ }

    ctecka.addEventListener('click', (e) => {
        const sipka = e.target.closest('[data-krok-ctecky]');
        const skupina = e.target.closest('[data-skupina]');
        const volba = e.target.closest('[data-rezim-ctecky]');
        if (sipka) krok(parseInt(sipka.dataset.krokCtecky));
        else if (skupina) {
            aktualni = parseInt(skupina.dataset.skupina);
            vykreslit();
        } else if (volba) nastavitRezim(parseInt(volba.dataset.rezimCtecky));
        // Klik na stranu listuje: levá polovina zpět, pravá dál
        else if (e.target.closest('#cteckaStrana img')) {
            const r = plocha.getBoundingClientRect();
            krok(e.clientX < r.left + r.width / 2 ? -1 : 1);
        }
    });

    // Šipky, PageUp/PageDown, Home/End, 1 a 2 přepínají rozložení; Esc zavře (jako každé okno)
    document.addEventListener('keydown', (e) => {
        if (ctecka.classList.contains('hidden') || e.ctrlKey || e.altKey || e.metaKey) return;
        if (document.querySelector('.modal-overlay:not(.hidden):not(#ctecka)')) return;
        const kroky = { ArrowLeft: -1, ArrowRight: 1, PageUp: -1, PageDown: 1, ' ': 1, Home: -Infinity, End: Infinity };
        if (e.key in kroky) {
            e.preventDefault();
            e.stopPropagation();
            const k = kroky[e.key];
            if (Math.abs(k) === Infinity) {
                aktualni = k < 0 ? 0 : skupiny.length - 1;
                vykreslit();
            } else krok(e.shiftKey && e.key === ' ' ? -1 : k);
        } else if (e.key === '1' || e.key === '2') nastavitRezim(parseInt(e.key));
    }, true);
}
