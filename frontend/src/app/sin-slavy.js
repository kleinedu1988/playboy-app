// Síň slávy (Oblíbenost › Síň slávy): kronika potvrzené top 10 z backendu (GetSinSlavy, oblibenost_slava.go) –
// vitrína současné top 10 s délkou pobytu, rekordy, kronika událostí po měsících a legendy (bývalé top 10).
// Profil otevírá prehled.js (data-otevrit-modelku), přechod do Porovnávání oblibenost.js (data-ob-porovnavat).
import { GetSinSlavy } from './backend';
import { esc } from '../lib/format';
import { datumKroniky, kronikaPoMesicich, textDni, textRekordu, textUdalosti } from '../lib/slava';
import { stav } from './stav';
import { adresaTitulni } from './obrazky';
import { stylVyrezu } from './navigace';
import { nastavitHtml } from '../ui/dom';
import { htmlPrazdna } from '../ui/prazdno';

const UDALOSTI_NAJEDNOU = 40;

let kontejner = null;
let data = null;
let kronikaVse = false;

const modelka = id => stav.prehledModelky.get(id);
const jmeno = id => modelka(id)?.jmeno || '';

// Varianta rozvržení (dočasně pro výběr; výchozí A)
const varianta = () => { try { return localStorage.getItem('slavaVarianta') || 'a'; } catch { return 'a'; } };

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

// ——— Kousky ———

const foto = (m, velka = false) => m ? `<img src="${esc(adresaTitulni(m, velka))}" alt="" loading="lazy" draggable="false" style="${stylVyrezu(m)}" />` : '<span class="slava-bez-fotky"></span>';

const prazdnaVitrina = () => `<div class="slava-prazdna-vitrina">
    <p>Zatím žádná potvrzená v Top 10. Do Top 10 se dostane modelka po 10 porovnáních s výhrou nad některou z Top 20.</p>
    <button type="button" class="link" data-ob-porovnavat>Porovnávat →</button></div>`;

function htmlRekordy(tridy = 'slava-rekordy') {
    if (!data.rekordy.length) return '';
    return `<div class="${tridy}">${data.rekordy.map(r => {
        const t = textRekordu(r);
        const m = modelka(r.modelkaId);
        return `<button type="button" class="slava-rekord" data-otevrit-modelku="${r.modelkaId}" title="${esc(`${t.nazev}: ${m?.jmeno || ''}, ${t.hodnota} ${t.popis}`)}">
            ${foto(m)}
            <span class="slava-rekord-text"><small>${esc(t.nazev)}</small><b>${esc(t.hodnota)}</b><span>${esc(m?.jmeno || '')}</span><small>${esc(t.popis)}</small></span>
        </button>`;
    }).join('')}</div>`;
}

// Modelky, které v top 10 byly už na začátku kroniky, jsou v jednom řádku (jinak deset stejných vět za sebou)
function htmlPocatku(udalosti) {
    const serazene = [...udalosti].sort((x, y) => x.misto - y.misto);
    return `<li class="slava-udalost pocatek">
        <span class="slava-ikona" aria-hidden="true">★</span>
        <span class="slava-udalost-text">Na začátku kroniky byly v Top 10:
            <span class="slava-pocatek">${serazene.map(u => `<button type="button" class="slava-mini" data-otevrit-modelku="${u.modelkaId}" title="${esc(`${u.misto}. ${jmeno(u.modelkaId)}`)}">${foto(modelka(u.modelkaId))}</button>`).join('')}</span>
            <small>${esc(datumKroniky(udalosti[0].cas))}</small></span>
    </li>`;
}

function htmlKroniky() {
    const ukazat = kronikaVse ? data.kronika : data.kronika.slice(0, UDALOSTI_NAJEDNOU);
    return `<ol class="slava-kronika">${kronikaPoMesicich(ukazat).map(sk => `<li class="slava-mesic"><span>${esc(sk.mesic)}</span></li>${sk.udalosti.map((u, i, vse) => {
        if (u.druh === 'pocatek') {
            if (vse[i - 1]?.druh === 'pocatek') return '';
            let konec = i;
            while (vse[konec]?.druh === 'pocatek') konec++;
            return htmlPocatku(vse.slice(i, konec));
        }
        const t = textUdalosti(u, jmeno);
        const m = modelka(u.modelkaId);
        return `<li class="slava-udalost ${esc(u.druh)}">
            <span class="slava-ikona" aria-hidden="true">${t.ikona}</span>
            ${u.modelkaId ? `<button type="button" class="slava-mini" data-otevrit-modelku="${u.modelkaId}" title="Otevřít profil">${foto(m)}</button>` : '<span class="slava-mini"></span>'}
            <span class="slava-udalost-text">${esc(t.text)}<small>${esc(datumKroniky(u.cas))}</small></span>
        </li>`;
    }).join('')}`).join('')}</ol>
    ${ukazat.length < data.kronika.length ? `<button type="button" class="link ob-vse" data-slava-vse>Zobrazit celou kroniku (${data.kronika.length})</button>` : ''}`;
}

function htmlLegend() {
    if (!data.legendy.length) return '<p class="slava-nic">Zatím nikdo z Top 10 nevypadl.</p>';
    return `<ul class="slava-legendy">${data.legendy.map(x => {
        const m = modelka(x.modelkaId);
        return `<li><button type="button" data-otevrit-modelku="${x.modelkaId}">${foto(m)}
            <span><b>${esc(m?.jmeno || '')}</b><small>${esc(`${datumKroniky(x.od)} – ${datumKroniky(x.do)} · ${textDni(x.dniCelkem, x.odZacatku)} v Top 10 · nejlépe ${x.nejlepsiMisto}.${x.obhajob ? ` · ${x.obhajob}× obhájila` : ''}`)}</small></span>
        </button></li>`;
    }).join('')}</ul>`;
}

const popisPobytu = x => [textDni(x.dniTed, x.odZacatku), x.pobytu > 1 ? `${x.pobytu}. pobyt` : '', x.obhajob ? `${x.obhajob}× obhájila` : ''].filter(Boolean).join(' · ');

// ——— Varianta A: vitrína karet, rekordy, kronika a legendy ve dvou sloupcích ———

function variantaA() {
    const karty = data.vitrina.map(x => {
        const m = modelka(x.modelkaId);
        return `<button type="button" class="slava-karta ${x.misto === 1 ? 'prvni' : ''}" data-otevrit-modelku="${x.modelkaId}">
            ${foto(m, true)}
            <span class="slava-misto">${x.misto}.</span>
            <span class="slava-karta-popis"><b>${esc(m?.jmeno || '')}</b><small>${esc(popisPobytu(x))}</small></span>
        </button>`;
    }).join('');
    return `<div class="ob-karta"><h4>Top 10 <small>${data.vitrina.length ? 'jak dlouho tu kdo je' : ''}</small></h4>
            ${data.vitrina.length ? `<div class="slava-vitrina">${karty}</div>` : prazdnaVitrina()}</div>
        ${data.rekordy.length ? `<div class="ob-karta"><h4>Rekordy</h4>${htmlRekordy()}</div>` : ''}
        <div class="ob-dva-sloupce">
            <div class="ob-karta"><h4>Kronika</h4>${htmlKroniky()}</div>
            <div class="ob-karta"><h4>Legendy <small>bývalé Top 10</small></h4>${htmlLegend()}</div>
        </div>`;
}

// ——— Varianta B: vlevo žebříček s délkou pobytu, vpravo kronika; rekordy jako pruh nahoře ———

function variantaB() {
    const nejvic = Math.max(1, ...data.vitrina.map(x => x.dniTed));
    const radky = data.vitrina.map(x => {
        const m = modelka(x.modelkaId);
        return `<li><button type="button" class="slava-radek" data-otevrit-modelku="${x.modelkaId}">
            <span class="ob-misto">${x.misto}.</span>${foto(m)}
            <span class="slava-radek-text"><b>${esc(m?.jmeno || '')}</b><small>${esc(popisPobytu(x))}</small>
                <span class="slava-delka" aria-hidden="true"><i style="width:${Math.max(4, Math.round(100 * x.dniTed / nejvic))}%"></i></span></span>
        </button></li>`;
    }).join('');
    return `${htmlRekordy('slava-rekordy slava-rekordy-pruh')}
        <div class="ob-dva-sloupce slava-b">
            <div class="ob-karta"><h4>Top 10 <small>délka současného pobytu</small></h4>
                ${data.vitrina.length ? `<ol class="slava-zebricek">${radky}</ol>` : prazdnaVitrina()}
                <h4 class="slava-podnadpis">Legendy <small>bývalé Top 10</small></h4>${htmlLegend()}</div>
            <div class="ob-karta"><h4>Kronika</h4>${htmlKroniky()}</div>
        </div>`;
}

// ——— Varianta C: jednička velká, 2.–10. menší, rekordy jako trofeje, legendy v galerii, kronika dole ———

function variantaC() {
    const [prvni, ...dalsi] = data.vitrina;
    const m1 = prvni && modelka(prvni.modelkaId);
    const hrdina = prvni ? `<button type="button" class="slava-hrdina" data-otevrit-modelku="${prvni.modelkaId}">
            ${foto(m1, true)}
            <span class="slava-hrdina-popis"><small>♛ Jednička</small><b>${esc(m1?.jmeno || '')}</b>
                <span>${esc([prvni.dniNaPrvnim ? `na 1. místě ${textDni(prvni.dniNaPrvnim, prvni.odZacatku)}` : '', `v Top 10 ${textDni(prvni.dniTed, prvni.odZacatku)}`, prvni.obhajob ? `${prvni.obhajob}× obhájila` : ''].filter(Boolean).join(' · '))}</span></span>
        </button>` : prazdnaVitrina();
    const mensi = dalsi.map(x => {
        const m = modelka(x.modelkaId);
        return `<button type="button" class="slava-karta mala" data-otevrit-modelku="${x.modelkaId}">${foto(m, true)}
            <span class="slava-misto">${x.misto}.</span><span class="slava-karta-popis"><b>${esc(m?.jmeno || '')}</b><small>${esc(textDni(x.dniTed, x.odZacatku))}</small></span></button>`;
    }).join('');
    const legendy = data.legendy.length ? `<div class="slava-galerie">${data.legendy.map(x => {
        const m = modelka(x.modelkaId);
        return `<button type="button" class="slava-portret" data-otevrit-modelku="${x.modelkaId}" title="${esc(`${datumKroniky(x.od)} – ${datumKroniky(x.do)}, nejlépe ${x.nejlepsiMisto}.`)}">${foto(m, true)}
            <span><b>${esc(m?.jmeno || '')}</b><small>${esc(`${textDni(x.dniCelkem, x.odZacatku)} · nejlépe ${x.nejlepsiMisto}.`)}</small></span></button>`;
    }).join('')}</div>` : '<p class="slava-nic">Zatím nikdo z Top 10 nevypadl.</p>';
    return `<div class="slava-c-hlava">${hrdina}${mensi ? `<div class="slava-mensi">${mensi}</div>` : ''}</div>
        ${data.rekordy.length ? `<div class="ob-karta"><h4>Trofeje</h4>${htmlRekordy('slava-rekordy slava-trofeje')}</div>` : ''}
        <div class="ob-karta"><h4>Legendy <small>bývalé Top 10</small></h4>${legendy}</div>
        <div class="ob-karta"><h4>Kronika</h4>${htmlKroniky()}</div>`;
}

function vykreslit() {
    if (!kontejner || !data) return;
    if (!data.od) {
        nastavitHtml(kontejner, htmlPrazdna('Síň slávy se teprve plní', 'Kronika začne při příštím přepočtu oblíbenosti. Od té chvíle si program pamatuje, kdo je v Top 10, kdo vypadl, obhájil místo nebo byl jedničkou.', { ikona: 'hvezda' }));
        return;
    }
    const zacatek = `<p class="ob-info">Kronika Top 10 od ${esc(datumKroniky(data.od))}. Dny se počítají od vstupu do potvrzené Top 10; „aspoň“ znamená, že tam modelka byla už před začátkem kroniky.</p>`;
    const v = varianta();
    nastavitHtml(kontejner, `<div class="slava slava-${v}">${zacatek}${v === 'b' ? variantaB() : v === 'c' ? variantaC() : variantaA()}</div>`);
}

export function pripravitSinSlavy() {
    document.addEventListener('click', (e) => {
        if (!kontejner?.contains(/** @type {Node} */ (e.target))) return;
        if (/** @type {HTMLElement} */ (e.target).closest('[data-slava-vse]')) {
            kronikaVse = true;
            vykreslit();
        }
    });
}
