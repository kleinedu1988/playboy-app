// Stránka vydání, ročníku a fotografa; údaje čísla
import { GetAlbaFotografa, GetVydani, GetVydaniInfo, SetVydaniInfo } from './backend';
import { MESICE, esc, nazevAlba, nazevVydani, obrazek, rozlozitVydani, sjednotit, slozitVydani, sklonovat } from '../lib/format';
import { sestavitAlba } from '../lib/alba';
import { jednou, oznamit } from '../ui/oznameni';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { vybratKliknutim } from './vyber';
import { htmlAkciDlazdice } from './akce-fotky';
import { calendar, issueView, searchInput } from './prvky';
import { listaStranky } from './listy';
import { BEZ_FOTKY, VELIKOST_NAHLEDU, VELIKOST_PLAKATU, VELIKOST_PLAKATU_MALA } from './obrazky';
import { ukazatPohled, zapamatovatMisto } from './navigace';
import { htmlSrdickaFotky } from './galerie';
import { atributyMrizky, htmlPlakatu, htmlPopisuAlba, pripravitPlakat, pripravitPopisy, rozbalitKliknute, zkratitAlba } from './profil';
import { nacistKalendar } from './kalendar';
import { otevritCoverModal } from './cover';
import { otevritLightbox } from './prohlizec';
import { pridatCenterfold, pridatPictorial } from './formular-alba';

// Stránka vydání: vlevo cover, vpravo centerfold a pictorialy všech modelek z tohoto čísla
export async function otevritVydani(vydani, { bezHistorie = false } = {}) {
    if (!bezHistorie) zapamatovatMisto({ vydani });
    const moje = ++stav.cisloNacteni;
    const [fotky, info] = await Promise.all([GetVydani(vydani).then(f => f || []), GetVydaniInfo(vydani)]);
    if (moje !== stav.cisloNacteni) return;
    stav.aktualniVydani = vydani;
    stav.aktualniFotograf = null;
    ukazatPohled(issueView);
    document.querySelector('main').scrollTop = 0;
    // Ročník (bez měsíce) má vlastní rozvržení po měsících
    if (!rozlozitVydani(vydani)?.mesic) return vykreslitRocnik(vydani, fotky);
    listaStranky.naplnit([]);

    const alba = sestavitAlba(fotky);
    const coveryVydani = alba.filter(a => a.typ === 'Cover');
    const centerfoldy = alba.filter(a => a.typ === 'Centerfold');
    const ostatni = alba.filter(a => a.typ !== 'Cover' && a.typ !== 'Centerfold');
    // Pořadí pro prohlížeč: cover, centerfold, pictorialy
    stav.vydaniPolozky = [...coveryVydani, ...centerfoldy, ...ostatni].flatMap(a => a.polozky);
    // Index položky z mapy sestavené jednou, ne hledáním v poli u každé dlaždice
    const indexy = new Map(stav.vydaniPolozky.map((p, i) => [p, i]));
    const index = p => indexy.get(p);
    // Ročník bez měsíce sdružuje jen pictorialy; cover ani centerfold nemá
    const jenRocnik = !rozlozitVydani(vydani)?.mesic;
    const odkazNaModelku = a => [{ id: a.modelkaId, jmeno: a.jmenoModelky }, ...a.dalsiModelky]
        .map(m => `<button class="chip" data-modelka="${m.id}" title="Otevřít profil modelky">${esc(m.jmeno)}</button>`).join(' ');

    document.getElementById('issueSide').innerHTML = `
        <div class="posters">
            ${coveryVydani.flatMap(a => a.polozky).map(p => htmlPlakatu(p, VELIKOST_PLAKATU_MALA, `data-index="${index(p)}"`)).join('')
                || `<div class="profile-cover"><img src="${BEZ_FOTKY}" alt="Bez coveru" draggable="false" /></div>`}
        </div>
        <h2>${jenRocnik ? 'Ročník ' : ''}${esc(nazevVydani(vydani))}</h2>
        <div class="issue-add">
            ${jenRocnik ? '' : '<button class="chip" data-pridat="cover">+ cover</button><button class="chip" data-pridat="centerfold">+ centerfold</button>'}
            <button class="chip" data-pridat="pictorial">+ pictorial</button>
        </div>
        <dl class="profile-info">
            ${jenRocnik ? '' : `
            <div><dt>Cover</dt><dd>${coveryVydani.length ? 'Ano' : 'Zatím chybí'}</dd></div>
            <div><dt>Centerfold</dt><dd>${centerfoldy.map(a => esc(a.jmenoModelky)).join(', ') || 'Zatím chybí'}</dd></div>`}
            <div><dt>Pictorialy</dt><dd>${ostatni.length}</dd></div>
            <div><dt>Fotek celkem</dt><dd>${fotky.length}</dd></div>
            ${info.jmenoObalky ? `<div><dt>Na obálce</dt><dd><button class="chip" data-modelka="${info.modelkaObalky}">${esc(info.jmenoObalky)}</button></dd></div>` : ''}
            ${info.stav ? `<div><dt>Stav</dt><dd>${NAZVY_STAVU[info.stav]}</dd></div>` : ''}
        </dl>
        ${info.poznamka ? `<p class="profile-note">${esc(info.poznamka)}</p>` : ''}
        <button class="btn btn-secondary btn-small issue-edit" data-upravit-vydani>Upravit číslo…</button>
    `;

    document.getElementById('issueMain').innerHTML = [
        ...centerfoldy.map(a => `
            <section class="issue-album">
                <div class="album-header">
                    <h4>Centerfold</h4>
                    ${odkazNaModelku(a)}
                </div>
                ${htmlPopisuAlba(a)}
                <div class="posters">${a.polozky.map(p => htmlPlakatu(p, VELIKOST_PLAKATU, `data-index="${index(p)}"`)).join('')}</div>
            </section>
        `),
        ...ostatni.map(a => `
            <section class="issue-album">
                <div class="album-header">
                    <h4>${esc(a.album)}</h4>
                    <span>${esc(a.typ)} · ${sklonovat(a.fotky.length, 'fotka', 'fotky', 'fotek')}</span>
                    ${odkazNaModelku(a)}
                </div>
                ${htmlPopisuAlba(a)}
                <div class="photos-grid" ${atributyMrizky(a)}>
                    ${a.polozky.map(p => `
                        <div class="photo-item" data-index="${index(p)}" tabindex="0">
                            <img src="${esc(obrazek(p.fotky[0].url, VELIKOST_NAHLEDU))}" loading="lazy" draggable="false" />
                            ${htmlSrdickaFotky(p, index(p))}
                                   ${htmlAkciDlazdice()}
                        </div>
                    `).join('')}
                </div>
            </section>
        `),
    ].join('') || '<p class="empty-state">K tomuto vydání zatím není přiřazený žádný centerfold ani pictorial. Centerfold se přiřadí měsícem a rokem, pictorial v úpravě alba.</p>';

    issueView.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
    pripravitPopisy(issueView);
    zkratitAlba(issueView);
}

// Obnovení stránky vydání, ročníku nebo fotografa po změně
export function obnovitStranku() {
    if (stav.aktualniFotograf) otevritFotografa(stav.aktualniFotograf, { bezHistorie: true });
    else otevritVydani(stav.aktualniVydani, { bezHistorie: true });
}

// Dlaždice fotky na stránce vydání, ročníku, fotografa a v Nejlepších
export const htmlDlazdice = (p, index) => `
    <div class="photo-item" data-index="${index}" data-foto-id="${p.fotky[0].id}" tabindex="0">
        <img src="${esc(obrazek(p.fotky[0].url, VELIKOST_NAHLEDU))}" loading="lazy" draggable="false" />
        ${htmlSrdickaFotky(p, index)}
                                   ${htmlAkciDlazdice()}
    </div>`;

// Album na stránce ročníku nebo fotografa: hlavička s modelkami, text a fotky (centerfold a cover jako plakát)
export function htmlAlbaStranky(a, index, { nadpis = nazevAlba(a.album, a.typ), sVydanim = false } = {}) {
    const plakat = a.typ === 'Centerfold' || a.typ === 'Cover';
    const modelky = [{ id: a.modelkaId, jmeno: a.jmenoModelky }, ...a.dalsiModelky].filter(m => m.jmeno)
        .map(m => `<button class="chip" data-modelka="${m.id}" title="Otevřít profil modelky">${esc(m.jmeno)}</button>`).join(' ');
    const vydani = a.typ === 'Centerfold' || a.typ === 'Cover' ? a.album : a.vydani;
    return `
        <section class="issue-album">
            <div class="album-header">
                <h4>${esc(nadpis)}</h4>
                <span>${esc(a.typ)}${plakat ? '' : ` · ${sklonovat(a.fotky.length, 'fotka', 'fotky', 'fotek')}`}</span>
                ${sVydanim && vydani ? `<button class="chip" data-vydani="${esc(vydani)}" title="Otevřít vydání">${esc(nazevVydani(vydani))}</button>` : ''}
                ${modelky}
            </div>
            ${htmlPopisuAlba(a)}
            ${plakat
                ? `<div class="posters">${a.polozky.map(p => htmlPlakatu(p, VELIKOST_PLAKATU_MALA, `data-index="${index(p)}"`, true)).join('')}</div>`
                : `<div class="photos-grid" ${atributyMrizky(a)}>${a.polozky.map(p => htmlDlazdice(p, index(p))).join('')}</div>`}
        </section>`;
}

// Ročník: všechna čísla roku po měsících a pictorialy přiřazené jen k ročníku; lišta měsíců nahoře
export function vykreslitRocnik(vydani, fotky) {
    const casti = rozlozitVydani(vydani);
    const mesic = a => rozlozitVydani(a.typ === 'Centerfold' || a.typ === 'Cover' ? a.album : a.vydani)?.mesic || '';
    const poradiTypu = { Cover: 0, Centerfold: 1 };
    const alba = sestavitAlba(fotky).sort((x, y) => (mesic(x) || '99').localeCompare(mesic(y) || '99') || (poradiTypu[x.typ] ?? 2) - (poradiTypu[y.typ] ?? 2));
    stav.vydaniPolozky = alba.flatMap(a => a.polozky);
    // Index položky z mapy sestavené jednou, ne hledáním v poli u každé dlaždice
    const indexy = new Map(stav.vydaniPolozky.map((p, i) => [p, i]));
    const index = p => indexy.get(p);

    const podleMesicu = new Map();
    alba.forEach(a => {
        if (!podleMesicu.has(mesic(a))) podleMesicu.set(mesic(a), []);
        podleMesicu.get(mesic(a)).push(a);
    });
    const cisel = [...podleMesicu.keys()].filter(Boolean).length;
    const pocet = typ => alba.filter(a => typ === 'Pictorial' ? a.typ !== 'Cover' && a.typ !== 'Centerfold' : a.typ === typ).length;

    document.getElementById('issueSide').innerHTML = `
        <h2>Ročník ${esc(nazevVydani(vydani))}</h2>
        <div class="issue-add"><button class="chip" data-pridat="pictorial">+ pictorial</button></div>
        <dl class="profile-info">
            <div><dt>Čísel ve sbírce</dt><dd>${cisel} z 12</dd></div>
            <div><dt>Coverů</dt><dd>${pocet('Cover')}</dd></div>
            <div><dt>Centerfoldů</dt><dd>${pocet('Centerfold')}</dd></div>
            <div><dt>Pictorialů</dt><dd>${pocet('Pictorial')}</dd></div>
            <div><dt>Fotek celkem</dt><dd>${fotky.length}</dd></div>
        </dl>
    `;
    const nazevMesice = m => m ? MESICE[parseInt(m) - 1] : 'Celý ročník';
    document.getElementById('issueMain').innerHTML = [...podleMesicu].map(([m, albaMesice]) => `
        <section class="issue-month" data-cast="${m || 'rok'}">
            <h3>${esc(nazevMesice(m))}
                ${m ? `<button class="chip" data-vydani="${esc(slozitVydani(casti.rok, m, casti.edice))}" title="Otevřít číslo">Otevřít číslo</button>` : ''}</h3>
            ${albaMesice.map(a => htmlAlbaStranky(a, index, { nadpis: a.typ === 'Cover' ? 'Cover' : a.typ === 'Centerfold' ? 'Centerfold' : nazevAlba(a.album, a.typ) })).join('')}
        </section>
    `).join('') || '<p class="empty-state">Z tohoto ročníku zatím ve sbírce nic není.</p>';
    listaStranky.naplnit([...podleMesicu].map(([m, albaMesice]) => ({ klic: m || 'rok', nazev: nazevMesice(m), pocet: albaMesice.reduce((s, a) => s + a.fotky.length, 0) })));

    issueView.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
    pripravitPopisy(issueView);
    zkratitAlba(issueView);
    listaStranky.sledovat();
}

// Stránka fotografa: jeho alba napříč modelkami, chronologicky
export async function otevritFotografa(jmeno, { bezHistorie = false } = {}) {
    if (!bezHistorie) zapamatovatMisto({ fotograf: jmeno });
    const moje = ++stav.cisloNacteni;
    const fotky = await GetAlbaFotografa(jmeno) || [];
    if (moje !== stav.cisloNacteni) return;
    stav.aktualniFotograf = jmeno;
    ukazatPohled(issueView);
    document.querySelector('main').scrollTop = 0;

    const alba = sestavitAlba(fotky).sort((x, y) => {
        const v = a => (a.typ === 'Centerfold' || a.typ === 'Cover' ? a.album : a.vydani) || '9999';
        return v(x).localeCompare(v(y));
    });
    stav.vydaniPolozky = alba.flatMap(a => a.polozky);
    // Index položky z mapy sestavené jednou, ne hledáním v poli u každé dlaždice
    const indexy = new Map(stav.vydaniPolozky.map((p, i) => [p, i]));
    const index = p => indexy.get(p);
    const modelek = new Set(alba.flatMap(a => [a.modelkaId, ...a.dalsiModelky.map(m => m.id)])).size;

    document.getElementById('issueSide').innerHTML = `
        <h2>${esc(jmeno)}</h2>
        <p class="profile-aliases">fotograf</p>
        <dl class="profile-info">
            <div><dt>Alb</dt><dd>${alba.length}</dd></div>
            <div><dt>Modelek</dt><dd>${modelek}</dd></div>
            <div><dt>Fotek celkem</dt><dd>${fotky.length}</dd></div>
        </dl>
    `;
    document.getElementById('issueMain').innerHTML = alba.map((a, i) => `<div data-cast="${i}">${htmlAlbaStranky(a, index, { sVydanim: true })}</div>`).join('')
        || '<p class="empty-state">Fotograf zatím nemá žádné album.</p>';
    listaStranky.naplnit(alba.map((a, i) => ({ klic: i, nazev: `${a.jmenoModelky} – ${nazevAlba(a.album, a.typ)}`, pocet: a.fotky.length })));

    issueView.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
    pripravitPopisy(issueView);
    zkratitAlba(issueView);
    listaStranky.sledovat();
}

// Údaje čísla: stav ve sbírce, modelka z obálky, poznámka
export const NAZVY_STAVU = { shanim: 'Sháním', nezajima: 'Nezajímá mě' };
export const issueModal = document.getElementById('issueModal');

export async function upravitVydani(vydani) {
    stav.upravovaneVydani = vydani;
    const [info, modelky] = await Promise.all([GetVydaniInfo(vydani), vsechnyModelky()]);
    document.getElementById('issueModalTitle').textContent = nazevVydani(vydani);
    document.getElementById('selectIssueStav').value = info.stav;
    document.getElementById('inputIssueObalka').value = info.jmenoObalky;
    document.getElementById('inputIssuePoznamka').value = info.poznamka;
    document.getElementById('seznamModelekObalky').innerHTML = (modelky || []).map(m => `<option value="${esc(m.jmeno)}"></option>`).join('');
    issueModal.classList.remove('hidden');
    document.getElementById('inputIssuePoznamka').focus();
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    document.getElementById('issueForm').onsubmit = jednou(async (e) => {
        e.preventDefault();
        const jmeno = document.getElementById('inputIssueObalka').value.trim();
        const modelka = jmeno ? (await vsechnyModelky()).find(m => sjednotit(m.jmeno) === sjednotit(jmeno)) : null;
        if (jmeno && !modelka) {
            oznamit(`Modelka „${jmeno}“ ve sbírce není. Vyber ji ze seznamu, nebo ji nejdřív založ.`);
            return;
        }
        if (!await SetVydaniInfo(stav.upravovaneVydani, document.getElementById('inputIssuePoznamka').value, document.getElementById('selectIssueStav').value, modelka?.id || 0)) {
            oznamit('Údaje čísla se nepodařilo uložit.');
            return;
        }
        issueModal.classList.add('hidden');
        if (!issueView.classList.contains('hidden')) obnovitStranku();
        else if (!calendar.classList.contains('hidden')) nacistKalendar(searchInput.value, true);
    });

    // Přidávání přímo ze stránky vydání: vydání je předvyplněné, vybírá se jen modelka
    issueView.addEventListener('click', (e) => {
        if (e.target.closest('[data-upravit-vydani]')) {
            upravitVydani(stav.aktualniVydani);
            return;
        }
        const pridat = e.target.closest('[data-pridat]')?.dataset.pridat;
        if (!pridat) return;
        e.stopPropagation();
        if (pridat === 'cover') otevritCoverModal(null, stav.aktualniVydani);
        else if (pridat === 'centerfold') pridatCenterfold(stav.aktualniVydani);
        else pridatPictorial(stav.aktualniVydani);
    });

    issueView.addEventListener('click', (e) => {
        if (vybratKliknutim(e)) return;
        if (e.target.closest('[data-modelka], [data-vydani], .hearts') || rozbalitKliknute(e)) return;
        const polozka = e.target.closest('[data-index]');
        if (polozka) otevritLightbox(parseInt(polozka.dataset.index), false, stav.vydaniPolozky);
    });
}
