// Filtry v Modelkách jako štítky v kapsli hledání (přepracování filtru, krok 2). Jediný zdroj pravdy je text dotazu:
// příkazy, které zná model filtru (lib/dimenze.js: vlasy:, rok:, hodnoceni:…), se po dopsání (mezera, Enter) změní ve
// štítky; v poli zůstane jen volný text. searchInput.value v Modelkách vrací celý dotaz (štítky + text), takže
// načítání galerie, přepínání přehledů i Zpět pracují s textem jako dřív; zápis do value text rozdělí zpět na štítky.
// Klik na štítek nebo na tlačítko v řádku rychlých filtrů pod kapslí otevře editor (je / není, hodnoty s počty, rozsah).
import { bezDiakritiky, esc, rozlozitDotaz, sklonovat } from '../lib/format';
import { fasety, parsovat, serializovat } from '../lib/filtr';
import { DIMENZE_MODELEK, textyModelky } from '../lib/dimenze';
import { vsechnyModelky } from './mezipamet';
import { searchInput } from './prvky';
import { stav } from './stav';

const nativni = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
let stitky = []; // podmínky filtru (lib/filtr.js), jedna na dimenzi a negaci
const aktivni = () => stav.rezim === 'modelky';
const dimenze = klic => DIMENZE_MODELEK.find(d => d.klic === klic);

export const nativniText = () => nativni.get.call(searchInput);
export function nastavitNativniText(text) {
    nativni.set.call(searchInput, text);
}
const textStitku = p => serializovat({ podminky: [p], volne: [] });

// Celý dotaz Modelek: štítky a volný text z pole
Object.defineProperty(searchInput, 'value', {
    configurable: true,
    get() {
        const text = nativni.get.call(this);
        if (!aktivni() || !stitky.length) return text;
        return [stitky.map(textStitku).join(' '), text].filter(s => s.trim()).join(' ');
    },
    set(hodnota) {
        if (!aktivni()) {
            nativni.set.call(this, hodnota);
            return;
        }
        stitky = [];
        nativni.set.call(this, vyjmoutPrikazy(String(hodnota ?? ''), true));
        vykreslit();
    },
});

// Přidá podmínku ke štítkům: stejná dimenze a negace se slučuje (vlasy:blond + vlasy:zrzavá = vlasy:blond,zrzavá),
// rozsah a srdíčka nahrazují předchozí
function pridatPodminku(p) {
    const d = dimenze(p.klic);
    const stejny = stitky.find(s => s.klic === p.klic && s.negace === p.negace);
    if (stejny && d?.typ === 'text') {
        const nove = p.hodnoty.filter(h => !stejny.hodnoty.some(x => bezDiakritiky(x) === bezDiakritiky(h)));
        stejny.hodnoty.push(...nove);
        stejny.vyraz = stejny.hodnoty.join(',');
    } else if (stejny) {
        Object.assign(stejny, p);
    } else {
        stitky.push(p);
    }
}

// Vyjme z textu příkazy známých dimenzí a udělá z nich štítky; vrátí zbylý text. vse = i poslední rozepsaný příkaz
// (Enter, zápis celé hodnoty), jinak jen příkazy, za kterými už je mezera
const VZOR_PRIKAZU = /(?:^|\s)((-|!)?([\p{L}]+):\s*((?:>=|<=|==|>|<|=)\s*\d+(?:[.,]\d+)?|(?:"[^"]*"|[^\s",:]+)(?:\s*,\s*(?:"[^"]*"|[^\s",:]+))*))(?=\s|$)/gu;
function vyjmoutPrikazy(text, vse) {
    let zbytek = text;
    const nove = [];
    // Odzadu, aby se pozice dřívějších příkazů vyjímáním nepohnuly; štítky pak v pořadí, jak jsou v textu
    for (const m of [...text.matchAll(VZOR_PRIKAZU)].reverse()) {
        const prikaz = m[1];
        const konec = m.index + m[0].length;
        const d = DIMENZE_MODELEK.find(x => x.klic === bezDiakritiky(m[3]) || x.aliasy?.includes(bezDiakritiky(m[3])));
        if (!d || (!vse && !/\s/.test(text.charAt(konec)))) continue;
        const [p] = parsovat(prikaz, DIMENZE_MODELEK).podminky;
        if (!p) continue;
        nove.unshift(p);
        zbytek = zbytek.slice(0, konec - prikaz.length) + zbytek.slice(konec);
    }
    nove.forEach(pridatPodminku);
    return zbytek.replace(/\s{2,}/g, ' ').replace(/^\s+/, '');
}

// Změna štítků: překreslit, uložit a znovu načíst galerii (galerie.js poslouchá událost)
function zmeneno() {
    vykreslit();
    document.dispatchEvent(new CustomEvent('filtr-modelek'));
}

// ——— Štítky v kapsli ———

const kapsle = /** @type {HTMLElement} */ (searchInput.closest('.hledani'));
const mistoStitku = document.createElement('span');
mistoStitku.className = 'hledani-stitky';
searchInput.before(mistoStitku);

function popisHodnot(p) {
    const d = dimenze(p.klic);
    if (d?.typ === 'srdicka') return popisSrdicek(p.vyraz);
    if (d?.typ === 'cislo') return p.vyraz.replace('..', '–');
    return p.hodnoty.join(', ');
}
function popisSrdicek(vyraz) {
    const v = String(vyraz).replace(/\s/g, '');
    if (v === '0') return 'bez ♥';
    const pul = n => n.replace('.', ',');
    const op = /^(>=|>|<=|<|=)?(\d+(?:[.,]\d+)?)$/.exec(v);
    if (op) return `${op[1] === '>=' ? '' : op[1] || ''}♥ ${pul(op[2])}${op[1] === '>=' ? '+' : ''}`;
    return `♥ ${v.replace('..', '–')}`;
}

function vykreslit() {
    const zobrazit = aktivni();
    kapsle?.classList.toggle('s-stitky', zobrazit && stitky.length > 0);
    mistoStitku.innerHTML = zobrazit ? stitky.map((p, i) => {
        const d = dimenze(p.klic);
        return `<span class="hledani-stitek ${p.negace ? 'neni' : ''}" data-stitek="${i}" role="button" tabindex="-1" title="${esc(`${d?.nazev || p.klic}${p.negace ? ' není' : ''}: ${popisHodnot(p)} – klik upraví, × zruší`)}">
            <b>${esc(d?.nazev || p.klic)}</b>${p.negace ? '<i>≠</i>' : ''}<span>${esc(popisHodnot(p))}</span><em data-zrusit-stitek="${i}" aria-label="Zrušit">×</em></span>`;
    }).join('') : '';
    vykreslitRychle();
}

mistoStitku.addEventListener('mousedown', e => e.preventDefault());
mistoStitku.addEventListener('click', (e) => {
    const zrusit = /** @type {HTMLElement} */ (e.target).closest('[data-zrusit-stitek]');
    const stitek = /** @type {HTMLElement} */ (e.target).closest('[data-stitek]');
    if (zrusit) {
        e.preventDefault();
        stitky.splice(Number(zrusit.dataset.zrusitStitek), 1);
        zavritEditor();
        zmeneno();
    } else if (stitek) {
        e.preventDefault();
        otevritEditor(stitky[Number(stitek.dataset.stitek)].klic, stitek, stitky[Number(stitek.dataset.stitek)].negace);
    }
});

// Psaní: dopsaný příkaz (za ním mezera) se změní ve štítek; Enter i rozepsaný; Backspace v prázdném poli vrátí
// poslední štítek do pole k úpravě
searchInput.addEventListener('input', () => {
    if (!aktivni()) return;
    const text = nativniText();
    const pocet = stitky.length;
    const zbytek = vyjmoutPrikazy(text, false);
    if (stitky.length !== pocet || zbytek !== text) {
        nastavitNativniText(zbytek);
        vykreslit();
    }
}, true);
searchInput.addEventListener('keydown', (e) => {
    if (!aktivni()) return;
    if (e.key === 'Enter') {
        const text = nativniText();
        const pocet = stitky.length;
        const zbytek = vyjmoutPrikazy(text, true);
        if (stitky.length !== pocet) {
            nastavitNativniText(zbytek);
            vykreslit();
            searchInput.dispatchEvent(new Event('input'));
        }
    } else if (e.key === 'Backspace' && !nativniText() && searchInput.selectionStart === 0 && stitky.length) {
        e.preventDefault();
        const posledni = stitky.pop();
        nastavitNativniText(textStitku(posledni));
        vykreslit();
        searchInput.dispatchEvent(new Event('input'));
    }
}, true);

// ——— Řádek rychlých filtrů pod kapslí ———

const RYCHLE = ['hodnoceni', 'edice', 'kategorie', 'vyskyt', 'vlasy', 'narodnost', 'rok', 'vyska'];
const rychle = document.createElement('div');
rychle.className = 'rychle-filtry';
rychle.setAttribute('role', 'toolbar');
rychle.setAttribute('aria-label', 'Rychlé filtry');
kapsle?.after(rychle);

function vykreslitRychle() {
    const zobrazit = aktivni();
    rychle.classList.toggle('hidden', !zobrazit);
    if (!zobrazit) return;
    const dalsi = DIMENZE_MODELEK.filter(d => !RYCHLE.includes(d.klic));
    const tlacitko = (d) => {
        const zapnute = stitky.filter(s => s.klic === d.klic);
        const souhrn = zapnute.length ? zapnute.map(p => `${p.negace ? '≠ ' : ''}${popisHodnot(p)}`).join(' · ') : '';
        return `<button type="button" class="rychly-filtr ${zapnute.length ? 'zapnuto' : ''}" data-rychly="${d.klic}" aria-haspopup="dialog">${esc(d.nazev)}${souhrn ? `<span>${esc(souhrn)}</span>` : ''} <i aria-hidden="true">▾</i></button>`;
    };
    const dalsiZapnute = dalsi.filter(d => stitky.some(s => s.klic === d.klic));
    rychle.innerHTML = RYCHLE.map(k => tlacitko(dimenze(k))).join('') + dalsiZapnute.map(tlacitko).join('')
        + `<button type="button" class="rychly-filtr dalsi" data-rychly-dalsi aria-haspopup="menu">+ Další</button>`
        + (stitky.length ? '<button type="button" class="link rychle-zrusit" data-rychle-zrusit>Zrušit filtry</button>' : '');
}

rychle.addEventListener('mousedown', e => e.preventDefault());
rychle.addEventListener('click', (e) => {
    const cil = /** @type {HTMLElement} */ (e.target);
    const tlacitko = /** @type {HTMLElement | null} */ (cil.closest('[data-rychly]'));
    if (tlacitko) {
        const klic = tlacitko.dataset.rychly;
        if (editor?.dataset.klic === klic) return zavritEditor();
        return otevritEditor(klic, tlacitko, stitky.find(s => s.klic === klic)?.negace || false);
    }
    if (cil.closest('[data-rychly-dalsi]')) {
        const dalsi = DIMENZE_MODELEK.filter(d => !RYCHLE.includes(d.klic));
        return otevritSeznamDalsich(/** @type {HTMLElement} */ (cil.closest('[data-rychly-dalsi]')), dalsi);
    }
    if (cil.closest('[data-rychle-zrusit]')) {
        stitky = [];
        zavritEditor();
        zmeneno();
    }
});

function otevritSeznamDalsich(kotva, dalsi) {
    zavritEditor();
    editor = document.createElement('div');
    editor.className = 'filtr-editor filtr-seznam';
    editor.dataset.klic = '+';
    editor.innerHTML = `<h6>Další filtry</h6>${dalsi.map(d => `<button type="button" data-dalsi="${d.klic}">${esc(d.nazev)}</button>`).join('')}`;
    umistit(kotva);
    editor.addEventListener('click', (e) => {
        const b = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-dalsi]'));
        if (b) otevritEditor(b.dataset.dalsi, kotva, false);
    });
}

// ——— Editor jednoho filtru ———

let editor = null;
function zavritEditor() {
    editor?.remove();
    editor = null;
    document.removeEventListener('pointerdown', klikMimo, true);
}
function klikMimo(e) {
    if (editor && !editor.contains(e.target) && !e.target.closest?.('.rychle-filtry, .hledani-stitky')) zavritEditor();
}
function umistit(kotva) {
    document.getElementById('app').append(editor);
    const r = kotva.getBoundingClientRect();
    const sirka = editor.offsetWidth;
    editor.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - sirka - 8))}px`;
    editor.style.top = `${r.bottom + 6}px`;
    document.addEventListener('pointerdown', klikMimo, true);
}

// Volný text a ostatní štítky pro počty u hodnot (fasety): kolik modelek by zbylo s touto hodnotou
const filtrProPocty = () => ({ podminky: stitky, volne: rozlozitDotaz(nativniText()) });

const PREDVOLBY = {
    rok: [['1950..1959', '50. léta'], ['1960..1969', '60. léta'], ['1970..1979', '70. léta'], ['1980..1989', '80. léta'], ['1990..1999', '90. léta'], ['2000..2009', '2000–2009'], ['2010..2029', 'od 2010']],
    narozena: [['1930..1949', '1930–1949'], ['1950..1959', '50. léta'], ['1960..1969', '60. léta'], ['1970..1979', '70. léta'], ['1980..1989', '80. léta'], ['1990..2010', 'od 1990']],
    vyska: [['<165', 'do 164 cm'], ['165..174', '165–174 cm'], ['>=175', 'od 175 cm']],
    vaha: [['<50', 'do 49 kg'], ['50..59', '50–59 kg'], ['>=60', 'od 60 kg']],
};
const SRDICKA = [['>=1', '♥ 1+'], ['>=2', '♥ 2+'], ['>=3', '♥ 3+'], ['>=3,5', '♥ 3½+'], ['>=4', '♥ 4+'], ['>=4,5', '♥ 4½+'], ['5', '♥ 5'], ['0', 'Bez ♥']];

async function otevritEditor(klic, kotva, negace) {
    const d = dimenze(klic);
    if (!d) return;
    zavritEditor();
    editor = document.createElement('div');
    editor.className = 'filtr-editor';
    editor.dataset.klic = klic;
    editor.setAttribute('role', 'dialog');
    editor.setAttribute('aria-label', `Filtr ${d.nazev}`);
    const stavE = { negace, hledat: '' };
    const podminka = () => stitky.find(s => s.klic === klic && s.negace === stavE.negace);
    const nastavit = (p) => {
        stitky = stitky.filter(s => !(s.klic === klic && s.negace === stavE.negace));
        if (p) stitky.push({ klic, negace: stavE.negace, ...p });
        zmeneno();
        vykreslitEditor();
    };
    const modelky = await vsechnyModelky();

    const vykreslitEditor = () => {
        if (!editor) return;
        const p = podminka();
        const hlava = `<div class="fe-hlava"><h6>${esc(d.nazev)}</h6>
            <div class="fe-je" role="group" aria-label="Je nebo není"><button type="button" class="${stavE.negace ? '' : 'on'}" data-fe-je="0">je</button><button type="button" class="${stavE.negace ? 'on' : ''}" data-fe-je="1">není</button></div></div>`;
        let telo = '';
        if (d.typ === 'srdicka' || d.typ === 'anone' || (d.typ === 'cislo' && PREDVOLBY[klic])) {
            const volby = d.typ === 'srdicka' ? SRDICKA : d.typ === 'anone' ? [['ano', 'Ano'], ['ne', 'Ne']] : PREDVOLBY[klic];
            const zvolena = p ? (d.typ === 'anone' ? p.hodnoty[0] : p.vyraz) : '';
            telo += `<div class="fe-volby">${volby.map(([v, n]) => `<button type="button" class="${bezDiakritiky(zvolena) === bezDiakritiky(v) ? 'on' : ''}" data-fe-vyraz="${esc(v)}">${esc(n)}</button>`).join('')}</div>`;
        }
        if (d.typ === 'cislo') {
            const r = /^(\d+)\.\.(\d+)$/.exec(p?.vyraz || '') || /^>=(\d+)$/.exec(p?.vyraz || '');
            telo += `<div class="fe-rozsah"><input type="number" inputmode="numeric" data-fe-od placeholder="od" value="${r ? esc(r[1]) : ''}" /><span>–</span><input type="number" inputmode="numeric" data-fe-do placeholder="do" value="${r && r[2] ? esc(r[2]) : ''}" /></div>`;
        }
        if (d.typ === 'text') {
            const pocty = fasety(modelky, filtrProPocty(), DIMENZE_MODELEK, textyModelky, klic);
            const zvolene = new Set((p?.hodnoty || []).map(bezDiakritiky));
            const hledane = bezDiakritiky(stavE.hledat);
            // Zvolené hodnoty vždy (i bez modelek), ostatní podle hledání; nejvýš 40
            const hodnoty = [...(p?.hodnoty || []).filter(h => !pocty.some(x => bezDiakritiky(x.hodnota) === bezDiakritiky(h))).map(h => ({ hodnota: h, pocet: 0 })), ...pocty]
                .filter(x => zvolene.has(bezDiakritiky(x.hodnota)) || !hledane || bezDiakritiky(x.hodnota).includes(hledane)).slice(0, 40);
            telo += `${pocty.length > 8 ? `<input type="search" class="fe-hledat" data-fe-hledat placeholder="Hledat hodnotu…" value="${esc(stavE.hledat)}" />` : ''}
                <div class="fe-seznam" role="listbox" aria-multiselectable="true">${hodnoty.map(x => {
                    const on = zvolene.has(bezDiakritiky(x.hodnota));
                    return `<button type="button" role="option" aria-selected="${on}" class="${on ? 'on' : ''} ${x.pocet ? '' : 'nula'}" data-fe-hodnota="${esc(x.hodnota)}"><span class="fe-box" aria-hidden="true"></span>${esc(x.hodnota)}<small>${x.pocet}</small></button>`;
                }).join('') || '<p class="fe-prazdne">Žádná hodnota</p>'}</div>`;
        }
        const pata = `<div class="fe-pata"><span>${p ? esc(`${textStitku(p)}`) : 'Bez omezení'}</span>${p ? '<button type="button" class="link" data-fe-zrusit>Zrušit</button>' : ''}</div>`;
        const fokus = document.activeElement?.matches?.('[data-fe-hledat]');
        editor.innerHTML = hlava + telo + pata;
        if (fokus) {
            const pole = /** @type {HTMLInputElement | null} */ (editor.querySelector('[data-fe-hledat]'));
            pole?.focus();
            pole?.setSelectionRange(pole.value.length, pole.value.length);
        }
    };

    vykreslitEditor();
    umistit(kotva);
    editor.addEventListener('click', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const je = /** @type {HTMLElement | null} */ (cil.closest('[data-fe-je]'));
        const vyraz = /** @type {HTMLElement | null} */ (cil.closest('[data-fe-vyraz]'));
        const hodnota = /** @type {HTMLElement | null} */ (cil.closest('[data-fe-hodnota]'));
        if (je) {
            // Přepnutí je / není přenese stávající podmínku na druhou stranu
            const p = podminka();
            const nova = je.dataset.feJe === '1';
            if (nova === stavE.negace) return;
            if (p) stitky = stitky.filter(s => s !== p);
            stavE.negace = nova;
            if (p) nastavit({ hodnoty: p.hodnoty, vyraz: p.vyraz });
            else vykreslitEditor();
        } else if (vyraz) {
            const v = vyraz.dataset.feVyraz;
            const p = podminka();
            if (d.typ === 'anone') nastavit(p?.hodnoty[0] === v ? null : { hodnoty: [v], vyraz: v });
            else nastavit(p?.vyraz === v ? null : { hodnoty: [], vyraz: v });
        } else if (hodnota) {
            const v = hodnota.dataset.feHodnota;
            const p = podminka();
            const hodnoty = (p?.hodnoty || []).filter(h => bezDiakritiky(h) !== bezDiakritiky(v));
            if (hodnoty.length === (p?.hodnoty || []).length) hodnoty.push(v);
            nastavit(hodnoty.length ? { hodnoty, vyraz: hodnoty.join(',') } : null);
        } else if (cil.closest('[data-fe-zrusit]')) {
            nastavit(null);
        }
    });
    editor.addEventListener('input', (e) => {
        const cil = /** @type {HTMLInputElement} */ (e.target);
        if (cil.matches('[data-fe-hledat]')) {
            stavE.hledat = cil.value;
            vykreslitEditor();
        }
    });
    editor.addEventListener('change', (e) => {
        const cil = /** @type {HTMLInputElement} */ (e.target);
        if (!cil.matches('[data-fe-od], [data-fe-do]')) return;
        const od = /** @type {HTMLInputElement} */ (editor.querySelector('[data-fe-od]')).value.trim();
        const po = /** @type {HTMLInputElement} */ (editor.querySelector('[data-fe-do]')).value.trim();
        nastavit(od && po ? { hodnoty: [], vyraz: `${od}..${po}` } : od ? { hodnoty: [], vyraz: `>=${od}` } : po ? { hodnoty: [], vyraz: `<=${po}` } : null);
    });
    editor.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        zavritEditor();
        searchInput.focus();
    });
    /** @type {HTMLElement | null} */ (editor.querySelector('[data-fe-hledat], .fe-seznam button, .fe-volby button'))?.focus({ preventScroll: true });
}

// ——— Pro stavovou lištu a kapsli voleb ———

// Štítky filtru k zobrazení jinde (stavová lišta): popis a zrušení
export function stitkyFiltru() {
    if (!aktivni()) return [];
    return stitky.map((p, i) => ({
        text: `${dimenze(p.klic)?.nazev || p.klic}${p.negace ? ' ≠' : ':'} ${popisHodnot(p)}`,
        zrusit: () => {
            stitky.splice(i, 1);
            zmeneno();
        },
        upravit: () => {
            document.dispatchEvent(new CustomEvent('otevrit-filtry'));
            requestAnimationFrame(() => {
                const kotva = rychle.querySelector(`[data-rychly="${p.klic}"]`);
                if (kotva) otevritEditor(p.klic, /** @type {HTMLElement} */ (kotva), p.negace);
            });
        },
    }));
}
export const pocetStitku = () => (aktivni() ? stitky.length : 0);
export const popisPoctu = n => sklonovat(n, 'filtr', 'filtry', 'filtrů');

// Přepnutí přehledu: štítky patří jen Modelkám
export function obnovitStitky() {
    if (!aktivni()) zavritEditor();
    vykreslit();
}
