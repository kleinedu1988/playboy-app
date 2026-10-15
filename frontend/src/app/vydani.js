// Stránka vydání, ročníku a fotografa; údaje čísla
import { GetAlbaFotografa, GetClanky, GetVydani, GetVydaniInfo, SetVydaniInfo, SetNazevSpecialu } from './backend';
import { MESICE, esc, nazevAlba, nazevVydani, obrazek, paskaCisla, rozlozitVydani, sjednotit, slozitVydani, sklonovat, jeSpecial } from '../lib/format';
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
import { htmlClanku, otevritEditorClanku } from './clanky';

// Stránka vydání: vlevo cover, vpravo centerfold a pictorialy všech modelek z tohoto čísla
export async function otevritVydani(vydani, { bezHistorie = false } = {}) {
    if (!bezHistorie) zapamatovatMisto({ vydani });
    const moje = ++stav.cisloNacteni;
    const [fotky, info, clanky] = await Promise.all([GetVydani(vydani).then(f => f || []), GetVydaniInfo(vydani), GetClanky(vydani).then(c => c || [])]);
    if (moje !== stav.cisloNacteni) return;
    // Při obnovení téhož čísla zůstane otevřený článek, jinak se začíná alby
    if (vydani !== stav.aktualniVydani || !bezHistorie) stav.vydaniClanek = 0;
    stav.vydaniClanky = clanky;
    if (!clanky.some(c => c.id === stav.vydaniClanek)) stav.vydaniClanek = 0;
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

    // Obsah čísla: články podle stran, za nimi centerfold a pictorialy (ty stranu nemají)
    const albaObsahu = [...centerfoldy, ...ostatni];
    const polozkaObsahu = (strana, rubrika, nazev, atribut, aktivni) => `
        <button type="button" class="obsah-polozka ${aktivni ? 'active' : ''}" ${atribut}>
            <span class="obsah-strana">${strana || ''}</span>
            <span><span class="obsah-rubrika">${esc(rubrika)}</span><span class="obsah-nazev">${esc(nazev)}</span></span>
        </button>`;
    const obsah = [
        ...stav.vydaniClanky.map(c => polozkaObsahu(c.strana, c.rubrika || 'Článek', c.nazev, `data-clanek="${c.id}"`, c.id === stav.vydaniClanek)),
        ...albaObsahu.map((a, i) => polozkaObsahu('', a.typ, a.typ === 'Centerfold' ? a.jmenoModelky : a.album, `data-album-obsahu="${i}"`, false)),
    ].join('');
    const stavCisla = [
        coveryVydani.length ? 'cover' : 'bez coveru',
        centerfoldy.length ? `centerfold <b>${esc(centerfoldy.map(a => a.jmenoModelky).join(', '))}</b>` : 'bez centerfoldu',
        sklonovat(ostatni.length, 'pictorial', 'pictorialy', 'pictorialů'),
        sklonovat(fotky.length, 'fotka', 'fotky', 'fotek'),
    ].join(' · ');

    document.getElementById('issueSide').innerHTML = `
        <div class="posters">
            ${coveryVydani.flatMap(a => a.polozky).map(p => htmlPlakatu(p, VELIKOST_PLAKATU_MALA, `data-index="${index(p)}"`)).join('')
                || `<div class="profile-cover"><img src="${BEZ_FOTKY}" alt="Bez coveru" draggable="false" /></div>`}
        </div>
        <span class="panel-paska">${esc(paskaCisla(vydani))}</span>
        <h2>${esc(nazevVydani(vydani))}</h2>
        <div class="profile-actions pridat-do-cisla">
            <button class="volba" data-pridat="cover"><span aria-hidden="true">+</span>Cover</button>
            <button class="volba" data-pridat="centerfold"><span aria-hidden="true">+</span>Centerfold</button>
            <button class="volba" data-pridat="pictorial"><span aria-hidden="true">+</span>Pictorial</button>
        </div>
        <h4 class="panel-nadpis">Obsah<button type="button" data-novy-clanek title="Přidat článek do obsahu">+ článek</button></h4>
        <nav class="obsah-cisla">${obsah || '<p class="obsah-prazdny">Zatím bez článků. Přidej je tlačítkem + článek.</p>'}</nav>
        <h4 class="panel-nadpis">Číslo</h4>
        <p class="cislo-udaje">${stavCisla}${info.jmenoObalky ? `<br>na obálce <button class="link" data-modelka="${info.modelkaObalky}">${esc(info.jmenoObalky)}</button>`
            : info.naObalce ? `<br>na obálce <b>${esc(info.naObalce)}</b>` : ''}${info.stav ? `<br><b>${NAZVY_STAVU[info.stav].toLowerCase()}</b>` : ''}</p>
        ${info.poznamka ? `<p class="profile-note">${esc(info.poznamka)}</p>` : ''}
        <div class="profile-actions"><button class="volba issue-edit" data-upravit-vydani><span aria-hidden="true">✎</span>Upravit číslo…</button></div>
        ${centerfoldy.map((a, i) => `
            <section class="panel-centerfold" data-cast="album-${i}">
                <h4 class="panel-nadpis">Centerfold</h4>
                <div class="panel-centerfold-modelka">${odkazNaModelku(a)}</div>
                <div class="posters">${a.polozky.map(p => htmlPlakatu(p, VELIKOST_PLAKATU_MALA, `data-index="${index(p)}"`)).join('')}</div>
                ${htmlPopisuAlba(a)}
            </section>`).join('')}
    `;

    const htmlAlb = [
        ...ostatni.map((a, i) => `
            <section class="issue-album" data-cast="album-${centerfoldy.length + i}">
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
    ].join('') || `<p class="empty-state">${centerfoldy.length ? 'K tomuto vydání zatím není přiřazený žádný pictorial; přiřadí se v úpravě alba.'
        : 'K tomuto vydání zatím není přiřazený žádný centerfold ani pictorial. Centerfold se přiřadí měsícem a rokem, pictorial v úpravě alba.'}</p>`;
    stav.vydaniHtmlAlb = htmlAlb;
    vykreslitObsahStranky();
}

// Pravá část stránky čísla: alba čísla, nebo otevřený článek (podle stav.vydaniClanek)
function vykreslitObsahStranky() {
    const clanek = stav.vydaniClanky.find(c => c.id === stav.vydaniClanek);
    issueView.classList.toggle('cteni-clanku', Boolean(clanek));
    document.querySelectorAll('#issueSide [data-clanek]').forEach(b => b.classList.toggle('active', parseInt(b.dataset.clanek) === stav.vydaniClanek));
    document.getElementById('issueMain').innerHTML = clanek ? htmlClanku(clanek, stav.vydaniClanky) : stav.vydaniHtmlAlb;
    issueView.style.setProperty('--precteno', '0%');
    if (clanek) {
        requestAnimationFrame(oznacitPrecteno);
        // V proužku (úzké okno) je čtený článek vidět
        const prouzek = issueView.querySelector('.clanek-prouzek');
        const aktivni = prouzek?.querySelector('.active');
        if (aktivni) prouzek.scrollLeft = aktivni.offsetLeft - prouzek.clientWidth / 2 + aktivni.offsetWidth / 2;
    }
    if (!clanek) {
        issueView.querySelectorAll('#issueMain .poster').forEach(p => pripravitPlakat(p));
        issueView.querySelectorAll('#issueSide .poster').forEach(p => pripravitPlakat(p));
        pripravitPopisy(issueView);
        zkratitAlba(issueView);
    } else {
        issueView.querySelectorAll('#issueSide .poster').forEach(p => pripravitPlakat(p));
    }
}

// Otevření článku (0 = zpět na alba čísla)
export function ukazatClanek(id) {
    stav.vydaniClanek = id;
    vykreslitObsahStranky();
    document.querySelector('main').scrollTop = 0;
}

// Obnovení stránky vydání, ročníku nebo fotografa po změně
export function obnovitStranku() {
    if (stav.aktualniFotograf) return otevritFotografa(stav.aktualniFotograf, { bezHistorie: true });
    return otevritVydani(stav.aktualniVydani, { bezHistorie: true });
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
    const cisel = [...podleMesicu.keys()].filter(m => m && !m.startsWith('S')).length;
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
    const nazevMesice = m => !m ? 'Celý ročník' : m.startsWith('S') ? nazevVydani(slozitVydani(casti.rok, m, casti.edice)).replace(/ \d{4}( · .*)?$/, '') : MESICE[parseInt(m) - 1];
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
export const NAZVY_STAVU = { mam: 'Mám výtisk', shanim: 'Sháním', nezajima: 'Nezajímá mě' };
export const issueModal = document.getElementById('issueModal');

export async function upravitVydani(vydani) {
    stav.upravovaneVydani = vydani;
    const [info, modelky] = await Promise.all([GetVydaniInfo(vydani), vsechnyModelky()]);
    document.getElementById('issueModalTitle').textContent = nazevVydani(vydani);
    document.getElementById('selectIssueStav').value = info.stav;
    document.getElementById('issueNazevGroup').classList.toggle('hidden', !jeSpecial(vydani));
    document.getElementById('inputIssueNazev').value = info.nazev || '';
    document.getElementById('inputIssueNazev').required = jeSpecial(vydani);
    document.getElementById('inputIssueObalka').value = info.jmenoObalky || info.naObalce;
    document.getElementById('inputIssuePoznamka').value = info.poznamka;
    document.getElementById('seznamModelekObalky').innerHTML = (modelky || []).map(m => `<option value="${esc(m.jmeno)}"></option>`).join('');
    issueModal.classList.remove('hidden');
    document.getElementById('inputIssuePoznamka').focus();
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
// Ukazatel přečteného: kolik z otevřeného článku už odrolovalo (0–100 %) v obsahu vlevo i v proužku
function oznacitPrecteno() {
    const clanek = issueView.querySelector('.clanek');
    if (!clanek || issueView.classList.contains('hidden')) return;
    const oblast = document.querySelector('main');
    const zbyva = clanek.offsetHeight - oblast.clientHeight;
    const odrolovano = oblast.getBoundingClientRect().top - clanek.getBoundingClientRect().top;
    const procent = zbyva > 0 ? Math.min(100, Math.max(0, odrolovano / zbyva * 100)) : 100;
    issueView.style.setProperty('--precteno', `${procent}%`);
}

export function pripravit() {
    document.querySelector('main').addEventListener('scroll', oznacitPrecteno, { passive: true });
    document.getElementById('issueForm').onsubmit = jednou(async (e) => {
        e.preventDefault();
        // Modelka ze sbírky se propojí s profilem; jméno, které ve sbírce není, se uloží jako text
        const jmeno = document.getElementById('inputIssueObalka').value.trim();
        const modelka = jmeno ? (await vsechnyModelky()).find(m => sjednotit(m.jmeno) === sjednotit(jmeno)) : null;
        if (jeSpecial(stav.upravovaneVydani) && !await SetNazevSpecialu(stav.upravovaneVydani, document.getElementById('inputIssueNazev').value)) {
            oznamit('Název speciálu se nepodařilo uložit.');
            return;
        }
        if (!await SetVydaniInfo(stav.upravovaneVydani, document.getElementById('inputIssuePoznamka').value, document.getElementById('selectIssueStav').value, modelka?.id || 0, modelka ? '' : jmeno)) {
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
        // Obsah čísla: článek, album čísla, nový článek; v článku úprava, skeny a sousední články
        const clanek = e.target.closest('[data-clanek]');
        const albumObsahu = e.target.closest('[data-album-obsahu]');
        if (clanek) {
            e.stopPropagation();
            ukazatClanek(parseInt(clanek.dataset.clanek));
            return;
        }
        if (albumObsahu) {
            e.stopPropagation();
            // Centerfold je v levém panelu (sjede se v něm), pictorialy vpravo mezi alby čísla
            const cil = () => issueView.querySelector(`[data-cast="album-${albumObsahu.dataset.albumObsahu}"]`);
            if (stav.vydaniClanek && !cil()?.closest('#issueSide')) ukazatClanek(0);
            cil()?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        if (e.target.closest('[data-alba-cisla]')) {
            ukazatClanek(0);
            return;
        }
        if (e.target.closest('[data-novy-clanek]')) {
            otevritEditorClanku(null, stav.aktualniVydani);
            return;
        }
        if (e.target.closest('[data-upravit-clanek]')) {
            otevritEditorClanku(stav.vydaniClanky.find(c => c.id === stav.vydaniClanek), stav.aktualniVydani);
            return;
        }
        const sken = e.target.closest('[data-sken]');
        if (sken) {
            // Skeny stran v prohlížeči fotek, od kliknutého
            const c = stav.vydaniClanky.find(x => x.id === stav.vydaniClanek);
            const polozky = c.skenyUrl.map((url, i) => ({ fotky: [{ id: 0, url, rotace: 0, driveId: c.skeny[i], hodnoceni: 0 }], album: c.nazev, typ: 'Sken', modelkaId: 0, jmenoModelky: '', rotace: 0, hodnoceni: 0 }));
            otevritLightbox(parseInt(sken.dataset.sken), false, polozky);
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
