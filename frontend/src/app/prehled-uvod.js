// Úvod Přehledu: hlavní čísla, mapa české edice (vlastní výtisky), mapa americké edice (úplnost dat),
// co zbývá doplnit a naposledy přidané modelky. Česká edice se sbírá fyzicky, americká jen jako data (PDF),
// proto má každá mapa jiné stavy. Políčko je jedno měsíční číslo; klik ho otevře, prázdné nabídne přidání.
import { MESICE, RADY_EDIC, ciselRocniku, cisloNevyslo, esc, formatDatum, nazevVydani, rozlozitVydani, sklonovat, slozitVydani } from '../lib/format';
import { adresaTitulni } from './obrazky';
import { grafSloupcu } from './statistiky';

// Mapy začínají prvním číslem edice (RADY_EDIC); měsíce mimo měsíční řadu jsou v nich prázdné
const PRVNI_ROK_CZ = parseInt(RADY_EDIC.CZ.od);
const PRVNI_ROK_US = parseInt(RADY_EDIC.US.od);
const POSLEDNI_ROK_US = parseInt(RADY_EDIC.US.do);
// Naposledy přidaných modelek na úvodu
const NAPOSLEDY = 6;

const STAVY_CZ = { m: 'mám výtisk', s: 'sháním', n: 'nezajímá mě', c: 'chybí', b: 'ještě nevyšlo', x: 'před prvním českým číslem' };
const STAVY_US = { k: 'kompletní', p: 'částečné', n: 'nezajímá mě', c: 'chybí', b: 'ještě nevyšlo', x: 'číslo nevyšlo' };

// Měsíční čísla edice po letech: { rok: [12 × { klic, data }] } od prvního do posledního roku
function cislaEdice(edice, odRoku, doRoku, podleKlice) {
    const roky = [];
    for (let rok = odRoku; rok <= doRoku; rok++) {
        roky.push({ rok, mesice: MESICE.map((_, i) => {
            const klic = slozitVydani(String(rok), String(i + 1).padStart(2, '0'), edice);
            return { klic, data: podleKlice.get(klic) };
        }) });
    }
    return roky;
}

// Obsah čísla slovy (do nápovědy políčka)
const obsahCisla = k => [k?.cover && 'cover', k?.centerfold && 'centerfold', k?.pictorial && 'pictorial'].filter(Boolean).join(', ');

// Mapa po desetiletích: sloupec = desetiletí, řádek = rok, políčko = měsíc
function htmlMapy(roky, stavCisla) {
    const dekady = new Map();
    roky.forEach(r => {
        const dekada = Math.floor(r.rok / 10) * 10;
        if (!dekady.has(dekada)) dekady.set(dekada, []);
        dekady.get(dekada).push(r);
    });
    return `<div class="uvod-mapa">${[...dekady].map(([dekada, rokyDekady]) => `
        <div class="uvod-dekada"><h5>${dekada}–${dekada + 9}</h5>
            ${rokyDekady.map(r => `<div class="uvod-rok"><span>${r.rok}</span>${r.mesice.map(m => {
                const [stavPole, popis] = stavCisla(m);
                // Měsíc před prvním číslem edice (x) není číslo, nedá se otevřít ani označit
                return stavPole === 'x' ? `<i class="x" title="${esc(`${nazevVydani(m.klic)} – ${popis}`)}"></i>`
                    : `<i class="${stavPole}" data-cislo="${esc(m.klic)}" ${m.data ? 'data-ma-data' : ''} title="${esc(`${nazevVydani(m.klic)} – ${popis}`)}"></i>`;
            }).join('')}</div>`).join('')}
        </div>`).join('')}</div>`;
}

const legenda = (pocty, nazvy) => `<div class="uvod-legenda">${Object.entries(pocty).filter(([, n]) => n).map(([s, n]) =>
    `<span><i class="${s}"></i>${nazvy[s]} ${n}</span>`).join('')}</div>`;

// p = GetPrehled, kalendar = GetKalendar, stavy = GetStavyVydani, souhrn = řádky „Co zbývá doplnit“, kUdrzbe = počet v menu Údržba
export function htmlUvodu({ p, kalendar, stavy, modelky, souhrn, kUdrzbe, modelekUplnych }) {
    const dnes = new Date();
    const letos = dnes.getFullYear();
    const budouci = klic => {
        const v = rozlozitVydani(klic);
        return parseInt(v.rok) > letos || (parseInt(v.rok) === letos && parseInt(v.mesic) > dnes.getMonth() + 1);
    };
    const podleKlice = new Map(kalendar.map(k => [k.vydani, k]));
    const stavPodleKlice = new Map(stavy.map(s => [s.vydani, s.stav]));
    const rokyEdice = edice => kalendar.concat(stavy).map(k => rozlozitVydani(k.vydani)).filter(v => v?.mesic && v.edice === edice && !v.mesic.startsWith('S')).map(v => parseInt(v.rok));

    // Česká edice: výtisky od prvního čísla 07/2011 (nebo od dřívějšího čísla ve sbírce) do letoška
    const rokyCz = rokyEdice('CZ');
    const cz = cislaEdice('CZ', Math.min(PRVNI_ROK_CZ, ...rokyCz), letos, podleKlice);
    const poctyCz = { m: 0, s: 0, n: 0, c: 0, b: 0, x: 0 };
    const stavCz = m => {
        const stavCisla = ({ mam: 'm', shanim: 's', nezajima: 'n' })[stavPodleKlice.get(m.klic)];
        // Měsíc před prvním číslem se nepočítá, pokud k němu ve sbírce přece jen něco není
        const mimoRadu = cisloNevyslo(m.klic) && !m.data && !stavCisla;
        const s = mimoRadu ? 'x' : budouci(m.klic) ? 'b' : stavCisla || 'c';
        poctyCz[s]++;
        const obsah = obsahCisla(m.data);
        return [s, STAVY_CZ[s] + (obsah ? ` · ${obsah}` : '')];
    };
    const mapaCz = htmlMapy(cz, stavCz);

    // Americká edice: úplnost dat od prvního do posledního roku ve sbírce
    const rokyUs = rokyEdice('US');
    const poctyUs = { k: 0, p: 0, n: 0, c: 0, b: 0, x: 0 };
    const stavUs = m => {
        const s = cisloNevyslo(m.klic) && !m.data && !stavPodleKlice.get(m.klic) ? 'x' : budouci(m.klic) ? 'b' : stavPodleKlice.get(m.klic) === 'nezajima' ? 'n'
            : m.data?.cover && m.data?.centerfold && m.data?.pictorial ? 'k' : m.data ? 'p' : 'c';
        poctyUs[s]++;
        const obsah = obsahCisla(m.data);
        return [s, STAVY_US[s] + (obsah && s === 'p' ? ` · ${obsah}` : '')];
    };
    // Celá měsíční řada 1953–2020 (a případná dřívější nebo pozdější čísla ve sbírce), když sbírka nějaké US číslo má
    const odUs = Math.min(PRVNI_ROK_US, ...rokyUs), doUs = Math.min(letos, Math.max(POSLEDNI_ROK_US, ...rokyUs));
    const mapaUs = rokyUs.length ? htmlMapy(cislaEdice('US', odUs, doUs, podleKlice), stavUs) : '';
    const vydanychCz = poctyCz.m + poctyCz.s + poctyCz.n + poctyCz.c;
    const vydanychUs = poctyUs.k + poctyUs.p + poctyUs.n + poctyUs.c;

    const procentModelek = p.modelek ? Math.round(modelekUplnych / p.modelek * 100) : 100;
    const kpi = [
        ['Modelky', p.modelek, `${procentModelek} % s úplnými údaji`],
        ['Alba', p.alb, sklonovat(p.fotek, 'fotka', 'fotky', 'fotek')],
        ['Čísla US', poctyUs.k + poctyUs.p, vydanychUs ? `${poctyUs.k} kompletních z ${vydanychUs}` : 'zatím žádné'],
        ['Výtisky CZ', poctyCz.m, `z ${vydanychCz} vydaných · ${poctyCz.s} sháním`],
    ];

    const naposledy = [...modelky].filter(m => m.pridano).sort((a, b) => b.pridano.localeCompare(a.pridano)).slice(0, NAPOSLEDY);

    return `
        <div class="uvod-kpi">${kpi.map(([nazev, cislo, popis]) => `<div><span>${nazev}</span><b>${cislo.toLocaleString('cs-CZ')}</b><small>${esc(popis)}</small></div>`).join('')}</div>
        <div class="uvod-karta">
            <h4>Česká edice · moje výtisky<small>${cz[0].rok}–${letos} · klik otevře číslo, pravým tlačítkem stav</small></h4>
            ${mapaCz}
            ${legenda({ m: poctyCz.m, s: poctyCz.s, n: poctyCz.n, c: poctyCz.c }, STAVY_CZ)}
        </div>
        ${mapaUs ? `
        <div class="uvod-karta">
            <h4>Americká edice · archiv dat<small>${odUs}–${doUs} · kompletní = cover, centerfold i pictorial</small></h4>
            ${mapaUs}
            ${legenda({ k: poctyUs.k, p: poctyUs.p, n: poctyUs.n, c: poctyUs.c }, STAVY_US)}
        </div>` : ''}
        <div class="uvod-karta uvod-doplnit">
            <h4>Co zbývá doplnit<small><button type="button" class="link" data-sekce-prehledu="udrzba" data-udrzba-filtr="vse">Údržba (${kUdrzbe}) →</button></small></h4>
            ${souhrn}
        </div>
        <div class="uvod-dole">
            <div class="uvod-karta">
                <h4>Výtisky CZ po letech</h4>
                ${grafSloupcu(cz.filter(r => r.rok < letos || r.mesice.some(m => !budouci(m.klic))).map(r => {
                    const mam = r.mesice.filter(m => stavPodleKlice.get(m.klic) === 'mam').length;
                    return { hodnota: mam, popisek: r.rok % 5 === 0 ? String(r.rok) : '', tip: `${r.rok}: ${mam} z ${ciselRocniku(r.rok, 'CZ')} výtisků` };
                }), { vyska: 170 })}
            </div>
            <div class="uvod-karta" data-graf-dekad>
                <h4>Centerfoldy podle desetiletí</h4>
                <p class="stat-prazdne">Počítám…</p>
            </div>
        </div>
        <div class="uvod-karta uvod-radek">
            <h4>Naposledy přidané</h4>
            ${naposledy.length ? `<div class="uvod-naposledy">${naposledy.map(m => `
                <button type="button" data-otevrit-modelku="${m.id}"><img src="${esc(adresaTitulni(m))}" alt="" loading="lazy" draggable="false" />${esc(m.jmeno)}<small>${esc(formatDatum(m.pridano.slice(0, 10)))}</small></button>`).join('')}</div>`
                : '<p class="uvod-hotovo">Zatím žádné modelky.</p>'}
        </div>
        <div class="graf-bublina hidden"></div>`;
}

// Sháním (jen česká edice): čísla po letech, poznámka v nápovědě; seznam jde zkopírovat jako text
export function shanenaCisla(stavy) {
    return stavy.filter(s => s.stav === 'shanim' && rozlozitVydani(s.vydani)?.edice === 'CZ')
        .sort((a, b) => a.vydani.localeCompare(b.vydani));
}

export function htmlShanim(stavy) {
    const cisla = shanenaCisla(stavy);
    const podleRoku = new Map();
    cisla.forEach(s => {
        const rok = rozlozitVydani(s.vydani).rok;
        if (!podleRoku.has(rok)) podleRoku.set(rok, []);
        podleRoku.get(rok).push(s);
    });
    return `
        <h3>Sháním <span>česká edice · ${sklonovat(cisla.length, 'číslo', 'čísla', 'čísel')}</span>
            ${cisla.length ? '<button type="button" class="link stat-toggle" data-kopirovat-shanim>Kopírovat seznam</button>' : ''}</h3>
        ${cisla.length ? `<div class="uvod-karta uvod-shanim">${[...podleRoku].map(([rok, seznam]) => `
            <div class="uvod-shanim-rok"><b>${rok}</b><div>${seznam.map(s => `
                <button type="button" class="chip" data-shanim="${esc(s.vydani)}" title="${esc(nazevVydani(s.vydani) + (s.poznamka ? ` – ${s.poznamka}` : ''))}">${esc(nazevVydani(s.vydani).replace(/ \d{4}.*$/, ''))}${s.poznamka ? `<small>${esc(s.poznamka)}</small>` : ''}</button>`).join('')}</div></div>`).join('')}
        </div>` : '<p class="stat-prazdne">Žádné číslo české edice nemá stav „sháním“. Označíš ho v mapě na úvodu Přehledu pravým tlačítkem, v kalendáři nebo v „Upravit číslo…“.</p>'}`;
}

// Text seznamu k vložení do zprávy nebo poznámek (např. pro antikvariát)
export function textShanim(stavy) {
    const podleRoku = new Map();
    shanenaCisla(stavy).forEach(s => {
        const v = rozlozitVydani(s.vydani);
        if (!podleRoku.has(v.rok)) podleRoku.set(v.rok, []);
        podleRoku.get(v.rok).push(MESICE[parseInt(v.mesic) - 1].toLowerCase());
    });
    return ['Playboy CZ – sháním:', ...[...podleRoku].map(([rok, mesice]) => `${rok}: ${mesice.join(', ')}`)].join('\n');
}

// Graf centerfoldů podle desetiletí (stejný jako ve Statistikách); počítá se až po zobrazení úvodu
export function htmlGrafuDekad(s) {
    if (!s.desetileti.length) return '<p class="stat-prazdne">Zatím žádné centerfoldy.</p>';
    return grafSloupcu(s.desetileti.map(d => ({ hodnota: d.centerfoldy, popisek: `${String(d.desetileti).slice(2)}.`, tip: `${d.desetileti}–${d.desetileti + 9}: ${sklonovat(d.centerfoldy, 'centerfold', 'centerfoldy', 'centerfoldů')}` })), { vyska: 170 });
}
