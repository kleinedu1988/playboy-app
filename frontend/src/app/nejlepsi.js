// Nejlepší fotky a vlastní výběry
import { GetFotkyVyberu, GetNejlepsiFotky, GetVybery, PrejmenovatVyber, PridatDoVyberu, SmazatVyber, VyberPodleNazvu } from './backend';
import { oznamit } from '../ui/oznameni';
import { bezDiakritiky, esc, sjednotit, sklonovat } from '../lib/format';
import { stav } from './stav';
import { vybratKliknutim } from './vyber';
import { best, searchInput } from './prvky';
import { listaNejlepsich } from './listy';
import { historie, prepnoutRezim, ukazatPohled } from './navigace';
import { nacistGalerii } from './galerie';
import { htmlDlazdice } from './vydani';
import { otevritLightbox } from './prohlizec';
import { potvrdit } from './formular-modelky';
import { vybratHodnotu } from './ulozeni';

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

    // Každá fotka zvlášť, po modelkách (covery bez modelky na konci)
    const hledat = sjednotit(dotaz);
    stav.nejlepsiPolozky = fotky.filter(f => !hledat || bezDiakritiky(f.jmenoModelky).includes(hledat)).map(f => ({
        fotky: [f], album: f.album, typ: f.typ, modelkaId: f.modelkaId, jmenoModelky: f.jmenoModelky, rotace: f.rotace, hodnoceni: f.hodnoceni,
    }));
    const podleModelek = new Map();
    stav.nejlepsiPolozky.forEach((p, i) => {
        const klic = p.jmenoModelky || 'Covery';
        if (!podleModelek.has(klic)) podleModelek.set(klic, { modelkaId: p.modelkaId, indexy: [] });
        podleModelek.get(klic).indexy.push(i);
    });

    const prah = [3, 4, 5].map(n => `<button class="chip ${!stav.nejlepsiVyber && n === stav.nejlepsiMin ? 'active' : ''}" data-nejlepsi-min="${n}">&#9829; ${n}${n < 5 ? '+' : ''}</button>`).join('')
        + vybery.map(v => `<button class="chip ${v.id === stav.nejlepsiVyber ? 'active' : ''}" data-vyber-id="${v.id}" title="Vlastní výběr">${esc(v.nazev)}<span>${v.pocet}</span></button>`).join('')
        + (vyber ? '<button class="link" data-vyber-akce="prejmenovat">přejmenovat</button><button class="link" data-vyber-akce="smazat">smazat výběr</button>' : '');
    document.getElementById('bestList').innerHTML = `
        <div class="best-toolbar">${prah}<span>${sklonovat(stav.nejlepsiPolozky.length, 'fotka', 'fotky', 'fotek')}</span>
            ${stav.nejlepsiPolozky.length ? '<button class="btn btn-secondary btn-small" data-nejlepsi-slideshow>Spustit slideshow</button>' : ''}</div>
        ${[...podleModelek].map(([jmeno, { modelkaId, indexy }], i) => `
            <section class="best-model" data-cast="${i}">
                <div class="album-header">
                    <h4>${modelkaId ? `<button class="link" data-modelka="${modelkaId}" title="Otevřít profil">${esc(jmeno)}</button>` : esc(jmeno)}</h4>
                    <span>${sklonovat(indexy.length, 'fotka', 'fotky', 'fotek')}</span>
                </div>
                <div class="photos-grid">${indexy.map(index => htmlDlazdice(stav.nejlepsiPolozky[index], index)).join('')}</div>
            </section>
        `).join('') || `<p class="empty-state">${fotky.length || hledat ? 'Hledání neodpovídá žádná modelka.'
            : vyber ? 'Výběr je prázdný. Fotky se do něj přidávají odkudkoli: tlačítkem ⋯ na fotce, v prohlížeči nebo u vybraných fotek „Přidat do výběru…“.'
            : `Zatím žádná fotka nemá ${stav.nejlepsiMin} a více srdíček. Fotky se hodnotí srdíčky na dlaždici nebo v prohlížeči klávesami 1–5.`}</p>`}
    `;
    listaNejlepsich.naplnit([...podleModelek].map(([jmeno, { indexy }], i) => ({ klic: i, nazev: jmeno, pocet: indexy.length })));
    listaNejlepsich.sledovat();
}

export async function upravitVyber(akce) {
    const vyber = stav.vyberyData.find(v => v.id === stav.nejlepsiVyber);
    if (!vyber) return;
    if (akce === 'prejmenovat') {
        const nazev = await vybratHodnotu({ nadpis: 'Přejmenovat výběr', popisek: 'Název', tlacitko: 'Přejmenovat', vychozi: vyber.nazev });
        if (nazev && !await PrejmenovatVyber(vyber.id, nazev)) oznamit('Výběr s tímto názvem už existuje.');
    } else if (await potvrdit('Smazat výběr', `Smazat výběr „${vyber.nazev}“? Fotky ve sbírce zůstanou, zmizí jen tento výběr.`, 'Smazat')) {
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
            stav.nejlepsiVyber = parseInt(vyberChip.dataset.vyberId);
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
