// Síň slávy (Oblíbenost › Síň slávy): karty modelek jako v galerii Modelky, doplněné o kroniku potvrzené top 10
// z backendu (GetSinSlavy, oblibenost_slava.go). Nahoře současná Top 10 (místo, jak dlouho v ní je, obhajoby, trofeje
// rekordů), pod ní Legendy (bývalé Top 10) a sbalená kronika událostí po měsících.
// Profil otevírá prehled.js (data-otevrit-modelku), srdíčka galerie.js, přechod do Porovnávání oblibenost.js
// (data-ob-porovnavat).
import { GetSinSlavy } from './backend';
import { esc } from '../lib/format';
import { datumKroniky, kronikaPoMesicich, textDni, textRekordu, textUdalosti } from '../lib/slava';
import { stav } from './stav';
import { adresaTitulni, nacitatPostupne } from './obrazky';
import { stylVyrezu } from './navigace';
import { htmlSrdicka, htmlTrendu } from './galerie';
import { nastavitHtml } from '../ui/dom';
import { htmlPrazdna } from '../ui/prazdno';

let kontejner = null;
let data = null;

const modelka = id => stav.prehledModelky.get(id);
const jmeno = id => modelka(id)?.jmeno || '';

export async function nacistSinSlavy(prvek) {
    kontejner = prvek;
    try {
        data = await GetSinSlavy();
    } catch {
        nastavitHtml(kontejner, '<p class="ob-info">Síň slávy se nepodařilo načíst.</p>');
        return;
    }
    vykreslit();
}

// Trofeje rekordů podle modelky: id → [{ nazev, hodnota, popis }]
function trofeje() {
    const podleModelky = new Map();
    data.rekordy.forEach(r => {
        if (!podleModelky.has(r.modelkaId)) podleModelky.set(r.modelkaId, []);
        podleModelky.get(r.modelkaId).push(textRekordu(r));
    });
    return podleModelky;
}

// Karta modelky jako v galerii: titulní fotka s výřezem, srdíčka, vpravo nahoře místo (legendy nejlepší místo),
// trofeje rekordů nad jménem a pod jménem řádek síně slávy
function htmlKarty(x, rekordy, legenda) {
    const m = modelka(x.modelkaId);
    if (!m) return '';
    // Krátce (sekce říká, že jde o Top 10); podrobnosti v bublině
    const popis = legenda
        ? [`${textDni(x.dniCelkem, x.odZacatku)} v Top 10`, x.obhajob ? `${x.obhajob}× 🛡` : '']
        : [textDni(x.dniTed, x.odZacatku), x.obhajob ? `${x.obhajob}× 🛡` : '', x.pobytu > 1 ? `${x.pobytu}. pobyt` : ''];
    const bublina = legenda
        ? `${m.jmeno}: v Top 10 ${datumKroniky(x.od)} – ${datumKroniky(x.do)}, celkem ${textDni(x.dniCelkem, x.odZacatku)}, nejlépe ${x.nejlepsiMisto}. místo${x.dniNaPrvnim ? `, na 1. místě ${textDni(x.dniNaPrvnim)}` : ''}`
        : `${m.jmeno}: ${x.misto}. místo, v Top 10 od ${datumKroniky(x.od)}${x.odZacatku ? ' (už před začátkem kroniky)' : ''}${x.pobytu > 1 ? `, celkem ${textDni(x.dniCelkem)}` : ''}${x.dniNaPrvnim ? `, na 1. místě ${textDni(x.dniNaPrvnim, x.odZacatku)}` : ''}, nejlépe ${x.nejlepsiMisto}. místo`;
    const misto = legenda ? `<span class="slava-misto legenda" title="Nejlepší místo">nejlépe ${x.nejlepsiMisto}.</span>`
        : `<span class="slava-misto ${x.misto === 1 ? 'prvni' : ''}" title="${x.misto}. místo v Top 10">${x.misto === 1 ? '♛ ' : ''}${x.misto}.</span>`;
    return `
        <div class="card slava-karta ${legenda ? 'legenda' : ''}" data-otevrit-modelku="${m.id}" tabindex="0" aria-label="${esc(m.jmeno)}" title="${esc(bublina)}">
            <div class="card-image-wrap">
                <img data-src="${esc(adresaTitulni(m))}" alt="" style="${stylVyrezu(m)}" draggable="false" decoding="async" />
                ${htmlSrdicka(m, false)}
                ${misto}
                ${rekordy?.length ? `<span class="slava-trofeje">${rekordy.map(r => `<span class="slava-trofej" title="${esc(`${r.nazev}: ${r.hodnota} ${r.popis}`)}">🏆 ${esc(r.nazev)}</span>`).join('')}</span>` : ''}
            </div>
            <div class="card-info">
                <h3>${esc(m.jmeno)}${legenda ? '' : htmlTrendu(m)}</h3>
                <p class="slava-popis">${esc(popis.filter(Boolean).join(' · '))}</p>
            </div>
        </div>`;
}

function htmlKroniky() {
    const skupiny = kronikaPoMesicich(data.kronika);
    return `<details class="ob-karta slava-kronika-obal">
        <summary><h4>Kronika <small>${data.kronika.length} ${data.kronika.length === 1 ? 'událost' : data.kronika.length < 5 ? 'události' : 'událostí'} od ${esc(datumKroniky(data.od))}</small></h4></summary>
        <ol class="slava-kronika">${skupiny.map(sk => `<li class="slava-mesic">${esc(sk.mesic)}</li>${sk.udalosti.map((u, i, vse) => {
            // Kdo byl v top 10 už na začátku kroniky, je v jednom řádku (jinak deset stejných vět za sebou)
            if (u.druh === 'pocatek') {
                if (vse[i - 1]?.druh === 'pocatek') return '';
                let konec = i;
                while (vse[konec]?.druh === 'pocatek') konec++;
                const jmena = vse.slice(i, konec).sort((a, b) => a.misto - b.misto).map(x => `${x.misto}. ${jmeno(x.modelkaId)}`).join(', ');
                return `<li class="slava-udalost pocatek"><span class="slava-ikona" aria-hidden="true">★</span><span>Na začátku kroniky byly v Top 10: ${esc(jmena)}<small>${esc(datumKroniky(u.cas))}</small></span></li>`;
            }
            const t = textUdalosti(u, jmeno);
            return `<li class="slava-udalost ${esc(u.druh)}"><span class="slava-ikona" aria-hidden="true">${t.ikona}</span><span>${esc(t.text)}<small>${esc(datumKroniky(u.cas))}</small></span></li>`;
        }).join('')}`).join('')}</ol>
    </details>`;
}

function vykreslit() {
    if (!kontejner || !data) return;
    if (!data.od) {
        nastavitHtml(kontejner, htmlPrazdna('Síň slávy se teprve plní', 'Kronika začne při příštím přepočtu oblíbenosti. Od té chvíle si program pamatuje, kdo je v Top 10, kdo vypadl, obhájil místo nebo byl jedničkou.', { ikona: 'hvezda' }));
        return;
    }
    const rekordy = trofeje();
    const top = data.vitrina.map(x => htmlKarty(x, rekordy.get(x.modelkaId), false)).join('');
    const legendy = data.legendy.map(x => htmlKarty(x, rekordy.get(x.modelkaId), true)).join('');
    nastavitHtml(kontejner, `<div class="slava">
        <h4 class="slava-nadpis">Top 10 <small>${top ? 'jak dlouho v ní kdo je · 🛡 obhajoby · 🏆 rekordy' : ''}</small></h4>
        ${top ? `<div class="gallery-grid slava-karty">${top}</div>` : `<p class="slava-nic">Zatím žádná potvrzená v Top 10. Do Top 10 se dostane modelka po 10 porovnáních s výhrou nad některou z Top 20. <button type="button" class="link" data-ob-porovnavat>Porovnávat →</button></p>`}
        <h4 class="slava-nadpis">Legendy <small>bývalé Top 10</small></h4>
        ${legendy ? `<div class="gallery-grid slava-karty">${legendy}</div>` : '<p class="slava-nic">Zatím nikdo z Top 10 nevypadl.</p>'}
        ${htmlKroniky()}
    </div>`);
    nacitatPostupne(kontejner);
}

export function pripravitSinSlavy() {
    // Klávesnice: Enter na kartě otevře profil jako klik
    document.addEventListener('keydown', (e) => {
        const karta = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target)?.closest?.('.slava-karta'));
        if (e.key === 'Enter' && karta && kontejner?.contains(karta)) karta.click();
    });
}
