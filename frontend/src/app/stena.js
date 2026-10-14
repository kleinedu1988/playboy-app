// Stěna centerfoldů a covery časopisů
import { GetCenterfoldy, GetCovery } from './backend';
import { bezDiakritiky, esc, nazevAlba, rozlozitVydani, sjednotit } from '../lib/format';
import { sestavitAlba } from '../lib/alba';
import { stav } from './stav';
import { covers, coversList, searchInput, wall } from './prvky';
import { listaCoveru, listaSteny } from './listy';
import { VELIKOST_PLAKATU_MALA } from './obrazky';
import { ukazatPohled } from './navigace';
import { htmlPlakatu, pripravitPlakat } from './profil';
import { otevritVydani } from './vydani';
import { prevestNaVolby } from '../ui/volby';

export async function nacistStenu(dotaz = '', zMezipameti = false) {
    const moje = ++stav.cisloNacteni;
    const fotky = zMezipameti && stav.stenaData ? stav.stenaData : await GetCenterfoldy() || [];
    if (moje !== stav.cisloNacteni) return;
    stav.stenaData = fotky;
    stav.zrusitUpravuVyrezu = null;
    ukazatPohled(wall);

    const hledat = sjednotit(dotaz);
    const vyhovuje = f => !hledat || [f.jmenoModelky, f.album, nazevAlba(f.album, f.typ)].some(t => bezDiakritiky(t).includes(hledat));
    stav.stenaPolozky = sestavitAlba(fotky.filter(vyhovuje)).flatMap(a => a.polozky);
    // Chronologicky: podle vydání (rok, měsíc, edice) jako časová osa, s lištou desetiletí
    const klicVydani = p => { const v = rozlozitVydani(p.album); return v ? `${v.rok}${v.mesic}${v.edice}` : '9999'; };
    if (stav.stenaChronologicky) stav.stenaPolozky.sort((x, y) => klicVydani(x).localeCompare(klicVydani(y)));
    wall.classList.toggle('chronologicky', stav.stenaChronologicky);

    const razeni = `<div class="wall-toolbar">
        <button class="chip ${stav.stenaChronologicky ? '' : 'active'}" data-razeni-steny="jmeno">Podle jména</button>
        <button class="chip ${stav.stenaChronologicky ? 'active' : ''}" data-razeni-steny="vydani">Podle vydání</button></div>`;
    if (stav.stenaPolozky.length === 0) {
        listaSteny.naplnit([]);
        wall.innerHTML = razeni + `<div class="empty-state">${fotky.length ? 'Hledání neodpovídá žádný centerfold.' : 'Zatím žádné centerfoldy. Přidej je tlačítkem + nahoře.'}</div>`;
        prevestNaVolby(wall.querySelector('.wall-toolbar'));
        return;
    }

    const dekady = new Map();
    const znackaDekady = p => {
        if (!stav.stenaChronologicky) return '';
        const rok = parseInt(rozlozitVydani(p.album)?.rok);
        if (!rok) return '';
        const dekada = Math.floor(rok / 10) * 10;
        const prvni = !dekady.has(dekada);
        dekady.set(dekada, (dekady.get(dekada) || 0) + 1);
        return prvni ? `data-cast="${dekada}"` : '';
    };
    wall.innerHTML = razeni + stav.stenaPolozky.map((p, i) => `
        <figure class="wall-item" tabindex="0" data-index="${i}" ${znackaDekady(p)}>
            ${htmlPlakatu(p, VELIKOST_PLAKATU_MALA, '', true)}
            <figcaption>
                <strong>${esc(p.jmenoModelky)}</strong>
                <span>${esc(nazevAlba(p.album, p.typ))}</span>
            </figcaption>
        </figure>
    `).join('');
    prevestNaVolby(wall.querySelector('.wall-toolbar'));
    listaSteny.naplnit([...dekady].map(([dekada, pocet]) => ({ klic: dekada, nazev: `${dekada}–${dekada + 9}`, pocet })));
    listaSteny.sledovat();
    wall.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
}

export async function nacistCovery(dotaz = '', zMezipameti = false) {
    const moje = ++stav.cisloNacteni;
    const [fotky, centerfoldy] = zMezipameti && stav.coveryData ? stav.coveryData : await Promise.all([GetCovery(), GetCenterfoldy()]);
    if (moje !== stav.cisloNacteni) return;
    stav.coveryData = [fotky, centerfoldy];
    stav.zrusitUpravuVyrezu = null;
    ukazatPohled(covers);

    // Modelka z centerfoldu téhož vydání, pokud už je v databázi
    const playmate = new Map((centerfoldy || []).map(f => [f.album, f.jmenoModelky]));

    const hledat = sjednotit(dotaz);
    const vyhovuje = f => !hledat || [f.album, nazevAlba(f.album, f.typ), playmate.get(f.album) || ''].some(t => bezDiakritiky(t).includes(hledat));
    stav.coveryPolozky = sestavitAlba((fotky || []).filter(vyhovuje)).flatMap(a => a.polozky);

    if (stav.coveryPolozky.length === 0) {
        listaCoveru.naplnit([]);
        coversList.innerHTML = `<div class="empty-state">${fotky?.length ? 'Hledání neodpovídá žádný cover.' : 'Zatím žádné covery. Přidej je tlačítkem + nahoře.'}</div>`;
        return;
    }

    const rocniky = new Map();
    stav.coveryPolozky.forEach((p, i) => {
        const rok = /^\d{4}/.exec(p.album)?.[0] || 'Ostatní';
        if (!rocniky.has(rok)) rocniky.set(rok, []);
        rocniky.get(rok).push(i);
    });

    listaCoveru.naplnit([...rocniky].map(([rok, indexy]) => ({ klic: rok, nazev: rok, pocet: indexy.length })));
    coversList.innerHTML = [...rocniky].map(([rok, indexy]) => `
        <section class="cover-year" data-cast="${esc(rok)}">
            <h3>${esc(rok)}</h3>
            <div class="covers-grid">
                ${indexy.map(i => {
                    const p = stav.coveryPolozky[i];
                    return `
                        <figure class="cover-item" tabindex="0" data-index="${i}">
                            ${htmlPlakatu(p, VELIKOST_PLAKATU_MALA, '', true)}
                            <figcaption>
                                <strong>${esc(nazevAlba(p.album, p.typ))}</strong>
                                ${playmate.has(p.album) ? `<span>Centerfold: ${esc(playmate.get(p.album))}</span>` : ''}
                            </figcaption>
                        </figure>
                    `;
                }).join('')}
            </div>
        </section>
    `).join('');
    covers.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
    listaCoveru.sledovat();
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    try { stav.stenaChronologicky = localStorage.getItem('stenaChronologicky') === '1'; } catch { /* podle jména */ }

    wall.addEventListener('click', (e) => {
        const razeni = e.target.closest('[data-razeni-steny]');
        if (!razeni) return;
        e.stopPropagation();
        stav.stenaChronologicky = razeni.dataset.razeniSteny === 'vydani';
        try { localStorage.setItem('stenaChronologicky', stav.stenaChronologicky ? '1' : ''); } catch { /* jen se nezapamatuje */ }
        nacistStenu(searchInput.value, true);
    }, true);

    covers.addEventListener('click', (e) => {
        const polozka = e.target.closest('.cover-item');
        if (polozka) otevritVydani(stav.coveryPolozky[parseInt(polozka.dataset.index)].album);
    });
}
