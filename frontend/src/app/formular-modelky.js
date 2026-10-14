// Rychlé přidání modelky, formulář modelky a potvrzení mazání
import { jednou, oznamit } from '../ui/oznameni';
import { AddModelka, DeleteModelka, DeleteVse, SlozkaZaloh } from './backend';
import { esc, prevestVahu, prevestVysku, rozlozitMiry, sjednotit } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { searchInput } from './prvky';
import { prepnoutRezim } from './navigace';
import { nacistGalerii } from './galerie';
import { otevritDetailModelky } from './profil';
import { modelModal } from './okno';
import { neniDuplicitni } from './vyrez';

// Rychlé přidání: jen jméno, po uložení se rovnou otevře profil, kde se doplní fotky a údaje
export const quickModal = document.getElementById('quickModal');

export function otevritRychlePridani() {
    document.getElementById('quickForm').reset();
    quickModal.classList.remove('hidden');
    document.getElementById('inputQuickJmeno').focus();
}

// Pole formuláře modelky: [vlastnost modelky, id prvku, typ]
export const poleModelky = [
    ['jmeno', 'inputJmeno', 'text'],
    ['dalsiJmena', 'inputDalsiJmena', 'text'],
    ['poznamka', 'inputPoznamka', 'text'],
    ['odkazy', 'inputOdkazy', 'text'],
    ['narozeniDatum', 'inputNarozeniDatum', 'text'],
    ['narozeniMisto', 'inputNarozeniMisto', 'text'],
    ['narodnost', 'inputNarodnost', 'text'],
    ['etnicita', 'inputEtnicita', 'text'],
    ['vyskaCm', 'inputVyska', 'cislo'],
    ['vahaKg', 'inputVaha', 'cislo'],
    ['vlasyBarva', 'inputVlasy', 'text'],
    ['ociBarva', 'inputOci', 'text'],
    ['ochlupeni', 'selectOchlupeni', 'text'],
    ['tetovani', 'selectTetovani', 'cislo'],
    ['piercing', 'selectPiercing', 'cislo'],
    ['obvodHrudnikCm', 'inputHrudnik', 'cislo'],
    ['obvodPasCm', 'inputPas', 'cislo'],
    ['obvodBokyCm', 'inputBoky', 'cislo'],
    ['velikostPrsou', 'inputVelikost', 'text'],
    ['prsaTyp', 'selectPrsaTyp', 'text'],
    ['role', 'inputRole', 'text'],
    ['tags', 'inputTags', 'text'],
    ['coverId', 'inputDriveID', 'text'],
];

export function otevritModelModal(modelka, fronta = null) {
    stav.frontaDoplnovani = fronta;
    document.getElementById('modelNextBtn').classList.toggle('hidden', !fronta);
    stav.editovanaModelka = modelka;
    document.getElementById('addModelForm').reset();
    document.getElementById('modelModalTitle').textContent = modelka ? 'Upravit modelku' : 'Přidat novou modelku';
    document.querySelectorAll('#addModelForm option[data-puvodni]').forEach(o => o.remove());

    if (modelka) {
        poleModelky.forEach(([vlastnost, id, typ]) => {
            const prvek = document.getElementById(id);
            // Hodnota, kterou výběr nenabízí (typicky z importu), se do něj doplní; jinak by se zobrazila
            // jako prázdná a uložením by se smazala
            if (prvek.tagName === 'SELECT' && modelka[vlastnost] !== '' && ![...prvek.options].some(o => o.value === String(modelka[vlastnost]))) {
                prvek.add(new Option(String(modelka[vlastnost]), String(modelka[vlastnost])));
                prvek.lastElementChild.dataset.puvodni = '1';
            }
            // Výběr ano/ne/neuvedeno potřebuje i nulu, číselné pole nulu zobrazuje jako prázdné
            if (prvek.tagName === 'SELECT') prvek.value = String(modelka[vlastnost]);
            else if (typ === 'cislo') prvek.value = modelka[vlastnost] || '';
            else prvek.value = modelka[vlastnost];
        });
    }
    modelModal.classList.remove('hidden');
    ukazatZalozku(0);
    oznacitVyplneneZalozky();
    document.getElementById('inputJmeno').focus();
    naplnitNapovedu();
}

// Formulář modelky je rozdělený do záložek, aby se nemusel rolovat
export const sekceFormulare = [...document.querySelectorAll('#addModelForm .form-section')];
export const modelTabs = document.getElementById('modelTabs');

export function ukazatZalozku(index) {
    sekceFormulare.forEach((sekce, i) => sekce.classList.toggle('active', i === index));
    modelTabs.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', i === index));
    document.querySelector('#modelModal .form-body').scrollTop = 0;
}

// Tečka u záložky, ve které už je něco vyplněno
export function oznacitVyplneneZalozky() {
    sekceFormulare.forEach((sekce, i) => {
        const vyplneno = [...sekce.querySelectorAll('input, select, textarea')]
            .some(p => p.value.trim() && p.value !== '-1');
        modelTabs.children[i].classList.toggle('filled', vyplneno);
    });
}

// Našeptávání: hodnoty už zapsané u jiných modelek, doplněné o několik obvyklých
export async function naplnitNapovedu() {
    const modelky = await vsechnyModelky();
    /** @type {[string, (m: any) => string, string[]][]} */
    const seznamy = [
        ['seznamVlasy', m => m.vlasyBarva, ['Blond', 'Hnědá', 'Černá', 'Zrzavá']],
        ['seznamOci', m => m.ociBarva, ['Modrá', 'Hnědá', 'Zelená', 'Šedá']],
        ['seznamNarodnost', m => m.narodnost, []],
        ['seznamEtnicita', m => m.etnicita, []],
        ['seznamMisto', m => m.narozeniMisto, []],
        ['seznamRole', m => m.role, []],
    ];
    seznamy.forEach(([id, hodnota, obvykle]) => {
        const hodnoty = new Map();
        [...modelky.map(hodnota), ...obvykle].forEach(h => {
            if (sjednotit(h) && !hodnoty.has(sjednotit(h))) hodnoty.set(sjednotit(h), h.trim());
        });
        document.getElementById(id).innerHTML = [...hodnoty.values()]
            .sort((a, b) => a.localeCompare(b, 'cs'))
            .map(h => `<option value="${esc(h)}"></option>`).join('');
    });

    // Tagy se přidávají kliknutím, protože pole jich obsahuje víc najednou
    const tagy = new Map();
    modelky.flatMap(m => m.tags.split(',')).forEach(t => {
        if (sjednotit(t) && !tagy.has(sjednotit(t))) tagy.set(sjednotit(t), t.trim());
    });
    document.getElementById('tagyNapoveda').innerHTML = [...tagy.values()]
        .sort((a, b) => a.localeCompare(b, 'cs'))
        .map(t => `<button type="button" class="tag" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
}

export const deleteModal = document.getElementById('deleteModal');

// Potvrzovací okno pro nevratné mazání; akce se provede až po potvrzení
export function otevritDeleteModal(nadpis, text, akce, poDokonceni = () => nacistGalerii(searchInput.value)) {
    stav.potvrzenaAkce = async () => {
        if (await akce() === false) oznamit('Smazání se nepodařilo, nic se nezměnilo.');
        poDokonceni();
    };
    document.getElementById('confirmDeleteBtn').textContent = 'Smazat';
    document.getElementById('deleteModalTitle').textContent = nadpis;
    document.getElementById('deleteModalText').textContent = text;
    deleteModal.classList.remove('hidden');
}

// Obecná otázka ano/ne ve stejném okně; vrací, zda uživatel potvrdil
export function potvrdit(nadpis, text, popisTlacitka) {
    return new Promise((vyreseno) => {
        stav.potvrzenaAkce = () => { stav.zrusenaAkce = null; vyreseno(true); };
        stav.zrusenaAkce = () => vyreseno(false);
        document.getElementById('confirmDeleteBtn').textContent = popisTlacitka;
        document.getElementById('deleteModalTitle').textContent = nadpis;
        document.getElementById('deleteModalText').textContent = text;
        deleteModal.classList.remove('hidden');
    });
}

export function zavritDeleteModal() {
    stav.zrusenaAkce?.();
    stav.zrusenaAkce = null;
    stav.potvrzenaAkce = null;
    deleteModal.classList.add('hidden');
}

export function smazatModelku(modelka) {
    otevritDeleteModal(
        'Smazat modelku',
        `Opravdu smazat modelku „${modelka.jmeno}" včetně všech jejích fotek a alb? Alba sdílená s dalšími modelkami zůstanou jim. Před smazáním se uloží záloha.`,
        () => DeleteModelka(modelka.id)
    );
}

export function smazatDatabazi() {
    otevritDeleteModal(
        'Smazat celou databázi',
        `Opravdu smazat celou databázi? Odstraní se všechny modelky, jejich fotky a alba i covery. Před smazáním se uloží záloha.`,
        async () => {
            const smazano = await DeleteVse();
            if (smazano) oznamit(`Databáze smazána. Záloha před smazáním je ve složce ${await SlozkaZaloh()}`);
            return smazano;
        }
    );
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    document.getElementById('closeQuickModalBtn').onclick = () => quickModal.classList.add('hidden');

    document.getElementById('quickMoreBtn').onclick = () => {
        const jmeno = document.getElementById('inputQuickJmeno').value;
        quickModal.classList.add('hidden');
        otevritModelModal(null);
        document.getElementById('inputJmeno').value = jmeno;
        oznacitVyplneneZalozky();
    };

    document.getElementById('quickForm').onsubmit = jednou(async (e) => {
        e.preventDefault();
        const modelka = /** @type {import('../../wailsjs/go/models').main.Modelka} */ ({ jmeno: document.getElementById('inputQuickJmeno').value.trim(), tetovani: -1, piercing: -1 });
        if (!modelka.jmeno || !await neniDuplicitni(modelka)) return;
        if (!await AddModelka(modelka)) {
            oznamit('Modelku se nepodařilo uložit do databáze.');
            return;
        }
        quickModal.classList.add('hidden');

        // Nově přidaná modelka má nejvyšší ID
        const nova = (await vsechnyModelky()).reduce((a, b) => (a && a.id > b.id ? a : b), null);
        if (nova) {
            prepnoutRezim('modelky');
            otevritDetailModelky(nova);
        }
    });

    // Míry z amerických zdrojů se po opuštění pole převedou na centimetry a kilogramy
    document.getElementById('inputVyska').addEventListener('change', (e) => {
        const cm = prevestVysku(e.target.value);
        if (cm !== null) e.target.value = cm;
    });

    document.getElementById('inputVaha').addEventListener('change', (e) => {
        const kg = prevestVahu(e.target.value);
        if (kg !== null) e.target.value = kg;
    });

    // „34B-24-34" vložené do hrudníku nebo velikosti prsou vyplní všechny tři obvody i velikost
    ['inputHrudnik', 'inputVelikost'].forEach(id => document.getElementById(id).addEventListener('change', (e) => {
        const miry = rozlozitMiry(e.target.value);
        if (!miry) return;
        document.getElementById('inputHrudnik').value = miry.hrudnik;
        document.getElementById('inputPas').value = miry.pas;
        document.getElementById('inputBoky').value = miry.boky;
        if (miry.velikost) document.getElementById('inputVelikost').value = miry.velikost;
        else if (id === 'inputVelikost') document.getElementById('inputVelikost').value = '';
        oznacitVyplneneZalozky();
    }));

    modelTabs.innerHTML = sekceFormulare.map((sekce, i) =>
        `<button type="button" data-zalozka="${i}">${esc(sekce.querySelector('h4').textContent)}<i></i></button>`).join('');

    modelTabs.addEventListener('click', (e) => {
        const zalozka = e.target.closest('[data-zalozka]');
        if (zalozka) ukazatZalozku(parseInt(zalozka.dataset.zalozka));
    });

    document.getElementById('addModelForm').addEventListener('input', oznacitVyplneneZalozky);

    document.getElementById('tagyNapoveda').addEventListener('click', (e) => {
        const tag = e.target.closest('[data-tag]')?.dataset.tag;
        if (!tag) return;
        const pole = document.getElementById('inputTags');
        const soucasne = pole.value.split(',').map(t => t.trim()).filter(Boolean);
        if (!soucasne.some(t => sjednotit(t) === sjednotit(tag))) soucasne.push(tag);
        pole.value = soucasne.join(', ');
    });

    document.getElementById('closeDeleteModalBtn').onclick = zavritDeleteModal;

    document.getElementById('cancelDeleteBtn').onclick = zavritDeleteModal;

    document.getElementById('confirmDeleteBtn').onclick = jednou(async () => {
        if (!stav.potvrzenaAkce) return;
        // Potvrzeno: zavření okna už nesmí akci ohlásit jako zrušenou
        const akce = stav.potvrzenaAkce;
        stav.zrusenaAkce = null;
        await akce();
        zavritDeleteModal();
    });
}
