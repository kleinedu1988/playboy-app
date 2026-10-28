// Síň slávy (Oblíbenost › Síň slávy): karty modelek jako v galerii Modelky, doplněné o kroniku potvrzené top 10
// z backendu (GetSinSlavy, oblibenost_slava.go). Nahoře současná Top 10 (místo, jak dlouho v ní je, obhajoby, trofeje
// rekordů), pod ní Legendy (bývalé Top 10) a sbalená kronika událostí po měsících.
// Profil otevírá prehled.js (data-otevrit-modelku), srdíčka galerie.js, přechod do Porovnávání oblibenost.js
// (data-ob-porovnavat).
import { GetSinSlavy } from './backend';
import { esc } from '../lib/format';
import { ODZNAKY, PORADI_ODZNAKU, datumKroniky, kronikaPoMesicich, popisOdznaku, textDni, textRekordu, textUdalosti } from '../lib/slava';
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

// Varianta vzhledu odznaků (dočasně na ukázku): a = medailony pod jménem, b = na fotce, c = počet medailí
const varianta = () => document.documentElement.dataset.odznaky || 'a';

// Získané odznaky podle modelky: id → [odznak], v pořadí ODZNAKY, vyšší stupeň napřed
function odznakyModelek() {
    const v = new Map();
    (data.odznaky || []).filter(o => o.ziskan).forEach(o => {
        if (!v.has(o.modelkaId)) v.set(o.modelkaId, []);
        v.get(o.modelkaId).push(o);
    });
    v.forEach(seznam => seznam.sort((a, b) => PORADI_ODZNAKU.indexOf(a.odznak) - PORADI_ODZNAKU.indexOf(b.odznak)));
    return v;
}

// Medailon odznaku: ikona v kroužku, barva kroužku podle stupně (jednorázový fialový)
export function htmlMedailonu(o, velky = false) {
    const p = popisOdznaku(o, jmeno);
    if (!p) return '';
    // Nezískaný (jen postup k bronzu): přerušovaný kroužek
    const stupen = !o.ziskan ? 'cil' : ['jednorazovy', 'bronz', 'stribro', 'zlato'][o.stupen] || 'jednorazovy';
    return `<span class="odznak ${stupen}${velky ? ' velky' : ''}" title="${esc(p.text)}" aria-label="${esc(p.text)}">${p.ikona}</span>`;
}

// Řada medailonů (karta, profil); nejvýš max, zbytek „+2“
export function htmlRadyOdznaku(seznam, max = 6) {
    if (!seznam?.length) return '';
    const navic = seznam.length - max;
    return `<span class="odznaky-rada">${seznam.slice(0, max).map(o => htmlMedailonu(o)).join('')}${navic > 0 ? `<span class="odznak navic" title="${esc(seznam.slice(max).map(o => popisOdznaku(o, jmeno)?.text).join('\n'))}">+${navic}</span>` : ''}</span>`;
}

// Počet medailí: „🥇2 🥈1 🥉3 · ✦2“ (zlato, stříbro, bronz, jednorázové)
function htmlPoctuMedaili(seznam) {
    if (!seznam?.length) return '';
    const pocet = s => seznam.filter(o => o.stupen === s).length;
    const casti = [[3, '🥇', 'zlato'], [2, '🥈', 'stříbro'], [1, '🥉', 'bronz'], [0, '✦', 'jednorázové']].map(([s, ikona, nazev]) => pocet(s) ? `<span title="${esc(`${nazev}: ${seznam.filter(o => o.stupen === s).map(o => popisOdznaku(o, jmeno)?.nazev).join(', ')}`)}">${ikona}${pocet(s)}</span>` : '').filter(Boolean);
    return `<span class="odznaky-pocty" title="${esc(seznam.map(o => popisOdznaku(o, jmeno)?.text).join('\n'))}">${casti.join('')}</span>`;
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
function htmlKarty(x, rekordy, legenda, odznaky) {
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
                ${varianta() === 'b' && odznaky?.length ? `<span class="odznaky-na-fotce">${odznaky.slice(0, 5).map(o => htmlMedailonu(o)).join('')}${odznaky.length > 5 ? `<span class="odznak navic">+${odznaky.length - 5}</span>` : ''}</span>` : ''}
                ${rekordy?.length ? `<span class="slava-trofeje">${rekordy.map(r => `<span class="slava-trofej" title="${esc(`${r.nazev}: ${r.hodnota} ${r.popis}`)}">🏆 ${esc(r.nazev)}</span>`).join('')}</span>` : ''}
            </div>
            <div class="card-info">
                <h3>${esc(m.jmeno)}${legenda ? '' : htmlTrendu(m)}</h3>
                <p class="slava-popis">${esc(popis.filter(Boolean).join(' · '))}</p>
                ${varianta() === 'a' ? htmlRadyOdznaku(odznaky, 5) : varianta() === 'c' ? htmlPoctuMedaili(odznaky) : ''}
            </div>
        </div>`;
}

// Oddíl Odznaky: kdo co má a kolik chybí k dalšímu stupni (modelky v Top 10)
function htmlOddiluOdznaku() {
    const vse = data.odznaky || [];
    const ziskane = vse.filter(o => o.ziskan);
    const naCeste = vse.filter(o => o.dalsi > 0).sort((a, b) => (popisOdznaku(b)?.postup ?? 0) - (popisOdznaku(a)?.postup ?? 0));
    const kdo = o => `<button type="button" class="link odznak-jmeno" data-otevrit-modelku="${o.modelkaId}" title="${esc(popisOdznaku(o, jmeno)?.text || '')}">${esc(jmeno(o.modelkaId))}</button>`;
    const pruh = o => {
        const p = popisOdznaku(o, jmeno);
        return `<li class="odznak-cesta"><span class="odznak-cesta-ikona">${htmlMedailonu(o)}</span>${kdo(o)}<span class="odznak-pruh" title="${esc(p.text)}"><i style="width:${Math.round((p.postup || 0) * 100)}%"></i></span><small>${esc(p.zbyva)}</small></li>`;
    };
    const nadpis = `<h4 class="slava-nadpis">Odznaky <small>${ziskane.length ? `${ziskane.length} získaných` : 'zatím žádný'} · bronz, stříbro, zlato a jednorázové</small></h4>`;
    const cesta = naCeste.length ? `<div class="odznaky-cesta"><h5>Na dosah</h5><ol>${naCeste.slice(0, 8).map(pruh).join('')}</ol></div>` : '';
    if (varianta() === 'b') {
        // Tabulka: modelky (s odznakem) × odznaky
        const ids = [...new Set(vse.map(o => o.modelkaId))].sort((a, b) => (modelka(a)?.poradi || 999) - (modelka(b)?.poradi || 999));
        const bunka = (id, klic) => {
            const o = vse.find(x => x.modelkaId === id && x.odznak === klic);
            if (!o) return '<td></td>';
            if (!o.ziskan) return `<td class="odznak-postup" title="${esc(popisOdznaku(o, jmeno).text)}"><span class="odznak-pruh"><i style="width:${Math.round((popisOdznaku(o).postup || 0) * 100)}%"></i></span></td>`;
            return `<td>${htmlMedailonu(o)}</td>`;
        };
        return `${nadpis}<div class="ob-karta odznaky-tabulka-obal"><table class="odznaky-tabulka"><thead><tr><th></th>${PORADI_ODZNAKU.map(k => `<th title="${esc(`${ODZNAKY[k].nazev}: ${ODZNAKY[k].popis}`)}">${ODZNAKY[k].ikona}<small>${esc(ODZNAKY[k].nazev)}</small></th>`).join('')}</tr></thead>
            <tbody>${ids.map(id => `<tr><th><button type="button" class="link" data-otevrit-modelku="${id}">${esc(jmeno(id))}</button></th>${PORADI_ODZNAKU.map(k => bunka(id, k)).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    if (varianta() === 'c') {
        // Řádek na odznak: zlato | stříbro | bronz (jednorázové: kdo ho má)
        const radek = klic => {
            const d = ODZNAKY[klic];
            const maji = ziskane.filter(o => o.odznak === klic);
            const stupne = d.prahy
                ? [3, 2, 1].map(s => `<span class="odznak-stupen-sloupec s${s}"><b>${['', 'Bronz', 'Stříbro', 'Zlato'][s]} <small>${esc(d.jednotka(d.prahy[s - 1]))}</small></b>${maji.filter(o => o.stupen === s).map(kdo).join(', ') || '<small class="odznak-nikdo">–</small>'}</span>`).join('')
                : `<span class="odznak-stupen-sloupec jedno">${maji.map(kdo).join(', ') || '<small class="odznak-nikdo">zatím nikdo</small>'}</span>`;
            return `<li class="odznak-radek"><span class="odznak velky ${d.prahy ? 'zlato' : 'jednorazovy'}">${d.ikona}</span><span class="odznak-radek-nazev"><b>${esc(d.nazev)}</b><small>${esc(d.popis)}</small></span>${stupne}</li>`;
        };
        return `${nadpis}<div class="odznaky-c"><ol class="ob-karta odznaky-radky">${PORADI_ODZNAKU.map(radek).join('')}</ol>${cesta ? `<div class="ob-karta">${cesta}</div>` : ''}</div>`;
    }
    // a: dlaždice odznaků, v každé kdo ho má (zlato napřed), dole Na dosah
    const dlazdice = klic => {
        const d = ODZNAKY[klic];
        const maji = ziskane.filter(o => o.odznak === klic).sort((a, b) => b.stupen - a.stupen);
        return `<div class="odznak-dlazdice ${maji.length ? '' : 'prazdna'}"><span class="odznak velky ${d.prahy ? (maji[0] ? ['', 'bronz', 'stribro', 'zlato'][maji[0].stupen] : 'zadny') : maji.length ? 'jednorazovy' : 'zadny'}">${d.ikona}</span>
            <b>${esc(d.nazev)}</b><small>${esc(d.prahy ? `${d.popis}: ${d.prahy.join(' / ')}` : d.popis)}</small>
            <span class="odznak-drzitelky">${maji.length ? maji.map(o => `<span class="odznak-drzitelka ${['jednorazovy', 'bronz', 'stribro', 'zlato'][o.stupen]}">${kdo(o)}</span>`).join('') : '<small class="odznak-nikdo">zatím nikdo</small>'}</span></div>`;
    };
    return `${nadpis}<div class="odznaky-dlazdice">${PORADI_ODZNAKU.map(dlazdice).join('')}</div>${cesta ? `<div class="ob-karta odznaky-cesta-obal">${cesta}</div>` : ''}`;
}

// Kronika: zavřená je jeden řádek s nejnovější událostí, po rozkliknutí všechny po měsících
function htmlKroniky() {
    const skupiny = kronikaPoMesicich(data.kronika);
    const nejnovejsi = data.kronika[0];
    const t = nejnovejsi && textUdalosti(nejnovejsi, jmeno);
    const pocet = `${data.kronika.length} ${data.kronika.length === 1 ? 'událost' : data.kronika.length < 5 ? 'události' : 'událostí'} od ${datumKroniky(data.od)}`;
    return `<details class="ob-karta slava-kronika-obal">
        <summary title="${esc(`Kronika Top 10: ${pocet}. Klik ukáže všechny.`)}"><span class="slava-kronika-nadpis">Kronika</span>
            ${t ? `<span class="slava-ikona ${esc(nejnovejsi.druh)}" aria-hidden="true">${t.ikona}</span><span class="slava-kronika-posledni">${esc(t.text)}</span><small>${esc(datumKroniky(nejnovejsi.cas))}</small>` : ''}
            <small class="slava-kronika-pocet">${esc(pocet)}</small></summary>
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

// Legendy vyplní řady rovnoměrně: nejvýš 7 v řadě, řad co nejméně a v každé skoro stejně karet (8 → 4 + 4,
// 10 → 5 + 5), aby vpravo nezůstávalo prázdno
const sloupcuLegend = n => Math.ceil(n / Math.ceil(n / 7));

function vykreslit() {
    if (!kontejner || !data) return;
    if (!data.od) {
        nastavitHtml(kontejner, htmlPrazdna('Síň slávy se teprve plní', 'Kronika začne při příštím přepočtu oblíbenosti. Od té chvíle si program pamatuje, kdo je v Top 10, kdo vypadl, obhájil místo nebo byl jedničkou.', { ikona: 'hvezda' }));
        return;
    }
    const rekordy = trofeje();
    const odznaky = odznakyModelek();
    // Stupně vítězů: první tři větší na podstavcích (2. vlevo, 1. uprostřed, 3. vpravo), od 4. místa běžná mřížka
    const stupne = data.vitrina.filter(x => x.misto >= 1 && x.misto <= 3);
    const poradiStupnu = [2, 1, 3].map(misto => stupne.find(x => x.misto === misto)).filter(Boolean);
    const htmlStupnu = poradiStupnu.length ? `<div class="slava-stupne">${poradiStupnu.map(x =>
        `<div class="slava-stupen misto-${x.misto}">${htmlKarty(x, rekordy.get(x.modelkaId), false, odznaky.get(x.modelkaId))}<div class="slava-podstavec" aria-hidden="true">${x.misto}</div></div>`).join('')}</div>` : '';
    // Místa 4–10 v jedné řadě přes celou šířku (karty se poměrně zmenší, vpravo nezůstane prázdno)
    const zbytek = data.vitrina.filter(x => !stupne.includes(x));
    const ostatni = zbytek.map(x => htmlKarty(x, rekordy.get(x.modelkaId), false, odznaky.get(x.modelkaId))).join('');
    const top = htmlStupnu + (ostatni ? `<div class="slava-karty slava-rada ${zbytek.length >= 6 ? 'husta' : ''}" style="--karet: ${zbytek.length}">${ostatni}</div>` : '');
    const legendy = data.legendy.map(x => htmlKarty(x, rekordy.get(x.modelkaId), true, odznaky.get(x.modelkaId))).join('');
    nastavitHtml(kontejner, `<div class="slava">
        <h4 class="slava-nadpis">Top 10 <small>${top ? 'jak dlouho v ní kdo je · 🛡 obhajoby · 🏆 rekordy · odznaky pod jménem' : ''}</small></h4>
        ${top || `<p class="slava-nic">Zatím žádná potvrzená v Top 10. Do Top 10 se dostane modelka po 10 porovnáních s výhrou nad některou z Top 20. <button type="button" class="link" data-ob-porovnavat>Porovnávat →</button></p>`}
        <h4 class="slava-nadpis">Legendy <small>bývalé Top 10</small></h4>
        ${legendy ? `<div class="slava-karty slava-rada ${sloupcuLegend(data.legendy.length) >= 6 ? 'husta' : ''}" style="--karet: ${sloupcuLegend(data.legendy.length)}">${legendy}</div>` : '<p class="slava-nic">Zatím nikdo z Top 10 nevypadl.</p>'}
        ${htmlOddiluOdznaku()}
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
