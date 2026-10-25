// Okno „Doplnit modelku“ z Přehledu: všechno, co modelce podle Přehledu chybí, na jednom místě.
// Pole údajů se berou z formuláře modelky (stejné typy a nabídky), ukládá se jedním tlačítkem;
// „Uložit a další“ pokračuje další modelkou v pořadí Přehledu.
import { jednou, oznamit } from '../ui/oznameni';
import { GetFotografieModelky, SetHodnoceni, SetNetykaSe, SetNetykaSeAlba, SetTitulniFotka, SetVydaniAlba, UpdateModelka } from './backend';
import { esc, nazevAlba, obrazek, platneDatum, prevestVahu, prevestVysku, rozlozitMiry, rozlozitVydani } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { stats } from './prvky';
import { VELIKOST_NAHLEDU } from './obrazky';
import { otevritDetailModelky, nacistFotkyModelky } from './profil';
import { otevritAlbumModal } from './formular-alba';
import { poleModelky, potvrdit } from './formular-modelky';
import { pripojitVyberKategorii } from '../ui/kategorie';
import { nacistPrehled } from './prehled';
import { KLICE_SKUPIN, SKUPINY_UDAJU } from '../lib/udrzba';
import { htmlSrdicekModelky, obnovitSrdickaModelky } from '../ui/srdicka';
import { hodnotaPoKliku } from '../lib/srdicka';

export const doplnitModal = document.getElementById('doplnitModal');
const obsah = document.getElementById('doplnitObsah');

const typPole = id => poleModelky.find(([, prvek]) => prvek === id)?.[2] || 'text';
const vlastnostPole = id => poleModelky.find(([, prvek]) => prvek === id)?.[0];

// Pole z formuláře modelky jako kopie (typ, nápověda, nabídka výběru) s vlastním id; sdílí ho Údržba
// (udrzba-udaje.js, udrzba-fokus.js). hodnota = výchozí hodnota pole (oprava nálezu, návrh), jinak prázdné.
export function kopiePole(id, popis, { predpona = 'dopl', hodnota = '' } = {}) {
    const vzor = document.getElementById(id);
    const kopie = /** @type {HTMLInputElement | HTMLSelectElement} */ (vzor.cloneNode(true));
    kopie.id = `${predpona}-${id}`;
    kopie.dataset.pole = id;
    kopie.removeAttribute('required');
    // Živé nápovědy formuláře modelky v tomto okně nejsou
    kopie.removeAttribute('aria-describedby');
    if (kopie.tagName === 'SELECT') {
        kopie.querySelectorAll('option[data-puvodni]').forEach(o => o.remove());
        const vyber = /** @type {HTMLSelectElement} */ (kopie);
        // Hodnota, kterou výběr nenabízí, se do něj doplní (jako ve formuláři modelky)
        if (hodnota !== '' && ![...vyber.options].some(o => o.value === hodnota)) vyber.add(new Option(hodnota, hodnota));
        if (hodnota !== '') vyber.value = hodnota;
        else vyber.selectedIndex = 0;
    } else {
        /** @type {HTMLInputElement} */ (kopie).value = hodnota;
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

// Hodnoty kopií polí do kopie modelky se stejnými převody jako formulář modelky (americké míry, čísla).
// Prázdné pole se přeskočí; s prazdne: true údaj smaže (oprava nálezu kontroly). Vrací, zda se něco zapsalo.
export function zapsatPole(prvky, modelka, { prazdne = false } = {}) {
    let zmena = false;
    for (const prvek of prvky) {
        const hodnota = prvek.value.trim();
        if (!hodnota && !prazdne) continue;
        const pole = prvek.dataset.pole;
        if (pole === 'inputVyska') modelka.vyskaCm = prevestVysku(hodnota) ?? (parseInt(hodnota) || 0);
        else if (pole === 'inputVaha') modelka.vahaKg = prevestVahu(hodnota) ?? (parseInt(hodnota) || 0);
        else modelka[vlastnostPole(pole)] = typPole(pole) === 'cislo' ? parseInt(hodnota) || 0 : hodnota;
        zmena = true;
    }
    return zmena;
}

// Po opuštění pole: americké míry na cm a kg, „34B-24-34“ v hrudníku nebo velikosti prsou rozepíše do polí,
// která kontejner nabízí
export function prevestPole(kontejner, prvek) {
    const prevod = { inputVyska: prevestVysku, inputVaha: prevestVahu }[prvek.dataset.pole];
    if (prevod) {
        const cislo = prevod(prvek.value);
        if (cislo !== null) prvek.value = String(cislo);
        return;
    }
    if (prvek.dataset.pole !== 'inputHrudnik' && prvek.dataset.pole !== 'inputVelikost') return;
    const miry = rozlozitMiry(prvek.value);
    if (!miry) return;
    const nastavit = (pole, hodnota) => {
        const kopie = /** @type {HTMLInputElement} */ (kontejner.querySelector(`[data-pole="${pole}"]`));
        if (kopie) kopie.value = String(hodnota);
    };
    nastavit('inputHrudnik', miry.hrudnik);
    nastavit('inputPas', miry.pas);
    nastavit('inputBoky', miry.boky);
    // Míry bez velikosti v poli velikosti nesmí zůstat jako velikost prsou
    if (miry.velikost || prvek.dataset.pole === 'inputVelikost') nastavit('inputVelikost', miry.velikost);
    // Kontejner bez pole velikosti (řádek Míry v Údržbě): velikost si pole zapamatuje a uloží se, když chybí
    if (miry.velikost && !kontejner.querySelector('[data-pole="inputVelikost"]')) prvek.dataset.velikost = miry.velikost;
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
        : '<div class="doplnit-akce"><span class="doplnit-napoveda">Modelka zatím nemá fotky.</span><button type="button" class="btn btn-secondary btn-small" data-pridat-fotky><span>+</span> Přidat fotky nebo album…</button></div>'));
    SKUPINY_UDAJU.forEach((s, i) => {
        const chybejici = radek.netyka.has(KLICE_SKUPIN[i]) ? [] : radek.udaje?.[i] || [];
        if (chybejici.length) bloky.push(blok(`${s.nazev} · ${chybejici.length === s.udaje.length ? 'vše' : `${chybejici.length} z ${s.udaje.length}`}`,
            KLICE_SKUPIN[i], `<div class="doplnit-mrizka" data-pole-pro="${KLICE_SKUPIN[i]}"></div>`));
    });
    if (chybi('centerfold')) bloky.push(blok('Centerfold', 'centerfold',
        '<div class="doplnit-akce"><button type="button" class="btn btn-secondary btn-small" data-doplnit-centerfold><span>+</span> Přidat centerfold…</button></div>'));
    if (chybi('hodnoceni')) bloky.push(blok('Hodnocení', 'hodnoceni',
        `<div class="doplnit-srdicka">${htmlSrdicekModelky(stav.doplnovaneHodnoceni, '', { tabem: false, posuvnik: false, atributPulky: 'data-hodnota-doplneni' })}</div>`));
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
            <button type="button" class="close-btn" data-zavrit title="Zavřít (Esc)" aria-label="Zavřít">&times;</button>
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
    const zmenaModelky = zapsatPole(/** @type {NodeListOf<HTMLInputElement>} */ (obsah.querySelectorAll('[data-pole]')), modelka);
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
    // Ctrl+Enter uloží odkudkoli v okně
    doplnitModal.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        // Opuštění pole nejdřív převede rozepsanou míru (událost change)
        /** @type {HTMLElement} */ (document.activeElement)?.blur();
        document.getElementById('doplnitUlozitBtn').click();
    });

    // Stejné převody jako ve formuláři modelky: americké míry po opuštění pole na cm a kg,
    // „34B-24-34“ v hrudníku nebo velikosti prsou rozepíše do polí, která okno nabízí
    obsah.addEventListener('change', (e) => prevestPole(obsah, /** @type {HTMLInputElement} */ (e.target)));

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
            doplnitModal.dataset.zmeneno = '1';
            obsah.querySelectorAll('[data-titulni]').forEach(b => b.classList.toggle('vybrana', parseInt(b.dataset.titulni) === stav.doplnovanaTitulni));
            return;
        }
        // Tlačítka, která okno opustí, se u rozepsaných změn nejdřív zeptají
        const odejit = cil.closest('[data-pridat-fotky], [data-doplnit-centerfold], [data-text-alba]');
        if (odejit && doplnitModal.dataset.zmeneno
            && !await potvrdit('Zahodit změny?', 'Rozepsané údaje v okně se neuloží.', 'Zahodit', { nebezpecne: true })) return;
        if (cil.closest('[data-pridat-fotky]')) {
            doplnitModal.classList.add('hidden');
            otevritAlbumModal(modelka);
            return;
        }
        const srdce = cil.closest('[data-hodnota-doplneni]');
        if (srdce) {
            // Po půlkách jako v profilu: levá půlka srdíčka dá x,5, klik na současnou hodnotu ji zruší
            stav.doplnovaneHodnoceni = hodnotaPoKliku(stav.doplnovaneHodnoceni, srdce.dataset.hodnotaDoplneni);
            doplnitModal.dataset.zmeneno = '1';
            obnovitSrdickaModelky(srdce.closest('.hearts'), stav.doplnovaneHodnoceni);
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
