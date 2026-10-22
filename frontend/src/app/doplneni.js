// Okno „Doplnit modelku“ z Přehledu: všechno, co modelce podle Přehledu chybí, na jednom místě.
// Pole údajů se berou z formuláře modelky (stejné typy a nabídky), ukládá se jedním tlačítkem;
// „Uložit a další“ pokračuje další modelkou v pořadí Přehledu.
import { jednou, oznamit } from '../ui/oznameni';
import { GetFotografieModelky, SetHodnoceni, SetNetykaSe, SetNetykaSeAlba, SetTitulniFotka, SetVydaniAlba, UpdateModelka } from './backend';
import { esc, nazevAlba, obrazek, platneDatum, prevestVahu, prevestVysku, rozlozitVydani } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { stats } from './prvky';
import { VELIKOST_NAHLEDU } from './obrazky';
import { otevritDetailModelky, nacistFotkyModelky } from './profil';
import { otevritAlbumModal } from './formular-alba';
import { poleModelky } from './formular-modelky';
import { pripojitVyberKategorii } from '../ui/kategorie';
import { KLICE_SKUPIN, SKUPINY_UDAJU, nacistPrehled } from './prehled';

export const doplnitModal = document.getElementById('doplnitModal');
const obsah = document.getElementById('doplnitObsah');

const typPole = id => poleModelky.find(([, prvek]) => prvek === id)?.[2] || 'text';
const vlastnostPole = id => poleModelky.find(([, prvek]) => prvek === id)?.[0];

// Pole z formuláře modelky jako kopie (typ, nápověda, nabídka výběru) s vlastním id
function kopiePole(id, popis) {
    const vzor = document.getElementById(id);
    const kopie = /** @type {HTMLInputElement | HTMLSelectElement} */ (vzor.cloneNode(true));
    kopie.id = `dopl-${id}`;
    kopie.dataset.pole = id;
    kopie.removeAttribute('required');
    if (kopie.tagName === 'SELECT') {
        kopie.querySelectorAll('option[data-puvodni]').forEach(o => o.remove());
        /** @type {HTMLSelectElement} */ (kopie).selectedIndex = 0;
    } else {
        /** @type {HTMLInputElement} */ (kopie).value = '';
    }
    const obal = document.createElement('div');
    obal.className = 'doplnit-pole';
    obal.innerHTML = `<label for="${kopie.id}">${esc(popis.charAt(0).toUpperCase() + popis.slice(1))}</label>`;
    obal.append(kopie);
    // Kategorie: místo skrytého pole štítky jako ve formuláři modelky
    if (id === 'inputRole') {
        const vyber = document.createElement('div');
        obal.append(vyber);
        pripojitVyberKategorii(/** @type {HTMLInputElement} */ (kopie), vyber);
    }
    return obal;
}

const blok = (nazev, klic, telo = '') => `
    <section class="doplnit-blok" data-blok="${klic}">
        <h4>${nazev}<button type="button" class="doplnit-netyka" data-netyka-bloku="${klic}" title="Přestat sledovat v Přehledu">netýká se</button></h4>
        ${telo}
    </section>`;

// Otevření okna pro modelku z karty Přehledu
export async function otevritDoplneni(modelkaId) {
    const radek = stav.prehledRadky.find(r => r.id === modelkaId);
    const modelka = (await vsechnyModelky()).find(m => m.id === modelkaId);
    if (!radek || !modelka) return;
    stav.doplnovanaModelka = modelka;
    stav.doplnovanyRadek = radek;

    const chybi = klic => radek.chybi.has(klic) && !radek.netyka.has(klic);
    const albaBez = seznam => seznam.filter(a => !a.netykaSe);
    const bloky = [];
    // Titulní fotka se vybírá z fotek modelky (kliknutím), ne odkazem
    const fotky = chybi('titulni') ? (await GetFotografieModelky(modelkaId) || []).filter(f => f.url) : [];
    if (chybi('titulni')) bloky.push(blok('Titulní fotka', 'titulni', fotky.length
        ? `<p class="doplnit-napoveda">Vyber fotku z galerie modelky:</p><div class="doplnit-fotky">${fotky.slice(0, 60).map(f =>
            `<button type="button" data-titulni="${f.id}" title="${esc(nazevAlba(f.album, f.typ))}"><img src="${esc(obrazek(f.url, VELIKOST_NAHLEDU))}" alt="" loading="lazy" draggable="false" /></button>`).join('')}</div>`
        : '<div class="doplnit-akce"><span class="doplnit-napoveda">Modelka zatím nemá fotky.</span><button type="button" class="btn btn-secondary btn-small" data-pridat-fotky><span>+</span> Přidat fotky nebo album……</button></div>'));
    SKUPINY_UDAJU.forEach((s, i) => {
        const chybejici = radek.netyka.has(KLICE_SKUPIN[i]) ? [] : radek.udaje?.[i] || [];
        if (chybejici.length) bloky.push(blok(`${s.nazev} · ${chybejici.length === s.udaje.length ? 'vše' : `${chybejici.length} z ${s.udaje.length}`}`,
            KLICE_SKUPIN[i], `<div class="doplnit-mrizka" data-pole-pro="${KLICE_SKUPIN[i]}"></div>`));
    });
    if (chybi('centerfold')) bloky.push(blok('Centerfold', 'centerfold',
        '<div class="doplnit-akce"><button type="button" class="btn btn-secondary btn-small" data-doplnit-centerfold><span>+</span> Přidat centerfold…</button></div>'));
    if (chybi('hodnoceni')) bloky.push(blok('Hodnocení', 'hodnoceni',
        `<div class="doplnit-srdicka">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="heart" data-hodnota-doplneni="${n}" title="${n} z 5"></button>`).join('')}</div>`));
    const bezVydani = albaBez(radek.bezVydani);
    if (bezVydani.length) bloky.push(blok(`Alba bez vydání · ${bezVydani.length}`, 'vydani', `<div class="doplnit-mrizka">
        ${bezVydani.map((a, i) => `<div class="doplnit-pole"><label for="dopl-vydani-${i}">${esc(nazevAlba(a.album, a.typ))}</label>
            <input id="dopl-vydani-${i}" data-vydani-alba="${i}" placeholder="RRRR-MM nebo RRRR" /></div>`).join('')}</div>`));
    const bezTextu = albaBez(radek.bezPopisu);
    if (bezTextu.length) bloky.push(blok(`Alba bez textu · ${bezTextu.length}`, 'text', `<div class="doplnit-akce">
        ${bezTextu.map((a, i) => `<button type="button" class="btn btn-secondary btn-small" data-text-alba="${i}">✎ ${esc(nazevAlba(a.album, a.typ))}</button>`).join('')}</div>`));

    const poradi = stav.prehledPoradi.indexOf(modelkaId);
    obsah.innerHTML = `
        <header class="doplnit-hlavicka">
            <div>
                <h3>${esc(modelka.jmeno)}</h3>
                <div class="prehled-modelka-pruh"><div><i style="width:${radek.vyplneno}%"></i></div>${radek.vyplneno} %</div>
                <p>Chybí ${radek.vaha} ${radek.vaha === 1 ? 'položka' : radek.vaha < 5 ? 'položky' : 'položek'} · doplň, co víš; ostatní můžeš označit „netýká se“</p>
            </div>
        </header>
        <div class="doplnit-telo">${bloky.join('') || '<p class="empty-state">Modelce už nic nechybí.</p>'}</div>`;
    document.getElementById('doplnitPozice').textContent = poradi >= 0 ? `Modelka ${poradi + 1} z ${stav.prehledPoradi.length}` : '';
    document.getElementById('doplnitDalsiBtn').classList.toggle('hidden', poradi < 0 || poradi >= stav.prehledPoradi.length - 1);

    // Pole údajů z formuláře modelky
    SKUPINY_UDAJU.forEach((s, i) => {
        const cil = obsah.querySelector(`[data-pole-pro="${KLICE_SKUPIN[i]}"]`);
        if (cil) (radek.udaje?.[i] || []).forEach(([, popis, id]) => cil.append(kopiePole(id, popis)));
    });
    stav.doplnovaneHodnoceni = 0;
    stav.doplnovanaTitulni = 0;
    doplnitModal.classList.remove('hidden');
    /** @type {HTMLElement} */ (obsah.querySelector('input:not([type="hidden"]), select, .kategorie-vyber .chip, button.heart, .doplnit-akce button'))?.focus();
}

// Uložení všeho vyplněného; vrací, zda se povedlo
async function ulozit() {
    const modelka = { ...stav.doplnovanaModelka };
    const radek = stav.doplnovanyRadek;
    let zmenaModelky = false;
    for (const prvek of /** @type {NodeListOf<HTMLInputElement>} */ (obsah.querySelectorAll('[data-pole]'))) {
        const hodnota = prvek.value.trim();
        if (!hodnota) continue;
        const vlastnost = vlastnostPole(prvek.dataset.pole);
        if (prvek.dataset.pole === 'inputVyska') modelka.vyskaCm = prevestVysku(hodnota) ?? (parseInt(hodnota) || 0);
        else if (prvek.dataset.pole === 'inputVaha') modelka.vahaKg = prevestVahu(hodnota) ?? (parseInt(hodnota) || 0);
        else modelka[vlastnost] = typPole(prvek.dataset.pole) === 'cislo' ? parseInt(hodnota) || 0 : hodnota;
        zmenaModelky = true;
    }
    if (!platneDatum(modelka.narozeniDatum)) {
        document.getElementById('dopl-inputNarozeniDatum')?.focus();
        oznamit('Datum narození napiš jako RRRR-MM-DD, RRRR-MM nebo jen rok RRRR.');
        return false;
    }
    /** @type {[HTMLInputElement, string][]} */
    const vydani = [.../** @type {NodeListOf<HTMLInputElement>} */ (obsah.querySelectorAll('[data-vydani-alba]'))]
        .map(p => /** @type {[HTMLInputElement, string]} */ ([p, p.value.trim()])).filter(([, v]) => v);
    const spatne = vydani.find(([, v]) => !rozlozitVydani(v));
    if (spatne) {
        spatne[0].focus();
        oznamit('Vydání alba napiš jako RRRR-MM, nebo jen rok RRRR.');
        return false;
    }

    if (zmenaModelky && !await UpdateModelka(modelka)) {
        oznamit('Modelku se nepodařilo uložit do databáze.');
        return false;
    }
    if (stav.doplnovaneHodnoceni) await SetHodnoceni(modelka.id, stav.doplnovaneHodnoceni);
    if (stav.doplnovanaTitulni) await SetTitulniFotka(modelka.id, stav.doplnovanaTitulni);
    const alba = radek.bezVydani.filter(a => !a.netykaSe);
    for (const [prvek, v] of vydani) {
        const a = alba[parseInt(prvek.dataset.vydaniAlba)];
        if (a) await SetVydaniAlba(a.modelkaId, a.album, a.typ, v);
    }
    return true;
}

async function dalsiModelka() {
    const poradi = stav.prehledPoradi.indexOf(stav.doplnovanaModelka.id);
    const dalsiId = stav.prehledPoradi[poradi + 1];
    await nacistPrehled();
    if (dalsiId && stav.prehledRadky.some(r => r.id === dalsiId)) otevritDoplneni(dalsiId);
    else doplnitModal.classList.add('hidden');
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    document.getElementById('doplnitUlozitBtn').onclick = jednou(async () => {
        if (!await ulozit()) return;
        doplnitModal.classList.add('hidden');
        if (!stats.classList.contains('hidden')) nacistPrehled();
        oznamit(`${stav.doplnovanaModelka.jmeno}: uloženo.`);
    });
    document.getElementById('doplnitDalsiBtn').onclick = jednou(async () => {
        if (await ulozit()) await dalsiModelka();
    });
    document.getElementById('doplnitProfilBtn').onclick = () => {
        doplnitModal.classList.add('hidden');
        otevritDetailModelky(stav.doplnovanaModelka);
    };

    obsah.addEventListener('click', async (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const radek = stav.doplnovanyRadek;
        const modelka = stav.doplnovanaModelka;
        const titulni = cil.closest('[data-titulni]');
        if (titulni) {
            const id = parseInt(titulni.dataset.titulni);
            stav.doplnovanaTitulni = stav.doplnovanaTitulni === id ? 0 : id;
            obsah.querySelectorAll('[data-titulni]').forEach(b => b.classList.toggle('vybrana', parseInt(b.dataset.titulni) === stav.doplnovanaTitulni));
            return;
        }
        if (cil.closest('[data-pridat-fotky]')) {
            doplnitModal.classList.add('hidden');
            otevritAlbumModal(modelka);
            return;
        }
        const srdce = cil.closest('[data-hodnota-doplneni]');
        if (srdce) {
            const n = parseInt(srdce.dataset.hodnotaDoplneni);
            stav.doplnovaneHodnoceni = stav.doplnovaneHodnoceni === n ? 0 : n;
            obsah.querySelectorAll('[data-hodnota-doplneni]').forEach(b => b.classList.toggle('on', parseInt(b.dataset.hodnotaDoplneni) <= stav.doplnovaneHodnoceni));
            return;
        }
        if (cil.closest('[data-doplnit-centerfold]')) {
            doplnitModal.classList.add('hidden');
            otevritAlbumModal(modelka, null, { typ: 'Centerfold' });
            document.getElementById('selectAlbumMesic').focus();
            return;
        }
        const textAlba = cil.closest('[data-text-alba]');
        if (textAlba) {
            // Text alba se píše v okně alba (s fotografem a ostatními údaji alba)
            const a = radek.bezPopisu.filter(x => !x.netykaSe)[parseInt(textAlba.dataset.textAlba)];
            doplnitModal.classList.add('hidden');
            await otevritDetailModelky(modelka);
            await nacistFotkyModelky(modelka.id);
            const album = a && stav.aktualniAlba.find(x => x.album === a.album && x.typ === a.typ);
            if (album) {
                otevritAlbumModal(modelka, album);
                document.getElementById('inputAlbumPopis').focus();
            }
            return;
        }
        const netyka = cil.closest('[data-netyka-bloku]');
        if (netyka) {
            const klic = netyka.dataset.netykaBloku;
            if (klic === 'text' || klic === 'vydani') {
                for (const a of (klic === 'text' ? radek.bezPopisu : radek.bezVydani)) await SetNetykaSeAlba(a.modelkaId, a.album, a.typ, klic, true);
            } else {
                await SetNetykaSe(modelka.id, klic, true);
            }
            netyka.closest('.doplnit-blok').remove();
            if (!obsah.querySelector('.doplnit-blok')) obsah.querySelector('.doplnit-telo').innerHTML = '<p class="empty-state">Modelce už nic nechybí.</p>';
        }
    });
}
