// Profil modelky: alba, texty, plakáty, ruční pořadí fotek a zkrácená alba
import { esc, formatDatum, nazevAlba, nazevVydani, obrazek, paskaCisla, rozlozitVydani, vekPriVydani, sklonovat } from '../lib/format';
import { GetFotografieModelky, SetPoradiFotek } from './backend';
import { klicAlba, novePoradi, sestavitAlba } from '../lib/alba';
import { oznamit } from '../ui/oznameni';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { htmlAkciDlazdice } from './akce-fotky';
import { detailView, issueView } from './prvky';
import { hlavniOblast, listaAlb, listyStranky } from './listy';
import { VELIKOST_NAHLEDU, VELIKOST_PLAKATU_MALA, adresaTitulni } from './obrazky';
import { stylVyrezu, ukazatPohled, zapamatovatMisto } from './navigace';
import { htmlSrdicka, htmlSrdickaFotky } from './galerie';
import { selectionBar } from './vyber';
import { doplnitClankyModelky } from './clanky';

// Otevření profilu modelky s fotogalerií
export async function otevritDetailModelky(modelka, { bezHistorie = false } = {}) {
    // Opožděná odpověď přehledu, ze kterého se sem přišlo, už profil nesmí přepsat
    const moje = ++stav.cisloNacteni;
    // Galerie a historie drží objekty z doby načtení; po úpravě by profil i formulář ukázaly staré údaje
    modelka = (await vsechnyModelky()).find(m => m.id === modelka.id) || modelka;
    // Mezitím otevřený jiný pohled má přednost
    if (moje !== stav.cisloNacteni) return;
    if (!bezHistorie) zapamatovatMisto({ modelka });
    stav.aktualniModelka = modelka;
    ukazatPohled(detailView);
    // Dokud nejsou načtené fotky, není jasné, zda se ukáže titulní fotka, nebo centerfold
    document.getElementById('centerfoldsSide').innerHTML = '';
    detailView.classList.add('bez-titulni');
    document.querySelector('main').scrollTop = 0;

    const hledatelne = hodnota => hodnota
        ? `<button class="link" data-hledat="${esc(hodnota)}" title="Vyhledat modelky se stejnou hodnotou">${esc(hodnota)}</button>`
        : '';
    // Vydání se odvozují z alb a centerfoldů; starší ručně psané údaje se ukážou, jen když odvozená chybí
    const prvniVydani = modelka.vydani.find(v => rozlozitVydani(v)?.mesic) || (rozlozitVydani(modelka.vystoupeni)?.mesic ? modelka.vystoupeni : '');
    const vydani = modelka.vydani.length
        ? modelka.vydani.map(v => `<button class="chip" data-vydani="${esc(v)}" title="Otevřít vydání">${esc(nazevVydani(v))}</button>`).join(' ')
        : esc([modelka.vystoupeni, ...modelka.pictorialVydani.split('\n')].map(v => v.trim()).filter(Boolean).join(', '));

    // Údaje ve třech blocích: Playboy (nejdůležitější pro sbírku), Osobní, Vzhled; prázdné části se nezobrazí
    const stitkyVydani = vydaniKody => vydaniKody.map(v => `<button class="chip" data-vydani="${esc(v)}" title="Otevřít vydání">${esc(nazevVydani(v))}</button>`).join(' ');
    const playboy = [
        ['Vydání', vydani],
        ['Role', modelka.role ? `<span class="udaje-znamka">${esc(modelka.role)}</span>` : ''],
        ['Na obálce', stitkyVydani(modelka.obalky || [])],
    ].filter(([, hodnota]) => hodnota);

    // Osobní údaje jako věty: „12. 3. 1975, Praha · v prvním vydání 20 let“
    const vekVydani = vekPriVydani(modelka.narozeniDatum, prvniVydani);
    const vekUmrti = vekPriVydani(modelka.narozeniDatum, modelka.umrtiDatum);
    const osobni = [
        [esc([formatDatum(modelka.narozeniDatum), modelka.narozeniMisto].filter(Boolean).join(', ')), vekVydani && `v prvním vydání ${esc(vekVydani)}`]
            .filter(Boolean).join(' · '),
        modelka.umrtiDatum ? `† ${esc(formatDatum(modelka.umrtiDatum))}${vekUmrti ? `, ve věku ${esc(vekUmrti)}` : ''}` : '',
        [hledatelne(modelka.narodnost), esc(modelka.etnicita)].filter(Boolean).join(' · '),
    ].filter(Boolean);

    // Vzhled jako mřížka dvojic; tetování a piercing jen jako štítek, když je odpověď „ano“
    const vzhled = [
        ['Výška', modelka.vyskaCm ? `${modelka.vyskaCm} cm` : ''],
        ['Váha', modelka.vahaKg ? `${modelka.vahaKg} kg` : ''],
        ['Míry', esc(modelka.miry)],
        ['Prsa', esc([modelka.velikostPrsou, modelka.prsaTyp].filter(Boolean).join(', '))],
        ['Vlasy', hledatelne(modelka.vlasyBarva)],
        ['Oči', hledatelne(modelka.ociBarva)],
        ['Ochlupení', esc(modelka.ochlupeni)],
    ].filter(([, hodnota]) => hodnota);
    const znamky = [modelka.tetovani === 1 ? 'Tetování' : '', modelka.piercing === 1 ? 'Piercing' : ''].filter(Boolean);

    const bloky = [
        playboy.length ? `<section class="udaje-blok"><h4>Playboy</h4>
            ${playboy.map(([nazev, hodnota]) => `<div class="udaje-radek"><span class="udaje-popis">${nazev}</span><div class="udaje-stitky">${hodnota}</div></div>`).join('')}
        </section>` : '',
        osobni.length ? `<section class="udaje-blok"><h4>Osobní</h4>${osobni.map(veta => `<p class="udaje-veta">${veta}</p>`).join('')}</section>` : '',
        vzhled.length || znamky.length ? `<section class="udaje-blok"><h4>Vzhled</h4>
            ${vzhled.length ? `<dl class="udaje-mrizka">${vzhled.map(([nazev, hodnota]) => `<div><dt>${nazev}</dt><dd>${hodnota}</dd></div>`).join('')}</dl>` : ''}
            ${znamky.length ? `<div class="udaje-znamky">${znamky.map(z => `<span class="udaje-znamka">${z}</span>`).join('')}</div>` : ''}
        </section>` : '',
    ].filter(Boolean);

    const tagy = modelka.tags.split(',').map(t => t.trim()).filter(Boolean);
    const dalsiJmena = modelka.dalsiJmena.split(',').map(j => j.trim()).filter(Boolean);

    // Tlačítka profilu (Upravit modelku, Přidat fotky) jsou v šabloně s obsluhou; před přepsáním hlavičky se vezmou
    // a vloží zpět pod jméno
    const akce = document.getElementById('profileActions');
    // Páska v rohu panelu: první číslo, u playmate s označením role
    const paska = prvniVydani ? `<span class="panel-paska">${/playmate/i.test(modelka.role) ? 'Playmate · ' : ''}${esc(paskaCisla(prvniVydani))}</span>` : '';
    document.getElementById('modelHeader').innerHTML = `
        ${paska}
        <div class="profile-cover"><img src="${esc(adresaTitulni(modelka, true))}" alt="${esc(modelka.jmeno)}" style="${stylVyrezu(modelka)}" draggable="false" /></div>
        <h2>${esc(modelka.jmeno)}</h2>
        ${htmlSrdicka(modelka)}
        ${dalsiJmena.length ? `<p class="profile-aliases">také ${esc(dalsiJmena.join(', '))}</p>` : ''}
        <div class="profile-actions-misto"></div>
        <div class="profile-tags">${tagy.map(t => `<button class="tag" data-hledat="${esc(t)}" title="Vyhledat modelky s tímto tagem">${esc(t)}</button>`).join('')}</div>
        ${bloky.length ? `<div class="udaje-modelky">${bloky.join('')}</div>` : ''}
        ${modelka.poznamka ? `<p class="profile-note">${esc(modelka.poznamka)}</p>` : ''}
        ${htmlOdkazu(modelka.odkazy)}
    `;

    document.querySelector('#modelHeader .profile-actions-misto').replaceWith(akce);

    await Promise.all([nacistFotkyModelky(modelka.id), doplnitClankyModelky(modelka)]);
}

// Ostatní modelky sdíleného alba (hlavní i další kromě té, jejíž profil je otevřený) jako odkazy na jejich profil
export function htmlSpoluModelek(a, krome = stav.aktualniModelka?.id) {
    const ostatni = [{ id: a.modelkaId, jmeno: a.jmenoModelky }, ...a.dalsiModelky].filter(m => m.id !== krome && m.jmeno);
    return ostatni.length ? `<span class="album-spolu">s ${ostatni.map(m => `<button class="chip" data-modelka="${m.id}" title="Otevřít profil">${esc(m.jmeno)}</button>`).join(' ')}</span>` : '';
}

// Průvodní text alba a fotograf; delší text je zkrácený a rozbaluje se kliknutím
export function htmlPopisuAlba(a) {
    if (!a.popis && !a.fotograf) return '';
    return `
        <div class="album-desc">
            ${a.popis ? `<p class="album-desc-text">${esc(a.popis)}</p>
            <button class="link album-desc-more hidden" data-rozbalit>více</button>` : ''}
            ${a.fotograf ? `<p class="album-credit">Foto: <button class="link" data-fotograf="${esc(a.fotograf)}" title="Všechna alba tohoto fotografa">${esc(a.fotograf)}</button></p>` : ''}
        </div>
    `;
}

// Tlačítko „více" má smysl jen u textu, který se do zkrácené podoby nevešel
export function pripravitPopisy(pohled) {
    pohled.querySelectorAll('.album-desc-text').forEach(text => {
        text.nextElementSibling.classList.toggle('hidden', text.scrollHeight <= text.clientHeight + 1);
    });
}

// Odkazy modelky jako štítky s názvem webu; otevírají se v prohlížeči
export function htmlOdkazu(text) {
    const odkazy = String(text || '').split('\n').map(o => o.trim()).filter(o => /^https?:\/\//i.test(o));
    if (!odkazy.length) return '';
    const web = o => { try { return new URL(o).hostname.replace(/^www\./, ''); } catch { return o; } };
    return `<div class="profile-links">${odkazy.map(o => `<button class="chip" data-odkaz="${esc(o)}" title="${esc(o)}">${esc(web(o))}</button>`).join('')}</div>`;
}

// Plakát: jedna nebo více stránek spojených bez mezer, volitelně otočený
// line = načíst až při přiblížení k oknu (dlouhé přehledy, kde je plakátů mnoho)
export function htmlPlakatu(polozka, velikost, atributy = '', line = false) {
    return `
        <div class="poster" data-rot="${polozka.rotace}" ${atributy} ${atributy.includes('data-index') ? 'tabindex="0"' : ''}>
            <div class="poster-inner">
                ${polozka.fotky.map(f => `<img src="${esc(obrazek(f.url, velikost))}" data-foto-id="${f.id}" draggable="false" ${line ? 'loading="lazy"' : ''} />`).join('')}
            </div>
            ${htmlAkciDlazdice()}
        </div>
    `;
}

// Po načtení stránek nastaví plakátu poměr stran a rozložení stránek
export function pripravitPlakat(plakat, poZmene = () => {}) {
    const vnitrek = plakat.querySelector('.poster-inner');
    const obrazky = [...vnitrek.querySelectorAll('img')];

    const prepocitat = () => {
        if (obrazky.some(o => !o.naturalWidth)) return;
        const pomery = obrazky.map(o => o.naturalWidth / o.naturalHeight);
        // Stránky na výšku se řadí vedle sebe, stránky na šířku pod sebe
        const sloupec = obrazky.length > 1 && pomery[0] > 1;
        vnitrek.classList.toggle('column', sloupec);
        // Podíl stránky na délce plakátu; násobek drží součet nad 1, jinak by flex nevyplnil celý plakát
        obrazky.forEach((o, i) => { o.style.flex = `${(sloupec ? 1 / pomery[i] : pomery[i]) * 100} 1 0px`; });

        // Rozměr celého plakátu v pixelech zdrojových obrázků (před otočením)
        const W = sloupec ? Math.max(...obrazky.map(o => o.naturalWidth)) : null;
        const H = sloupec ? null : Math.max(...obrazky.map(o => o.naturalHeight));
        plakat._rozmer = sloupec
            ? { W, H: W * pomery.reduce((s, p) => s + 1 / p, 0) }
            : { W: H * pomery.reduce((s, p) => s + p, 0), H };

        const pomer = plakat._rozmer.W / plakat._rozmer.H;
        plakat.style.setProperty('--ar', parseInt(plakat.dataset.rot) % 180 ? 1 / pomer : pomer);
        poZmene();
    };

    obrazky.forEach(o => o.addEventListener('load', prepocitat));
    prepocitat();
}

// Načtení fotografií v detailu
export async function nacistFotkyModelky(modelkaId) {
    const fotky = await GetFotografieModelky(modelkaId);
    // Při rychlém listování mezi modelkami může dorazit odpověď pro tu předchozí; její alba se nesmí ukázat
    // pod jménem jiné modelky, úpravy by pak šly na špatnou
    if (stav.aktualniModelka?.id !== modelkaId) return;
    const photosGrid = document.getElementById('photosGrid');
    // Překreslení alb výběr ruší
    stav.posledniVybrana = null;
    selectionBar.classList.add('hidden');

    const centerfoldsSide = document.getElementById('centerfoldsSide');
    const prazdno = '<p class="empty-state">Tato modelka zatím nemá žádná alba. Přidej je tlačítkem + Přidat fotky / album.</p>';

    stav.aktualniAlba = sestavitAlba(fotky || []);
    // Jméno hlavní modelky sdíleného alba (fotky profilu jména nenesou)
    const jmenaModelek = new Map((stav.nacteneModelky || []).map(m => [m.id, m.jmeno]));
    jmenaModelek.set(stav.aktualniModelka.id, stav.aktualniModelka.jmeno);
    const neznama = stav.aktualniAlba.filter(a => !jmenaModelek.has(a.modelkaId));
    if (neznama.length) (await vsechnyModelky()).forEach(m => jmenaModelek.set(m.id, m.jmeno));
    stav.aktualniAlba.forEach(a => { a.jmenoModelky = jmenaModelek.get(a.modelkaId) || ''; });
    // Alba v profilu chronologicky podle vydání, bez vydání na konci v pořadí, jak přibyla;
    // ruční přeřazení fotek uvnitř alba tak pořadí alb nemění
    const klicPoradi = a => {
        const v = rozlozitVydani(a.typ === 'Centerfold' ? a.album : a.vydani);
        return v ? `0${v.rok}${v.mesic || '00'}${v.edice}` : '1';
    };
    const prvniFotka = a => Math.min(...a.fotky.map(f => f.id));
    stav.aktualniAlba.sort((x, y) => Number(y.typ === 'Centerfold') - Number(x.typ === 'Centerfold')
        || klicPoradi(x).localeCompare(klicPoradi(y)) || prvniFotka(x) - prvniFotka(y));
    // Pořadí pro prohlížeč: nejdřív centerfoldy z levého sloupce, potom alba
    stav.aktualniPolozky = stav.aktualniAlba.flatMap(a => a.polozky);


    // Indexy alb a položek se sestaví jednou; hledání v poli u každé dlaždice by rostlo s druhou mocninou
    const indexAlba = new Map(stav.aktualniAlba.map((a, i) => [a, i]));
    const indexPolozky = new Map(stav.aktualniPolozky.map((p, i) => [p, i]));

    const htmlAlba = (a) => {
        const centerfold = a.typ === 'Centerfold';
        const popis = sklonovat(a.fotky.length, 'fotka', 'fotky', 'fotek');

        return `
            <section class="album" data-album="${indexAlba.get(a)}" data-cast="${indexAlba.get(a)}">
                ${centerfold ? '' : `
                    <div class="album-header">
                        <h4>${esc(nazevAlba(a.album, a.typ))}</h4>
                        <span>${esc(a.typ)} · ${popis}</span>
                        ${a.vydani ? `<button class="chip" data-vydani="${esc(a.vydani)}" title="Otevřít vydání">${esc(nazevVydani(a.vydani))}</button>` : ''}
                        ${htmlSpoluModelek(a)}
                        <button class="album-more" data-nabidka-alba title="Akce alba (také pravým tlačítkem)">&#8943;</button>
                    </div>
                    ${htmlPopisuAlba(a)}
                `}
                <div class="${centerfold ? 'posters' : 'photos-grid'}" ${centerfold ? '' : atributyMrizky(a)}>
                    ${a.polozky.map(p => {
                        const index = indexPolozky.get(p);
                        // Centerfold se zobrazuje celý jako plakát, ostatní fotky jako oříznuté dlaždice
                        return centerfold
                            ? htmlPlakatu(p, VELIKOST_PLAKATU_MALA, `data-index="${index}"`)
                            : `<div class="photo-item" data-index="${index}" data-foto-id="${p.fotky[0].id}" tabindex="0">
                                   <img src="${esc(obrazek(p.fotky[0].url, VELIKOST_NAHLEDU))}" loading="lazy" draggable="false" />
                                   ${htmlSrdickaFotky(p, index)}
                                   ${htmlAkciDlazdice()}
                               </div>`;
                    }).join('')}
                </div>
                ${centerfold ? htmlPopisuAlba(a) : ''}
            </section>
        `;
    };

    const centerfoldy = stav.aktualniAlba.filter(a => a.typ === 'Centerfold');
    const ostatni = stav.aktualniAlba.filter(a => a.typ !== 'Centerfold');
    centerfoldsSide.innerHTML = centerfoldy.map(htmlAlba).join('');
    detailView.classList.toggle('bez-titulni', centerfoldy.length > 0);
    photosGrid.innerHTML = ostatni.map(htmlAlba).join('') || prazdno;

    // Lišta má smysl až od dvou alb; centerfoldy jsou v levém sloupci stále vidět
    listaAlb.naplnit(ostatni.map(a => ({ klic: indexAlba.get(a), nazev: nazevAlba(a.album, a.typ), pocet: a.fotky.length })));

    detailView.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
    pripravitPopisy(detailView);
    zkratitAlba(detailView);
    listaAlb.sledovat();
}

export function zrusitZnackyVlozeni() {
    document.querySelectorAll('.vlozit-pred, .vlozit-za').forEach(d => d.classList.remove('vlozit-pred', 'vlozit-za'));
}

export async function dokoncitTazeniFotky(zrusit = false) {
    const t = stav.tazenaFotka;
    stav.tazenaFotka = null;
    if (!t || !t.tahne) return;
    zrusitZnackyVlozeni();
    t.dlazdice.classList.remove('tazena');
    document.body.classList.remove('razeni');
    // Uvolnění tlačítka po tažení nesmí fotku otevřít
    stav.praveTazeno = true;
    setTimeout(() => { stav.praveTazeno = false; }, 0);
    if (zrusit || !t.cil) return;

    // Výchozí je pořadí, v jakém jsou fotky právě vidět; tím se z alba stává ručně seřazené
    const album = stav.aktualniAlba[parseInt(t.dlazdice.closest('.album').dataset.album)];
    const ids = novePoradi(album.polozky.map(p => p.fotky[0].id),
        parseInt(t.dlazdice.dataset.fotoId), parseInt(t.cil.dataset.fotoId), t.pred);

    if (!await SetPoradiFotek(ids)) return;
    if (!album.rucniPoradi) oznamit('Album má teď ruční pořadí a podle srdíček se už nepřeskupuje. Zpět: ⋯ u alba → Řadit album podle srdíček.');
    nacistFotkyModelky(stav.aktualniModelka.id);
}

// Posun stránky spojeného plakátu o jedno místo; smer -1 = dřív, 1 = později
export async function posunoutStranku(album, fotka, smer) {
    const ids = album.fotky.map(f => f.id);
    const odkud = ids.indexOf(fotka.id);
    const kam = odkud + smer;
    if (kam < 0 || kam >= ids.length) return;
    [ids[odkud], ids[kam]] = [ids[kam], ids[odkud]];
    if (await SetPoradiFotek(ids)) nacistFotkyModelky(stav.aktualniModelka.id);
}

// Dlouhé album ukazuje jen první řádky; poslední viditelná dlaždice nese počet skrytých fotek a album rozbalí
export const RADKU_NAHLEDU = 2;
export const rozbalenaAlba = new Set();
export const atributyMrizky = a => `data-klic="${esc(klicAlba(a))}"`;

export function zkratitAlba(pohled) {
    pohled.querySelectorAll('.photos-grid').forEach(mrizka => {
        // Počet sloupců jde zjistit jen u mřížky, která je vidět
        if (!mrizka.offsetParent) return;
        const dlazdice = [...mrizka.children];
        const limit = getComputedStyle(mrizka).gridTemplateColumns.split(' ').length * RADKU_NAHLEDU;
        const zkratit = dlazdice.length > limit && !rozbalenaAlba.has(mrizka.dataset.klic);

        dlazdice.forEach((d, i) => {
            d.classList.toggle('skryta', zkratit && i >= limit);
            d.classList.toggle('dalsi', zkratit && i === limit - 1);
            if (zkratit && i === limit - 1) d.dataset.dalsich = `+${dlazdice.length - limit}`;
        });
        mrizka.classList.toggle('zkracena', zkratit);
        mrizka.classList.toggle('rozbalena', dlazdice.length > limit && !zkratit);
    });
}

export function prepnoutRozbaleniAlba(mrizka, rozbalit) {
    if (rozbalit) rozbalenaAlba.add(mrizka.dataset.klic);
    else rozbalenaAlba.delete(mrizka.dataset.klic);
    zkratitAlba(mrizka.parentElement);
    listaAlb.sledovat();
}

// Klik na dlaždici s počtem skrytých fotek album rozbalí, místo aby otevřel fotku
export function rozbalitKliknute(e) {
    const dlazdice = e.target.closest('.photo-item.dalsi');
    if (dlazdice) prepnoutRozbaleniAlba(dlazdice.parentElement, true);
    return Boolean(dlazdice);
}
// Lišta písmen má smysl až u větší sbírky
export const MODELEK_PRO_PISMENA = 20;

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    document.querySelector('main').addEventListener('click', (e) => {
        const tlacitko = e.target.closest('[data-rozbalit]');
        if (!tlacitko) return;
        const rozbaleno = tlacitko.previousElementSibling.classList.toggle('open');
        tlacitko.textContent = rozbaleno ? 'méně' : 'více';
    });

    document.getElementById('photosGrid').addEventListener('pointerdown', (e) => {
        const dlazdice = e.target.closest('.photo-item');
        // S Ctrl nebo Shift se fotky vybírají, netahají
        if (e.button !== 0 || !dlazdice || dlazdice.classList.contains('dalsi') || e.target.closest('.hearts') || e.ctrlKey || e.metaKey || e.shiftKey) return;
        stav.tazenaFotka = { dlazdice, x: e.clientX, y: e.clientY, tahne: false, cil: null, pred: false };
    });

    window.addEventListener('pointermove', (e) => {
        const t = stav.tazenaFotka;
        if (!t) return;
        // Malý pohyb při kliknutí ještě není tažení
        if (!t.tahne) {
            if (Math.hypot(e.clientX - t.x, e.clientY - t.y) < 8) return;
            t.tahne = true;
            t.dlazdice.classList.add('tazena');
            document.body.classList.add('razeni');
        }
        zrusitZnackyVlozeni();
        const pod = document.elementFromPoint(e.clientX, e.clientY)?.closest('.photo-item');
        // Přesouvá se jen uvnitř téhož alba
        t.cil = pod && pod !== t.dlazdice && pod.parentElement === t.dlazdice.parentElement ? pod : null;
        if (!t.cil) return;
        const obdelnik = t.cil.getBoundingClientRect();
        t.pred = e.clientX < obdelnik.left + obdelnik.width / 2;
        t.cil.classList.add(t.pred ? 'vlozit-pred' : 'vlozit-za');
    });

    window.addEventListener('pointerup', () => dokoncitTazeniFotky());

    window.addEventListener('pointercancel', () => dokoncitTazeniFotky(true));

    window.addEventListener('blur', () => dokoncitTazeniFotky(true));

    document.getElementById('photosGrid').addEventListener('click', (e) => {
        if (!stav.praveTazeno) return;
        e.stopPropagation();
        e.preventDefault();
    }, true);

    hlavniOblast.addEventListener('scroll', () => {
        if (stav.cekaNaOznaceni) return;
        stav.cekaNaOznaceni = true;
        requestAnimationFrame(() => {
            stav.cekaNaOznaceni = false;
            listyStranky.forEach(l => l.sledovat());
        });
    }, { passive: true });

    // Počet sloupců mřížky, a tím i počet fotek v náhledu, závisí na šířce okna
    window.addEventListener('resize', () => {
        zkratitAlba(detailView);
        zkratitAlba(issueView);
        listyStranky.forEach(l => { l.sledovat(); l.upravitSipky(); });
    });
}
