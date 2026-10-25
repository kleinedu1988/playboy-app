// Rychlé přidání modelky, formulář modelky a potvrzení mazání
import { jednou, oznamit } from '../ui/oznameni';
import { AddModelka, DeleteModelka, DeleteVse, SlozkaZaloh } from './backend';
import { esc, formatDatum, formatMarkdown, odvozeneKategorie, platneDatum, prevestVahu, prevestVysku, rozlozitMiry, sjednotit, sklonovat } from '../lib/format';
import { pripojitVyberKategorii } from '../ui/kategorie';
import { upravitText } from '../ui/editor-textu';
import { nastavitHtml, nastavitText } from '../ui/dom';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { searchInput } from './prvky';
import { prepnoutRezim } from './navigace';
import { nacistGalerii } from './galerie';
import { otevritDetailModelky } from './profil';
import { modelModal } from './okno';
import { neniDuplicitni } from './vyrez';
import { SKUPINY_UDAJU } from './prehled';

// Rychlé přidání: jen jméno, po uložení se rovnou otevře profil, kde se doplní fotky a údaje
export const quickModal = document.getElementById('quickModal');

// Modelky sbírky pro živou kontrolu jména (načtou se při otevření okna)
let modelkySbirky = [];

export function otevritRychlePridani() {
    document.getElementById('quickForm').reset();
    document.getElementById('quickJmenoInfo').textContent = '';
    quickModal.classList.remove('hidden');
    document.getElementById('inputQuickJmeno').focus();
    vsechnyModelky().then(m => { modelkySbirky = m; });
}

// Modelka sbírky se stejným jménem nebo pseudonymem (stejné porovnání jako při ukládání, viz vyrez.js)
function stejnaModelka(jmeno, dalsiJmena = '', bezId = 0) {
    const jmena = (j, d) => [j, ...(d || '').split(',')].map(sjednotit).filter(Boolean);
    const hledana = jmena(jmeno, dalsiJmena);
    if (!hledana.length) return null;
    return modelkySbirky.find(m => m.id !== bezId && jmena(m.jmeno, m.dalsiJmena).some(j => hledana.includes(j))) || null;
}

const textStejne = m => m ? `Ve sbírce už je „${m.jmeno}“ se stejným jménem nebo pseudonymem.` : '';

// Pole formuláře modelky: [vlastnost modelky, id prvku, typ]
export const poleModelky = [
    ['jmeno', 'inputJmeno', 'text'],
    ['dalsiJmena', 'inputDalsiJmena', 'text'],
    ['poznamka', 'inputPoznamka', 'text'],
    ['odkazy', 'inputOdkazy', 'text'],
    ['narozeniDatum', 'inputNarozeniDatum', 'text'],
    ['umrtiDatum', 'inputUmrtiDatum', 'text'],
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

// Kategorie modelky: štítky nad skrytým polem role
const vyberKategorii = pripojitVyberKategorii(/** @type {HTMLInputElement} */ (document.getElementById('inputRole')), document.getElementById('kategorieVyber'));

// Kurzor do pole formuláře; kategorie nemají textové pole, fokus dostane první štítek, poznámka náhled textu
export function zameritPole(id) {
    const prvek = id === 'inputRole' ? document.querySelector('#kategorieVyber .chip')
        : id === 'inputPoznamka' ? document.getElementById('modelPoznamkaBtn') : document.getElementById(id);
    /** @type {HTMLElement} */ (prvek)?.focus();
}

// Hodnota vložená do pole otevřeného formuláře (návrh doplnění, „Upravit…“): ohlásí se jako úprava uživatele,
// takže okno ví o změně a stačí uložit. Výběr, který hodnotu nenabízí, ji dostane jako volbu navíc;
// kategorie se přidají ke štítkům.
export function predvyplnitPole(id, hodnota) {
    const prvek = document.getElementById(id);
    if (!prvek) return;
    if (prvek.tagName === 'SELECT' && ![...prvek.options].some(o => o.value === hodnota)) {
        prvek.add(new Option(hodnota, hodnota));
        prvek.lastElementChild.dataset.puvodni = '1';
    }
    prvek.value = id === 'inputRole' ? [prvek.value, hodnota].filter(Boolean).join(', ') : hodnota;
    if (id === 'inputRole') vyberKategorii.obnovit(odvozeneKategorie(stav.editovanaModelka || {}));
    prvek.dispatchEvent(new Event('input', { bubbles: true }));
    prvek.dispatchEvent(new Event('change', { bubbles: true }));
    // Krátké zvýraznění, kam se hodnota vložila
    const pole = prvek.closest('.form-group') || prvek;
    pole.classList.remove('predvyplneno');
    void pole.offsetWidth;
    pole.classList.add('predvyplneno');
}

export function otevritModelModal(modelka, fronta = null) {
    stav.frontaDoplnovani = fronta;
    document.getElementById('modelNextBtn').classList.toggle('hidden', !fronta);
    stav.editovanaModelka = modelka;
    document.getElementById('addModelForm').reset();
    document.getElementById('modelModalTitle').textContent = modelka ? 'Upravit modelku' : 'Přidat novou modelku';
    document.getElementById('modelUlozitBtn').textContent = modelka ? 'Uložit změny' : 'Přidat modelku';
    document.querySelector('#modelModal .modelka-zkratka').textContent = fronta ? 'Ctrl+Enter uloží a otevře další' : 'Ctrl+Enter uloží';
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
    // Skryté pole formulář reset nevymaže (skrytou textareu poznámky ano)
    if (!modelka) /** @type {HTMLInputElement} */ (document.getElementById('inputRole')).value = '';
    vyberKategorii.obnovit(modelka ? odvozeneKategorie(modelka) : []);
    modelModal.classList.remove('hidden');
    ukazatZalozku(0);
    obnovitFormular();
    document.getElementById('inputJmeno').focus();
    naplnitNapovedu();
}

// Formulář je rozdělený do částí pod sebou; levý sloupec na ně skáče a ukazuje, ve které už je něco vyplněno
export const sekceFormulare = [...document.querySelectorAll('#addModelForm .form-section')];
export const modelTabs = document.getElementById('modelTabs');
const teloFormulare = /** @type {HTMLElement} */ (document.querySelector('#modelModal .form-body'));

// Zvýraznění části v levém sloupci (bez posunu)
function oznacitCast(index) {
    sekceFormulare.forEach((sekce, i) => sekce.classList.toggle('active', i === index));
    modelTabs.querySelectorAll('button').forEach((b, i) => {
        b.classList.toggle('active', i === index);
        if (i === index) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
    });
}

// „Záložka“ posune formulář na svou část
export function ukazatZalozku(index) {
    oznacitCast(index);
    teloFormulare.scrollTop = index ? teloFormulare.scrollTop + sekceFormulare[index].getBoundingClientRect().top - teloFormulare.getBoundingClientRect().top : 0;
}

// Tečka u části, ve které už je něco vyplněno
export function oznacitVyplneneZalozky() {
    sekceFormulare.forEach((sekce, i) => {
        const vyplneno = [...sekce.querySelectorAll('input, select, textarea')]
            .some(p => p.value.trim() && p.value !== '-1');
        modelTabs.children[i]?.classList.toggle('filled', vyplneno);
    });
}

const hodnota = id => /** @type {HTMLInputElement} */ (document.getElementById(id)).value.trim();

// Nápověda pod polem; chyba (neplatný tvar) je červená
function napoveda(id, text, chyba = false) {
    const prvek = document.getElementById(id);
    nastavitText(prvek, text);
    prvek.classList.toggle('chyba', chyba);
}

// Celé roky mezi dvěma daty v tvaru RRRR, RRRR-MM nebo RRRR-MM-DD (do dneška, když druhé chybí)
function rokuMezi(od, doData = '') {
    const a = od.split('-').map(Number);
    const dnes = new Date();
    const b = doData ? doData.split('-').map(Number) : [dnes.getFullYear(), dnes.getMonth() + 1, dnes.getDate()];
    let roku = b[0] - a[0];
    // Bez měsíce u některého z dat se rok neopravuje
    if (a[1] && b[1] && (b[1] < a[1] || (b[1] === a[1] && a[2] && b[2] && b[2] < a[2]))) roku--;
    return roku >= 0 && roku < 130 ? roku : null;
}

const desetinne = n => n.toFixed(1).replace('.', ',');

// Živé nápovědy pod poli: kontrola jména, tvar a věk u dat, převod amerických měr, BMI
function obnovitNapovedy() {
    napoveda('modelJmenoInfo', textStejne(stejnaModelka(hodnota('inputJmeno'), hodnota('inputDalsiJmena'), stav.editovanaModelka?.id || 0)));

    const narozeni = hodnota('inputNarozeniDatum');
    const umrti = hodnota('inputUmrtiDatum');
    const narozeniOk = narozeni && platneDatum(narozeni);
    const umrtiOk = umrti && platneDatum(umrti);
    const vek = narozeniOk && !umrti ? rokuMezi(narozeni) : null;
    if (narozeni && !narozeniOk) napoveda('modelNarozeniInfo', 'Napiš jako RRRR-MM-DD, RRRR-MM nebo RRRR', true);
    else napoveda('modelNarozeniInfo', narozeniOk ? [formatDatum(narozeni), vek !== null && `dnes ${sklonovat(vek, 'rok', 'roky', 'let')}`].filter(Boolean).join(' · ') : '');
    const vekUmrti = narozeniOk && umrtiOk ? rokuMezi(narozeni, umrti) : null;
    if (umrti && !umrtiOk) napoveda('modelUmrtiInfo', 'Napiš jako RRRR-MM-DD, RRRR-MM nebo RRRR', true);
    else if (umrtiOk && narozeniOk && umrti.slice(0, narozeni.length) < narozeni.slice(0, umrti.length)) napoveda('modelUmrtiInfo', 'Je před datem narození', true);
    else napoveda('modelUmrtiInfo', umrtiOk ? [formatDatum(umrti), vekUmrti !== null && `ve věku ${sklonovat(vekUmrti, 'rok', 'roky', 'let')}`].filter(Boolean).join(' · ') : '');

    // Americké míry se převedou po opuštění pole; do té doby nápověda ukáže, na co
    const vyska = hodnota('inputVyska');
    const vaha = hodnota('inputVaha');
    const cm = prevestVysku(vyska);
    const kg = prevestVahu(vaha);
    if (vyska && cm === null) napoveda('modelVyskaInfo', 'Napiš cm, nebo stopy a palce (5\'7")', true);
    else napoveda('modelVyskaInfo', cm && !/^\d+$/.test(vyska) ? `= ${cm} cm` : '');
    if (vaha && kg === null) napoveda('modelVahaInfo', 'Napiš kg, nebo libry (115 lbs)', true);
    else if (kg && !/^\d+$/.test(vaha)) napoveda('modelVahaInfo', `= ${kg} kg`);
    else napoveda('modelVahaInfo', cm && kg ? `BMI ${desetinne(kg / (cm / 100) ** 2)}` : '');

    const miry = rozlozitMiry(hodnota('inputHrudnik')) || rozlozitMiry(hodnota('inputVelikost'));
    napoveda('modelMiryInfo', miry ? `= ${miry.hrudnik}-${miry.pas}-${miry.boky} cm${miry.velikost ? ` · ${miry.velikost}` : ''}` : '');
}

// Náhled v levém sloupci: jak bude modelka vypadat v profilu, a kolik sledovaných údajů je vyplněno
function obnovitNahled() {
    const jmeno = hodnota('inputJmeno');
    nastavitText(document.getElementById('modelNahledJmeno'), jmeno || 'Bez jména');
    nastavitText(document.getElementById('modelNahledDalsi'), hodnota('inputDalsiJmena') ? `také ${hodnota('inputDalsiJmena')}` : '');
    const vyber = id => {
        const prvek = /** @type {HTMLSelectElement} */ (document.getElementById(id));
        return prvek.value && prvek.value !== '-1' ? prvek.selectedOptions[0]?.textContent.toLowerCase() : '';
    };
    const narozeni = hodnota('inputNarozeniDatum');
    const cm = prevestVysku(hodnota('inputVyska'));
    const kg = prevestVahu(hodnota('inputVaha'));
    const obvody = ['inputHrudnik', 'inputPas', 'inputBoky'].map(hodnota);
    const radky = [
        [narozeni && platneDatum(narozeni) && `nar. ${formatDatum(narozeni)}`, hodnota('inputNarozeniMisto')],
        [hodnota('inputUmrtiDatum') && platneDatum(hodnota('inputUmrtiDatum')) && `† ${formatDatum(hodnota('inputUmrtiDatum'))}`],
        [hodnota('inputNarodnost'), hodnota('inputEtnicita')],
        [cm && `${cm} cm`, kg && `${kg} kg`],
        [obvody.some(Boolean) && obvody.map(o => o || '?').join('-'), hodnota('inputVelikost'), vyber('selectPrsaTyp')],
        [hodnota('inputVlasy') && `vlasy ${hodnota('inputVlasy').toLowerCase()}`, hodnota('inputOci') && `oči ${hodnota('inputOci').toLowerCase()}`],
        [vyber('selectTetovani') && `tetování ${vyber('selectTetovani')}`, vyber('selectPiercing') && `piercing ${vyber('selectPiercing')}`],
    ].map(r => r.filter(Boolean).join(' · ')).filter(Boolean);
    nastavitHtml(document.getElementById('modelNahledUdaje'), radky.length
        ? radky.map(r => `<li>${esc(r)}</li>`).join('')
        : '<li class="prazdny">Údaje se ukážou, jak je budeš psát.</li>');

    // Sledované údaje jsou ty, které hlídá Údržba; kategorie se počítá i odvozená (centerfold, obálka)
    const udaje = SKUPINY_UDAJU.flatMap(s => s.udaje);
    const vyplneno = udaje.filter(([, , id]) => id === 'inputRole'
        ? hodnota(id) || document.querySelector('#kategorieVyber .chip.active')
        : hodnota(id) && hodnota(id) !== '-1').length;
    document.getElementById('modelNahledPruh').style.width = `${Math.round(vyplneno / udaje.length * 100)}%`;
    nastavitText(document.getElementById('modelNahledVyplneno'), `Vyplněno ${vyplneno} z ${udaje.length} údajů`);
}

// Náhled poznámky (klik otevře editor textu)
function obnovitPoznamku() {
    const text = hodnota('inputPoznamka');
    nastavitHtml(document.getElementById('modelPoznamkaNahled'), text ? formatMarkdown(text) : '<span class="text-nahled-prazdny">Přidat poznámku…</span>');
}

// Vše, co se odvozuje z hodnot polí; volá se při otevření a po každé změně
function obnovitFormular() {
    oznacitVyplneneZalozky();
    obnovitNapovedy();
    obnovitNahled();
    obnovitPoznamku();
    oznacitTagy();
}

// Už použité tagy pod polem: zapnutý je ten, který modelka má
function oznacitTagy() {
    const soucasne = hodnota('inputTags').split(',').map(sjednotit).filter(Boolean);
    document.querySelectorAll('#tagyNapoveda [data-tag]').forEach(b => {
        const zapnuty = soucasne.includes(sjednotit(/** @type {HTMLElement} */ (b).dataset.tag));
        b.classList.toggle('active', zapnuty);
        b.setAttribute('aria-pressed', String(zapnuty));
    });
}

// Našeptávání: hodnoty už zapsané u jiných modelek, doplněné o několik obvyklých
export async function naplnitNapovedu() {
    const modelky = await vsechnyModelky();
    modelkySbirky = modelky;
    obnovitNapovedy();
    /** @type {[string, (m: any) => string, string[]][]} */
    const seznamy = [
        ['seznamVlasy', m => m.vlasyBarva, ['Blond', 'Hnědá', 'Černá', 'Zrzavá']],
        ['seznamOci', m => m.ociBarva, ['Modrá', 'Hnědá', 'Zelená', 'Šedá']],
        ['seznamNarodnost', m => m.narodnost, []],
        ['seznamEtnicita', m => m.etnicita, []],
        ['seznamMisto', m => m.narozeniMisto, []],
    ];
    seznamy.forEach(([id, hodnota, obvykle]) => {
        const hodnoty = new Map();
        [...modelky.map(hodnota), ...obvykle].forEach(h => {
            if (sjednotit(h) && !hodnoty.has(sjednotit(h))) hodnoty.set(sjednotit(h), h.trim());
        });
        nastavitHtml(document.getElementById(id), [...hodnoty.values()]
            .sort((a, b) => a.localeCompare(b, 'cs'))
            .map(h => `<option value="${esc(h)}"></option>`).join(''));
    });

    // Tagy se přidávají kliknutím, protože pole jich obsahuje víc najednou
    const tagy = new Map();
    modelky.flatMap(m => m.tags.split(',')).forEach(t => {
        if (sjednotit(t) && !tagy.has(sjednotit(t))) tagy.set(sjednotit(t), t.trim());
    });
    nastavitHtml(document.getElementById('tagyNapoveda'), [...tagy.values()]
        .sort((a, b) => a.localeCompare(b, 'cs'))
        .map(t => `<button type="button" class="tag" data-tag="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join(''));
    oznacitTagy();
}

export const deleteModal = document.getElementById('deleteModal');

// Potvrzovací okno pro nevratné mazání; akce se provede až po potvrzení
// slovo: když je zadané, tlačítko Smazat se odemkne až po jeho napsání
// Okna mají stejné vrstvení, rozhoduje pořadí v DOM: dotaz se přesune na konec, aby byl nad oknem, ze kterého
// se ptá (článek, Doplnit modelku), a Esc i Tab patřily jemu
const navrchDeleteModal = () => deleteModal.parentElement.append(deleteModal);

export function otevritDeleteModal(nadpis, text, akce, poDokonceni = () => nacistGalerii(searchInput.value), slovo = '') {
    navrchDeleteModal();
    stav.potvrzenaAkce = async () => {
        if (await akce() === false) oznamit('Smazání se nepodařilo, nic se nezměnilo.');
        poDokonceni();
    };
    document.getElementById('confirmDeleteBtn').textContent = 'Smazat';
    // Mazání je červené a výchozí volba je Zrušit, aby ho Enter neprovedl omylem
    document.getElementById('confirmDeleteBtn').classList.add('btn-danger');
    document.getElementById('deleteModalTitle').textContent = nadpis;
    document.getElementById('deleteModalText').textContent = text;
    nastavitPotvrzovaciSlovo(slovo);
    deleteModal.classList.remove('hidden');
    document.getElementById(slovo ? 'inputDeleteSlovo' : 'cancelDeleteBtn').focus();
}

function nastavitPotvrzovaciSlovo(slovo) {
    const pole = document.getElementById('inputDeleteSlovo');
    document.getElementById('deleteSlovoGroup').classList.toggle('hidden', !slovo);
    document.getElementById('deleteSlovoLabel').textContent = `Pro potvrzení napiš ${slovo}`;
    pole.value = '';
    pole.dataset.slovo = slovo;
    document.getElementById('confirmDeleteBtn').disabled = Boolean(slovo);
}

// Obecná otázka ano/ne ve stejném okně; vrací, zda uživatel potvrdil
// nebezpecne: hlavní tlačítko je červené a výchozí volba (fokus) je Zrušit
export function potvrdit(nadpis, text, popisTlacitka, { nebezpecne = false } = {}) {
    navrchDeleteModal();
    return new Promise((vyreseno) => {
        stav.potvrzenaAkce = () => { stav.zrusenaAkce = null; vyreseno(true); };
        stav.zrusenaAkce = () => vyreseno(false);
        document.getElementById('confirmDeleteBtn').textContent = popisTlacitka;
        // Obyčejná otázka: hlavní tlačítko v barvě akcentu a s fokusem
        document.getElementById('confirmDeleteBtn').classList.toggle('btn-danger', nebezpecne);
        document.getElementById('deleteModalTitle').textContent = nadpis;
        document.getElementById('deleteModalText').textContent = text;
        nastavitPotvrzovaciSlovo('');
        deleteModal.classList.remove('hidden');
        document.getElementById(nebezpecne ? 'cancelDeleteBtn' : 'confirmDeleteBtn').focus();
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
        `Opravdu smazat modelku „${modelka.jmeno}“ včetně všech jejích fotek a alb? Alba sdílená s dalšími modelkami zůstanou jim. Před smazáním se uloží záloha.`,
        () => DeleteModelka(modelka.id)
    );
}

export async function smazatDatabazi() {
    const modelky = await vsechnyModelky();
    otevritDeleteModal(
        'Smazat celou databázi',
        `Smaže se celá sbírka: ${sklonovat(modelky.length, 'modelka', 'modelky', 'modelek')} se všemi fotkami a alby, covery, údaje čísel a výběry. Před smazáním se uloží záloha, ze které jde sbírku obnovit (⋯ → Obnovit ze zálohy).`,
        async () => {
            const smazano = await DeleteVse();
            if (smazano) oznamit(`Databáze smazána. Záloha před smazáním je ve složce ${await SlozkaZaloh()}`);
            return smazano;
        },
        () => nacistGalerii(searchInput.value),
        'SMAZAT'
    );
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    document.getElementById('closeQuickModalBtn').onclick = () => quickModal.classList.add('hidden');

    // Rychlé přidání: hned při psaní upozorní, že modelka se stejným jménem už ve sbírce je
    document.getElementById('inputQuickJmeno').addEventListener('input', (e) => {
        napoveda('quickJmenoInfo', textStejne(stejnaModelka(/** @type {HTMLInputElement} */ (e.target).value)));
    });

    document.getElementById('quickMoreBtn').onclick = () => {
        const jmeno = document.getElementById('inputQuickJmeno').value;
        quickModal.classList.add('hidden');
        otevritModelModal(null);
        const pole = /** @type {HTMLInputElement} */ (document.getElementById('inputJmeno'));
        pole.value = jmeno;
        pole.dispatchEvent(new Event('input', { bubbles: true }));
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
        obnovitFormular();
    });

    document.getElementById('inputVaha').addEventListener('change', (e) => {
        const kg = prevestVahu(e.target.value);
        if (kg !== null) e.target.value = kg;
        obnovitFormular();
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
        obnovitFormular();
    }));

    // Části formuláře v levém sloupci; tečka (i) značí vyplněnou část
    modelTabs.innerHTML = sekceFormulare.map((sekce, i) =>
        `<button type="button" data-zalozka="${i}">${esc(sekce.querySelector('h4').textContent)}<i aria-hidden="true"></i></button>`).join('');

    modelTabs.addEventListener('click', (e) => {
        const zalozka = e.target.closest('[data-zalozka]');
        if (zalozka) ukazatZalozku(parseInt(zalozka.dataset.zalozka));
    });

    // Při rolování se v levém sloupci zvýrazní část, která je nahoře (na konci formuláře poslední)
    teloFormulare.addEventListener('scroll', () => {
        const dole = teloFormulare.scrollTop + teloFormulare.clientHeight >= teloFormulare.scrollHeight - 4;
        const horni = teloFormulare.getBoundingClientRect().top + 40;
        const index = dole ? sekceFormulare.length - 1
            : Math.max(0, sekceFormulare.findLastIndex(sekce => sekce.getBoundingClientRect().top <= horni));
        oznacitCast(index);
    }, { passive: true });

    const formular = document.getElementById('addModelForm');
    formular.addEventListener('input', obnovitFormular);
    formular.addEventListener('change', obnovitFormular);

    // Ctrl+Enter uloží odkudkoli ve formuláři (i z pole Odkazy, kde Enter dělá nový řádek); ve frontě Údržby jde na další modelku
    formular.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        // Opuštění pole nejdřív převede rozepsanou míru (událost change)
        /** @type {HTMLElement} */ (document.activeElement)?.blur();
        const dalsi = document.getElementById('modelNextBtn');
        /** @type {HTMLFormElement} */ (formular).requestSubmit(dalsi.classList.contains('hidden') ? document.getElementById('modelUlozitBtn') : dalsi);
    });

    // Klik na už použitý tag ho přidá, na zapnutý ho odebere; změna se ohlásí jako úprava formuláře
    document.getElementById('tagyNapoveda').addEventListener('click', (e) => {
        const tag = e.target.closest('[data-tag]')?.dataset.tag;
        if (!tag) return;
        const pole = /** @type {HTMLInputElement} */ (document.getElementById('inputTags'));
        const soucasne = pole.value.split(',').map(t => t.trim()).filter(Boolean);
        const bez = soucasne.filter(t => sjednotit(t) !== sjednotit(tag));
        pole.value = (bez.length < soucasne.length ? bez : [...soucasne, tag]).join(', ');
        pole.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Poznámka ve společném okně s formátováním; změna se ohlásí jako úprava formuláře
    document.getElementById('modelPoznamkaBtn').addEventListener('click', async () => {
        const pole = /** @type {HTMLTextAreaElement} */ (document.getElementById('inputPoznamka'));
        const text = await upravitText({
            nadpis: `Poznámka${hodnota('inputJmeno') ? ` – ${hodnota('inputJmeno')}` : ''}`,
            text: pole.value,
            zastupny: 'Zajímavosti, kariéra, odkud údaje jsou…',
            napoveda: 'Poznámka se ukáže v profilu pod údaji. Ctrl+B tučné, Ctrl+I kurzíva, Ctrl+Enter použije text.',
        });
        // Po zavření editoru (i zrušením) se fokus vrátí na náhled poznámky
        document.getElementById('modelPoznamkaBtn').focus();
        if (text === null || text === pole.value) return;
        pole.value = text;
        pole.dispatchEvent(new Event('input', { bubbles: true }));
    });

    document.getElementById('closeDeleteModalBtn').onclick = zavritDeleteModal;

    document.getElementById('cancelDeleteBtn').onclick = zavritDeleteModal;

    // Napsané slovo odemkne tlačítko Smazat; Enter v poli potvrdí
    const poleSlova = document.getElementById('inputDeleteSlovo');
    // Bez požadovaného slova platí vždy; stav tlačítka se kontrolovat nedá, jednou() ho při kliknutí vypne
    const slovoNapsane = () => !poleSlova.dataset.slovo || poleSlova.value.trim().toUpperCase() === poleSlova.dataset.slovo;
    poleSlova.addEventListener('input', () => {
        document.getElementById('confirmDeleteBtn').disabled = !slovoNapsane();
    });
    poleSlova.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && slovoNapsane()) document.getElementById('confirmDeleteBtn').click();
    });

    document.getElementById('confirmDeleteBtn').onclick = jednou(async () => {
        if (!stav.potvrzenaAkce || !slovoNapsane()) return;
        // Potvrzeno: zavření okna už nesmí akci ohlásit jako zrušenou
        const akce = stav.potvrzenaAkce;
        stav.zrusenaAkce = null;
        await akce();
        zavritDeleteModal();
    });
}
