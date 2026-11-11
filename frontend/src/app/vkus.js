// Tvoje ideální modelka (galerie_vkus.go GetIdealniModelka): obrazně složená z toho, co hodnotíš ♥4+ – profil
// (vlasy, původ, éra, věk při focení, tetování, kariéra), styly a obsah, které miluješ a které tě míjí, modelky
// obsahem nejblíž tvému vkusu a tvoje nejtypičtější fotka s objevem, který jsi ještě nehodnotil. Celostránkové okno;
// otevírá ho jakékoli tlačítko s data-otevrit-vkus (banner Profilů, blok kolekcí v Galerii). Vlastnost s kolekcí
// otevře tu kolekci v Galerii.
import { GetIdealniModelka } from './backend';
import { esc, obrazek } from '../lib/format';
import { stav } from './stav';
import { searchInput } from './prvky';
import { prepnoutRezim } from './navigace';
import { nacistGalerii } from './galerie';
import { otevritProfilPodleId } from './cover';
import { otevritLightbox } from './prohlizec';
import { nastavitKolekciGalerie } from './galerie-vse';
import { atributVyrezu } from './vyrez-nahledu';

let okno = null;
let data = null;

const procenta = x => `${Math.round(x * 100)} %`;
const pomer = x => `${x >= 10 ? Math.round(x) : String(x.toFixed(1)).replace('.', ',')}×`;
const polozka = f => ({ fotky: [f], album: f.album, typ: f.typ, modelkaId: f.modelkaId, jmenoModelky: f.jmenoModelky, rotace: f.rotace, hodnoceni: f.hodnoceni });

function htmlVlastnosti(x, i, seznam) {
    const titulek = `${procenta(x.podil)} tvých oblíbených fotek proti ${procenta(x.prumer)} ve sbírce`;
    return `<button type="button" class="vk-vlastnost ${x.klic ? '' : 'bez-kolekce'}" data-vk="${seznam}:${i}" title="${esc(titulek)}${x.klic ? ' – klik otevře kolekci v Galerii' : ''}">
        <span class="vk-hodnota">${esc(x.hodnota)}</span><span class="vk-pomer">${pomer(x.pomer)}</span></button>`;
}

function htmlFotky(f, nadpis, popis, klic) {
    if (!f) return '';
    return `<figure class="vk-fotka" data-vk-fotka="${klic}">
        <img src="${esc(obrazek(f.url, 'w800'))}"${atributVyrezu(f)} alt="" draggable="false" />
        <figcaption><b>${esc(nadpis)}</b><span>${esc(popis)}</span><small>${esc(f.jmenoModelky || '')}</small></figcaption></figure>`;
}

function vykreslit() {
    const telo = okno.querySelector('.vk-telo');
    if (!data) {
        telo.innerHTML = '<p class="vk-nacita">Skládám tvoji ideální modelku…</p>';
        return;
    }
    if (data.malo) {
        telo.innerHTML = `<p class="vk-nacita">Na závěry je zatím málo srdíček: ohodnoť aspoň 20 fotek ♥4 nebo ♥5 (teď ${data.oblibenych}). Nejrychleji v Hodnocení nebo v Galerii klávesami 4 a 5.</p>`;
        return;
    }
    const profil = data.profil.map(x => `<div class="vk-radek"><span class="vk-skupina">${esc(x.skupina)}</span>${htmlVlastnosti(x, data.profil.indexOf(x), 'profil')}</div>`).join('');
    telo.innerHTML = `
        <p class="vk-uvod">Složená z ${data.oblibenych.toLocaleString('cs-CZ')} fotek, které hodnotíš ♥4 a víc (♥5 váží dvakrát). Číslo říká, kolikrát častěji je vlastnost mezi nimi než v celé sbírce.</p>
        <div class="vk-mrizka">
            <section class="vk-karta vk-profil"><h3>Kdo to je</h3>${profil || '<p class="vk-prazdne">Bez vyhraněných preferencí – líbí se ti všechno stejně.</p>'}</section>
            <section class="vk-karta"><h3>Co miluješ</h3><div class="vk-seznam">${data.milujes.map((x, i) => htmlVlastnosti(x, i, 'milujes')).join('') || '<p class="vk-prazdne">Nic výrazně nad průměr.</p>'}</div>
                ${data.mijis.length ? `<h3 class="vk-mijis">Co tě míjí</h3><div class="vk-seznam">${data.mijis.map((x, i) => htmlVlastnosti(x, i, 'mijis')).join('')}</div>` : ''}</section>
        </div>
        ${data.dokonala || data.objev ? `<div class="vk-fotky">${htmlFotky(data.dokonala, 'Tvoje nejtypičtější fotka', 'Z tvých oblíbených obsahem nejblíž středu vkusu', 'dokonala')}${htmlFotky(data.objev, 'Objev', 'Nehodnocená fotka, která ti sedí nejvíc', 'objev')}</div>` : ''}
        ${data.nejblize.length ? `<section class="vk-nejblize"><h3>Modelky nejblíž tvému ideálu</h3><div class="vk-modelky">${data.nejblize.map(m => `<button type="button" class="vk-modelka" data-vk-modelka="${m.modelkaId}" title="Otevřít profil">
            <img src="${esc(obrazek(m.fotka.url, 'w400'))}"${atributVyrezu(m.fotka)} alt="" loading="lazy" draggable="false" /><span>${esc(m.jmeno)}</span></button>`).join('')}</div></section>` : ''}`;
}

export async function otevritVkus() {
    if (!okno) {
        okno = document.createElement('div');
        okno.className = 'vk-okno';
        okno.setAttribute('role', 'dialog');
        okno.setAttribute('aria-label', 'Tvoje ideální modelka');
        okno.innerHTML = `<div class="vk-obsah"><header class="vk-hlava"><h2>✨ Tvoje ideální modelka</h2><button type="button" class="vk-zavrit" data-vk-zavrit aria-label="Zavřít" title="Zavřít (Esc)">×</button></header><div class="vk-telo"></div></div>`;
        okno.addEventListener('click', klik);
        document.body.append(okno);
    }
    okno.classList.remove('hidden');
    data = null;
    vykreslit();
    data = await GetIdealniModelka().catch(() => null) || { malo: true, oblibenych: 0, profil: [], milujes: [], mijis: [], nejblize: [] };
    if (okno && !okno.classList.contains('hidden')) vykreslit();
}

function zavrit() {
    okno?.classList.add('hidden');
}

function klik(e) {
    const cil = /** @type {HTMLElement} */ (e.target);
    if (cil.closest('[data-vk-zavrit]') || cil === okno) return zavrit();
    const v = /** @type {HTMLElement | null} */ (cil.closest('[data-vk]'));
    if (v) {
        const [seznam, i] = v.dataset.vk.split(':');
        const x = data?.[seznam]?.[parseInt(i, 10)];
        if (!x?.klic) return;
        zavrit();
        nastavitKolekciGalerie(x.klic, x.hodnota);
        stav.nejlepsiVyber = 0;
        stav.nejlepsiMin = 0;
        searchInput.value = '';
        prepnoutRezim('nejlepsi');
        nacistGalerii('');
        return;
    }
    const m = /** @type {HTMLElement | null} */ (cil.closest('[data-vk-modelka]'));
    if (m) {
        zavrit();
        return otevritProfilPodleId(parseInt(m.dataset.vkModelka, 10));
    }
    const f = /** @type {HTMLElement | null} */ (cil.closest('[data-vk-fotka]'));
    if (f && data) {
        const fotky = [data.dokonala, data.objev].filter(Boolean);
        const i = f.dataset.vkFotka === 'objev' && data.dokonala ? 1 : 0;
        otevritLightbox(i, false, fotky.map(polozka));
    }
}

// Tlačítka data-otevrit-vkus kdekoli v aplikaci; Esc zavře
export function pripravitVkus() {
    document.addEventListener('click', (e) => {
        if (/** @type {HTMLElement} */ (e.target).closest('[data-otevrit-vkus]')) otevritVkus();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && okno && !okno.classList.contains('hidden') && document.getElementById('lightbox')?.classList.contains('hidden') !== false) zavrit();
    });
}
