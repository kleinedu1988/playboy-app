// Síň slávy (Oblíbenost › Síň slávy): pět pohledů přepínaných pilulkami nahoře, každý s vlastním uspořádáním,
// nic se nehromadí pod sebou. Top 10 (stupně vítězů, výchozí; klik na kartu rozbalí pod řadou vitrínu modelky
// s odznaky, rekordy a její kronikou, pod Top 10 řádek „Na dosah“), Legendy (bývalé Top 10), Odznaky (sbírka všech
// typů i nezískaných, s držitelkami a postupem), Rekordy (trofejová police) a Kronika (časová osa s filtrem).
// Data z backendu (GetSinSlavy, oblibenost_slava.go); zvolený pohled si pamatuje localStorage (slavaPohled).
// Profil otevírá prehled.js (data-otevrit-modelku), srdíčka galerie.js, přechod do Porovnávání oblibenost.js
// (data-ob-porovnavat).
import { GetSezona, GetSinSlavy } from './backend';
import { soubojOTrun } from './oblibenost';
import { vyhlasitSezonu } from './vyhlaseni-sezony';
import { zvolitSezonu } from './volba-sezony';
import { odemknoutTema } from './galerie-hodnoceni';
import { esc, sklonovat } from '../lib/format';
import { ODZNAKY, PORADI_ODZNAKU, PORADI_REKORDU, STUPNE, ZNAKY_REKORDU, casKroniky, datumKroniky, htmlBublinyOdznaku, htmlBublinyRekordu, kronikaPoMesicich, popisOdznaku, slozeniBodu, textDni, textRekordu, textUdalosti, textZbyva, nazevSezonyVeVete } from '../lib/slava';
import { stav } from './stav';
import { adresaTitulni, nacitatPostupne } from './obrazky';
import { stylVyrezu } from './navigace';
import { htmlSrdicka, htmlTrendu } from './galerie';
import { jeVidet, nastavitHtml, otevreneOkno } from '../ui/dom';
import { htmlPrazdna, htmlPrazdnaMala } from '../ui/prazdno';

let kontejner = null;
let data = null;
let sezona = null; // probíhající sezóna (GetSezona, oblibenost_sezony.go)

const modelka = id => stav.prehledModelky.get(id);
const jmeno = id => modelka(id)?.jmeno || '';
const TRIDY_STUPNU = ['jednorazovy', 'bronz', 'stribro', 'zlato'];

// Pohledy síně slávy: klíč, název (ikonu v pilulce dává ui/volby.js podle názvu)
const POHLEDY = [['top', 'Top 10'], ['legendy', 'Legendy'], ['odznaky', 'Odznaky'], ['rekordy', 'Rekordy'], ['kronika', 'Kronika'], ['sezona', 'Sezóna']];
const jePohled = klic => POHLEDY.some(([k]) => k === klic);
let pohled = (() => {
    try {
        const ulozeny = localStorage.getItem('slavaPohled');
        return jePohled(ulozeny) ? ulozeny : 'top';
    } catch {
        return 'top';
    }
})();

// Ukázaný pohled (Kronika má filtr v liště pod hledáním, prehled.js podle toho vybere volby)
export const pohledSlavy = () => pohled;

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
    ['sezony', 'Sezóny', u => ['favoritka', 'milacek'].includes(u.druh)],
];
let filtrKroniky = 'vse';

export async function nacistSinSlavy(prvek) {
    kontejner = prvek;
    try {
        [data, sezona] = await Promise.all([GetSinSlavy(), GetSezona()]);
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
function htmlAvataru(id, trida = '') {
    const m = modelka(id);
    if (!m) return `<span class="slava-avatar ${trida}"></span>`;
    return `<span class="slava-avatar ${trida}"><img data-src="${esc(adresaTitulni(m))}" alt="" style="${stylVyrezu(m)}" draggable="false" decoding="async" /></span>`;
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
    // V Top 10 klik otevře vitrínu modelky (profil z ní tlačítkem), v Legendách rovnou profil
    const akce = legenda ? `data-otevrit-modelku="${m.id}"`
        : `data-slava-vybrat="${m.id}" role="button" aria-expanded="${vybrana === m.id}"`;
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
        <div class="card slava-karta ${legenda ? 'legenda' : ''}${!legenda && vybrana === m.id ? ' vybrana' : ''}" ${akce} tabindex="0" aria-label="${esc(m.jmeno)}" title="${esc(bublina)}">
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

// Stavová lišta Síně slávy: vlevo probíhající sezóna (den, kdo vede), vpravo skončená sezóna k vyhlášení, jinak
// poslední zápis kroniky s odkazem (skrytá tlačítka se zrcadlí do lišty, klik jde na ně); počty jsou na stránce
function htmlStavuSine() {
    const vede = sezona?.poradi?.find(b => b.misto === 1 && modelka(b.modelkaId));
    const textSezony = sezona?.dni
        ? [`Sezóna ${nazevSezonyVeVete(sezona, true)}`, `den ${sezona.den} z ${sezona.dni}`, vede ? `vede ${jmeno(vede.modelkaId).split(' ')[0]}` : 'nikdo zatím nevede'].join(' · ')
        : '';
    let vpravo = '';
    if (sezona?.kUzavreni) {
        vpravo = `<button type="button" data-sezona-vyhlasit>♛ Sezóna ${esc(nazevSezonyVeVete(sezona.kUzavreni, true))} čeká na vyhlášení · Vyhlásit →</button>`;
    } else if (sezona?.propadle) {
        vpravo = `<button type="button" data-sezona-odemknout="${esc(sezona.propadle.klic)}">⚠ Téma „${esc(sezona.propadle.nazev)}“ nemá dost soutěžících (${sezona.propadle.soutezicich}/${sezona.propadle.minModelek}) · Odemknout →</button>`;
    } else if (sezona?.dni && !sezona.zvoleno) {
        vpravo = '<button type="button" data-sezona-zvolit>✦ Sezóna ještě nemá téma · Zvolit →</button>';
    } else if (pohled !== 'kronika') {
        const posledni = (data.kronika || []).filter(u => u.druh !== 'zacatek' && u.druh !== 'pocatek')
            .sort((x, y) => String(y.cas).localeCompare(String(x.cas)))[0];
        if (posledni) {
            const u = textUdalosti(posledni, jmeno);
            vpravo = `<button type="button" data-slava-pohled="kronika" title="${esc(u.text)}">${esc(`${u.ikona} ${u.text.split(' · ')[0]}`)} · Kronika →</button>`;
        }
    }
    return `${vpravo}${textSezony ? `<span>${esc(textSezony)}</span>` : ''}`;
}

// Skrytý řádek pro stavovou lištu (pohledy a filtr Kroniky jsou v liště hlavičky Síně)
function htmlPoctuPohledu() {
    return `<div class="volby-v-liste" data-volby-casti="slava-${pohled}">${htmlStavuSine()}</div>`;
}

// Pohled Top 10: stupně vítězů (2. vlevo, 1. uprostřed, 3. vpravo) a místa 4–10 v řadě přes celou šířku
function htmlTop(rekordy, odznaky) {
    const stupne = data.vitrina.filter(x => x.misto >= 1 && x.misto <= 3);
    const poradiStupnu = [2, 1, 3].map(misto => stupne.find(x => x.misto === misto)).filter(Boolean);
    // Za každou skupinou karet místo pro vitrínu (otevře se pod řadou vybrané modelky)
    const misto = '<div class="slava-vitrina-misto"></div>';
    const htmlStupnu = poradiStupnu.length ? `<div class="slava-stupne slava-skupina">${poradiStupnu.map(x =>
        `<div class="slava-stupen misto-${x.misto}">${htmlKarty(x, rekordy.get(x.modelkaId), false, odznaky.get(x.modelkaId))}<div class="slava-podstavec" aria-hidden="true">${x.misto}</div></div>`).join('')}</div>${misto}` : '';
    const zbytek = data.vitrina.filter(x => !stupne.includes(x));
    const ostatni = zbytek.map(x => htmlKarty(x, rekordy.get(x.modelkaId), false, odznaky.get(x.modelkaId))).join('');
    const top = htmlStupnu + (ostatni ? `<div class="slava-karty slava-rada slava-skupina ${zbytek.length >= 6 ? 'husta' : ''}" style="--karet: ${zbytek.length}">${ostatni}</div>${misto}` : '');
    if (!top) return htmlPrazdna('Top 10 je zatím prázdná', 'Do Top 10 se dostane modelka po 10 porovnáních s výhrou nad některou z Top 20.', { ikona: 'hvezda', odkaz: '<button type="button" class="link" data-ob-porovnavat>Porovnat →</button>' });
    return top;
}

// Pohled Sezóna: řádek sezóny (název, odpočet do konce, počty), trůn s první trojicí (stejné karty a stupně jako Top 10),
// pořadí sezóny od 4. místa se složením bodů, pravidla a minulé sezóny. Body jen formy v sezóně, sílu nemění.
function htmlSlozeni(b, nejvys) {
    const sl = slozeniBodu(b, nejvys);
    return `<span class="sz-slozeni" title="${esc(`za souboje ${b.zaSouboje} b. · za zájem ${b.zaZajem} b.`)}"><i class="sz-souboje" style="flex:${sl.souboje}"></i><i class="sz-zajem" style="flex:${sl.zajem}"></i><i class="sz-zbytek" style="flex:${Math.max(0, 1 - sl.souboje - sl.zajem)}"></i></span>`;
}

const textTrendu = t => (t > 0 ? `<span class="trend nahoru">▲ ${t}</span>` : t < 0 ? `<span class="trend dolu">▼ ${-t}</span>` : '');

function htmlKartySezony(b, vudkyne, nejvys) {
    const m = modelka(b.modelkaId);
    if (!m) return '';
    const prvni = b.misto === 1;
    const vyzva = !prvni && vudkyne
        ? `<button type="button" class="sz-vyzvat" data-sezona-vyzvat="${m.id}" data-sezona-vudkyne="${vudkyne.modelkaId}" title="Souboj s vedoucí modelkou v Porovnat">⚔ Vyzvat o trůn <small>−${vudkyne.body - b.body} b.</small></button>`
        : `<p class="slava-popis sz-vede">${prvni ? 'Průběžná favoritka sezóny' : ''}</p>`;
    return `
        <div class="card slava-karta" data-otevrit-modelku="${m.id}" tabindex="0" aria-label="${esc(m.jmeno)}" title="${esc(`${m.jmeno}: ${b.misto}. místo v sezóně, ${b.body} b. (souboje ${b.zaSouboje}, zájem ${b.zaZajem}), ${sklonovat(b.vyhry, 'výhra', 'výhry', 'výher')}, ${sklonovat(b.remizy, 'remíza', 'remízy', 'remíz')}, ${sklonovat(b.prohry, 'prohra', 'prohry', 'proher')}`)}">
            <div class="card-image-wrap">
                <img data-src="${esc(adresaTitulni(m))}" alt="" style="${stylVyrezu(m)}" draggable="false" decoding="async" />
                <span class="slava-misto ${prvni ? 'prvni' : ''}">${prvni ? '♛ ' : ''}${b.misto}.</span>
            </div>
            <div class="card-info">
                <h3>${esc(m.jmeno)}</h3>
                <p class="slava-popis">${b.body} b. · ${esc(sklonovat(b.vyhry, 'výhra', 'výhry', 'výher'))}${b.trend ? ` · ${b.trend > 0 ? '▲' : '▼'} ${Math.abs(b.trend)} za týden` : ''}</p>
                ${htmlSlozeni(b, nejvys)}
                ${vyzva}
            </div>
        </div>`;
}

// Řádek sezóny nad trůnem: téma s ikonou, období, kolik zbývá, soutěžící; propadlé téma s nabídkou odemčení;
// sezóna bez zvoleného tématu s nabídkou volby
function htmlRadkuSezony(sz) {
    const t = sz.tema;
    const casti = [
        t ? `<b>${esc(`${t.ikona || ''} ${t.nazev}`.trim())}</b>` : '<b>Klasická</b>',
        esc(sz.obdobi || ''),
        esc(textZbyva(sz.den, sz.dni)),
        t ? esc(sklonovat(sz.soutezicich, 'soutěžící', 'soutěžící', 'soutěžících')) : '',
    ].filter(Boolean).join(' · ');
    const p = sz.propadle;
    const upozorneni = p
        ? `<p class="sz-upozorneni">⚠ Téma „${esc(p.nazev)}“ teď nemá dost soutěžících (${p.soutezicich} z ${p.minModelek}) – sezóna běží jako Klasická. <button type="button" class="link" data-sezona-odemknout="${esc(p.klic)}">🔓 Odemknout v Průvodci →</button></p>`
        : !sz.zvoleno ? '<p class="sz-upozorneni">Sezóna ještě nemá téma. <button type="button" class="link" data-sezona-zvolit>✦ Zvolit téma →</button></p>' : '';
    return `<div class="sz-radek-sezony">${casti}</div>${upozorneni}`;
}

function htmlSezony() {
    const sz = sezona;
    if (!sz) return htmlPrazdna('Sezónu se nepodařilo načíst', 'Zkus Síň slávy otevřít znovu.', { ikona: 'hvezda' });
    const radekSezony = htmlRadkuSezony(sz);
    // Skončená, ještě neuzavřená sezóna (okno vyhlášení se odložilo „Později“)
    const soutezi = sz.poradi.filter(b => b.misto > 0 && modelka(b.modelkaId));
    const nejvys = Math.max(1, ...sz.poradi.map(b => b.body));
    if (!soutezi.length) {
        return `<div class="sz">${radekSezony}${htmlPrazdna('Sezóna teprve začíná', 'Body sbírají modelky za souboje v Porovnat a za zájem. Na trůn se dostane modelka, která má v sezóně aspoň 3 souboje.', { ikona: 'hvezda', odkaz: '<button type="button" class="link" data-ob-porovnavat>Porovnat →</button>' })}</div>`;
    }
    const vudkyne = soutezi[0];
    const trun = [2, 1, 3].map(misto => soutezi.find(b => b.misto === misto)).filter(Boolean);
    const zbytek = soutezi.filter(b => b.misto > 3).slice(0, 7);
    const ostatnich = sz.poradi.length - soutezi.length;
    const radky = zbytek.map(b => {
        const m = modelka(b.modelkaId);
        return `<button type="button" class="sz-radek" data-otevrit-modelku="${m.id}">
            <span class="sz-m">${b.misto}.</span><img class="sz-av" data-src="${esc(adresaTitulni(m))}" alt="" style="${stylVyrezu(m)}" draggable="false" />
            <span class="sz-jm">${esc(m.jmeno)}</span>${htmlSlozeni(b, nejvys)}<span class="sz-wl" title="výhry – prohry">${b.vyhry}–${b.prohry}</span>${textTrendu(b.trend) || '<span class="trend"></span>'}<b class="sz-b">${b.body}</b></button>`;
    }).join('');
    return `<div class="sz">${radekSezony}
        <div class="slava-stupne slava-skupina">${trun.map(b => `<div class="slava-stupen misto-${b.misto}">${htmlKartySezony(b, vudkyne, nejvys)}<div class="slava-podstavec" aria-hidden="true">${b.misto}</div></div>`).join('')}</div>
        <div class="sz-mrizka">
            <div class="sz-karta"><h4>Pořadí sezóny</h4>
                <p class="sz-leg"><span><i class="sz-souboje"></i>souboje</span><span><i class="sz-zajem"></i>zájem (nejvýš polovina bodů)</span></p>
                ${radky || '<p class="prazdno-male">Zatím jen první trojice.</p>'}
                ${ostatnich ? `<p class="prazdno-male">${esc(sklonovat(ostatnich, 'další modelka má', 'další modelky mají', 'dalších modelek má'))} body, ale ještě ne 3 souboje, které pořadí potřebuje.</p>` : ''}
            </div>
        </div></div>`;
}

// ——— Hlavička Síně slávy (jeden panel v hlavičce okna jako Hodnocení a Sbírka) ———
// Fotka jedničky s ♛, čísla, okénka Sezóna a Na dosah, akce (Vyzvat o trůn, Vyhlásit sezónu, Porovnat) a lišta:
// pohledy Top 10 · Sezóna · Legendy · Odznaky · Rekordy · Kronika, vpravo filtr Kroniky. Po odrolování jeden řádek.
let hlava = null;
const POHLEDY_V_LISTE = ['top', 'sezona', 'legendy', 'odznaky', 'rekordy', 'kronika'];
const hlavaVidet = () => Boolean(kontejner?.isConnected) && Boolean(data) && stav.rezim === 'prehled'
    && stav.prehledSekce === 'oblibenost' && stav.oblibenostCast === 'slava' && !document.getElementById('stats')?.classList.contains('hidden');

// Panel vpravo (I): Na dosah (nejbližší stupně odznaků), Minulé sezóny, Pravidla sezóny
const PANELY_SLAVY = [['dosah', 'Na dosah'], ['minule', 'Minulé sezóny'], ['pravidla', 'Pravidla']];

function nejblizsiOdznaky(kolik) {
    return (data.odznaky || []).filter(o => o.dalsi > 0 && modelka(o.modelkaId) && data.vitrina.some(x => x.modelkaId === o.modelkaId))
        .map(o => ({ o, p: popisOdznaku(o, jmeno) }))
        .sort((a, b) => (b.p?.postup ?? 0) - (a.p?.postup ?? 0)).slice(0, kolik);
}

function htmlHlavySlavy() {
    const krestni = id => jmeno(id).split(' ')[0];
    const prvni = data.vitrina.find(x => x.misto === 1);
    const m1 = prvni && modelka(prvni.modelkaId);
    const foto = m1
        ? `<button type="button" class="sl-foto" data-otevrit-modelku="${m1.id}" title="${esc(`1. ${m1.jmeno} – otevřít profil`)}"><img src="${esc(adresaTitulni(m1))}" alt="" style="${stylVyrezu(m1)}" draggable="false" /><span aria-hidden="true">♛</span></button>`
        : '<div class="sl-foto prazdna" aria-hidden="true"><span>♛</span></div>';
    const cislo = (n, a, b, c) => `<span><b>${(n || 0).toLocaleString('cs-CZ')}</b> ${esc(sklonovat(n || 0, a, b, c).replace(/^\S+ /, ''))}</span>`;
    const sz = sezona;
    const soutezi = (sz?.poradi || []).filter(b => b.misto > 0 && modelka(b.modelkaId));
    const vede = soutezi[0];
    const okenkoSezony = sz?.dni ? `<button type="button" class="sh-oblast hd-okenko" data-sl-pohled="sezona" title="Pohled Sezóna">
            <span>Sezóna ${esc(nazevSezonyVeVete(sz, true))}</span><b>${vede ? `♛ ${esc(krestni(vede.modelkaId))}` : '—'}</b><i><em style="width:${Math.round(sz.den / sz.dni * 100)}%"></em></i><small>${esc(textZbyva(sz.den, sz.dni))}${vede ? ` · ${vede.body} b.` : ''}</small></button>` : '';
    const dosah = nejblizsiOdznaky(1)[0];
    const okenkoDosahu = dosah ? `<button type="button" class="sh-oblast hd-okenko" data-sl-panel="dosah" title="Nejbližší další stupeň odznaku – panel Na dosah">
            <span>Na dosah</span><b>${esc(krestni(dosah.o.modelkaId))}</b><i><em style="width:${Math.round((dosah.p?.postup || 0) * 100)}%"></em></i><small>${esc(dosah.p?.zbyva || '')}</small></button>` : '';
    const druha = soutezi[1];
    const akce = [
        sz?.kUzavreni ? `<button type="button" class="volba akcent" data-sezona-vyhlasit><b>♛ Vyhlásit sezónu ${esc(nazevSezonyVeVete(sz.kUzavreni, true))}</b></button>` : '',
        sz?.dni && !sz.zvoleno && !sz.kUzavreni ? '<button type="button" class="volba akcent" data-sezona-zvolit title="Téma a délka probíhající sezóny"><b>✦ Zvolit téma sezóny</b></button>' : '',
        druha && vede ? `<button type="button" class="volba ${sz?.kUzavreni ? '' : 'akcent'}" data-sezona-vyzvat="${druha.modelkaId}" data-sezona-vudkyne="${vede.modelkaId}" title="${esc(`Souboj ${jmeno(druha.modelkaId)} s vedoucí ${jmeno(vede.modelkaId)} v Porovnat`)}"><b>⚔ Vyzvat o trůn</b> <small>${esc(krestni(druha.modelkaId))} −${vede.body - druha.body} b.</small></button>` : '',
        '<button type="button" class="volba" data-zobrazeni-prehledu="porovnat" title="Hodnocení › Porovnat"><b>Porovnat →</b></button>',
    ].join('');
    const nazvy = new Map(POHLEDY.map(([k, n]) => /** @type {[string, string]} */ ([k, n])));
    const filtryKroniky = pohled === 'kronika' ? FILTRY_KRONIKY.map(([k, nazev, f]) => {
        const n = bezOpakovanychPocatku(data.kronika.filter(f)).length;
        return n || k === 'vse' ? `<button type="button" class="${k === filtrKroniky ? 'on' : ''}" data-kronika-filtr="${k}" aria-pressed="${k === filtrKroniky}">${nazev} <small>${n}</small></button>` : '';
    }).join('') : '';
    return `<div class="sh-obsah">
            ${foto}
            <div class="sh-identita"><h2>Síň slávy</h2>
                <div class="sh-cisla">${cislo(data.vitrina.length, 'v Top 10', 'v Top 10', 'v Top 10')}${cislo(data.legendy.length, 'legenda', 'legendy', 'legend')}${cislo((data.odznaky || []).filter(o => o.ziskan).length, 'odznak', 'odznaky', 'odznaků')}${cislo(data.rekordy.length, 'rekord', 'rekordy', 'rekordů')}</div></div>
            <div class="sh-oblasti">${okenkoSezony}${okenkoDosahu}</div>
        </div>
        <div class="sh-akce">
            ${akce}<span class="sh-oddelovac" aria-hidden="true"></span>
            ${PANELY_SLAVY.map(([klic, nazev]) => `<button type="button" class="volba ${stav.slavaPanel === klic ? 'zapnuto' : ''}" data-sl-panel="${klic}" aria-pressed="${stav.slavaPanel === klic}" title="Panel vpravo (I)">${nazev}</button>`).join('')}
        </div>
        <div class="sh-lista">
            <div class="sh-filtry" role="tablist" aria-label="Pohledy Síně slávy">${POHLEDY_V_LISTE.map(klic =>
                `<button type="button" role="tab" class="sh-filtr ${klic === pohled ? 'on' : ''}" aria-selected="${klic === pohled}" data-sl-pohled="${klic}">${nazvy.get(klic)}</button>`).join('')}</div>
            <div class="sh-pohledy" role="group" aria-label="Filtr kroniky">${filtryKroniky}</div>
        </div>`;
}

export function obnovitHlavuSlavy() {
    if (!hlava) return;
    const videt = hlavaVidet();
    hlava.classList.toggle('hidden', !videt);
    if (!videt) {
        document.querySelector('.navbar')?.classList.remove('slava-svinuta');
        return;
    }
    nastavitHtml(hlava, htmlHlavySlavy());
}

// Obsah panelu (vykresluje se s pohledem; otevřený říká data-sl-panel na .slava)
function htmlPaneluSlavy() {
    const cil = o => TRIDY_STUPNU[(o.stupen || 0) + 1] || 'zlato';
    const blizko = nejblizsiOdznaky(8);
    const dosah = blizko.length ? `<ul class="slp-dosah">${blizko.map(({ o, p }) => `<li><button type="button" class="slava-dosah-polozka" data-slava-vybrat="${o.modelkaId}" data-odznak-bublina="${esc(klicBubliny(o))}" title="">
            ${htmlMedailonu(o)}<span class="slava-dosah-text"><b>${esc(jmeno(o.modelkaId))}</b><span class="odznak-pruh ${cil(o)}"><i style="width:${Math.round((p?.postup || 0) * 100)}%"></i></span><small>${esc(p?.zbyva || '')}</small></span>
        </button></li>`).join('')}</ul>` : '<p class="hz-tichy">Žádná modelka z Top 10 teď nemá další stupeň odznaku na dosah.</p>';
    const minule = (sezona?.minule || []).length ? `<ul class="slp-minule">${sezona.minule.map(x => {
        const f = modelka(x.favoritka);
        const mil = x.milacek ? modelka(x.milacek) : null;
        return `<li><button type="button" ${f ? `data-otevrit-modelku="${f.id}"` : 'disabled'}>${f ? `<img data-src="${esc(adresaTitulni(f))}" alt="" style="${stylVyrezu(f)}" draggable="false" />` : '<span class="slp-bez"></span>'}
            <span><b>${esc(x.nazev)}</b><small>${x.nazev !== x.obdobi ? `${esc(x.obdobi)} · ` : ''}${f ? `♛ ${esc(f.jmeno)} · ${x.body} b.` : 'bez Favoritky'}${mil ? ` · ♥ ${esc(mil.jmeno.split(' ')[0])}` : ''} · ${esc(sklonovat(x.souboju, 'souboj', 'souboje', 'soubojů'))}</small></span></button></li>`;
    }).join('')}</ul>` : '<p class="hz-tichy">Zatím žádná uzavřená sezóna – první se vyhlásí, až skončí probíhající sezóna.</p>';
    const pravidla = `<ul class="sz-pravidla">
            <li><b>+3</b> výhra v souboji, <b>+1</b> remíza</li>
            <li><b>+2</b> navíc za výhru nad silnější (výš v pořadí)</li>
            <li><b>+1</b> den s otevřeným profilem, <b>+1</b> za každé 2 minuty nad fotkami – nejvýš 4 denně a nejvýš polovina bodů</li>
            <li>O titul soutěží modelky s aspoň 3 souboji v sezóně</li>
            <li>Sezóna trvá 7 až 30 dní a může mít téma; po jejím konci vyhlásíš <b>Favoritku</b> a můžeš zvolit <b>♥ Miláčka</b> sezóny</li>
            <li>V tematické sezóně soutěží jen modelky s aspoň 6 fotkami tématu a počítají se jen souboje v Porovnat v režimu tématu; téma potřebuje aspoň 8 takových modelek, jinak sezóna běží jako Klasická (chybějící fotky doplníš v Průvodci)</li>
        </ul>
        <h4>Top 10 a legendy</h4>
        <p class="hz-tichy">Do Top 10 se modelka dostane po 10 porovnáních s výhrou nad některou z Top 20. Bývalé členky Top 10 jsou Legendy; rekordy a odznaky se počítají z kroniky.</p>`;
    return `<aside class="sbirka-panel sl-panel" aria-label="Panel Síně slávy">
        <div class="sbp-hlava">
            <nav class="sbp-zalozky" role="tablist" aria-label="Panel Síně slávy">${PANELY_SLAVY.map(([klic, nazev]) => `<button type="button" role="tab" data-sl-panel="${klic}" aria-selected="${stav.slavaPanel === klic}">${nazev}</button>`).join('')}</nav>
            <button type="button" class="sbp-zavrit" data-sl-panel-zavrit title="Zavřít panel (Esc)" aria-label="Zavřít panel">&times;</button>
        </div>
        <div class="sbp-telo">
            <div class="hdp-cast" data-slp="dosah"><h4>Na dosah <small>nejbližší další stupně odznaků v Top 10</small></h4>${dosah}</div>
            <div class="hdp-cast" data-slp="minule"><h4>Minulé sezóny</h4>${minule}</div>
            <div class="hdp-cast hdp-jak" data-slp="pravidla"><h4>Pravidla sezóny</h4>${pravidla}</div>
        </div>
    </aside>`;
}

function nastavitPanelSlavy(klic) {
    stav.slavaPanel = klic === stav.slavaPanel ? '' : klic;
    try {
        localStorage.setItem('slavaPanel', stav.slavaPanel);
        if (stav.slavaPanel) localStorage.setItem('slavaPanelPosledni', stav.slavaPanel);
    } catch { /* jen pro toto spuštění */ }
    const koren = kontejner?.querySelector('.slava');
    if (koren) {
        koren.dataset.slPanel = stav.slavaPanel;
        koren.querySelectorAll('.sl-panel [data-sl-panel]').forEach(b => b.setAttribute('aria-selected', String(/** @type {HTMLElement} */ (b).dataset.slPanel === stav.slavaPanel)));
    }
    obnovitHlavuSlavy();
}

// Akce hlavičky a panelu (hlavička je mimo kontejner Síně)
function klikSlavy(cil) {
    const panel = /** @type {HTMLElement | null} */ (cil.closest('[data-sl-panel]'));
    const naPohled = /** @type {HTMLElement | null} */ (cil.closest('[data-sl-pohled]'));
    const filtr = /** @type {HTMLElement | null} */ (cil.closest('[data-kronika-filtr]'));
    const vyzva = /** @type {HTMLElement | null} */ (cil.closest('[data-sezona-vyzvat]'));
    if (cil.closest('[data-sl-panel-zavrit]')) nastavitPanelSlavy('');
    else if (panel) {
        if (!(panel.closest('.sl-panel') && panel.dataset.slPanel === stav.slavaPanel)) nastavitPanelSlavy(panel.dataset.slPanel);
    } else if (naPohled) prepnoutPohled(naPohled.dataset.slPohled);
    else if (filtr) {
        filtrKroniky = filtr.dataset.kronikaFiltr || 'vse';
        vykreslit();
    } else if (cil.closest('[data-sezona-vyhlasit]')) vyhlasitSezonu(sezona?.kUzavreni);
    else if (cil.closest('[data-sezona-zvolit]')) zvolitSezonu();
    else if (cil.closest('[data-sezona-odemknout]')) odemknoutTema(/** @type {HTMLElement} */ (cil.closest('[data-sezona-odemknout]')).dataset.sezonaOdemknout);
    else if (vyzva) soubojOTrun(Number(vyzva.dataset.sezonaVyzvat), Number(vyzva.dataset.sezonaVudkyne));
    else return false;
    return true;
}

function pripravitHlavuSlavy() {
    try { stav.slavaPanel = localStorage.getItem('slavaPanel') || ''; } catch { /* zavřený */ }
    if (!PANELY_SLAVY.some(([klic]) => klic === stav.slavaPanel)) stav.slavaPanel = '';
    hlava = document.createElement('div');
    hlava.id = 'slavaHlava';
    hlava.className = 'sbirka-hlava slava-hlava hidden';
    document.getElementById('albumNav')?.before(hlava);
    hlava.addEventListener('click', e => klikSlavy(/** @type {HTMLElement} */ (e.target)));
    const navbar = document.querySelector('.navbar');
    const main = document.querySelector('main');
    main?.addEventListener('scroll', () => {
        if (hlava.classList.contains('hidden')) return;
        if (main.scrollTop > 60) navbar.classList.add('slava-svinuta');
        else if (main.scrollTop < 20) navbar.classList.remove('slava-svinuta');
    }, { passive: true });
    // I otevře naposledy otevřený panel (nebo ho zavře), Esc zavře
    document.addEventListener('keydown', (e) => {
        if (!hlavaVidet() || e.ctrlKey || e.altKey || e.metaKey || stav.zamceno || otevreneOkno() || jeVidet('lightbox')
            || /** @type {HTMLElement} */ (e.target).closest?.('input, textarea, select, [contenteditable]')) return;
        if (e.key.toLowerCase() === 'i' && !e.shiftKey) {
            e.preventDefault();
            let posledni = 'dosah';
            try { posledni = localStorage.getItem('slavaPanelPosledni') || 'dosah'; } catch { /* výchozí */ }
            nastavitPanelSlavy(stav.slavaPanel ? '' : posledni);
        } else if (e.key === 'Escape' && stav.slavaPanel && !document.querySelector('.context-menu:not(.hidden), .volby-panel:not(.hidden)')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            nastavitPanelSlavy('');
        }
    }, true);
}

// ——— Vitrína modelky (z Top 10): čísla, odznaky se stupni a postupem, co jí chybí, rekordy a její kronika ———
let vybrana = 0;

// Všechny odznaky modelky (i nezískané s postupem), v pořadí ODZNAKY
const odznakyModelky = id => (data.odznaky || []).filter(o => o.modelkaId === id)
    .sort((a, b) => PORADI_ODZNAKU.indexOf(a.odznak) - PORADI_ODZNAKU.indexOf(b.odznak));

// Dlaždice odznaku ve vitríně: medailon, název, stupeň, tři tečky stupňů a postup k dalšímu
function htmlDlazdiceOdznaku(o) {
    const d = ODZNAKY[o.odznak];
    const p = popisOdznaku(o, jmeno);
    if (!d || !p) return '';
    const trida = !o.ziskan ? 'cil' : TRIDY_STUPNU[o.stupen] || 'jednorazovy';
    let spodek = '';
    if (d.prahy) {
        const tecky = `<span class="sv-tecky" aria-hidden="true">${[1, 2, 3].map(s => `<i class="${o.stupen >= s ? TRIDY_STUPNU[s] : ''}"></i>`).join('')}</span>`;
        spodek = p.postup !== null
            ? `${tecky}<span class="odznak-pruh"><i style="width:${Math.round(p.postup * 100)}%"></i></span><small>${esc(p.zbyva)}</small>`
            : `${tecky}<small>${esc(d.jednotka(Number(o.hodnota) || 0))} · nejvyšší stupeň</small>`;
    } else {
        const souperka = o.souperka && d.souperka ? jmeno(o.souperka) : '';
        spodek = `<small>${esc(souperka ? d.souperka(souperka) : d.popis)}</small>`;
    }
    const stupen = o.ziskan ? (p.stupen || 'jednorázový') : 'na cestě k bronzu';
    return `<div class="sv-odznak ${trida}">
        ${htmlMedailonu(o, true)}
        <span class="sv-odznak-text"><b>${esc(d.nazev)}</b><small class="sv-stupen ${trida}">${esc(stupen)}${o.ziskan && o.cas ? ` · ${esc(datumKroniky(o.cas))}` : ''}</small>${spodek}</span>
    </div>`;
}

// Události kroniky, které se modelky týkají (její i ty, kde byla soupeřkou), od nejnovější
const kronikaModelky = id => (data.kronika || []).filter(u => u.druh !== 'zacatek' && (u.modelkaId === id || u.souperka === id));

const htmlUdalostiVitriny = (u, id) => {
    const t = textUdalosti(u, jmeno);
    return `<li class="slava-udalost u-${esc(u.druh)}${u.modelkaId !== id ? ' cizi' : ''}"><span class="slava-ikona" aria-hidden="true">${t.ikona}</span><span>${esc(t.text)}<small>${esc(datumKroniky(u.cas))}</small></span></li>`;
};

function htmlVitriny(id) {
    const m = modelka(id);
    const x = data.vitrina.find(v => v.modelkaId === id);
    if (!m || !x) return '';
    const odznaky = odznakyModelky(id);
    const rekordy = trofeje().get(id) || [];
    const ma = new Set(odznaky.map(o => o.odznak));
    const chybi = PORADI_ODZNAKU.filter(k => !ma.has(k));
    const cisla = [
        [`${x.misto}.`, 'místo v Top 10'],
        [textDni(x.dniTed, x.odZacatku), x.pobytu > 1 ? `tentokrát v Top 10 (${x.pobytu}. pobyt)` : 'v Top 10'],
        x.pobytu > 1 ? [textDni(x.dniCelkem), 'v Top 10 celkem'] : null,
        x.dniNaPrvnim ? [textDni(x.dniNaPrvnim, x.odZacatku), 'na 1. místě'] : null,
        [`${x.obhajob}×`, 'obhájila místo'],
        x.nejlepsiMisto && x.nejlepsiMisto !== x.misto ? [`${x.nejlepsiMisto}.`, 'nejlepší místo'] : null,
    ].filter(Boolean);
    const udalosti = kronikaModelky(id);
    const kronika = udalosti.length
        ? `<ol class="slava-kronika sv-kronika">${udalosti.slice(0, 5).map(u => htmlUdalostiVitriny(u, id)).join('')}</ol>
           ${udalosti.length > 5 ? `<details class="sv-starsi"><summary>Starší (${udalosti.length - 5})</summary><ol class="slava-kronika sv-kronika">${udalosti.slice(5).map(u => htmlUdalostiVitriny(u, id)).join('')}</ol></details>` : ''}`
        : '<p class="sv-nic">Zatím bez událostí.</p>';
    return `<section class="slava-vitrina" aria-label="${esc(`Vitrína – ${m.jmeno}`)}">
        <header class="sv-hlava">
            ${htmlAvataru(id, 'velky')}
            <div class="sv-jmeno"><h3>${esc(m.jmeno)}</h3><small>${esc(`V Top 10 od ${datumKroniky(x.od)}${x.odZacatku ? ' (už před začátkem kroniky)' : ''}`)}</small></div>
            <dl class="sv-cisla">${cisla.map(([h, popis]) => `<div><dt>${esc(popis)}</dt><dd>${esc(h)}</dd></div>`).join('')}</dl>
            <span class="sv-akce">
                <button type="button" class="sv-tlacitko" data-otevrit-modelku="${m.id}">Profil →</button>
                <button type="button" class="sv-zavrit" data-slava-zavrit aria-label="Zavřít vitrínu" title="Zavřít (Esc)">✕</button>
            </span>
        </header>
        <div class="sv-telo">
            <div class="sv-odznaky">
                <div class="ob-nadpis">Odznaky · ${odznaky.filter(o => o.ziskan).length} z ${PORADI_ODZNAKU.length}</div>
                ${odznaky.length ? `<div class="sv-police">${odznaky.map(htmlDlazdiceOdznaku).join('')}</div>` : '<p class="sv-nic">Zatím žádný odznak.</p>'}
                ${chybi.length ? `<div class="sv-chybi"><small>Ještě nemá</small>${chybi.map(k => htmlMedailonu({ modelkaId: id, odznak: k, ziskan: false, stupen: 0, hodnota: 0, dalsi: 0 })).join('')}</div>` : ''}
            </div>
            <div class="sv-bok">
                <div class="ob-nadpis">Rekordy</div>
                ${rekordy.length ? `<ul class="sv-rekordy">${rekordy.map(r => `<li data-odznak-bublina="${esc(r.klic)}" title=""><span class="sv-pohar" aria-hidden="true">🏆</span><span><b>${esc(r.nazev)}</b><small>${esc(`${r.hodnota} ${r.popis}`)}</small></span></li>`).join('')}</ul>` : '<p class="sv-nic">Žádný rekord síně slávy.</p>'}
                <div class="ob-nadpis">Její kronika</div>
                ${kronika}
            </div>
        </div>
    </section>`;
}

// Vitrína pod řadou vybrané modelky (stupně nebo místa 4–10); šipka míří na její kartu
function ukazatVitrinu(posunout = true) {
    if (!kontejner) return;
    kontejner.querySelectorAll('.slava-vitrina-misto').forEach(s => s.replaceChildren());
    kontejner.querySelectorAll('.slava-skupina [data-slava-vybrat]').forEach(k => {
        const je = Number(/** @type {HTMLElement} */ (k).dataset.slavaVybrat) === vybrana;
        k.classList.toggle('vybrana', je);
        k.setAttribute('aria-expanded', String(je));
    });
    const karta = vybrana ? /** @type {HTMLElement | null} */ (kontejner.querySelector(`.slava-skupina [data-slava-vybrat="${vybrana}"]`)) : null;
    const misto = karta?.closest('.slava-skupina')?.nextElementSibling;
    if (!karta || !misto) {
        vybrana = 0;
        return;
    }
    misto.innerHTML = htmlVitriny(vybrana);
    umistitSipku();
    nacitatPostupne(kontejner);
    if (posunout) misto.firstElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// Šipka vitríny na střed vybrané karty (i po změně šířky okna)
function umistitSipku() {
    const karta = kontejner?.querySelector('.slava-skupina [data-slava-vybrat].vybrana');
    const panel = /** @type {HTMLElement | null} */ (kontejner?.querySelector('.slava-vitrina'));
    if (!karta || !panel) return;
    const r = karta.getBoundingClientRect();
    panel.style.setProperty('--sipka', `${r.left + r.width / 2 - panel.getBoundingClientRect().left}px`);
}

// Výběr modelky (karta nebo Na dosah): podruhé na tutéž kartu vitrínu zavře
function vybrat(id, prepnout = true) {
    vybrana = prepnout && vybrana === id ? 0 : id;
    ukazatVitrinu();
}

// Pohled Legendy: bývalé Top 10 jako portréty na stěně, pod jménem kdy v ní byly
function htmlLegend(rekordy, odznaky) {
    if (!data.legendy.length) return htmlPrazdna('Zatím žádné legendy', 'Legendy jsou modelky, které z Top 10 vypadly – tady uvidíš, kdo v ní vydržel nejdéle.', { ikona: 'hvezda' });
    const dni = data.legendy.reduce((s, x) => s + (x.dniCelkem || 0), 0);
    return `<p class="slava-uvod stranka-uvod">${esc(sklonovat(data.legendy.length, 'bývalá členka', 'bývalé členky', 'bývalých členek'))} Top 10 · dohromady ${esc(textDni(dni))} v ní · vpravo nahoře nejlepší místo</p>
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
    return `<p class="slava-uvod stranka-uvod">${esc(sklonovat(data.rekordy.length, 'rekord', 'rekordy', 'rekordů'))} z ${druhy.length} · ▲ rekord pořád roste · najetí myší na pohár ukáže, co měří</p>
        <div class="trofeje">${police.join('')}</div>
        ${rekordmanky ? `<h4 class="slava-nadpis">Rekordmanky <small>kdo drží kolik rekordů</small></h4><div class="rekordmanky">${rekordmanky}</div>` : ''}`;
}

// Kdo byl v Top 10 už na začátku kroniky, je jedna událost (jinak deset stejných vět za sebou)
const bezOpakovanychPocatku = seznam => seznam.filter((u, i) => !(u.druh === 'pocatek' && seznam[i - 1]?.druh === 'pocatek'));

// Pohled Kronika: svislá časová osa po měsících, u každé události uzel s ikonou a fotka modelky. Filtr druhu
// událostí je v liště pod hledáním (skrytý řádek štítků převezme ui/volby.js přes prehled.js)
function htmlKroniky() {
    const filtr = FILTRY_KRONIKY.find(([k]) => k === filtrKroniky) || FILTRY_KRONIKY[0];
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
    return `<ol class="kronika-osa">${osa || htmlPrazdnaMala('Žádné události tohoto druhu.', 'li')}</ol>`;
}

function vykreslit() {
    if (!kontejner || !data) return;
    if (!data.od) {
        nastavitHtml(kontejner, htmlPrazdna('Síň slávy se teprve plní', 'Kronika začne při příštím přepočtu oblíbenosti. Od té chvíle si program pamatuje, kdo je v Top 10, kdo vypadl, obhájil místo nebo byl jedničkou.', { ikona: 'hvezda' }));
        return;
    }
    const rekordy = trofeje();
    const odznaky = odznakyModelek();
    const obsah = pohled === 'legendy' ? htmlLegend(rekordy, odznaky)
        : pohled === 'odznaky' ? htmlOdznaku()
            : pohled === 'rekordy' ? htmlRekordu()
                : pohled === 'kronika' ? htmlKroniky()
                    : pohled === 'sezona' ? htmlSezony()
                        : htmlTop(rekordy, odznaky);
    nastavitHtml(kontejner, `<div class="slava" data-slava-zobrazeno="${pohled}" data-sl-panel="${stav.slavaPanel}">
        ${htmlPoctuPohledu()}
        <section class="slava-obsah" role="tabpanel" aria-label="${esc(POHLEDY.find(([k]) => k === pohled)?.[1] || '')}">${obsah}</section>
        ${htmlPaneluSlavy()}
    </div>`);
    obnovitHlavuSlavy();
    if (pohled === 'top') ukazatVitrinu(false);
    nacitatPostupne(kontejner);
    // Panel je fixed: fotky v něm se hlídají vůči oknu
    const panel = kontejner.querySelector('.sl-panel');
    if (panel) nacitatPostupne(panel, { root: null });
    // Volby v liště pod hledáním patří ukázanému pohledu (Kronika: filtr)
    document.dispatchEvent(new CustomEvent('volby-prehledu'));
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
    pripravitHlavuSlavy();
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
        if (cil.closest('.sl-panel') && klikSlavy(cil)) return;
        const naPohled = /** @type {HTMLElement | null} */ (cil.closest('[data-slava-pohled]'));
        if (naPohled) {
            prepnoutPohled(naPohled.dataset.slavaPohled, naPohled.getAttribute('role') === 'tab');
            return;
        }
        const filtr = /** @type {HTMLElement | null} */ (cil.closest('[data-kronika-filtr]'));
        if (filtr) {
            filtrKroniky = filtr.dataset.kronikaFiltr || 'vse';
            vykreslit();
            return;
        }
        if (cil.closest('[data-slava-zavrit]')) {
            vybrat(0, false);
            return;
        }
        if (cil.closest('[data-sezona-vyhlasit]')) {
            vyhlasitSezonu(sezona?.kUzavreni);
            return;
        }
        if (cil.closest('[data-sezona-zvolit]')) {
            zvolitSezonu();
            return;
        }
        if (cil.closest('[data-sezona-odemknout]')) {
            odemknoutTema(/** @type {HTMLElement} */ (cil.closest('[data-sezona-odemknout]')).dataset.sezonaOdemknout);
            return;
        }
        // Sezóna: souboj o trůn s vedoucí modelkou v Porovnat
        const vyzva = /** @type {HTMLElement | null} */ (cil.closest('[data-sezona-vyzvat]'));
        if (vyzva) {
            soubojOTrun(Number(vyzva.dataset.sezonaVyzvat), Number(vyzva.dataset.sezonaVudkyne));
            return;
        }
        // Karta v Top 10 nebo položka Na dosah: vitrína (srdíčka na kartě hodnotí, vitrínu neotevírají)
        const vyber = /** @type {HTMLElement | null} */ (cil.closest('[data-slava-vybrat]'));
        if (vyber && !cil.closest('.hearts')) vybrat(Number(vyber.dataset.slavaVybrat), !vyber.classList.contains('slava-dosah-polozka'));
    });
    window.addEventListener('resize', umistitSipku);
    // Po uzavření sezóny (okno vyhlášení) se síň načte znovu: minulé sezóny, kronika, odznak Favoritky
    ['sezona-uzavrena', 'sezona-zvolena'].forEach(u => document.addEventListener(u, () => { if (kontejner?.isConnected) nacistSinSlavy(kontejner); }));
    // Esc zavře otevřenou vitrínu (jen když je síň vidět a nic ji nepřekrývá)
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !vybrana || !kontejner?.isConnected || !kontejner.offsetParent) return;
        if (document.querySelector('.modal-overlay:not(.hidden)') || !document.getElementById('lightbox')?.classList.contains('hidden')) return;
        const id = vybrana;
        vybrat(0, false);
        /** @type {HTMLElement | null} */ (kontejner.querySelector(`.slava-skupina [data-slava-vybrat="${id}"]`))?.focus();
    });
    document.addEventListener('keydown', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        // Enter na kartě (vitrína v Top 10, profil v Legendách) nebo trofeji jako klik; tlačítko uvnitř karty
        // (Vyzvat o trůn) má vlastní Enter
        const karta = /** @type {HTMLElement | null} */ (cil?.closest?.('.slava-karta'));
        if (e.key === 'Enter' && karta === cil && kontejner?.contains(karta)) karta.click();
        const trofej = /** @type {HTMLElement | null} */ (cil?.closest?.('.trofej'));
        if (e.key === 'Enter' && trofej === cil && kontejner?.contains(trofej)) /** @type {HTMLElement | null} */ (trofej.querySelector('[data-otevrit-modelku]'))?.click();
    });
}
