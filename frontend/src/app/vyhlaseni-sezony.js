// Vyhlášení skončené sezóny (oblibenost_sezony.go): při spuštění programu, nebo tlačítkem v Síni slávy › Sezóna,
// když sezóna skončila a ještě není uzavřená. Okno ukáže Favoritku sezóny se stupni 1–3 a nabídne volbu Miláčka
// sezóny (nepovinnou). „Uzavřít sezónu“ ji zapíše (kronika, odznak), „Později“ okno zavře a zeptá se příště.
// Když není co vyhlásit, nabídne volbu tématu probíhající sezóny (volba-sezony.js).
import { GetSezona, UzavritSezonu } from './backend';
import { esc, sklonovat } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { adresaTitulni } from './obrazky';
import { stylVyrezu } from './navigace';
import { oznamit } from '../ui/oznameni';
import { otevreneOkno } from '../ui/dom';
import { zvolitSezonu } from './volba-sezony';

let okno = null;

function zavrit() {
    okno?.remove();
    okno = null;
}

function htmlOkna(u, modelky) {
    const m = id => modelky.get(id);
    const prvni = u.poradi[0];
    const f = m(prvni.modelkaId);
    const stupen = (b) => {
        const x = m(b.modelkaId);
        // Fotka v rámečku, který ořízne uložený výřez (zvětšení) – jinak by přetekla přes okno
        return x ? `<div class="vs-stupen misto-${b.misto} ${b.misto === 1 ? 'prvni' : ''}">
            <span class="vs-foto"><img src="${esc(adresaTitulni(x))}" alt="" style="${stylVyrezu(x)}" draggable="false" />${b.misto === 1 ? '<i class="vs-koruna" aria-hidden="true">♛</i>' : ''}</span>
            <div><b>${b.misto === 1 ? '♛ ' : ''}${b.misto}. ${esc(x.jmeno.split(' ')[0])}</b>${b.body} b.</div></div>` : '';
    };
    const trun = [2, 1, 3].map(misto => u.poradi.find(b => b.misto === misto)).filter(Boolean).map(stupen).join('');
    const kandidatky = u.poradi.slice(1).filter(b => m(b.modelkaId)).map(b => {
        const x = m(b.modelkaId);
        return `<button type="button" class="vs-volba" data-milacek="${x.id}" aria-pressed="false"><span class="vs-avatar"><img src="${esc(adresaTitulni(x))}" alt="" style="${stylVyrezu(x)}" draggable="false" /></span>${esc(x.jmeno.split(' ')[0])} <small>${b.misto}.</small></button>`;
    }).join('');
    return `
        <div class="modal-card vs-okno" role="dialog" aria-modal="true" aria-labelledby="vsNadpis">
            <p class="vs-stitek">Sezóna ${esc(u.nazev)} skončila${u.nazev !== u.obdobi ? ` <small>${esc(u.obdobi)}</small>` : ''}</p>
            <h2 id="vsNadpis">♛ Favoritkou sezóny je ${esc(f?.jmeno || 'modelka')}</h2>
            <p class="vs-popis">${prvni.body} b. · ${esc(sklonovat(prvni.vyhry, 'výhra', 'výhry', 'výher'))} z ${esc(sklonovat(prvni.souboju, 'souboje', 'soubojů', 'soubojů'))} · v sezóně ${esc(sklonovat(u.souboju, 'souboj', 'souboje', 'soubojů'))}</p>
            <div class="vs-stupne">${trun}</div>
            ${kandidatky ? `<p class="vs-stitek">♥ Miláček sezóny – tvoje volba (nepovinné)</p>
            <p class="vs-popis">Modelka, která tě v sezóně nejvíc potěšila, i když bodově nevyhrála.</p>
            <div class="vs-milacek">${kandidatky}</div>` : ''}
            <div class="vs-pata">
                <span class="vs-popis">Další sezóna už běží – body se počítají od jejího prvního dne.</span>
                <span><button type="button" class="btn btn-secondary" data-vs-pozdeji>Později</button>
                <button type="button" class="btn btn-primary" data-vs-uzavrit>Uzavřít sezónu</button></span>
            </div>
        </div>`;
}

export async function vyhlasitSezonu(u = null) {
    if (okno) return;
    let k = u;
    if (!k) {
        try { k = (await GetSezona())?.kUzavreni; } catch { return; }
    }
    // Nic k vyhlášení: při spuštění a po uzavření poslední nabídne volbu tématu probíhající sezóny
    if (!k?.poradi?.length) return u ? undefined : zvolitSezonu({ auto: true });
    if (okno || otevreneOkno()) return;
    let modelky;
    try { modelky = new Map((await vsechnyModelky()).map(x => [x.id, x])); } catch { return; }
    // Kontrola znovu po načtení: mezitím mohlo okno otevřít jiné volání (spuštění i tlačítko v Síni)
    if (okno || otevreneOkno()) return;
    okno = document.createElement('div');
    okno.className = 'modal-overlay vs-zavoj';
    okno.innerHTML = htmlOkna(k, modelky);
    document.getElementById('app').append(okno);
    let milacek = 0;
    okno.addEventListener('click', async (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const volba = /** @type {HTMLElement | null} */ (cil.closest('[data-milacek]'));
        if (volba) {
            const id = Number(volba.dataset.milacek);
            milacek = milacek === id ? 0 : id;
            okno.querySelectorAll('[data-milacek]').forEach(b => {
                const on = Number(/** @type {HTMLElement} */ (b).dataset.milacek) === milacek;
                b.classList.toggle('on', on);
                b.setAttribute('aria-pressed', String(on));
            });
        } else if (cil.closest('[data-vs-pozdeji]')) {
            // Klik mimo okno vyhlášení nezavírá (snadno se klikne omylem) – jen Později nebo Esc
            zavrit();
        } else if (cil.closest('[data-vs-uzavrit]')) {
            const tlacitko = /** @type {HTMLButtonElement} */ (cil.closest('[data-vs-uzavrit]'));
            if (tlacitko.disabled) return;
            tlacitko.disabled = true; // dvojklik neuzavře dvakrát
            let ok = false;
            try { ok = await UzavritSezonu(k.klic, milacek); } catch { ok = false; }
            zavrit();
            if (!ok) return oznamit('Sezónu se nepodařilo uzavřít.');
            oznamit(`Sezóna ${k.nazev} je uzavřená a zapsaná do kroniky.`);
            document.dispatchEvent(new CustomEvent('sezona-uzavrena'));
            // Další skončená neuzavřená sezóna (po delší pauze)
            vyhlasitSezonu();
        }
    });
    okno.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        zavrit();
    });
    /** @type {HTMLElement | null} */ (okno.querySelector('[data-vs-uzavrit]'))?.focus();
}
