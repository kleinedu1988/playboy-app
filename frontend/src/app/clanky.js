// Články čísla: čtení (text s perexem, citáty a zvýrazněnými otázkami, skeny stran) a okno pro úpravu
import { jednou, oznamit } from '../ui/oznameni';
import { AddClanek, DeleteClanek, UpdateClanek } from './backend';
import { esc, nazevVydani, obrazek, sjednotit } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { VELIKOST_NAHLEDU } from './obrazky';
import { potvrdit } from './formular-modelky';
import { obnovitStranku, ukazatClanek } from './vydani';

// Rubriky, které nabízí okno článku; vlastní rubrika jde dopsat
export const RUBRIKY = ['Úvodník', 'Playboy Interview', '20 otázek', 'Článek', 'Povídka', 'Móda', 'Humor', 'Advisor', 'Pictorial', 'Centerfold'];
const NAZVY_DRUHU = { prepis: 'přepis', shrnuti: 'shrnutí' };

const clanekModal = document.getElementById('clanekModal');

// Text článku: odstavce oddělené prázdným řádkem, první je perex; „> “ citát; „SLOVO:“ na začátku zvýrazní mluvčího
export function htmlTextuClanku(text) {
    const odstavce = String(text || '').replace(/\r/g, '').split(/\n\s*\n/).map(o => o.trim()).filter(Boolean);
    return odstavce.map((o, i) => {
        if (o.startsWith('>')) return `<blockquote>${esc(o.replace(/^>\s*/gm, '')).replace(/\n/g, '<br>')}</blockquote>`;
        let html = esc(o).replace(/\n/g, '<br>');
        html = html.replace(/^([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ .'-]{1,30}):/, '<strong>$1:</strong>');
        return `<p${i === 0 ? ' class="clanek-perex"' : ''}>${html}</p>`;
    }).join('');
}

// Čtení článku v pravé části stránky čísla; sousední články podle obsahu
export function htmlClanku(c, vsechny) {
    const poradi = vsechny.findIndex(x => x.id === c.id);
    const predchozi = vsechny[poradi - 1];
    const dalsi = vsechny[poradi + 1];
    const zahlavi = [c.rubrika || 'Článek', c.strana ? `strana ${c.strana}` : '', NAZVY_DRUHU[c.druh] || ''].filter(Boolean).join(' · ');
    // Tenký proužek s obsahem a ukazatelem přečteného; vidět jen v úzkém okně, kde levý panel není u čtení
    const prouzek = `
        <nav class="clanek-prouzek">
            ${vsechny.map(x => `<button type="button" class="${x.id === c.id ? 'active' : ''}" data-clanek="${x.id}">${x.strana ? `<b>${x.strana}</b>` : ''}${esc(x.nazev)}</button>`).join('')}
            <span class="clanek-precteno"><i></i></span>
        </nav>`;
    return `
        <article class="clanek">
            ${prouzek}
            <div class="clanek-akce">
                <button class="volba" data-alba-cisla><span aria-hidden="true">←</span>Alba čísla</button>
                <button class="volba" data-upravit-clanek><span aria-hidden="true">✎</span>Upravit článek</button>
            </div>
            <div class="clanek-rubrika">${esc(zahlavi)}</div>
            <h1>${esc(c.nazev)}</h1>
            ${c.autor || c.jmenoModelky ? `<div class="clanek-autor">${esc(c.autor)}${c.autor && c.jmenoModelky ? ' · ' : ''}${c.jmenoModelky
                ? `<button class="link" data-modelka="${c.modelkaId}" title="Otevřít profil modelky">${esc(c.jmenoModelky)}</button>` : ''}</div>` : ''}
            <div class="clanek-linka"></div>
            <div class="clanek-text">${htmlTextuClanku(c.text) || '<p class="empty-state">Článek zatím nemá text. Doplň ho tlačítkem Upravit článek.</p>'}</div>
            ${c.skenyUrl?.length ? `
                <div class="clanek-skeny-nadpis">Skeny stran</div>
                <div class="clanek-skeny">${c.skenyUrl.map((url, i) => `<button type="button" data-sken="${i}" title="Otevřít sken"><img src="${esc(obrazek(url, VELIKOST_NAHLEDU))}" alt="" loading="lazy" draggable="false" /></button>`).join('')}</div>` : ''}
            <nav class="clanek-sousede">
                ${predchozi ? `<button type="button" data-clanek="${predchozi.id}"><span>← předchozí</span><b>${esc(predchozi.nazev)}</b></button>` : '<span></span>'}
                ${dalsi ? `<button type="button" class="dalsi" data-clanek="${dalsi.id}"><span>další →</span><b>${esc(dalsi.nazev)}</b></button>` : '<span></span>'}
            </nav>
        </article>`;
}

// Okno článku: nový (clanek = null) nebo úprava; vydání je dané stránkou čísla
export async function otevritEditorClanku(clanek, vydani) {
    stav.editovanyClanek = clanek || { id: 0, vydani };
    const hodnota = (id, v) => { /** @type {HTMLInputElement} */ (document.getElementById(id)).value = v ?? ''; };
    document.getElementById('clanekModalTitle').textContent = clanek ? 'Upravit článek' : 'Nový článek';
    document.getElementById('clanekModalCislo').textContent = nazevVydani(vydani);
    hodnota('inputClanekRubrika', clanek?.rubrika);
    hodnota('inputClanekAutor', clanek?.autor);
    hodnota('inputClanekStrana', clanek?.strana || '');
    hodnota('inputClanekNazev', clanek?.nazev);
    hodnota('inputClanekModelka', clanek?.jmenoModelky);
    hodnota('selectClanekDruh', clanek?.druh);
    hodnota('inputClanekText', clanek?.text);
    hodnota('inputClanekSkeny', clanek?.skenyOdkazy);
    document.getElementById('clanekSmazatBtn').classList.toggle('hidden', !clanek);

    // Našeptávání: rubriky (obvyklé i už použité), autoři čísla a jména modelek
    const rubriky = new Map([...RUBRIKY, ...stav.vydaniClanky.map(c => c.rubrika)].filter(Boolean).map(r => [sjednotit(r), r]));
    document.getElementById('seznamRubrik').innerHTML = [...rubriky.values()].map(r => `<option value="${esc(r)}"></option>`).join('');
    const autori = new Set(stav.vydaniClanky.map(c => c.autor).filter(Boolean));
    document.getElementById('seznamAutoru').innerHTML = [...autori].map(a => `<option value="${esc(a)}"></option>`).join('');
    const modelky = await vsechnyModelky();
    document.getElementById('seznamModelekClanku').innerHTML = modelky.map(m => `<option value="${esc(m.jmeno)}"></option>`).join('');

    clanekModal.classList.remove('hidden');
    document.getElementById(clanek ? 'inputClanekText' : 'inputClanekRubrika').focus();
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    document.getElementById('clanekForm').onsubmit = jednou(async (e) => {
        e.preventDefault();
        const pole = id => /** @type {HTMLInputElement} */ (document.getElementById(id)).value.trim();
        const nazev = pole('inputClanekNazev');
        if (!nazev) {
            document.getElementById('inputClanekNazev').focus();
            oznamit('Vyplň název článku.');
            return;
        }
        const strana = pole('inputClanekStrana');
        if (strana && !/^\d+$/.test(strana)) {
            document.getElementById('inputClanekStrana').focus();
            oznamit('Strana je číslo, například 27.');
            return;
        }
        // Modelka podle jména; jméno, které ve sbírce není, se neuloží
        const jmeno = pole('inputClanekModelka');
        const modelka = jmeno ? (await vsechnyModelky()).find(m => sjednotit(m.jmeno) === sjednotit(jmeno)) : null;
        if (jmeno && !modelka) {
            document.getElementById('inputClanekModelka').focus();
            oznamit(`Modelka „${jmeno}“ ve sbírce není. Vyber jméno z nabídky, nebo pole nech prázdné.`);
            return;
        }
        const clanek = {
            ...stav.editovanyClanek,
            rubrika: pole('inputClanekRubrika'),
            autor: pole('inputClanekAutor'),
            strana: parseInt(strana) || 0,
            nazev,
            modelkaId: modelka?.id || 0,
            druh: pole('selectClanekDruh'),
            text: /** @type {HTMLTextAreaElement} */ (document.getElementById('inputClanekText')).value.trim(),
            skenyOdkazy: pole('inputClanekSkeny'),
        };
        let id = clanek.id;
        if (id) {
            if (!await UpdateClanek(/** @type {any} */ (clanek))) {
                oznamit('Článek se nepodařilo uložit.');
                return;
            }
        } else {
            id = await AddClanek(/** @type {any} */ (clanek));
            if (!id) {
                oznamit('Článek se nepodařilo uložit.');
                return;
            }
        }
        clanekModal.classList.add('hidden');
        // Uložený článek se rovnou otevře
        stav.vydaniClanek = id;
        await obnovitStranku();
        ukazatClanek(id);
    });

    document.getElementById('clanekSmazatBtn').onclick = async () => {
        const c = stav.editovanyClanek;
        if (!c?.id) return;
        // Potvrzení je samostatné okno; článek se po zrušení otevře znovu
        clanekModal.classList.add('hidden');
        if (!await potvrdit('Smazat článek', `Opravdu smazat článek „${c.nazev}“? Text článku se smaže, skeny na Disku zůstanou.`, 'Smazat', { nebezpecne: true })) {
            clanekModal.classList.remove('hidden');
            return;
        }
        if (!await DeleteClanek(c.id)) {
            oznamit('Článek se nepodařilo smazat.');
            return;
        }
        clanekModal.classList.add('hidden');
        stav.vydaniClanek = 0;
        obnovitStranku();
    };
}
