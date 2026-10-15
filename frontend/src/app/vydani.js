// Stránka vydání, ročníku a fotografa; údaje čísla
import { GetAlbaFotografa, GetClanky, GetStavyVydani, GetVydani, GetVydaniInfo, SetVydaniInfo, SetNazevSpecialu } from './backend';
import { MESICE, VYCHOZI_EDICE, esc, nazevAlba, nazevVydani, obrazek, paskaCisla, rozlozitVydani, sjednotit, slozitVydani, sklonovat, jeSpecial, specialyRoku } from '../lib/format';
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
import { nacistKalendar, oznacitCislo, pridatKVydani } from './kalendar';
import { otevritKontextovouNabidku } from '../ui/nabidka';
import { otevritCoverModal } from './cover';
import { otevritLightbox } from './prohlizec';
import { pridatCenterfold, pridatPictorial } from './formular-alba';
import { htmlClanku, htmlProuzku, otevritEditorClanku } from './clanky';
import { otevritCtecku } from './ctecka';

// Stránka vydání: vlevo cover, vpravo centerfold a pictorialy všech modelek z tohoto čísla
export async function otevritVydani(vydani, { bezHistorie = false } = {}) {
    if (!bezHistorie) zapamatovatMisto({ vydani });
    const moje = ++stav.cisloNacteni;
    const [fotky, info, clanky] = await Promise.all([GetVydani(vydani).then(f => f || []), GetVydaniInfo(vydani), GetClanky(vydani).then(c => c || [])]);
    if (moje !== stav.cisloNacteni) return;
    stav.vydaniClanky = clanky;
    stav.aktualniVydani = vydani;
    stav.aktualniFotograf = null;
    ukazatPohled(issueView);
    document.querySelector('main').scrollTop = 0;
    // Ročník (bez měsíce) má vlastní rozvržení po měsících
    if (!rozlozitVydani(vydani)?.mesic) {
        // Ročník ukazuje u chybějících čísel i jejich stav (sháním, výtisk)
        const stavy = await GetStavyVydani() || [];
        if (moje !== stav.cisloNacteni) return;
        stav.stavyVydaniData = stavy;
        return vykreslitRocnik(vydani, fotky);
    }
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
        ...stav.vydaniClanky.map(c => polozkaObsahu(c.strana, c.rubrika || 'Článek', c.nazev, `data-clanek="${c.id}"`, false)),
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

// Pravá část stránky čísla: články pod sebou podle stran, za nimi pictorialy; obsah vlevo ukazuje, kde se čte
function vykreslitObsahStranky() {
    const prouzek = stav.vydaniClanky.length ? htmlProuzku([
        ...stav.vydaniClanky.map(c => ({ strana: c.strana, nazev: c.nazev, atribut: `data-clanek="${c.id}"` })),
        ...[...document.querySelectorAll('#issueSide [data-album-obsahu]')].map(b => ({ strana: 0, nazev: b.querySelector('.obsah-nazev').textContent, atribut: `data-album-obsahu="${b.dataset.albumObsahu}"` })),
    ]) : '';
    document.getElementById('issueMain').innerHTML = prouzek + stav.vydaniClanky.map(c => htmlClanku(c)).join('') + stav.vydaniHtmlAlb;
    issueView.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
    pripravitPopisy(issueView);
    zkratitAlba(issueView);
    requestAnimationFrame(oznacitPrecteno);
}

// Posun na článek (pod sebou s ostatními)
export function ukazatClanek(id, plynule = true) {
    issueView.querySelector(`[data-cast="clanek-${id}"]`)?.scrollIntoView({ behavior: plynule ? 'smooth' : 'auto', block: 'start' });
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
    const alba = sestavitAlba(fotky);
    const podleMesicu = new Map();
    alba.forEach(a => {
        if (!podleMesicu.has(mesic(a))) podleMesicu.set(mesic(a), []);
        podleMesicu.get(mesic(a)).push(a);
    });
    const pocet = typ => alba.filter(a => typ === 'Pictorial' ? a.typ !== 'Cover' && a.typ !== 'Centerfold' : a.typ === typ).length;
    const cisel = [...podleMesicu.keys()].filter(m => m && !m.startsWith('S')).length;
    // Stav čísla (výtisk, sháním) z kalendáře, pokud už je načtený
    const stavCisla = new Map((stav.stavyVydaniData || []).map(x => [x.vydani, x.stav]));

    // Karta čísla: cover s páskou (bez coveru centerfold), v rohu náhled centerfoldu, pod ní playmate a obsah
    const karta = (m, nazev) => {
        const klic = slozitVydani(casti.rok, m, casti.edice);
        const albaCisla = podleMesicu.get(m) || [];
        const cover = albaCisla.find(a => a.typ === 'Cover');
        const centerfold = albaCisla.find(a => a.typ === 'Centerfold');
        const pictorialu = albaCisla.filter(a => a.typ !== 'Cover' && a.typ !== 'Centerfold').length;
        const stavKlice = stavCisla.get(klic);
        if (!albaCisla.length) {
            return `<button class="rocnik-karta chybi ${stavKlice || ''}" data-prazdne="${esc(klic)}" title="${esc(nazevVydani(klic))} – chybí, klikni pro přidání">
                <span class="rocnik-obalka"><span class="rocnik-plus">+</span></span>
                <span class="rocnik-popis"><b>${esc(nazev)}</b>${stavKlice === 'shanim' ? 'sháním' : stavKlice === 'mam' ? 'mám výtisk' : 'chybí'}</span></button>`;
        }
        const hlavni = cover || centerfold || albaCisla[0];
        const obsah = [cover && 'cover', centerfold && 'centerfold', pictorialu && sklonovat(pictorialu, 'pictorial', 'pictorialy', 'pictorialů')].filter(Boolean).join(' · ');
        return `<button class="rocnik-karta" data-vydani="${esc(klic)}" title="Otevřít ${esc(nazevVydani(klic))}">
            <span class="rocnik-obalka">
                <img src="${esc(obrazek(hlavni.fotky[0].url, VELIKOST_PLAKATU_MALA))}" alt="" loading="lazy" draggable="false" />
                <span class="rocnik-paska">${esc(paskaCisla(klic) || nazev)}</span>
                ${stavKlice === 'mam' ? '<span class="rocnik-stav">výtisk</span>' : ''}
                ${cover && centerfold ? `<span class="rocnik-cf"><img src="${esc(obrazek(centerfold.fotky[0].url, VELIKOST_NAHLEDU))}" alt="" loading="lazy" draggable="false" /></span>` : ''}
            </span>
            <span class="rocnik-popis"><b>${esc(centerfold?.jmenoModelky || nazev)}</b>${esc(obsah)}</span></button>`;
    };

    // Speciály roku: pojmenované i ty, ke kterým jsou jen alba
    const specialy = new Map(specialyRoku(casti.rok, casti.edice).map(x => [rozlozitVydani(x.vydani).mesic, x.nazev]));
    [...podleMesicu.keys()].filter(m => m.startsWith('S') && !specialy.has(m))
        .forEach(m => specialy.set(m, nazevVydani(slozitVydani(casti.rok, m, casti.edice)).replace(/ \d{4}( · .*)?$/, '')));
    const naRok = podleMesicu.get('') || [];
    stav.vydaniPolozky = naRok.flatMap(a => a.polozky);
    const indexy = new Map(stav.vydaniPolozky.map((p, i) => [p, i]));
    const index = p => indexy.get(p);

    document.getElementById('issueSide').innerHTML = `
        <div class="rocnik-nadpis">Ročník${casti.edice !== VYCHOZI_EDICE ? ` · ${esc(casti.edice)}` : ''}</div>
        <div class="rocnik-rok">${esc(casti.rok)}</div>
        <div class="prehled-pruh"><span>Čísel ve sbírce</span><b>${cisel} z 12</b><div><i style="width:${Math.round(cisel / 12 * 100)}%"></i></div></div>
        <div class="prehled-cisla rocnik-cisla">
            ${[[pocet('Cover'), 'coverů'], [pocet('Centerfold'), 'centerfoldů'], [pocet('Pictorial'), 'pictorialů']]
                .map(([n, popis]) => `<div><strong>${n}</strong><span>${popis}</span></div>`).join('')}
        </div>
        <div class="rocnik-akce"><button class="volba" data-pridat="pictorial"><span aria-hidden="true">+</span>Pictorial k ročníku</button></div>
    `;
    document.getElementById('issueMain').innerHTML = `
        <div class="rocnik-mrizka">${MESICE.map((nazev, i) => karta(String(i + 1).padStart(2, '0'), nazev)).join('')}</div>
        ${specialy.size ? `<h3 class="rocnik-oddil">Speciály</h3><div class="rocnik-mrizka">${[...specialy].sort(([x], [y]) => x.localeCompare(y)).map(([m, nazev]) => karta(m, nazev)).join('')}</div>` : ''}
        ${naRok.length ? `<h3 class="rocnik-oddil">Celý ročník</h3>${naRok.map(a => htmlAlbaStranky(a, index)).join('')}` : ''}
    `;
    listaStranky.naplnit([]);

    issueView.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
    pripravitPopisy(issueView);
    zkratitAlba(issueView);
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

    // Stejný panel jako ročník: drobný růžový nadpis, velké jméno, čísla
    document.getElementById('issueSide').innerHTML = `
        <div class="rocnik-nadpis">Fotograf</div>
        <h2 class="fotograf-jmeno">${esc(jmeno)}</h2>
        <div class="prehled-cisla rocnik-cisla">
            ${[[alba.length, 'alb'], [modelek, 'modelek'], [fotky.length, 'fotek']]
                .map(([n, popis]) => `<div><strong>${n}</strong><span>${popis}</span></div>`).join('')}
        </div>
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
// Rolování stránky čísla: v obsahu (a v proužku) se zvýrazní článek nebo album, které je právě nahoře,
// a u článku se pod názvem plní čára podle toho, kolik z něj už je odrolováno
function oznacitPrecteno() {
    if (issueView.classList.contains('hidden')) return;
    const oblast = document.querySelector('main');
    const horni = oblast.getBoundingClientRect().top + 60;
    const casti = [...issueView.querySelectorAll('#issueMain [data-cast]')];
    if (!casti.length) return;
    const naKonci = oblast.scrollTop >= oblast.scrollHeight - oblast.clientHeight - 1;
    const aktualni = naKonci ? casti.at(-1) : casti.filter(c => c.getBoundingClientRect().top <= horni).pop() || casti[0];
    const klic = aktualni.dataset.cast;
    const jeClanek = klic.startsWith('clanek-');
    const id = jeClanek ? klic.slice(7) : klic.slice(6);
    issueView.querySelectorAll('[data-clanek], [data-album-obsahu]').forEach(b => b.classList.toggle('active',
        jeClanek ? b.dataset.clanek === id : b.dataset.albumObsahu === id));
    let procent = 0;
    if (jeClanek) {
        const r = aktualni.getBoundingClientRect();
        const zbyva = r.height - oblast.clientHeight / 2;
        procent = zbyva > 0 ? Math.min(100, Math.max(0, (horni - r.top) / zbyva * 100)) : 100;
    }
    issueView.style.setProperty('--precteno', `${procent}%`);
    // Zvýrazněná položka obsahu je v levém panelu vidět (panel se posune jen sám, článek ne)
    const panel = document.getElementById('issueSide');
    const vObsahu = panel.querySelector('.obsah-polozka.active');
    if (vObsahu && getComputedStyle(panel).overflowY === 'auto') {
        const p = panel.getBoundingClientRect(), o = vObsahu.getBoundingClientRect();
        if (o.top < p.top + 8) panel.scrollTop -= p.top + 8 - o.top;
        else if (o.bottom > p.bottom - 8) panel.scrollTop += o.bottom - p.bottom + 8;
    }
    // V proužku (úzké okno) je zvýrazněná položka vidět
    const prouzek = issueView.querySelector('.clanek-prouzek');
    const vProuzku = prouzek?.querySelector('.active');
    if (vProuzku && (vProuzku.offsetLeft < prouzek.scrollLeft || vProuzku.offsetLeft + vProuzku.offsetWidth > prouzek.scrollLeft + prouzek.clientWidth)) {
        prouzek.scrollLeft = vProuzku.offsetLeft - prouzek.clientWidth / 2 + vProuzku.offsetWidth / 2;
    }
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
            // Centerfold je v levém panelu (sjede se v něm), pictorialy vpravo pod články
            issueView.querySelector(`[data-cast="album-${albumObsahu.dataset.albumObsahu}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        if (e.target.closest('[data-novy-clanek]')) {
            otevritEditorClanku(null, stav.aktualniVydani);
            return;
        }
        const upravit = e.target.closest('[data-upravit-clanek]');
        if (upravit) {
            otevritEditorClanku(stav.vydaniClanky.find(c => c.id === parseInt(upravit.dataset.upravitClanek)), stav.aktualniVydani);
            return;
        }
        const sken = e.target.closest('[data-sken]');
        if (sken) {
            // Skeny stran v prohlížeči stran (dvojstrana jako v časopise), od kliknutého
            otevritCtecku(stav.vydaniClanky.find(x => x.id === parseInt(sken.closest('[data-id-clanku]').dataset.idClanku)), parseInt(sken.dataset.sken));
            return;
        }
        const prazdne = e.target.closest('[data-prazdne]');
        if (prazdne) {
            e.stopPropagation();
            const misto = prazdne.getBoundingClientRect();
            // Po označení čísla se ročník překreslí
            const oznacit = oznacitCislo(prazdne.dataset.prazdne).map(p => ({ ...p, akce: async () => { await p.akce(); obnovitStranku(); } }));
            otevritKontextovouNabidku(misto.left, misto.bottom + 4, [...pridatKVydani(prazdne.dataset.prazdne), null, ...oznacit]);
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
