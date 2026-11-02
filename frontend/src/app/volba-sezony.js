// Volba sezóny na jejím začátku (oblibenost_volba.go): tři navržená témata s ukázkovými fotkami, Klasická,
// 🎲 los z ostatních platných témat a „Jiné téma“; pod nimi délka 7–30 dní s doporučením podle soutěžících,
// fotek tématu a tempa soubojů. Otevře se samo, dokud sezóna nemá potvrzenou volbu (po vyhlášení minulé nebo
// při spuštění); „Později“ ji pro tuto sezónu odloží (zvolit jde i tlačítkem v Síni slávy).
import { GetNahledyTematu, GetNavrhSezony, GetSezona, GetTemataKOdemceni, SetObdobiSezony } from './backend';
import { odemknoutTema } from './galerie-hodnoceni';
import { adresaFotkyVysky } from './porovnani-pasy';
import { MESICE_GENITIV, esc, sklonovat } from '../lib/format';
import { oznamit } from '../ui/oznameni';
import { drzetFokus, otevreneOkno } from '../ui/dom';

const ODLOZENO = 'volbaSezonyOdlozena';

let okno = null;
let tikLosu = 0; // běžící animace losu (zavření ani jiná volba ji nesmí nechat doběhnout)

function zavrit() {
    clearInterval(tikLosu);
    okno?.remove();
    okno = null;
}

const odlozena = (klic) => { try { return localStorage.getItem(ODLOZENO) === klic; } catch { return false; } };
const odlozit = (klic) => { try { localStorage.setItem(ODLOZENO, klic); } catch { /* příště se zeptá znovu */ } };

// Poslední den sezóny délky dni od klíče (RRRR-MM-DD): „15. listopadu“
function konec(klic, dni) {
    const [r, m, d] = klic.split('-').map(Number);
    const x = new Date(r, m - 1, d + dni - 1);
    return `${x.getDate()}. ${MESICE_GENITIV[x.getMonth()]}`;
}

const textTempa = t => `${String(t).replace('.', ',')} za den`;

function htmlKarty(t, druh, nahledy) {
    const fotky = (t.ukazky || []).map(id => nahledy?.[id]?.[0]).filter(Boolean).slice(0, 4);
    const kolaz = fotky.length
        ? fotky.map(f => `<img src="${esc(adresaFotkyVysky(f, 240))}" alt="" data-rot="${Number(f.rotace) || 0}" draggable="false" decoding="async" />`).join('')
        : `<span class="vo-symbol" aria-hidden="true">${druh === 'los' ? '🎲' : esc(t.ikona || '✦')}</span>`;
    const popis = druh === 'los'
        ? 'Náhodné téma z ostatních, které jdou hrát'
        : druh === 'klasicka'
            ? `${sklonovat(t.soutezicich, 'modelka', 'modelky', 'modelek')} v pořadí`
            : `${sklonovat(t.soutezicich, 'soutěžící', 'soutěžící', 'soutěžících')} · ${sklonovat(t.fotek, 'fotka', 'fotky', 'fotek')}`;
    return `<button type="button" class="vo-karta ${druh}" data-vo-tema="${esc(druh === 'los' ? '#los' : t.klic)}" aria-pressed="false">
        <span class="vo-kolaz n${fotky.length}">${kolaz}${t.stitek && druh !== 'los' ? `<i class="vo-stitek ${t.stitek === 'vzácné' ? 'vzacne' : ''}" title="${esc(t.stitek === 'vzácné' ? 'Téma s málo soutěžícími – objev méně známé modelky' : 'Toto téma ještě neběželo')}">${esc(t.stitek)}</i>` : ''}</span>
        <span class="vo-text"><b>${druh === 'los' ? '🎲 Los' : `${t.ikona ? `<i class="vo-ikona" aria-hidden="true">${esc(t.ikona)}</i>` : ''}${esc(t.nazev)}`}</b>
        ${t.popis && druh !== 'los' ? `<span class="vo-afinita">${esc(t.popis)}</span>` : ''}<small>${esc(popis)}</small>
        ${druh === 'los' ? '' : `<em>doporučeno ${t.dni} dní</em>`}</span>
    </button>`;
}

function htmlOkna(n, nahledyTematu, skoro = []) {
    const jine = n.vsechna.filter(t => !n.navrhy.some(x => x.klic === t.klic));
    return `
        <div class="modal-card vo-okno" role="dialog" aria-modal="true" aria-labelledby="voNadpis">
            <p class="vs-stitek">Nová sezóna${n.den > 1 ? ` · běží ${n.den}. den` : ''}</p>
            <h2 id="voNadpis">Jaké bude téma sezóny?</h2>
            <p class="vs-popis">V tématu soutěží modelky s aspoň 6 fotkami tématu (téma jich potřebuje aspoň 8); body dávají souboje v Porovnat v režimu tématu.${n.den > 1 ? ` <b>Souboje ${n.den - 1 === 1 ? 'z prvního dne' : `z prvních ${n.den - 1} dní`} se do tematické sezóny nezapočítají.</b>` : ''}</p>
            <div class="vo-karty">
                ${n.navrhy.map(t => htmlKarty(t, 'tema', nahledyTematu(t))).join('')}
                ${htmlKarty(n.klasicka, 'klasicka', nahledyTematu(n.klasicka))}
                ${jine.some(t => t.plati) ? htmlKarty({}, 'los', null) : ''}
            </div>
            <label class="vo-jine">Jiné téma
                <select data-vo-jine>
                    <option value="">—</option>
                    ${jine.map(t => `<option value="${esc(t.klic)}" ${t.plati ? '' : 'disabled'} title="${esc(t.popis || '')}">${esc(`${t.ikona || ''} ${t.nazev}`.trim())} · ${esc(t.plati ? sklonovat(t.soutezicich, 'soutěžící', 'soutěžící', 'soutěžících') : `${t.duvod} · odemkneš v Průvodci`)}</option>`).join('')}
                </select>
            </label>
            ${skoro.length ? `<div class="vo-skoro"><small>✦ Skoro hratelná – průvodce je odemkne</small>
                ${skoro.map(t => `<button type="button" class="vo-skoro-tema" data-vo-odemknout="${esc(t.klic)}" title="${esc(`Chybí ${sklonovat(t.chybiModelek, 'modelka', 'modelky', 'modelek')} – stačí projít průvodcem asi ${sklonovat(t.fotekKOdemceni, 'fotku', 'fotky', 'fotek')}. Volba sezóny se odloží.`)}">🔓 ${esc(`${t.ikona || ''} ${t.nazev}`.trim())} <b>${esc(`chybí ${sklonovat(t.chybiModelek, 'modelka', 'modelky', 'modelek')} · ${sklonovat(t.fotekKOdemceni, 'fotka', 'fotky', 'fotek')}`)}</b></button>`).join('')}
            </div>` : ''}
            <div class="vo-delka">
                <p class="vs-stitek">Délka sezóny</p>
                <div class="vo-delky" role="radiogroup" aria-label="Délka sezóny">
                    ${(n.delky || []).map(d => `<button type="button" role="radio" class="vo-dni" data-vo-dni="${d}" aria-checked="false" ${d < n.den ? 'disabled title="Tolik dní už uplynulo"' : ''}>${d}<small>dní</small></button>`).join('')}
                </div>
                <p class="vs-popis" data-vo-odhad></p>
            </div>
            <div class="vs-pata">
                <span class="vs-popis">Téma i délku vybíráš jednou na začátku sezóny.</span>
                <span><button type="button" class="btn btn-secondary" data-vo-pozdeji>Později</button>
                <button type="button" class="btn btn-primary" data-vo-zacit disabled>Začít sezónu</button></span>
            </div>
        </div>`;
}

// Okno volby; auto = samo (po vyhlášení, při spuštění): neotevře se u zvolené nebo odložené sezóny
export async function zvolitSezonu({ auto = false } = {}) {
    if (okno) return;
    let sezona;
    let n;
    let skoro = [];
    try {
        [sezona, n, skoro] = await Promise.all([GetSezona(), GetNavrhSezony(), GetTemataKOdemceni().catch(() => [])]);
    } catch { return; }
    if (!n?.klic || okno || otevreneOkno() || (auto && (sezona?.zvoleno || sezona?.kUzavreni || odlozena(n.klic)))) return;
    const vsechna = [...n.navrhy, n.klasicka];
    // Ukázkové fotky každého tématu zvlášť (jen fotky tématu)
    const nahledy = {};
    await Promise.all(vsechna.map(t => (t.ukazky?.length ? GetNahledyTematu(t.ukazky, 1, t.klic).then((x) => {
        (t.ukazky || []).forEach((id) => { nahledy[`${t.klic}|${id}`] = x?.[id] || []; });
    }).catch(() => {}) : null)));
    if (okno || otevreneOkno()) return;
    const nahledyTematu = t => Object.fromEntries((t.ukazky || []).map(id => [id, nahledy[`${t.klic}|${id}`]]));
    okno = document.createElement('div');
    okno.className = 'modal-overlay vs-zavoj';
    okno.innerHTML = htmlOkna(n, nahledyTematu, (skoro || []).slice(0, 3));
    document.getElementById('app').append(okno);

    let tema = null; // vybrané téma (objekt z návrhu)
    let dni = 0;
    let rucne = false; // délku uživatel změnil sám
    const najit = klic => n.vsechna.find(t => t.klic === klic) || (klic === '' ? n.klasicka : null);
    const vykreslit = () => {
        if (!okno) return;
        okno.querySelectorAll('[data-vo-tema]').forEach((k) => {
            const el = /** @type {HTMLElement} */ (k);
            const on = tema && (el.dataset.voTema === tema.klic || (el.dataset.voTema === '#los' && tema.los));
            el.classList.toggle('on', Boolean(on));
            el.setAttribute('aria-pressed', String(Boolean(on)));
        });
        okno.querySelectorAll('[data-vo-dni]').forEach((b) => {
            const el = /** @type {HTMLElement} */ (b);
            const d = Number(el.dataset.voDni);
            el.classList.toggle('on', d === dni);
            el.classList.toggle('doporuceno', Boolean(tema) && d === tema.dni);
            el.setAttribute('aria-checked', String(d === dni));
        });
        const odhad = okno.querySelector('[data-vo-odhad]');
        odhad.innerHTML = tema
            ? `${esc(tema.nazev)}: potřeba zhruba ${esc(sklonovat(tema.souboju, 'souboj', 'souboje', 'soubojů'))}, tvoje tempo ${esc(textTempa(n.tempo))} → doporučeno <b>${tema.dni} dní</b>${tema.duvod ? ` (${esc(tema.duvod)})` : ''}${dni ? ` · sezóna skončí ${esc(konec(n.klic, dni))}` : ''}`
            : 'Vyber téma – délka se doporučí podle počtu soutěžících, fotek tématu a tvého tempa soubojů.';
        /** @type {HTMLButtonElement} */ (okno.querySelector('[data-vo-zacit]')).disabled = !tema || !dni;
    };
    const vybrat = (t, zLosu = false) => {
        if (!zLosu) clearInterval(tikLosu);
        tema = t;
        if (!rucne || dni < n.den) dni = Math.max(t.dni, n.delky.find(d => d >= n.den) || t.dni);
        vykreslit();
    };
    const losovat = () => {
        const moznosti = n.vsechna.filter(t => t.plati && !n.navrhy.some(x => x.klic === t.klic));
        if (!moznosti.length) return;
        const karta = okno.querySelector('[data-vo-tema="#los"]');
        const t = { ...moznosti[Math.floor(Math.random() * moznosti.length)], los: true };
        const text = karta?.querySelector('.vo-text b');
        text?.setAttribute('aria-live', 'polite');
        let i = 0;
        clearInterval(tikLosu);
        tikLosu = setInterval(() => {
            if (!okno) return clearInterval(tikLosu);
            if (text) text.textContent = moznosti[i++ % moznosti.length].nazev;
            if (i > 9) {
                clearInterval(tikLosu);
                if (text) text.textContent = `🎲 ${t.nazev}`;
                karta?.querySelector('small')?.replaceChildren(`${sklonovat(t.soutezicich, 'soutěžící', 'soutěžící', 'soutěžících')} · ${sklonovat(t.fotek, 'fotka', 'fotky', 'fotek')}`);
                karta?.querySelector('.vo-text')?.insertAdjacentHTML('beforeend', `<em>doporučeno ${t.dni} dní</em>`);
                karta?.querySelector('.vo-afinita')?.remove();
                if (t.popis) karta?.querySelector('small')?.insertAdjacentHTML('beforebegin', `<span class="vo-afinita">${esc(t.popis)}</span>`);
                karta?.querySelector('.vo-text em + em')?.previousElementSibling?.remove();
                vybrat(t, true);
            }
        }, 70);
    };
    okno.addEventListener('click', async (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const karta = /** @type {HTMLElement | null} */ (cil.closest('[data-vo-tema]'));
        const delka = /** @type {HTMLButtonElement | null} */ (cil.closest('[data-vo-dni]'));
        if (karta) {
            /** @type {HTMLSelectElement} */ (okno.querySelector('[data-vo-jine]')).value = '';
            if (karta.dataset.voTema === '#los') losovat();
            else vybrat(najit(karta.dataset.voTema));
        } else if (delka && !delka.disabled) {
            dni = Number(delka.dataset.voDni);
            rucne = true;
            vykreslit();
        } else if (cil.closest('[data-vo-odemknout]')) {
            odlozit(n.klic);
            zavrit();
            odemknoutTema(/** @type {HTMLElement} */ (cil.closest('[data-vo-odemknout]')).dataset.voOdemknout);
        } else if (cil.closest('[data-vo-pozdeji]')) {
            // Klik mimo okno volbu neodkládá (snadno se klikne omylem) – jen Později nebo Esc
            odlozit(n.klic);
            zavrit();
        } else if (cil.closest('[data-vo-zacit]') && tema && dni) {
            const tlacitko = /** @type {HTMLButtonElement} */ (cil.closest('[data-vo-zacit]'));
            if (tlacitko.disabled) return;
            tlacitko.disabled = true; // dvojklik nezapíše dvakrát
            let ok = false;
            try { ok = await SetObdobiSezony(n.klic, tema.klic, dni); } catch { ok = false; }
            if (!ok) {
                tlacitko.disabled = false;
                return oznamit('Sezónu se nepodařilo nastavit.');
            }
            zavrit();
            oznamit(`Sezóna ${tema.klic ? `„${tema.nazev}“` : 'Klasická'} začala – potrvá ${dni} dní, do ${konec(n.klic, dni)}.`);
            document.dispatchEvent(new CustomEvent('sezona-zvolena'));
        }
    });
    okno.querySelector('[data-vo-jine]').addEventListener('change', (e) => {
        // „—“ = nic nevybírat (ne Klasická)
        const hodnota = /** @type {HTMLSelectElement} */ (e.target).value;
        const t = hodnota ? najit(hodnota) : null;
        if (t) vybrat(t);
    });
    okno.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        odlozit(n.klic);
        zavrit();
    });
    vykreslit();
    drzetFokus(okno);
    /** @type {HTMLElement | null} */ (okno.querySelector('[data-vo-tema]'))?.focus();
}
