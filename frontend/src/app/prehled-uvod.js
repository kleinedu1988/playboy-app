// Mapa čísel Sbírky (dřív Úvod): mapa české edice (vlastní výtisky), mapa americké edice (úplnost dat) a naposledy
// přidané modelky. Česká edice se sbírá fyzicky, americká jen jako data (PDF),
// proto má každá mapa jiné stavy. Políčko je jedno měsíční číslo; klik ho otevře, prázdné nabídne přidání.
import { MESICE, RADY_EDIC, VYCHOZI_EDICE, cisloNevyslo, esc, formatDatum, nazevVydani, rozlozitVydani, sklonovat, slozitVydani } from '../lib/format';
import { adresaTitulni } from './obrazky';

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
    let prvni = true;
    const dekady = new Map();
    roky.forEach(r => {
        const dekada = Math.floor(r.rok / 10) * 10;
        if (!dekady.has(dekada)) dekady.set(dekada, []);
        dekady.get(dekada).push(r);
    });
    return `<div class="uvod-mapa">${[...dekady].map(([dekada, rokyDekady]) => `
        <div class="uvod-dekada"><h5>${dekada}–${dekada + 9}</h5>
            ${rokyDekady.map(r => `<div class="uvod-rok"><span>${rozlozitVydani(r.mesice[0]?.klic)?.edice === VYCHOZI_EDICE
                ? `<button type="button" class="uvod-rok-wiki" data-rocnik-wiki="${r.rok}" title="Ročník ${r.rok} podle Wikipedie…">${r.rok}</button>` : r.rok}</span>${r.mesice.map(m => {
                const [stavPole, popis] = stavCisla(m);
                // Měsíc před prvním číslem edice (x) není číslo, nedá se otevřít ani označit
                // Do mapy vede Tab jen jednou (první číslo), dál se chodí šipkami
                const tab = prvni ? 0 : -1;
                if (stavPole !== 'x') prvni = false;
                return stavPole === 'x' ? `<i class="x" tabindex="-1" title="${esc(`${nazevVydani(m.klic)} – ${popis}`)}"></i>`
                    : `<i class="${stavPole}" data-cislo="${esc(m.klic)}" ${m.data ? 'data-ma-data' : ''} tabindex="${tab}" aria-label="${esc(`${nazevVydani(m.klic)} – ${popis}`)}" title="${esc(`${nazevVydani(m.klic)} – ${popis}`)}"></i>`;
            }).join('')}</div>`).join('')}
        </div>`).join('')}</div>`;
}

const legenda = (pocty, nazvy) => `<div class="uvod-legenda">${Object.entries(pocty).filter(([, n]) => n).map(([s, n]) =>
    `<span><i class="${s}"></i>${nazvy[s]} ${n}</span>`).join('')}</div>`;

// Mapa čísel Sbírky (dřív Úvod): mapy výtisků CZ a archivu US a naposledy přidané modelky; čísla sbírky a pokrok
// jsou v hlavičce Sbírky (udrzba.js). kalendar = GetKalendar, stavy = GetStavyVydani
export function htmlUvodu({ kalendar, stavy, modelky }) {
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


    const naposledy = [...modelky].filter(m => m.pridano).sort((a, b) => b.pridano.localeCompare(a.pridano)).slice(0, NAPOSLEDY);

    return `
        <div class="uvod-karta">
            <h4>Česká edice · moje výtisky<small>${esc(`${poctyCz.m} z ${vydanychCz} vydaných · sháním ${poctyCz.s}`)} · ${cz[0].rok}–${letos} · klik otevře číslo, pravým tlačítkem stav</small></h4>
            ${mapaCz}
            ${legenda({ m: poctyCz.m, s: poctyCz.s, n: poctyCz.n, c: poctyCz.c }, STAVY_CZ)}
        </div>
        ${mapaUs ? `
        <div class="uvod-karta">
            <h4>Americká edice · archiv dat<small>${esc(`kompletních ${poctyUs.k} z ${vydanychUs}`)} · ${odUs}–${doUs} · kompletní = cover, centerfold i pictorial</small></h4>
            ${mapaUs}
            ${legenda({ k: poctyUs.k, p: poctyUs.p, n: poctyUs.n, c: poctyUs.c }, STAVY_US)}
        </div>` : ''}
        <div class="uvod-karta uvod-radek cv-prehled" data-cv-prehled hidden></div>
        <div class="uvod-karta uvod-radek">
            <h4>Naposledy přidané</h4>
            ${naposledy.length ? `<div class="uvod-naposledy">${naposledy.map(m => `
                <button type="button" data-otevrit-modelku="${m.id}"><img src="${esc(adresaTitulni(m))}" alt="" loading="lazy" draggable="false" />${esc(m.jmeno)}<small>${esc(formatDatum(m.pridano.slice(0, 10)))}</small></button>`).join('')}</div>`
                : '<p class="prazdno-male">Zatím žádné modelky.</p>'}
        </div>
        <div class="graf-bublina hidden"></div>`;
}

// Sháněná čísla, ve kterých je modelka z pořadí oblíbenosti, od nejoblíbenější: [{ cislo, modelka }]
export function prioritaShanim(cisla, modelky) {
    const nejlepsi = new Map();
    for (const m of modelky) {
        if (!(m.poradi > 0)) continue;
        for (const v of new Set([...(m.vydani || []), ...(m.obalky || [])])) {
            if (!nejlepsi.has(v) || m.poradi < nejlepsi.get(v).poradi) nejlepsi.set(v, m);
        }
    }
    return cisla.filter(s => nejlepsi.has(s.vydani)).map(s => ({ cislo: s, modelka: nejlepsi.get(s.vydani) }))
        .sort((a, b) => a.modelka.poradi - b.modelka.poradi);
}

// Sháním (jen česká edice): čísla po letech, poznámka v nápovědě; seznam jde zkopírovat jako text
export function shanenaCisla(stavy) {
    return stavy.filter(s => s.stav === 'shanim' && rozlozitVydani(s.vydani)?.edice === 'CZ')
        .sort((a, b) => a.vydani.localeCompare(b.vydani));
}

export function htmlShanim(stavy, modelky = []) {
    const cisla = shanenaCisla(stavy);
    const priorita = prioritaShanim(cisla, modelky).slice(0, 6);
    const podleRoku = new Map();
    cisla.forEach(s => {
        const rok = rozlozitVydani(s.vydani).rok;
        if (!podleRoku.has(rok)) podleRoku.set(rok, []);
        podleRoku.get(rok).push(s);
    });
    return `
        <div class="volby-v-liste" data-volby-casti="shanim">${cisla.length ? '<button type="button" data-kopirovat-shanim>Kopírovat seznam</button>' : ''}<span>${esc(sklonovat(cisla.length, 'číslo', 'čísla', 'čísel'))} české edice</span></div>
        ${priorita.length ? `<div class="uvod-karta uvod-shanim uvod-shanim-napred"><h4>Nejdřív sháněj<small>čísla s tvými nejoblíbenějšími modelkami</small></h4><div>${priorita.map(({ cislo, modelka }) => `
            <button type="button" class="chip" data-shanim="${esc(cislo.vydani)}" title="${esc(`${nazevVydani(cislo.vydani)} – ${modelka.jmeno}, ${modelka.poradi}. v oblíbenosti`)}">${esc(nazevVydani(cislo.vydani))}<small>${esc(modelka.jmeno)} · ${modelka.poradi}.</small></button>`).join('')}</div></div>` : ''}
        ${cisla.length ? `<div class="uvod-karta uvod-shanim">${[...podleRoku].map(([rok, seznam]) => `
            <div class="uvod-shanim-rok"><b>${rok}</b><div>${seznam.map(s => `
                <button type="button" class="chip" data-shanim="${esc(s.vydani)}" title="${esc(nazevVydani(s.vydani) + (s.poznamka ? ` – ${s.poznamka}` : ''))}">${esc(nazevVydani(s.vydani).replace(/ \d{4}.*$/, ''))}${s.poznamka ? `<small>${esc(s.poznamka)}</small>` : ''}</button>`).join('')}</div></div>`).join('')}
        </div>` : '<p class="uvod-shanim-nic"><b>Nic nesháníš.</b> Číslo označíš jako sháněné pravým tlačítkem v mapě níže, v kalendáři nebo v „Upravit číslo…“.</p>'}`;
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
