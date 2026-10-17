// Nejlepší fotky a vlastní výběry
import { GetFotkyVyberu, GetNejlepsiFotky, GetVybery, PrejmenovatVyber, PridatDoVyberu, SmazatVyber, VyberPodleNazvu } from './backend';
import { oznamit } from '../ui/oznameni';
import { bezDiakritiky, esc, nazevAlba, obrazek, rozlozitDotaz, sjednotit, sklonovat, vyhovujeHledani } from '../lib/format';
import { stav } from './stav';
import { vybratKliknutim } from './vyber';
import { best, searchInput } from './prvky';
import { listaNejlepsich } from './listy';
import { historie, prepnoutRezim, ukazatPohled } from './navigace';
import { htmlSrdickaFotky, nacistGalerii } from './galerie';
import { VELIKOST_NAHLEDU } from './obrazky';
import { htmlAkciDlazdice } from './akce-fotky';
import { otevritLightbox } from './prohlizec';
import { potvrdit } from './formular-modelky';
import { vybratHodnotu } from './ulozeni';
import { prevestNaVolby } from '../ui/volby';
import { htmlNicNenalezeno, htmlPrazdna } from '../ui/prazdno';

// Přidání fotek do vlastního výběru (existujícího, nebo nového podle napsaného názvu)
export async function pridatDoVyberu(ids) {
    const vybery = await GetVybery() || [];
    const nazev = await vybratHodnotu({ nadpis: 'Přidat do výběru', text: 'Vyber výběr ze seznamu, nebo napiš název nového. Výběry se prohlížejí v přehledu Nejlepší.', popisek: 'Výběr', moznosti: vybery.map(v => v.nazev), tlacitko: 'Přidat' });
    if (!nazev) return false;
    const id = await VyberPodleNazvu(nazev);
    if (!id) return false;
    const pridano = await PridatDoVyberu(id, ids);
    oznamit(`Do výběru „${nazev}“ přidáno fotek: ${pridano}.` + (pridano < ids.length ? ` Už v něm bylo: ${ids.length - pridano}.` : ''),
        { text: 'Otevřít výběr', akce: () => { stav.nejlepsiVyber = id; prepnoutRezim('nejlepsi'); historie.length = 0; nacistGalerii(''); } });
    return true;
}

export async function nacistNejlepsi(dotaz = '', zMezipameti = false) {
    const moje = ++stav.cisloNacteni;
    const [fotky, vybery] = zMezipameti && stav.nejlepsiData ? [stav.nejlepsiData, stav.vyberyData]
        : await Promise.all([(stav.nejlepsiVyber ? GetFotkyVyberu(stav.nejlepsiVyber) : GetNejlepsiFotky(stav.nejlepsiMin)).then(f => f || []), GetVybery().then(v => v || [])]);
    if (moje !== stav.cisloNacteni) return;
    stav.nejlepsiData = fotky;
    stav.vyberyData = vybery;
    const vyber = vybery.find(v => v.id === stav.nejlepsiVyber);
    if (stav.nejlepsiVyber && !vyber) stav.nejlepsiVyber = 0;
    stav.zrusitUpravuVyrezu = null;
    ukazatPohled(best);

    const tokeny = rozlozitDotaz(dotaz);
    const vyhovuje = f => vyhovujeHledani([
        f.jmenoModelky,
        f.album,
        nazevAlba(f.album, f.typ),
        f.fotograf || '',
        f.popis || '',
    ], tokeny);
    stav.nejlepsiPolozky = fotky.filter(vyhovuje).map(f => ({
        fotky: [f], album: f.album, typ: f.typ, modelkaId: f.modelkaId, jmenoModelky: f.jmenoModelky, rotace: f.rotace, hodnoceni: f.hodnoceni,
    })).sort((x, y) => y.hodnoceni - x.hodnoceni);

    // Lišta nahoře skáče na úrovně srdíček; první fotka každé úrovně nese značku části
    const urovne = new Map();
    stav.nejlepsiPolozky.forEach(p => urovne.set(p.hodnoceni, (urovne.get(p.hodnoceni) || 0) + 1));
    const zacatekUrovne = new Set([...urovne.keys()].map(h => stav.nejlepsiPolozky.findIndex(p => p.hodnoceni === h)));

    const prah = [3, 4, 5].map(n => `<button class="chip ${!stav.nejlepsiVyber && n === stav.nejlepsiMin ? 'active' : ''}" data-nejlepsi-min="${n}">&#9829; ${n}${n < 5 ? '+' : ''}</button>`).join('')
        + vybery.map(v => `<button class="chip ${v.id === stav.nejlepsiVyber ? 'active' : ''}" data-vyber-id="${v.id}" title="Vlastní výběr">${esc(v.nazev)}<span>${v.pocet}</span></button>`).join('')
        + (vyber ? '<button class="link" data-vyber-akce="prejmenovat">přejmenovat</button><button class="link" data-vyber-akce="smazat">smazat výběr</button>' : '');
    document.getElementById('bestList').innerHTML = `
        <div class="best-toolbar">${prah}<span>${sklonovat(stav.nejlepsiPolozky.length, 'fotka', 'fotky', 'fotek')}</span>
            ${stav.nejlepsiPolozky.length ? '<button class="btn btn-secondary btn-small" data-nejlepsi-slideshow>Spustit slideshow</button>' : ''}</div>
        ${stav.nejlepsiPolozky.length ? `<div class="nejlepsi-mozaika">${stav.nejlepsiPolozky.map((p, i) => htmlDlazdiceMozaiky(p, i, zacatekUrovne.has(i))).join('')}</div>`
            : fotky.length || tokeny.length ? htmlNicNenalezeno('Hledání neodpovídá žádná fotka.')
            : vyber ? htmlPrazdna('Výběr je prázdný', 'Fotky se do něj přidávají odkudkoli: tlačítkem ⋯ na fotce, v prohlížeči nebo u vybraných fotek „Přidat do výběru…“.', { ikona: 'hvezda' })
            : htmlPrazdna(`Zatím žádné fotky s ♥ ${stav.nejlepsiMin}${stav.nejlepsiMin < 5 ? '+' : ''}`, 'Fotky se hodnotí srdíčky na dlaždici nebo v prohlížeči klávesami 1–5.', { ikona: 'srdce' })}
    `;
    prevestNaVolby(document.querySelector('#bestList .best-toolbar'));
    pripravitMozaiku();
    listaNejlepsich.naplnit([...urovne].map(([h, pocet]) => ({ klic: `srdicka-${h}`, nazev: h ? '♥'.repeat(h) : 'bez srdíček', pocet })));
    listaNejlepsich.sledovat();
}

// Poměr stran fotek (podle id) z minulého vykreslení: mozaika pak při překreslení neposkakuje
const pomeryFotek = new Map();

// Dlaždice mozaiky: řady stejné výšky, šířka podle poměru stran fotky; srdíčka v rohu, jméno a původ po najetí
function htmlDlazdiceMozaiky(p, index, zacatek) {
    const f = p.fotky[0];
    const album = nazevAlba(p.album, p.typ);
    const odkud = album.includes(p.typ) ? album : [p.typ, album].filter(Boolean).join(' · ');
    return `
        <div class="photo-item" data-index="${index}" data-foto-id="${f.id}" tabindex="0" ${zacatek ? `data-cast="srdicka-${p.hodnoceni}"` : ''}
            style="--pomer: ${pomeryFotek.get(f.id) || 0.75}">
            <img src="${esc(obrazek(f.url, VELIKOST_NAHLEDU))}" loading="lazy" draggable="false" />
            ${htmlSrdickaFotky(p, index)}
            <div class="nejlepsi-popis">
                ${p.modelkaId ? `<button class="link" data-modelka="${p.modelkaId}" title="Otevřít profil">${esc(p.jmenoModelky)}</button>` : ''}
                <small>${esc(odkud)}</small>
            </div>
            ${htmlAkciDlazdice()}
        </div>`;
}

function pripravitMozaiku() {
    document.querySelectorAll('#bestList .nejlepsi-mozaika .photo-item').forEach(dlazdice => {
        const img = dlazdice.querySelector('img');
        const nastavit = () => {
            if (!img.naturalWidth) return;
            const pomer = img.naturalWidth / img.naturalHeight;
            pomeryFotek.set(parseInt(dlazdice.dataset.fotoId), pomer);
            dlazdice.style.setProperty('--pomer', String(pomer));
        };
        if (img.complete) nastavit();
        else img.addEventListener('load', nastavit, { once: true });
    });
}

export async function upravitVyber(akce) {
    const vyber = stav.vyberyData.find(v => v.id === stav.nejlepsiVyber);
    if (!vyber) return;
    if (akce === 'prejmenovat') {
        const nazev = await vybratHodnotu({ nadpis: 'Přejmenovat výběr', popisek: 'Název', tlacitko: 'Přejmenovat', vychozi: vyber.nazev });
        if (nazev && !await PrejmenovatVyber(vyber.id, nazev)) oznamit('Výběr s tímto názvem už existuje.');
    } else if (await potvrdit('Smazat výběr', `Smazat výběr „${vyber.nazev}“? Fotky ve sbírce zůstanou, zmizí jen tento výběr.`, 'Smazat', { nebezpecne: true })) {
        await SmazatVyber(vyber.id);
        stav.nejlepsiVyber = 0;
    }
    nacistNejlepsi(searchInput.value);
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    try { stav.nejlepsiMin = parseInt(localStorage.getItem('nejlepsiMin')) || 4; } catch { /* výchozí 4 */ }

    best.addEventListener('click', (e) => {
        const vyberChip = e.target.closest('[data-vyber-id]');
        if (vyberChip) {
            const id = parseInt(vyberChip.dataset.vyberId);
            stav.nejlepsiVyber = id === stav.nejlepsiVyber ? 0 : id;
            nacistNejlepsi(searchInput.value);
            return;
        }
        const akceVyberu = e.target.closest('[data-vyber-akce]')?.dataset.vyberAkce;
        if (akceVyberu) {
            upravitVyber(akceVyberu);
            return;
        }
        const prah = e.target.closest('[data-nejlepsi-min]');
        if (prah) {
            stav.nejlepsiVyber = 0;
            stav.nejlepsiMin = parseInt(prah.dataset.nejlepsiMin);
            try { localStorage.setItem('nejlepsiMin', String(stav.nejlepsiMin)); } catch { /* jen se nezapamatuje */ }
            nacistNejlepsi(searchInput.value);
            return;
        }
        if (e.target.closest('[data-nejlepsi-slideshow]')) {
            otevritLightbox(0, true, stav.nejlepsiPolozky);
            return;
        }
        if (vybratKliknutim(e) || e.target.closest('.hearts, [data-modelka]')) return;
        const dlazdice = e.target.closest('[data-index]');
        if (dlazdice) otevritLightbox(parseInt(dlazdice.dataset.index), false, stav.nejlepsiPolozky);
    });
}
