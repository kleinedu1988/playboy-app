// Profil modelky: alba, texty, plakáty, ruční pořadí fotek a zkrácená alba
import { VYSKYT, jeOnline, esc, formatDatum, formatMarkdown, kategorieModelky, nazevAlba, nazevVydani, obrazek, paskaCisla, popisKategorie, paskaOnline, popisTypuAlba, rozlozitVydani, vekPriVydani, sklonovat, vyskytModelky } from '../lib/format';
import { GetFotografieModelky, GetSlavaModelky, SetPoradiFotek } from './backend';
import { klicAlba, novePoradi, sestavitAlba } from '../lib/alba';
import { oznamit } from '../ui/oznameni';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { htmlAkciDlazdice } from './akce-fotky';
import { detailView, issueView } from './prvky';
import { hlavniOblast, listaAlb, listyStranky } from './listy';
import { VELIKOST_NAHLEDU, VELIKOST_PLAKATU_MALA, adresaTitulni, nacitatPostupne } from './obrazky';
import { stylVyrezu, ukazatPohled, zapamatovatMisto } from './navigace';
import { htmlOdhadu, htmlSrdicka, htmlSrdickaFotky } from './galerie';
import { selectionBar } from './vyber';
import { doplnitClankyModelky } from './clanky';
import { htmlPrazdna } from '../ui/prazdno';
import { htmlKostryAlb } from '../ui/kostra';
import { textPoradiProfilu } from '../lib/oblibenost';
import { textSlavyProfilu } from '../lib/slava';
import { zaznamenatProfil } from './zajem';

// Otevření profilu modelky s fotogalerií
export async function otevritDetailModelky(modelka, { bezHistorie = false } = {}) {
    // Opožděná odpověď přehledu, ze kterého se sem přišlo, už profil nesmí přepsat
    const moje = ++stav.cisloNacteni;
    // Galerie a historie drží objekty z doby načtení; po úpravě by profil i formulář ukázaly staré údaje
    modelka = (await vsechnyModelky()).find(m => m.id === modelka.id) || modelka;
    // Mezitím otevřený jiný pohled má přednost
    if (moje !== stav.cisloNacteni) return;
    if (!bezHistorie) zapamatovatMisto({ modelka });
    // Listování mezi profily (bez historie) je taky zájem; backend stejnou modelku počítá nejvýš jednou za 10 minut
    zaznamenatProfil(modelka.id);
    // Alba předchozí modelky se do načtení nahradí obrysy (stejná modelka po uložení zůstává, jak je)
    if (stav.aktualniModelka?.id !== modelka.id) document.getElementById('photosGrid').innerHTML = htmlKostryAlb();
    stav.aktualniModelka = modelka;
    ukazatPohled(detailView);
    document.getElementById('centerfoldsSide').innerHTML = '';
    document.querySelector('main').scrollTop = 0;

    const hledatelne = hodnota => hodnota
        ? `<button class="link" data-hledat="${esc(hodnota)}" title="Vyhledat modelky se stejnou hodnotou">${esc(hodnota)}</button>`
        : '';
    // Vydání se odvozují z alb a centerfoldů; starší ručně psané údaje se ukážou, jen když odvozená chybí
    const prvniVydani = modelka.vydani.find(v => rozlozitVydani(v)?.mesic) || (rozlozitVydani(modelka.vystoupeni)?.mesic ? modelka.vystoupeni : '');
    const vydani = modelka.vydani.length
        ? modelka.vydani.map(v => `<button class="chip" data-vydani="${esc(v)}" title="Otevřít číslo">${esc(nazevVydani(v))}</button>`).join(' ')
        : esc([modelka.vystoupeni, ...modelka.pictorialVydani.split('\n')].map(v => v.trim()).filter(Boolean).join(', '));

    // Údaje ve třech blocích: Playboy (nejdůležitější pro sbírku), Osobní, Vzhled; prázdné části se nezobrazí
    const stitkyVydani = vydaniKody => vydaniKody.map(v => `<button class="chip" data-vydani="${esc(v)}" title="Otevřít číslo">${esc(nazevVydani(v))}</button>`).join(' ');
    const playboy = [
        ['Vydání', vydani],
        ['Kategorie', kategorieModelky(modelka).map(k => `<span class="udaje-znamka"${k.odvozena ? ' title="Odvozeno z dat sbírky"' : ''}>${esc(popisKategorie(k))}</span>`).join(' ')],
        ['Na obálce', stitkyVydani(modelka.obalky || [])],
        ['Výskyt', vyskytModelky(modelka) ? `<span class="udaje-znamka">${VYSKYT[vyskytModelky(modelka)]}</span>` : ''],
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
    // Pásky v rohu fotky: štítek za každé číslo (rok i měsíc), ve kterém se modelka objevila
    const vsechnaVydani = [
        ...(modelka.vydani || []),
        ...(modelka.obalky || []),
        modelka.vystoupeni,
        ...String(modelka.pictorialVydani || '').split('\n'),
    ].map(v => (v || '').trim()).filter(Boolean);
    const platnaVydani = [...new Set(vsechnaVydani)].filter(v => paskaCisla(v)).sort((a, b) => a.localeCompare(b));
    const jePlaymate = kategorieModelky(modelka).some(k => k.nazev === 'Playmate měsíce');
    const playmateVydani = (rozlozitVydani(modelka.vystoupeni)?.mesic && platnaVydani.includes(modelka.vystoupeni))
        ? modelka.vystoupeni
        : platnaVydani.find(v => rozlozitVydani(v)?.mesic);

    const paskyHtml = platnaVydani.map(v => {
        const role = (v === playmateVydani && jePlaymate) ? 'Playmate · ' : '';
        const popisek = `${role}${paskaCisla(v)}`;
        return `<button type="button" class="panel-paska" data-vydani="${esc(v)}" title="Otevřít číslo ${esc(nazevVydani(v))}">${esc(popisek)}</button>`;
    }).join('') + ((modelka.onlineAlba || []).length
        ? `<button type="button" class="panel-paska" data-online-album title="Přejít na online album">${esc(paskaOnline(modelka))}</button>` : '');
    const paska = paskyHtml ? `<div class="panel-pasky">${paskyHtml}</div>` : '';
    document.getElementById('modelHeader').innerHTML = `
        ${paska}
        <div class="profile-cover"><img src="${esc(adresaTitulni(modelka, true))}" alt="${esc(modelka.jmeno)}" style="${stylVyrezu(modelka)}" draggable="false" /></div>
        <h2>${esc(modelka.jmeno)}</h2>
        ${htmlSrdicka(modelka)}
        ${htmlOdhadu(modelka, 'odhad-profil')}
        ${htmlPoradi(modelka)}
        <button type="button" class="profile-poradi profile-slava hidden" data-otevrit-oblibenost="slava" title="Otevřít Síň slávy"></button>
        ${dalsiJmena.length ? `<p class="profile-aliases">také ${esc(dalsiJmena.join(', '))}</p>` : ''}
        <div class="profile-actions-misto"></div>
        <div class="profile-tags">${tagy.map(t => `<button class="tag" data-hledat="${esc(t)}" title="Vyhledat modelky s tímto tagem">${esc(t)}</button>`).join('')}</div>
        ${bloky.length ? `<div class="udaje-modelky">${bloky.join('')}</div>` : ''}
        ${modelka.poznamka ? `<div class="profile-note">${formatMarkdown(modelka.poznamka)}</div>` : ''}
        ${htmlOdkazu(modelka.odkazy)}
    `;

    document.querySelector('#modelHeader .profile-actions-misto').replaceWith(akce);

    await Promise.all([nacistFotkyModelky(modelka.id), doplnitClankyModelky(modelka), doplnitSlavu(modelka)]);
}

// Řádek síně slávy pod pořadím (jen modelka, která v potvrzené top 10 je nebo byla)
async function doplnitSlavu(modelka) {
    if (!(modelka.poradi > 0)) return;
    const moje = stav.cisloNacteni;
    let text = '';
    try { text = textSlavyProfilu(await GetSlavaModelky(modelka.id)); } catch { return; }
    const radek = document.querySelector('#modelHeader .profile-slava');
    if (!text || !radek || moje !== stav.cisloNacteni) return;
    // Části zvlášť: dlouhý řádek se zalomí mezi nimi, ne uvnitř
    radek.innerHTML = `🏆 ${text.split(' · ').map(c => `<span>${esc(c)}</span>`).join(' · ')}`;
    radek.classList.remove('hidden');
}

// Potvrzené pořadí v oblíbenosti, úroveň (Top 10 / 20 / 50 / 100) nebo čekání na vyšší a trend pod srdíčky; klik
// otevře Pořadí v Oblíbenosti
function htmlPoradi(modelka) {
    const r = textPoradiProfilu(modelka);
    if (!r) return '';
    const title = r.ceka
        ? `Podle síly patří výš, ${r.ceka} – potvrdí ji další porovnání (podrobnosti v Pořadí). Otevřít Oblíbenost`
        : 'Otevřít Oblíbenost – pořadí podle srdíček, fotek, porovnání a zájmu';
    return `<button type="button" class="profile-poradi" data-otevrit-oblibenost title="${esc(title)}">
        <span>${esc(r.poradi)}</span>${r.uroven ? ` · <b class="profile-uroven">${esc(r.uroven)}</b>` : ''}${r.obhajuje ? ` · <span class="profile-ceka" title="Silou ji předstihla jiná modelka; místo jí zůstává, dokud s ní neprohraje v souboji">🛡 ${esc(r.obhajuje)}</span>` : ''}${r.ceka ? ` · <span class="profile-ceka">⏳ ${esc(r.ceka)}</span>` : ''}${r.trend ? ` · <span class="trend ${r.trend.smer}" title="${esc(r.trend.text)}">${r.trend.znak} ${esc(r.trend.kratce)}</span>` : ''}</button>`;
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
            ${a.popis ? `<div class="album-desc-text">${formatMarkdown(a.popis)}</div>
            <button class="link album-desc-more hidden" data-rozbalit>více</button>` : ''}
            ${a.fotograf ? `<p class="album-credit">Foto: <button class="link" data-fotograf="${esc(a.fotograf)}" title="Všechna alba tohoto fotografa">${esc(a.fotograf)}</button></p>` : ''}
        </div>
    `;
}

// Tlačítko „více" má smysl jen u textu, který se do zkrácené podoby nevešel
// Rozměry se nejdřív všechny přečtou a pak se teprve zapisuje; střídání čtení a zápisu by u každého alba
// znovu rozvrhovalo celou stránku
export function pripravitPopisy(pohled) {
    const texty = [...pohled.querySelectorAll('.album-desc-text')];
    const vejdeSe = texty.map(text => text.scrollHeight <= text.clientHeight + 1);
    texty.forEach((text, i) => text.nextElementSibling.classList.toggle('hidden', vejdeSe[i]));
}

// Odkazy modelky jako štítky s názvem webu; otevírají se v prohlížeči
export function htmlOdkazu(text) {
    const odkazy = String(text || '').split('\n').map(o => o.trim()).filter(o => /^https?:\/\//i.test(o));
    if (!odkazy.length) return '';
    const web = o => { try { return new URL(o).hostname.replace(/^www\./, ''); } catch { return o; } };
    return `<div class="profile-links">${odkazy.map(o => `<button class="chip" data-odkaz="${esc(o)}" title="${esc(o)}">${esc(web(o))}</button>`).join('')}</div>`;
}

// Plakát: jedna nebo více stránek spojených bez mezer, volitelně otočený
// line = adresa jen v data-src, načte ji postupné načítání (nacitatPostupne) při přiblížení k oknu;
// pro dlouhé přehledy, kde je plakátů mnoho
export function htmlPlakatu(polozka, velikost, atributy = '', line = false) {
    return `
        <div class="poster" data-rot="${polozka.rotace}" ${atributy} ${atributy.includes('data-index') ? 'tabindex="0"' : ''}>
            <div class="poster-inner">
                ${polozka.fotky.map(f => `<img ${line ? 'data-src' : 'src'}="${esc(obrazek(f.url, velikost))}" data-foto-id="${f.id}" draggable="false" ${line ? 'decoding="async"' : ''} />`).join('')}
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

// Alba v profilu chronologicky podle vydání, bez vydání na konci v pořadí, jak přibyla; ruční přeřazení fotek
// uvnitř alba tak pořadí alb nemění. Online album se řadí podle data nafocení (vydání nemá). Centerfoldy první.
// Stejné pořadí má prohlížeč otevřený z náhledu v Oblíbenosti.
export function seraditAlbaProfilu(alba) {
    const klicPoradi = a => {
        const v = jeOnline(a.typ) ? rozlozitVydani(a.datumAlba.slice(0, 7)) : rozlozitVydani(a.typ === 'Centerfold' ? a.album : a.vydani);
        return v ? `0${v.rok}${v.mesic || '00'}${v.edice}` : '1';
    };
    const prvniFotka = a => Math.min(...a.fotky.map(f => f.id));
    return alba.sort((x, y) => Number(y.typ === 'Centerfold') - Number(x.typ === 'Centerfold')
        || klicPoradi(x).localeCompare(klicPoradi(y)) || prvniFotka(x) - prvniFotka(y));
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

    stav.aktualniAlba = sestavitAlba(fotky || []);
    // Jméno hlavní modelky sdíleného alba (fotky profilu jména nenesou)
    const jmenaModelek = new Map((stav.nacteneModelky || []).map(m => [m.id, m.jmeno]));
    jmenaModelek.set(stav.aktualniModelka.id, stav.aktualniModelka.jmeno);
    const neznama = stav.aktualniAlba.filter(a => !jmenaModelek.has(a.modelkaId));
    if (neznama.length) (await vsechnyModelky()).forEach(m => jmenaModelek.set(m.id, m.jmeno));
    stav.aktualniAlba.forEach(a => { a.jmenoModelky = jmenaModelek.get(a.modelkaId) || ''; });
    seraditAlbaProfilu(stav.aktualniAlba);
    // Pořadí pro prohlížeč: nejdřív centerfoldy z levého sloupce, potom alba
    stav.aktualniPolozky = stav.aktualniAlba.flatMap(a => a.polozky);


    // Indexy alb a položek se sestaví jednou; hledání v poli u každé dlaždice by rostlo s druhou mocninou
    const indexAlba = new Map(stav.aktualniAlba.map((a, i) => [a, i]));
    const indexPolozky = new Map(stav.aktualniPolozky.map((p, i) => [p, i]));

    const htmlCenterfoldu = (a) => {
        const index = indexAlba.get(a);
        const stitky = [
            a.album ? `<button class="chip" data-vydani="${esc(a.album)}" title="Otevřít číslo">${esc(nazevVydani(a.album))}</button>` : '',
            htmlSpoluModelek(a),
        ].filter(Boolean).join(' ');

        return `
            <section class="album panel-centerfold" data-album="${index}" data-cast="${index}">
                <h4 class="panel-nadpis">Centerfold</h4>
                ${stitky ? `<div class="panel-centerfold-modelka">${stitky}</div>` : ''}
                <div class="posters">
                    ${a.polozky.map(p => htmlPlakatu(p, VELIKOST_PLAKATU_MALA, `data-index="${indexPolozky.get(p)}"`)).join('')}
                </div>
                ${htmlPopisuAlba(a)}
            </section>
        `;
    };

    const htmlAlba = (a) => {
        const popis = sklonovat(a.fotky.length, 'fotka', 'fotky', 'fotek');

        return `
            <section class="album" data-album="${indexAlba.get(a)}" data-cast="${indexAlba.get(a)}"${jeOnline(a.typ) ? ' data-online' : ''}>
                <div class="album-header">
                    <h4>${esc(nazevAlba(a.album, a.typ))}</h4>
                    <span>${esc(popisTypuAlba(a.typ, a.datumAlba))} · ${popis}</span>
                    ${a.vydani ? `<button class="chip" data-vydani="${esc(a.vydani)}" title="Otevřít číslo">${esc(nazevVydani(a.vydani))}</button>` : ''}
                    ${htmlSpoluModelek(a)}
                    <button class="album-more" data-nabidka-alba title="Akce alba (také pravým tlačítkem)">&#8943;</button>
                </div>
                ${htmlPopisuAlba(a)}
                <div class="photos-grid" ${atributyMrizky(a)}>
                    ${a.polozky.map(p => {
                        const index = indexPolozky.get(p);
                        return `<div class="photo-item" data-index="${index}" data-foto-id="${p.fotky[0].id}" tabindex="0">
                                   <img data-src="${esc(obrazek(p.fotky[0].url, VELIKOST_NAHLEDU))}" decoding="async" draggable="false" />
                                   ${htmlSrdickaFotky(p, index)}
                                   ${htmlAkciDlazdice()}
                               </div>`;
                    }).join('')}
                </div>
            </section>
        `;
    };

    const centerfoldy = stav.aktualniAlba.filter(a => a.typ === 'Centerfold');
    const ostatni = stav.aktualniAlba.filter(a => a.typ !== 'Centerfold');
    const prazdno = centerfoldy.length
        ? htmlPrazdna('Žádná další alba', 'Pictorialy, fotky z dalších čísel a ostatní alba modelky se objeví tady. Stačí vložit odkazy na fotky z Google Disku.', { tlacitko: { text: 'Přidat fotky', akce: 'pridat-album' } })
        : htmlPrazdna('Zatím žádná alba', 'Centerfoldy, pictorialy a další alba modelky se objeví tady. Stačí vložit odkazy na fotky z Google Disku.', { tlacitko: { text: 'Přidat fotky', akce: 'pridat-album' } });
    centerfoldsSide.innerHTML = centerfoldy.map(htmlCenterfoldu).join('');
    photosGrid.innerHTML = ostatni.map(htmlAlba).join('') || prazdno;

    // Lišta má smysl až od dvou alb; centerfoldy jsou v levém sloupci stále vidět
    listaAlb.naplnit(ostatni.map(a => ({ klic: indexAlba.get(a), nazev: nazevAlba(a.album, a.typ), pocet: a.fotky.length })));

    detailView.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
    nacitatPostupne(photosGrid);
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

// Počty sloupců všech mřížek se zjistí najednou před prvním zápisem (jinak by se po každém albu rozvrhovalo znovu)
export function zkratitAlba(pohled) {
    const mrizky = [...pohled.querySelectorAll('.photos-grid')]
        // Počet sloupců jde zjistit jen u mřížky, která je vidět
        .filter(mrizka => mrizka.offsetParent)
        .map(mrizka => ({ mrizka, sloupcu: getComputedStyle(mrizka).gridTemplateColumns.split(' ').length }));
    mrizky.forEach(({ mrizka, sloupcu }) => {
        const dlazdice = [...mrizka.children];
        const limit = sloupcu * RADKU_NAHLEDU;
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

    // Páska online alb přeskočí na první online album; pořadí v oblíbenosti otevře Oblíbenost (jako tlačítko grafu)
    document.getElementById('modelHeader').addEventListener('click', (e) => {
        const doOblibenosti = e.target.closest('[data-otevrit-oblibenost]');
        if (doOblibenosti) {
            stav.oblibenostCast = doOblibenosti.dataset.otevritOblibenost || 'poradi';
            /** @type {HTMLElement|null} */ (document.querySelector('.nav-rezim[data-cast-prehledu="oblibenost"]'))?.click();
            return;
        }
        const paska = e.target.closest('[data-online-album]');
        if (!paska) return;
        document.querySelector('#photosGrid section.album[data-online]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
