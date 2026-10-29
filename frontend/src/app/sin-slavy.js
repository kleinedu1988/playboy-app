// Síň slávy (Oblíbenost › Síň slávy): pět pohledů přepínaných pilulkami nahoře, každý s vlastním uspořádáním,
// nic se nehromadí pod sebou. Top 10 (stupně vítězů, výchozí), Legendy (bývalé Top 10), Odznaky (sbírka všech
// typů i nezískaných, s držitelkami a postupem), Rekordy (trofejová police) a Kronika (časová osa s filtrem).
// Data z backendu (GetSinSlavy, oblibenost_slava.go); zvolený pohled si pamatuje localStorage (slavaPohled).
// Profil otevírá prehled.js (data-otevrit-modelku), srdíčka galerie.js, přechod do Porovnávání oblibenost.js
// (data-ob-porovnavat).
import { GetSinSlavy } from './backend';
import { esc, sklonovat } from '../lib/format';
import { ODZNAKY, PORADI_ODZNAKU, PORADI_REKORDU, STUPNE, ZNAKY_REKORDU, casKroniky, datumKroniky, htmlBublinyOdznaku, htmlBublinyRekordu, kronikaPoMesicich, popisOdznaku, textDni, textRekordu, textUdalosti } from '../lib/slava';
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
const TRIDY_STUPNU = ['jednorazovy', 'bronz', 'stribro', 'zlato'];

// Pohledy síně slávy: klíč, název, ikona v pilulce
const POHLEDY = [['top', 'Top 10', '♛'], ['legendy', 'Legendy', '★'], ['odznaky', 'Odznaky', '🏅'], ['rekordy', 'Rekordy', '🏆'], ['kronika', 'Kronika', '📜']];
const jePohled = klic => POHLEDY.some(([k]) => k === klic);
let pohled = (() => {
    try {
        const ulozeny = localStorage.getItem('slavaPohled');
        return jePohled(ulozeny) ? ulozeny : 'top';
    } catch {
        return 'top';
    }
})();

// Pohled, který síň slávy ukáže (i z profilu: řada odznaků otevře Odznaky)
export function nastavitPohledSlavy(klic) {
    if (!jePohled(klic)) return;
    pohled = klic;
    try { localStorage.setItem('slavaPohled', klic); } catch { /* jen pro toto spuštění */ }
}

// Filtr kroniky: klíč, název, které události ukáže
const FILTRY_KRONIKY = [
    ['vse', 'Vše', () => true],
    ['top', 'Vstupy a pády', u => ['vstup', 'vystup', 'pocatek', 'zacatek'].includes(u.druh)],
    ['jednicky', 'Jedničky', u => ['jednicka', 'konec'].includes(u.druh)],
    ['obhajoby', 'Obhajoby', u => u.druh === 'obhajoba'],
    ['odznaky', 'Odznaky', u => u.druh === 'odznak'],
];
let filtrKroniky = 'vse';

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

// Odznaky pro bublinu: klíč (modelka:odznak, nebo jen odznak u dlaždice) → odznak
const odznakyBublin = new Map();
const klicBubliny = o => {
    const klic = `${o.modelkaId || 0}:${o.odznak}`;
    odznakyBublin.set(klic, o);
    return klic;
};

// Rekord do téže bubliny (klíč rekord:druh)
const rekordyBublin = new Map();
function klicBublinyRekordu(r) {
    const klic = `rekord:${r.druh}`;
    rekordyBublin.set(klic, r);
    return klic;
}

// Medailon odznaku: ikona v kroužku, barva kroužku podle stupně (jednorázový fialový)
export function htmlMedailonu(o, velky = false) {
    const p = popisOdznaku(o, jmeno);
    if (!p) return '';
    // Nezískaný (jen postup k bronzu): přerušovaný kroužek
    const stupen = !o.ziskan ? 'cil' : TRIDY_STUPNU[o.stupen] || 'jednorazovy';
    return `<span class="odznak ${stupen}${velky ? ' velky' : ''}" data-odznak-bublina="${esc(klicBubliny(o))}" title="" aria-label="${esc(p.text)}">${p.ikona}</span>`;
}

// Řada medailonů (karta, profil); nejvýš max, zbytek „+2“
export function htmlRadyOdznaku(seznam, max = 6) {
    if (!seznam?.length) return '';
    const navic = seznam.length - max;
    return `<span class="odznaky-rada">${seznam.slice(0, max).map(o => htmlMedailonu(o)).join('')}${navic > 0 ? `<span class="odznak navic" title="${esc(seznam.slice(max).map(o => popisOdznaku(o, jmeno)?.text).join('\n'))}">+${navic}</span>` : ''}</span>`;
}

// Kulatá fotka modelky (sbírka odznaků, police rekordů, kronika) s výřezem titulní fotky
function htmlAvataru(id) {
    const m = modelka(id);
    if (!m) return '<span class="slava-avatar"></span>';
    return `<span class="slava-avatar"><img data-src="${esc(adresaTitulni(m))}" alt="" style="${stylVyrezu(m)}" draggable="false" decoding="async" /></span>`;
}

// Trofeje rekordů podle modelky: id → [{ nazev, hodnota, popis }]
function trofeje() {
    const podleModelky = new Map();
    data.rekordy.forEach(r => {
        if (!podleModelky.has(r.modelkaId)) podleModelky.set(r.modelkaId, []);
        podleModelky.get(r.modelkaId).push({ ...textRekordu(r), klic: klicBublinyRekordu(r) });
    });
    return podleModelky;
}

// Karta modelky jako v galerii: titulní fotka s výřezem, srdíčka, vpravo nahoře místo (legendy nejlepší místo),
// trofeje rekordů nad jménem a pod jménem řádek síně slávy
function htmlKarty(x, rekordy, legenda, odznaky) {
    const m = modelka(x.modelkaId);
    if (!m) return '';
    // Krátce (pohled říká, že jde o Top 10); podrobnosti v bublině
    const popis = legenda
        ? [`${textDni(x.dniCelkem, x.odZacatku)} v Top 10`, x.obhajob ? `${x.obhajob}× 🛡` : '']
        : [textDni(x.dniTed, x.odZacatku), x.obhajob ? `${x.obhajob}× 🛡` : '', x.pobytu > 1 ? `${x.pobytu}. pobyt` : ''];
    const bublina = legenda
        ? `${m.jmeno}: v Top 10 ${datumKroniky(x.od)} – ${datumKroniky(x.do)}, celkem ${textDni(x.dniCelkem, x.odZacatku)}, nejlépe ${x.nejlepsiMisto}. místo${x.dniNaPrvnim ? `, na 1. místě ${textDni(x.dniNaPrvnim)}` : ''}`
        : `${m.jmeno}: ${x.misto}. místo, v Top 10 od ${datumKroniky(x.od)}${x.odZacatku ? ' (už před začátkem kroniky)' : ''}${x.pobytu > 1 ? `, celkem ${textDni(x.dniCelkem)}` : ''}${x.dniNaPrvnim ? `, na 1. místě ${textDni(x.dniNaPrvnim, x.odZacatku)}` : ''}, nejlépe ${x.nejlepsiMisto}. místo`;
    const misto = legenda ? `<span class="slava-misto legenda" title="Nejlepší místo">${x.nejlepsiMisto === 1 ? '♛ ' : 'nejlépe '}${x.nejlepsiMisto}.</span>`
        : `<span class="slava-misto ${x.misto === 1 ? 'prvni' : ''}" title="${x.misto}. místo v Top 10">${x.misto === 1 ? '♛ ' : ''}${x.misto}.</span>`;
    return `
        <div class="card slava-karta ${legenda ? 'legenda' : ''}" data-otevrit-modelku="${m.id}" tabindex="0" aria-label="${esc(m.jmeno)}" title="${esc(bublina)}">
            <div class="card-image-wrap">
                <img data-src="${esc(adresaTitulni(m))}" alt="" style="${stylVyrezu(m)}" draggable="false" decoding="async" />
                ${htmlSrdicka(m, false)}
                ${misto}
                ${rekordy?.length ? `<span class="slava-trofeje">${rekordy.map(r => `<span class="slava-trofej" data-odznak-bublina="${esc(r.klic)}" title="" aria-label="${esc(`${r.nazev}: ${r.hodnota} ${r.popis}`)}">🏆 ${esc(r.nazev)}</span>`).join('')}</span>` : ''}
            </div>
            <div class="card-info">
                <h3>${esc(m.jmeno)}${legenda ? '' : htmlTrendu(m)}</h3>
                <p class="slava-popis">${esc(popis.filter(Boolean).join(' · '))}</p>
                ${legenda ? `<p class="slava-obdobi">${esc(`${datumKroniky(x.od)} – ${datumKroniky(x.do)}`)}</p>` : ''}
                ${htmlRadyOdznaku(odznaky, 5)}
            </div>
        </div>`;
}

// Pilulky pohledů a vpravo poslední událost kroniky (klik otevře Kroniku)
function htmlPrepinace(pocty) {
    const pilulky = POHLEDY.map(([klic, nazev, ikona]) => `<button type="button" role="tab" class="slava-pohled ${klic === pohled ? 'active' : ''}" data-slava-pohled="${klic}" aria-selected="${klic === pohled}" tabindex="${klic === pohled ? 0 : -1}">
        <span class="slava-pohled-ikona" aria-hidden="true">${ikona}</span>${nazev}${pocty[klic] ? `<small>${pocty[klic]}</small>` : ''}</button>`).join('');
    const posledni = data.kronika[0];
    const t = posledni && textUdalosti(posledni, jmeno);
    const vpravo = pohled !== 'kronika' && t
        ? `<button type="button" class="slava-novinka" data-slava-pohled="kronika" title="Naposledy v kronice – klik otevře celou kroniku"><span class="slava-ikona ${esc(posledni.druh)}" aria-hidden="true">${t.ikona}</span><span>${esc(t.text)}</span><small>${esc(datumKroniky(posledni.cas))}</small></button>`
        : `<span class="slava-meta">Kronika vede od ${esc(datumKroniky(data.od))}</span>`;
    return `<div class="slava-lista"><nav class="slava-pohledy" role="tablist" aria-label="Pohledy síně slávy">${pilulky}</nav>${vpravo}</div>`;
}

// Pohled Top 10: stupně vítězů (2. vlevo, 1. uprostřed, 3. vpravo) a místa 4–10 v řadě přes celou šířku
function htmlTop(rekordy, odznaky) {
    const stupne = data.vitrina.filter(x => x.misto >= 1 && x.misto <= 3);
    const poradiStupnu = [2, 1, 3].map(misto => stupne.find(x => x.misto === misto)).filter(Boolean);
    const htmlStupnu = poradiStupnu.length ? `<div class="slava-stupne">${poradiStupnu.map(x =>
        `<div class="slava-stupen misto-${x.misto}">${htmlKarty(x, rekordy.get(x.modelkaId), false, odznaky.get(x.modelkaId))}<div class="slava-podstavec" aria-hidden="true">${x.misto}</div></div>`).join('')}</div>` : '';
    const zbytek = data.vitrina.filter(x => !stupne.includes(x));
    const ostatni = zbytek.map(x => htmlKarty(x, rekordy.get(x.modelkaId), false, odznaky.get(x.modelkaId))).join('');
    const top = htmlStupnu + (ostatni ? `<div class="slava-karty slava-rada ${zbytek.length >= 6 ? 'husta' : ''}" style="--karet: ${zbytek.length}">${ostatni}</div>` : '');
    if (!top) return `<p class="slava-nic">Zatím žádná potvrzená v Top 10. Do Top 10 se dostane modelka po 10 porovnáních s výhrou nad některou z Top 20. <button type="button" class="link" data-ob-porovnavat>Porovnávat →</button></p>`;
    return `<p class="slava-uvod">Jak dlouho v ní kdo je · 🛡 obhajoby · 🏆 rekordy · odznaky pod jménem</p>${top}`;
}

// Pohled Legendy: bývalé Top 10 jako portréty na stěně, pod jménem kdy v ní byly
function htmlLegend(rekordy, odznaky) {
    if (!data.legendy.length) return '<p class="slava-nic">Zatím nikdo z Top 10 nevypadl.</p>';
    const dni = data.legendy.reduce((s, x) => s + (x.dniCelkem || 0), 0);
    return `<p class="slava-uvod">${esc(sklonovat(data.legendy.length, 'bývalá členka', 'bývalé členky', 'bývalých členek'))} Top 10 · dohromady ${esc(textDni(dni))} v ní · vpravo nahoře nejlepší místo</p>
        <div class="slava-legendy">${data.legendy.map(x => htmlKarty(x, rekordy.get(x.modelkaId), true, odznaky.get(x.modelkaId))).join('')}</div>`;
}

// Pohled Odznaky: sbírka všech typů jako medaile ve hře. Získaný odznak svítí barvou nejvyššího stupně, který
// kdo má, nezískaný je zašedlý se zámkem; u stupňových žebříček prahů s počtem držitelek, pod ním fotky držitelek
// a kdo má nejblíž k dalšímu stupni
function htmlOdznaku() {
    const vse = data.odznaky || [];
    const ziskane = vse.filter(o => o.ziskan);
    const vSini = PORADI_ODZNAKU.filter(k => ziskane.some(o => o.odznak === k)).length;
    const pocet = s => ziskane.filter(o => o.stupen === s).length;
    // Modelky, kterým k dalšímu stupni některého odznaku zbývá nejvýš čtvrtina cesty
    const naDosah = new Set(vse.filter(o => o.dalsi > 0 && (popisOdznaku(o)?.postup ?? 0) >= 0.75).map(o => o.modelkaId)).size;
    const souhrn = `<div class="sbirka-souhrn">
        <div class="sbirka-postup"><b>${vSini}</b><span>z ${PORADI_ODZNAKU.length} odznaků<br/>už někdo má</span>
            <span class="odznak-pruh"><i style="width:${Math.round(vSini / PORADI_ODZNAKU.length * 100)}%"></i></span></div>
        <ul class="sbirka-pocty">${[[3, 'zlato', 'zlaté'], [2, 'stribro', 'stříbrné'], [1, 'bronz', 'bronzové'], [0, 'jednorazovy', 'jednorázové']].map(([s, trida, nazev]) =>
            `<li><span class="odznak velky ${trida}${pocet(s) ? '' : ' zadny'}">${pocet(s)}</span>${nazev}</li>`).join('')}</ul>
        <p class="sbirka-dosah-pocet">${naDosah ? `<b>${naDosah}</b> ${naDosah === 1 ? 'modelka má' : naDosah < 5 ? 'modelky mají' : 'modelek má'} další stupeň na dosah` : 'Nikdo nemá další stupeň na dosah'}<small>Najetí myší na odznak nebo fotku ukáže podrobnosti</small></p>
    </div>`;
    const karta = klic => {
        const d = ODZNAKY[klic];
        const maji = ziskane.filter(o => o.odznak === klic).sort((a, b) => b.stupen - a.stupen || String(b.cas).localeCompare(String(a.cas)));
        const trida = !maji.length ? 'zamceno' : TRIDY_STUPNU[d.prahy ? maji[0].stupen : 0];
        const medaile = `<span class="sbirka-medaile"><span class="odznak obri ${maji.length ? trida : 'zadny'}" data-odznak-bublina="${esc(klicBubliny({ modelkaId: 0, odznak: klic }))}" title="" aria-label="${esc(`${d.nazev}: ${d.popis}`)}">${d.ikona}</span>${maji.length ? '' : '<span class="sbirka-zamek" aria-hidden="true">🔒</span>'}</span>`;
        // Stupňový: tři schody s prahem a počtem držitelek; jednorázový jen štítek
        const stupne = d.prahy
            ? `<ol class="sbirka-stupne">${d.prahy.map((prah, i) => {
                const n = maji.filter(o => o.stupen === i + 1).length;
                return `<li class="${TRIDY_STUPNU[i + 1]}${n ? ' ma' : ''}" title="${esc(`${velkym(STUPNE[i + 1])}: ${d.jednotka(prah)} · ${n ? sklonovat(n, 'držitelka', 'držitelky', 'držitelek') : 'zatím nikdo'}`)}"><span>${prah}</span>${n ? `<b>${n}</b>` : ''}</li>`;
            }).join('')}</ol>`
            : '<p class="sbirka-druh">Jednorázový</p>';
        const drzitelky = maji.length
            ? `<div class="sbirka-drzitelky">${maji.slice(0, 6).map(o => `<button type="button" class="sbirka-drzitelka ${TRIDY_STUPNU[o.stupen] || 'jednorazovy'}" data-otevrit-modelku="${o.modelkaId}" data-odznak-bublina="${esc(klicBubliny(o))}" title="" aria-label="${esc(jmeno(o.modelkaId))}">${htmlAvataru(o.modelkaId)}</button>`).join('')}${maji.length > 6 ? `<span class="sbirka-navic" title="${esc(maji.slice(6).map(o => jmeno(o.modelkaId)).join('\n'))}">+${maji.length - 6}</span>` : ''}</div>`
            : '<p class="sbirka-nikdo">Zatím nikdo</p>';
        // Kdo má nejblíž k dalšímu stupni; u jednorázového kdo ho získala naposledy
        const kandidat = vse.filter(o => o.odznak === klic && o.dalsi > 0).sort((a, b) => (popisOdznaku(b)?.postup ?? 0) - (popisOdznaku(a)?.postup ?? 0))[0];
        const naposledy = !d.prahy && maji.length ? [...maji].sort((a, b) => String(b.cas).localeCompare(String(a.cas)))[0] : null;
        let pata = '';
        if (kandidat) {
            const p = popisOdznaku(kandidat, jmeno);
            pata = `<div class="sbirka-dosah" data-odznak-bublina="${esc(klicBubliny(kandidat))}"><span class="sbirka-dosah-hlava"><small>Na dosah</small><b>${esc(jmeno(kandidat.modelkaId))}</b></span><span class="odznak-pruh"><i style="width:${Math.round((p.postup || 0) * 100)}%"></i></span><small>${esc(p.zbyva)}</small></div>`;
        } else if (naposledy) {
            pata = `<div class="sbirka-dosah"><span class="sbirka-dosah-hlava"><small>Naposledy</small><b>${esc(jmeno(naposledy.modelkaId))}</b></span><small>${esc(datumKroniky(naposledy.cas))}</small></div>`;
        } else if (d.prahy && maji.some(o => o.stupen === 3)) {
            pata = '<div class="sbirka-dosah"><small>Zlato získané – víc už nejde</small></div>';
        }
        return `<article class="sbirka-odznak ${trida}">
            ${medaile}
            <b class="sbirka-nazev">${esc(d.nazev)}</b>
            <small class="sbirka-popis">${esc(d.popis)}</small>
            ${stupne}
            ${drzitelky}
            ${pata}
        </article>`;
    };
    const stupnove = PORADI_ODZNAKU.filter(k => ODZNAKY[k].prahy);
    const jednorazove = PORADI_ODZNAKU.filter(k => !ODZNAKY[k].prahy);
    return `${souhrn}
        <h4 class="slava-nadpis">Stupňové <small>bronz → stříbro → zlato; čísla jsou prahy, v kroužku kolik modelek stupeň má</small></h4>
        <div class="sbirka">${stupnove.map(karta).join('')}</div>
        <h4 class="slava-nadpis">Jednorázové <small>příběhy, které se stanou jednou</small></h4>
        <div class="sbirka">${jednorazove.map(karta).join('')}</div>`;
}
const velkym = s => s.charAt(0).toUpperCase() + s.slice(1);

// Pohled Rekordy: trofejová police, na každé polici čtyři poháry; rekord, který nikdo nedrží, je prázdný podstavec
function htmlRekordu() {
    const trofej = druh => {
        const r = data.rekordy.find(x => x.druh === druh);
        const t = textRekordu(r || { druh });
        const pohar = `<span class="trofej-pohar" aria-hidden="true">🏆<span class="trofej-znak">${ZNAKY_REKORDU[druh] || ''}</span></span>`;
        if (!r) return `<div class="trofej prazdna">${pohar}<div class="trofej-stitek"><b>${esc(t.nazev)}</b><strong>—</strong><small>zatím nikdo</small></div></div>`;
        return `<div class="trofej${r.trva ? ' trva' : ''}" data-odznak-bublina="${esc(klicBublinyRekordu(r))}" tabindex="0" title="" aria-label="${esc(`${t.nazev}: ${jmeno(r.modelkaId)}, ${t.hodnota} ${t.popis}`)}">
            ${r.trva ? '<span class="trofej-trva" title="Rekord pořád roste">▲ roste</span>' : ''}
            ${pohar}
            <div class="trofej-stitek"><b>${esc(t.nazev)}</b><strong>${esc(t.hodnota)}</strong><small>${esc(t.popis)}</small></div>
            <button type="button" class="trofej-drzitelka" data-otevrit-modelku="${r.modelkaId}">${htmlAvataru(r.modelkaId)}<span>${esc(jmeno(r.modelkaId) || 'Modelka')}</span></button>
        </div>`;
    };
    const druhy = PORADI_REKORDU;
    const police = [];
    for (let i = 0; i < druhy.length; i += 4) police.push(`<div class="trofeje-police">${druhy.slice(i, i + 4).map(trofej).join('')}</div>`);
    // Rekordmanky: kdo drží kolik rekordů
    const podleModelky = new Map();
    data.rekordy.forEach(r => podleModelky.set(r.modelkaId, (podleModelky.get(r.modelkaId) || 0) + 1));
    const rekordmanky = [...podleModelky].sort((a, b) => b[1] - a[1]).map(([id, n]) =>
        `<button type="button" class="rekordmanka" data-otevrit-modelku="${id}">${htmlAvataru(id)}<span>${esc(jmeno(id))}</span><b>${'🏆'.repeat(n)}</b></button>`).join('');
    return `<p class="slava-uvod">${esc(sklonovat(data.rekordy.length, 'rekord', 'rekordy', 'rekordů'))} z ${druhy.length} · ▲ rekord pořád roste · najetí myší na pohár ukáže, co měří</p>
        <div class="trofeje">${police.join('')}</div>
        ${rekordmanky ? `<h4 class="slava-nadpis">Rekordmanky <small>kdo drží kolik rekordů</small></h4><div class="rekordmanky">${rekordmanky}</div>` : ''}`;
}

// Kdo byl v Top 10 už na začátku kroniky, je jedna událost (jinak deset stejných vět za sebou)
const bezOpakovanychPocatku = seznam => seznam.filter((u, i) => !(u.druh === 'pocatek' && seznam[i - 1]?.druh === 'pocatek'));

// Pohled Kronika: svislá časová osa po měsících, u každé události uzel s ikonou a fotka modelky; nahoře filtr
function htmlKroniky() {
    const filtr = FILTRY_KRONIKY.find(([k]) => k === filtrKroniky) || FILTRY_KRONIKY[0];
    const filtry = `<div class="kronika-filtry" role="group" aria-label="Filtr kroniky">${FILTRY_KRONIKY.map(([k, nazev, f]) => {
        const n = bezOpakovanychPocatku(data.kronika.filter(f)).length;
        return n || k === 'vse' ? `<button type="button" class="chip ${k === filtr[0] ? 'active' : ''}" data-kronika-filtr="${k}">${nazev} <small>${n}</small></button>` : '';
    }).join('')}</div>`;
    // Od nejnovější (stabilně: počátek kroniky zůstane pohromadě)
    const skupiny = kronikaPoMesicich(data.kronika.filter(filtr[2]).sort((a, b) => String(b.cas).localeCompare(String(a.cas))));
    const den = cas => {
        const d = casKroniky(cas);
        return d ? `${d.getDate()}. ${d.getMonth() + 1}.` : '';
    };
    const osa = skupiny.map(sk => `<li class="kronika-mesic"><span>${esc(sk.mesic)}</span></li>${sk.udalosti.map((u, i, vse) => {
        if (u.druh === 'pocatek' && vse[i - 1]?.druh === 'pocatek') return '';
        // Datum jen u prvního záznamu dne
        const datum = den(u.cas) !== den(vse[i - 1]?.cas) ? den(u.cas) : '';
        const cas = `<time datetime="${esc(String(u.cas).slice(0, 10))}">${esc(datum)}</time>`;
        if (u.druh === 'pocatek') {
            let konec = i;
            while (vse[konec]?.druh === 'pocatek') konec++;
            const kdo = vse.slice(i, konec).sort((a, b) => a.misto - b.misto);
            return `<li class="kronika-udalost druh-pocatek">${cas}<span class="kronika-uzel" aria-hidden="true">★</span><div class="kronika-obsah">
                <p>Na začátku kroniky byly v Top 10</p>
                <div class="kronika-pocatek">${kdo.map(x => `<button type="button" data-otevrit-modelku="${x.modelkaId}" title="${esc(`${x.misto}. ${jmeno(x.modelkaId)}`)}">${htmlAvataru(x.modelkaId)}<small>${x.misto}.</small>${esc(jmeno(x.modelkaId))}</button>`).join('')}</div>
            </div></li>`;
        }
        const t = textUdalosti(u, jmeno);
        const stupen = u.druh === 'odznak' ? ` ${TRIDY_STUPNU[u.stupen] || 'jednorazovy'}` : '';
        const foto = u.modelkaId && modelka(u.modelkaId) ? `<button type="button" class="kronika-foto" data-otevrit-modelku="${u.modelkaId}" aria-label="${esc(jmeno(u.modelkaId))}">${htmlAvataru(u.modelkaId)}</button>` : '';
        return `<li class="kronika-udalost druh-${esc(u.druh)}">${cas}<span class="kronika-uzel${stupen}" aria-hidden="true">${t.ikona}</span><div class="kronika-obsah">${foto}<p>${esc(t.text)}</p></div></li>`;
    }).join('')}`).join('');
    return `${filtry}<ol class="kronika-osa">${osa || '<li class="slava-nic">Žádné události tohoto druhu.</li>'}</ol>`;
}

function vykreslit() {
    if (!kontejner || !data) return;
    if (!data.od) {
        nastavitHtml(kontejner, htmlPrazdna('Síň slávy se teprve plní', 'Kronika začne při příštím přepočtu oblíbenosti. Od té chvíle si program pamatuje, kdo je v Top 10, kdo vypadl, obhájil místo nebo byl jedničkou.', { ikona: 'hvezda' }));
        return;
    }
    const rekordy = trofeje();
    const odznaky = odznakyModelek();
    const pocty = {
        top: 0,
        legendy: data.legendy.length,
        odznaky: (data.odznaky || []).filter(o => o.ziskan).length,
        rekordy: data.rekordy.length,
        kronika: bezOpakovanychPocatku(data.kronika).length,
    };
    const obsah = pohled === 'legendy' ? htmlLegend(rekordy, odznaky)
        : pohled === 'odznaky' ? htmlOdznaku()
            : pohled === 'rekordy' ? htmlRekordu()
                : pohled === 'kronika' ? htmlKroniky()
                    : htmlTop(rekordy, odznaky);
    nastavitHtml(kontejner, `<div class="slava" data-slava-zobrazeno="${pohled}">
        ${htmlPrepinace(pocty)}
        <section class="slava-obsah" role="tabpanel" aria-label="${esc(POHLEDY.find(([k]) => k === pohled)?.[1] || '')}">${obsah}</section>
    </div>`);
    nacitatPostupne(kontejner);
}

// Přepnutí pohledu: překreslí síň, stránku vrátí nahoru a zaměří zvolenou pilulku (když byla zaměřená)
function prepnoutPohled(klic, zamerit = false) {
    if (!jePohled(klic) || !kontejner) return;
    nastavitPohledSlavy(klic);
    vykreslit();
    const main = document.querySelector('main');
    if (main && kontejner.getBoundingClientRect().top < 0) main.scrollTop = 0;
    if (zamerit) /** @type {HTMLElement | null} */ (kontejner.querySelector(`[role="tab"][data-slava-pohled="${klic}"]`))?.focus();
}

// Bublina odznaku: jedna pro celou stránku, ukáže se nad odznakem pod myší (i v profilu) nebo při zaměření
let bublina = null;
function ukazatBublinu(prvek) {
    const klic = prvek.dataset.odznakBublina || '';
    const o = odznakyBublin.get(klic);
    const rekord = rekordyBublin.get(klic);
    if (!o && !rekord) return;
    if (!bublina) {
        bublina = document.createElement('div');
        bublina.className = 'odznak-bublina';
        bublina.setAttribute('role', 'tooltip');
        document.body.append(bublina);
    }
    bublina.innerHTML = o ? htmlBublinyOdznaku(o, jmeno) : htmlBublinyRekordu(rekord, jmeno);
    bublina.classList.add('viditelna');
    // Nad odznakem, když se nevejde, pod ním; vodorovně uvnitř okna
    const r = prvek.getBoundingClientRect();
    const b = bublina.getBoundingClientRect();
    const nahore = r.top - b.height - 10 >= 8;
    bublina.style.top = `${nahore ? r.top - b.height - 10 : r.bottom + 10}px`;
    bublina.style.left = `${Math.max(8, Math.min(window.innerWidth - b.width - 8, r.left + r.width / 2 - b.width / 2))}px`;
}
const skrytBublinu = () => bublina?.classList.remove('viditelna');

export function pripravitSinSlavy() {
    document.addEventListener('mouseover', (e) => {
        const prvek = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-odznak-bublina]'));
        if (prvek) ukazatBublinu(prvek);
        else skrytBublinu();
    });
    document.addEventListener('focusin', (e) => {
        const prvek = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-odznak-bublina]'));
        if (prvek) ukazatBublinu(prvek);
        else skrytBublinu();
    });
    document.addEventListener('scroll', skrytBublinu, true);
    // Pilulky pohledů, odkaz na kroniku a filtr kroniky
    document.addEventListener('click', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        if (!kontejner?.contains(cil)) return;
        const naPohled = /** @type {HTMLElement | null} */ (cil.closest('[data-slava-pohled]'));
        if (naPohled) {
            prepnoutPohled(naPohled.dataset.slavaPohled, naPohled.getAttribute('role') === 'tab');
            return;
        }
        const filtr = /** @type {HTMLElement | null} */ (cil.closest('[data-kronika-filtr]'));
        if (filtr) {
            filtrKroniky = filtr.dataset.kronikaFiltr || 'vse';
            vykreslit();
        }
    });
    document.addEventListener('keydown', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        // Šipky mezi pilulkami pohledů (jako záložky), Home/End na první a poslední
        const pilulka = /** @type {HTMLElement | null} */ (cil?.closest?.('[role="tab"][data-slava-pohled]'));
        if (pilulka && kontejner?.contains(pilulka) && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
            const i = POHLEDY.findIndex(([k]) => k === pilulka.dataset.slavaPohled);
            const n = e.key === 'Home' ? 0 : e.key === 'End' ? POHLEDY.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + POHLEDY.length) % POHLEDY.length;
            e.preventDefault();
            prepnoutPohled(POHLEDY[n][0], true);
            return;
        }
        // Enter na kartě nebo trofeji otevře profil jako klik
        const karta = /** @type {HTMLElement | null} */ (cil?.closest?.('.slava-karta'));
        if (e.key === 'Enter' && karta && kontejner?.contains(karta)) karta.click();
        const trofej = /** @type {HTMLElement | null} */ (cil?.closest?.('.trofej'));
        if (e.key === 'Enter' && trofej === cil && kontejner?.contains(trofej)) /** @type {HTMLElement | null} */ (trofej.querySelector('[data-otevrit-modelku]'))?.click();
    });
}
