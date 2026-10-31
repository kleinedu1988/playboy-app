// Vyhlášení skončené sezóny (oblibenost_sezony.go): při spuštění programu, nebo tlačítkem v Síni slávy › Sezóna,
// když sezóna skončila a ještě není uzavřená. Okno ukáže Favoritku sezóny se stupni 1–3 a nabídne volbu Miláčka
// sezóny (nepovinnou). „Uzavřít sezónu“ ji zapíše (kronika, odznak), „Později“ okno zavře a zeptá se příště.
import { GetSezona, UzavritSezonu } from './backend';
import { esc, sklonovat } from '../lib/format';
import { nazevSezony } from '../lib/slava';
import { vsechnyModelky } from './mezipamet';
import { adresaTitulni } from './obrazky';
import { stylVyrezu } from './navigace';
import { oznamit } from '../ui/oznameni';
import { otevreneOkno } from '../ui/dom';

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
        return x ? `<div class="vs-stupen ${b.misto === 1 ? 'prvni' : ''}">
            <img src="${esc(adresaTitulni(x))}" alt="" style="${stylVyrezu(x)}" draggable="false" />
            <div><b>${b.misto === 1 ? '♛ ' : ''}${b.misto}. ${esc(x.jmeno.split(' ')[0])}</b>${b.body} b.</div></div>` : '';
    };
    const trun = [2, 1, 3].map(misto => u.poradi.find(b => b.misto === misto)).filter(Boolean).map(stupen).join('');
    const kandidatky = u.poradi.slice(1).filter(b => m(b.modelkaId)).map(b => {
        const x = m(b.modelkaId);
        return `<button type="button" class="vs-volba" data-milacek="${x.id}" aria-pressed="false"><img src="${esc(adresaTitulni(x))}" alt="" style="${stylVyrezu(x)}" draggable="false" />${esc(x.jmeno.split(' ')[0])} <small>${b.misto}.</small></button>`;
    }).join('');
    return `
        <div class="modal-card vs-okno" role="dialog" aria-modal="true" aria-labelledby="vsNadpis">
            <p class="vs-stitek">Sezóna ${esc(nazevSezony(u.mesic))} skončila</p>
            <h2 id="vsNadpis">♛ Favoritkou sezóny je ${esc(f?.jmeno || 'modelka')}</h2>
            <p class="vs-popis">${prvni.body} b. · ${esc(sklonovat(prvni.vyhry, 'výhra', 'výhry', 'výher'))} z ${esc(sklonovat(prvni.souboju, 'souboje', 'soubojů', 'soubojů'))} · v sezóně ${esc(sklonovat(u.souboju, 'souboj', 'souboje', 'soubojů'))}</p>
            <div class="vs-stupne">${trun}</div>
            ${kandidatky ? `<p class="vs-stitek">♥ Miláček sezóny – tvoje volba (nepovinné)</p>
            <p class="vs-popis">Modelka, která tě v sezóně nejvíc potěšila, i když bodově nevyhrála.</p>
            <div class="vs-milacek">${kandidatky}</div>` : ''}
            <div class="vs-pata">
                <span class="vs-popis">Další sezóna už běží – body se počítají od 1. dne měsíce.</span>
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
    if (!k?.poradi?.length || okno || otevreneOkno()) return;
    const modelky = new Map((await vsechnyModelky()).map(x => [x.id, x]));
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
        } else if (cil.closest('[data-vs-pozdeji]') || cil === okno) {
            zavrit();
        } else if (cil.closest('[data-vs-uzavrit]')) {
            const ok = await UzavritSezonu(k.mesic, milacek);
            zavrit();
            if (!ok) return oznamit('Sezónu se nepodařilo uzavřít.');
            oznamit(`Sezóna ${nazevSezony(k.mesic)} je uzavřená a zapsaná do kroniky.`);
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
