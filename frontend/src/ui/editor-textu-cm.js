// Společné okno pro psaní textu v markdownu (průvodní text alba, text článku). Editor ukazuje text rovnou
// naformátovaný: značky (**, *, ~~, #, >) jsou schované a objeví se, jen když je kurzor ve formátovaném místě.
// Bloky (nadpis, citát, seznamy, perex) se poznávají po řádcích stejně jako ve formatMarkdown, aby editor
// ukazoval totéž co hotový text; formátování v řádku (tučné, kurzíva…) určuje parser markdownu.
// Modul s CodeMirrorem je velký (přes polovinu skriptů programu); načítá ho až editor-textu.js při prvním otevření okna.
import { EditorState, EditorSelection, StateEffect } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, undo } from '@codemirror/commands';
import { Language, LanguageSupport, defineLanguageFacet, syntaxTree } from '@codemirror/language';
import { Strikethrough, parser } from '@lezer/markdown';
import { formatMarkdown, pocetSlovAZnaku, sklonovat } from '../lib/format';

// Jen parser markdownu (bez @codemirror/lang-markdown, který s sebou táhne HTML, CSS a JavaScript pro bloky kódu)
const markdown = () => new LanguageSupport(new Language(defineLanguageFacet(), parser.configure([Strikethrough]), [], 'markdown'));

// Formátovaný úsek → třída obsahu; značky uvnitř se schovají, pokud v úseku není kurzor
const UPRAVY_V_RADKU = {
    StrongEmphasis: 'md-tucne',
    Emphasis: 'md-kurziva',
    Strikethrough: 'md-preskrtnute',
    InlineCode: 'md-kod',
};
const ZNACKY_V_RADKU = new Set(['EmphasisMark', 'StrikethroughMark', 'CodeMark']);

// Druh řádku jako ve formatMarkdown (ten řádek nejdřív ořízne): nadpis, citát, odrážka, číslo, odstavec, prázdný.
// znacka = délka značky i s mezerou za ní (od začátku řádku), uroven = počet # u nadpisu
function druhRadku(text, predchozi = '') {
    let m;
    if (!text.trim()) return { druh: 'prazdny', znacka: 0 };
    if ((m = /^\s*(#{1,3})\s+(?=\S)/.exec(text))) return { druh: 'nadpis', znacka: m[0].length, uroven: m[1].length };
    if ((m = /^\s*>\s*/.exec(text))) return { druh: 'citat', znacka: m[0].length };
    if ((m = /^\s*[*•–-]\s+(?=\S)/.exec(text))) return { druh: 'odrazka', znacka: m[0].length };
    if ((m = /^\s*\d+\.\s+(?=\S)/.exec(text))) return { druh: 'cislo', znacka: m[0].length };
    // Odsazený řádek pod položkou seznamu ji prodlužuje
    if ((predchozi === 'odrazka' || predchozi === 'cislo' || predchozi === 'pokracovani') && /^( {2}|\t)/.test(text)) return { druh: 'pokracovani', znacka: 0 };
    return { druh: 'odstavec', znacka: 0 };
}

const skryt = Decoration.replace({});
// Mluvčí v rozhovoru („PLAYBOY:“ na začátku odstavce) jako v hotovém článku (formatMarkdown s mluvci)
const vzorMluvciho = /^([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ .'-]{1,30}):/;
const mluvci = Decoration.mark({ class: 'md-tucne md-mluvci' });
const TRIDY_RADKU = { citat: 'md-citat', odrazka: 'md-polozka', cislo: 'md-polozka', pokracovani: 'md-polozka' };

// Odrážka místo „- “ na řádku bez kurzoru
class Tecka extends WidgetType {
    eq() { return true; }
    toDOM() {
        const prvek = document.createElement('span');
        prvek.className = 'md-tecka';
        prvek.textContent = '•';
        return prvek;
    }
    ignoreEvent() { return false; }
}
const tecka = Decoration.replace({ widget: new Tecka() });
const cisloPolozky = Decoration.mark({ class: 'md-cislo' });
const znackaOdrazky = Decoration.mark({ class: 'md-odrazka' });

// Kurzor (nebo výběr) zasahuje do úseku od–do včetně okrajů
const kurzorV = (stav, od, do_) => stav.selection.ranges.some(r => r.from <= do_ && r.to >= od);

// Druhy viditelných řádků; druh řádku závisí na předchozím (pokračování položky) a perex na všem nad ním,
// proto se začíná od začátku textu (texty v okně jsou krátké)
function druhyRadku(doc, doRadku) {
    const druhy = [];
    let predchozi = '';
    let perex = 0;
    for (let cislo = 1; cislo <= doRadku; cislo++) {
        const d = druhRadku(doc.line(cislo).text, predchozi);
        // Perex je první odstavec textu (do prázdného řádku nebo jiného bloku)
        if (d.druh === 'odstavec' && perex < 2) {
            d.perex = perex === 0 ? 'zacatek' : 'dalsi';
            perex = 1;
        } else if (perex === 1) perex = 2;
        druhy[cislo] = d;
        predchozi = d.druh;
    }
    return druhy;
}

function ozdobit(view) {
    const stav = view.state;
    const ozdoby = [];
    const posledni = view.visibleRanges.length ? stav.doc.lineAt(view.visibleRanges[view.visibleRanges.length - 1].to).number : 0;
    const druhy = druhyRadku(stav.doc, posledni);
    for (const { from, to } of view.visibleRanges) {
        // Bloky po řádcích
        for (let pozice = from; pozice <= to;) {
            const radek = stav.doc.lineAt(pozice);
            const { druh, znacka, uroven, perex } = druhy[radek.number];
            const sKurzorem = kurzorV(stav, radek.from, radek.to);
            const trida = druh === 'nadpis' ? `md-h${uroven}` : perex && zvyraznitMluvci ? `md-perex${perex === 'zacatek' ? ' md-perex-zacatek' : ''}` : TRIDY_RADKU[druh];
            if (trida) ozdoby.push(Decoration.line({ class: trida }).range(radek.from));
            if (druh === 'nadpis' || druh === 'citat') {
                if (!sKurzorem && znacka) ozdoby.push(skryt.range(radek.from, radek.from + znacka));
            } else if (druh === 'odrazka') {
                ozdoby.push((sKurzorem ? znackaOdrazky : tecka).range(radek.from, radek.from + znacka));
            } else if (druh === 'cislo') {
                ozdoby.push(cisloPolozky.range(radek.from, radek.from + znacka));
            } else if (druh === 'odstavec' && zvyraznitMluvci) {
                const shoda = vzorMluvciho.exec(radek.text);
                if (shoda) ozdoby.push(mluvci.range(radek.from, radek.from + shoda[0].length));
            }
            pozice = radek.to + 1;
        }
        // Formátování v řádku
        syntaxTree(stav).iterate({
            from, to,
            enter: (uzel) => {
                const nazev = uzel.name;
                if (!UPRAVY_V_RADKU[nazev]) return;
                ozdoby.push(Decoration.mark({ class: UPRAVY_V_RADKU[nazev] }).range(uzel.from, uzel.to));
                if (kurzorV(stav, uzel.from, uzel.to)) return;
                // Značky jsou přímé potomky úseku
                const kurzor = uzel.node.cursor();
                if (kurzor.firstChild()) {
                    do {
                        if (ZNACKY_V_RADKU.has(kurzor.name)) ozdoby.push(skryt.range(kurzor.from, kurzor.to));
                    } while (kurzor.nextSibling());
                }
            },
        });
    }
    return Decoration.set(ozdoby, true);
}

// Po puštění myši se ozdoby přepočítají (během tažení výběru zůstávají, aby text pod myší neposkakoval)
const obnovitOzdoby = StateEffect.define();

const zivyNahled = ViewPlugin.fromClass(class {
    constructor(view) {
        this.decorations = ozdobit(view);
        this.mys = false;
        this.pustit = () => {
            if (!this.mys) return;
            this.mys = false;
            view.dispatch({ effects: obnovitOzdoby.of(null) });
        };
        window.addEventListener('mouseup', this.pustit);
    }
    update(u) {
        // Při skládání znaku (IME, mrtvé klávesy pro háčky a čárky) se ozdoby jen posunou, ať se psaní nepřeruší
        if (u.view.composing && !u.transactions.some(t => t.effects.some(e => e.is(obnovitOzdoby)))) {
            this.decorations = this.decorations.map(u.changes);
            return;
        }
        if (u.docChanged || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)
            || (u.selectionSet && !this.mys) || u.transactions.some(t => t.effects.some(e => e.is(obnovitOzdoby)))) {
            this.decorations = ozdobit(u.view);
        }
    }
    destroy() { window.removeEventListener('mouseup', this.pustit); }
}, {
    decorations: p => p.decorations,
    eventHandlers: {
        mousedown(e) { if (e.button === 0) this.mys = true; },
    },
});

// Formátovaný úsek daného druhu, ve kterém je celý úsek od–do (pro vypnutí formátu tlačítkem)
function uzelKolem(stav, od, do_, nazev) {
    for (let uzel = syntaxTree(stav).resolveInner(od, 1); uzel; uzel = uzel.parent) {
        if (uzel.name === nazev && uzel.from <= od && uzel.to >= do_) return uzel;
    }
    for (let uzel = syntaxTree(stav).resolveInner(od, -1); uzel; uzel = uzel.parent) {
        if (uzel.name === nazev && uzel.from <= od && uzel.to >= do_) return uzel;
    }
    return null;
}

// Obalí výběr značkou (tučné, kurzíva); bez výběru vloží dvojici značek s kurzorem mezi nimi.
// Je-li kurzor nebo výběr už uvnitř takového formátu, značky kolem se odeberou (tlačítko formát vypne).
function obalit(view, znacka, nazev) {
    view.dispatch(view.state.changeByRange(r => {
        const uzel = uzelKolem(view.state, r.from, r.to, nazev);
        const prvni = uzel?.firstChild, posledni = uzel?.lastChild;
        if (uzel && prvni && posledni && prvni !== posledni && ZNACKY_V_RADKU.has(prvni.name)) {
            const zmeny = view.state.changes([{ from: prvni.from, to: prvni.to }, { from: posledni.from, to: posledni.to }]);
            return { changes: zmeny, range: r.map(zmeny) };
        }
        const text = view.state.sliceDoc(r.from, r.to);
        const obaleno = text.startsWith(znacka) && text.endsWith(znacka) && text.length >= 2 * znacka.length;
        const novy = obaleno ? text.slice(znacka.length, -znacka.length) : znacka + text + znacka;
        return {
            changes: { from: r.from, to: r.to, insert: novy },
            range: r.empty ? EditorSelection.cursor(r.from + znacka.length) : EditorSelection.range(r.from, r.from + novy.length),
        };
    }));
    view.focus();
    return true;
}

// Číslo položky se při přepínání nerozlišuje („3. “ je stejná značka jako „1. “)
const druhZnacky = znacka => /^\d+\./.test(znacka) ? 'cislo' : znacka.trim();

// Přepne předponu řádků ve výběru („## “, „- “, „> “, „1. “); číslovaný seznam čísluje řádky postupně
function predpona(view, znak) {
    const stav = view.state;
    const zmeny = [];
    const radky = new Set();
    for (const r of stav.selection.ranges) {
        for (let pozice = r.from; pozice <= r.to;) {
            const radek = stav.doc.lineAt(pozice);
            if (!radky.has(radek.number)) {
                radky.add(radek.number);
                const stara = /^(#{1,3} |[-*•–] |> ?|\d+\. )/.exec(radek.text)?.[0] || '';
                const vypnout = Boolean(stara) && druhZnacky(stara) === druhZnacky(znak);
                const nova = znak === '1. ' ? `${radky.size}. ` : znak;
                zmeny.push({ from: radek.from, to: radek.from + stara.length, insert: vypnout ? '' : nova });
            }
            pozice = radek.to + 1;
        }
    }
    view.dispatch({ changes: zmeny });
    view.focus();
    return true;
}

// Enter v seznamu nebo citátu pokračuje stejnou značkou; na prázdné položce značku smaže a seznam ukončí
// prázdným řádkem (bez něj by další text formatMarkdown připojil k seznamu jako odstavec hned pod ním)
function novyRadek(view) {
    const r = view.state.selection.main;
    if (!r.empty) return false;
    const radek = view.state.doc.lineAt(r.head);
    const shoda = /^(\s*)([-*•–]|\d+\.|>)\s?/.exec(radek.text);
    if (!shoda || r.head < radek.from + shoda[0].length || (shoda[2] !== '>' && !/\s/.test(shoda[0].slice(-1)))) return false;
    if (radek.text.trim() === shoda[0].trim()) {
        view.dispatch({ changes: { from: radek.from, to: radek.to, insert: '\n' }, selection: { anchor: radek.from + 1 }, scrollIntoView: true });
        return true;
    }
    const cislo = /^\d+\.$/.test(shoda[2]) ? parseInt(shoda[2]) + 1 : 0;
    const vlozit = `\n${shoda[1]}${cislo ? `${cislo}.` : shoda[2]} `;
    const zmeny = [{ from: r.head, insert: vlozit }];
    // Další položky číslovaného seznamu pod kurzorem se přečíslují
    for (let dalsi = radek.number + 1, n = cislo + 1; cislo && dalsi <= view.state.doc.lines; dalsi++, n++) {
        const pod = view.state.doc.line(dalsi);
        const m = /^(\s*)(\d+)\./.exec(pod.text);
        if (!m || m[1] !== shoda[1]) break;
        zmeny.push({ from: pod.from + m[1].length, to: pod.from + m[1].length + m[2].length, insert: String(n) });
    }
    view.dispatch({ changes: zmeny, selection: { anchor: r.head + vlozit.length }, scrollIntoView: true });
    return true;
}

const NASTROJE = {
    tucne: v => obalit(v, '**', 'StrongEmphasis'),
    kurziva: v => obalit(v, '*', 'Emphasis'),
    preskrtnute: v => obalit(v, '~~', 'Strikethrough'),
    nadpis: v => predpona(v, '## '),
    odrazky: v => predpona(v, '- '),
    cisla: v => predpona(v, '1. '),
    citat: v => predpona(v, '> '),
    zpet: v => undo(v),
};

// Které formáty jsou v místě kurzoru (tlačítka nástrojů je ukážou jako zapnuté)
function aktivniFormaty(stav) {
    const r = stav.selection.main;
    const druh = druhRadku(stav.doc.lineAt(r.head).text).druh;
    return {
        tucne: Boolean(uzelKolem(stav, r.from, r.to, 'StrongEmphasis')),
        kurziva: Boolean(uzelKolem(stav, r.from, r.to, 'Emphasis')),
        preskrtnute: Boolean(uzelKolem(stav, r.from, r.to, 'Strikethrough')),
        nadpis: druh === 'nadpis',
        odrazky: druh === 'odrazka',
        cisla: druh === 'cislo',
        citat: druh === 'citat',
    };
}

let editor = null;
let vyreseni = null;
let zvyraznitMluvci = false;
const okno = () => document.getElementById('textModal');

function obnovitNastroje(stav) {
    const aktivni = aktivniFormaty(stav);
    okno().querySelectorAll('.text-nastroje [data-nastroj]').forEach(b => {
        if (!(b.dataset.nastroj in aktivni)) return;
        b.classList.toggle('active', aktivni[b.dataset.nastroj]);
        b.setAttribute('aria-pressed', String(aktivni[b.dataset.nastroj]));
    });
}

function obnovitPocet(stav) {
    const { slov, znaku } = pocetSlovAZnaku(stav.doc.toString());
    document.getElementById('textPocet').textContent = slov ? `${sklonovat(slov, 'slovo', 'slova', 'slov')} · ${sklonovat(znaku, 'znak', 'znaky', 'znaků')}` : '';
}

function vytvoritEditor() {
    editor = new EditorView({
        parent: document.getElementById('textEditor'),
        state: EditorState.create({ extensions: rozsireni() }),
    });
}

const rozsireni = (zastupny = '') => [
    history(),
    keymap.of([
        { key: 'Mod-b', run: NASTROJE.tucne },
        { key: 'Mod-i', run: NASTROJE.kurziva },
        { key: 'Mod-Enter', run: () => { pouzit(); return true; } },
        { key: 'Enter', run: novyRadek },
        ...defaultKeymap, ...historyKeymap,
    ]),
    markdown(),
    zivyNahled,
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': 'Text', spellcheck: 'true', lang: 'cs' }),
    EditorView.updateListener.of(u => {
        if (u.docChanged || u.selectionSet || syntaxTree(u.startState) !== syntaxTree(u.state)) obnovitNastroje(u.state);
        if (u.docChanged) obnovitPocet(u.state);
    }),
    placeholder(zastupny),
];

// Náhled: text přesně tak, jak se ukáže v profilu (album) nebo ve čtečce (článek s perexem a mluvčími)
function prepnoutNahled(zapnout) {
    const nahled = document.getElementById('textNahledCely');
    document.getElementById('textNahledBtn').classList.toggle('active', zapnout);
    document.getElementById('textNahledBtn').setAttribute('aria-pressed', String(zapnout));
    okno().querySelectorAll('.text-nastroje [data-nastroj]').forEach(b => { b.disabled = zapnout; });
    document.getElementById('textEditor').classList.toggle('hidden', zapnout);
    nahled.classList.toggle('hidden', !zapnout);
    if (zapnout) {
        const text = editor.state.doc.toString();
        const html = formatMarkdown(text, { perex: zvyraznitMluvci, mluvci: zvyraznitMluvci });
        nahled.innerHTML = html
            ? (zvyraznitMluvci ? `<div class="clanek-text">${html}</div>` : `<div class="album-desc"><div class="album-desc-text open">${html}</div></div>`)
            : '<p class="text-nahled-prazdny">Zatím bez textu.</p>';
        nahled.focus();
    } else {
        editor.focus();
    }
}

function pouzit() {
    const text = editor.state.doc.toString().replace(/\s+$/, '');
    okno().classList.add('hidden');
    vyreseni?.(text);
    vyreseni = null;
}

/**
 * Otevře okno s textem; vrátí upravený text (Použít), nebo null (Zrušit, Esc).
 * mluvci: text článku (perex a mluvčí se ukazují jako ve čtečce)
 * @param {{ nadpis?: string, text?: string, napoveda?: string, zastupny?: string, mluvci?: boolean }} moznosti
 * @returns {Promise<string|null>}
 */
export function upravitText({ nadpis = 'Text', text = '', napoveda = '', zastupny = '', mluvci = false } = {}) {
    if (!editor) vytvoritEditor();
    zvyraznitMluvci = mluvci;
    vyreseni?.(null);
    document.getElementById('textModalTitle').textContent = nadpis;
    document.getElementById('textModalNapoveda').textContent = napoveda;
    editor.setState(EditorState.create({ doc: text, extensions: rozsireni(zastupny), selection: EditorSelection.cursor(text.length) }));
    obnovitNastroje(editor.state);
    obnovitPocet(editor.state);
    // Okno je vždy navrchu, i nad oknem, ze kterého se otevřelo
    okno().parentElement.append(okno());
    okno().classList.remove('hidden');
    prepnoutNahled(false);
    editor.dispatch({ effects: EditorView.scrollIntoView(text.length) });
    return new Promise(vyresit => { vyreseni = vyresit; });
}

// Obsluha okna; volá ji editor-textu.js jednou po načtení modulu (před prvním otevřením okna)
export function pripravit() {
    document.getElementById('textUlozitBtn').addEventListener('click', pouzit);
    document.querySelector('#textModal .text-nastroje').addEventListener('click', (e) => {
        const tlacitko = /** @type {HTMLElement} */ (e.target).closest('[data-nastroj]');
        if (tlacitko && editor) NASTROJE[tlacitko.dataset.nastroj](editor);
        if (/** @type {HTMLElement} */ (e.target).closest('#textNahledBtn')) prepnoutNahled(!document.getElementById('textEditor').classList.contains('hidden'));
    });
    // Tlačítka nástrojů neberou editoru fokus (kurzor i výběr zůstanou, kde byly)
    document.querySelector('#textModal .text-nastroje').addEventListener('mousedown', (e) => {
        if (/** @type {HTMLElement} */ (e.target).closest('[data-nastroj]')) e.preventDefault();
    });
    // Ctrl+Enter použije text i z náhledu
    document.getElementById('textNahledCely').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) pouzit();
    });
    // Zavření bez Použít (křížek, Zrušit, Esc) vrátí null
    new MutationObserver(() => {
        if (okno().classList.contains('hidden') && vyreseni) {
            vyreseni(null);
            vyreseni = null;
        }
    }).observe(okno(), { attributes: true, attributeFilter: ['class'] });
}
