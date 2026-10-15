import { VYCHOZI_EDICE } from '../lib/format';

// Sdílený stav rozhraní: hodnoty, které čte a mění víc modulů
export const stav = {
    aktualniModelka: null,
    nacteneModelky: [],
    editovanaModelka: null,
    potvrzenaAkce: null,
    zrusenaAkce: null,
    minHodnoceni: 0, // galerie ukazuje jen modelky s aspoň tolika srdíčky; 0 = všechny
    zrusitUpravuVyrezu: null,
    aktualniAlba: [],
    aktualniPolozky: [],
    stenaPolozky: [],
    razeniGalerie: 'jmeno', // 'jmeno', 'pridano' (naposledy přidané) nebo 'rok' (rok prvního vydání)
    rezim: 'modelky', // přehled na hlavní stránce: 'modelky', 'centerfoldy', 'covery', 'kalendar' nebo 'prehled'
    maZamek: false,
    // Pořadové číslo posledního načítání pohledu; odpověď, kterou mezitím předběhlo novější načítání, se zahodí
    cisloNacteni: 0,
    zamceno: false,
    coveryPolozky: [],
    cislaZobrazit: 'vse', // stránka Čísla: 'vse', 'cover', 'bezCoveru' nebo 'chybi'
    vydaniPolozky: [],
    aktualniVydani: null,
    editovanyCover: null,
    editovaneAlbum: null,
    // Modelka, ke které se ukládá okno alba; nemusí to být modelka otevřeného profilu
    modelkaAlba: null,
    // Ruční pořadí fotek: dlaždice se v albu profilu přetáhne na nové místo
    tazenaFotka: null,
    praveTazeno: false,
    cekaNaOznaceni: false,
    // Stěna centerfoldů napříč všemi modelkami
    stenaData: null,
    stenaChronologicky: false,
    // Stránka Čísla: [kalendář, stavy čísel, covery]
    coveryData: null,
    // Fotograf, jehož alba ukazuje stránka (jinak null a stránka ukazuje vydání)
    aktualniFotograf: null,
    upravovaneVydani: null,
    kalendarData: null,
    stavyVydaniData: null,
    // Kalendář ukazuje jednu edici; volba se pamatuje
    kalendarEdice: VYCHOZI_EDICE,
    // Modelky a jejich nedoplněná alba pro akce v buňkách přehledu
    prehledModelky: new Map(),
    prehledAlba: new Map(),
    // Pořadí modelek v tabulce pro „Uložit a další"
    prehledPoradi: [],
    prehledRadky: [],
    // Zobrazit i údaje označené „netýká se" (aby šlo označení zrušit) a kolik řádků tabulek ukázat
    prehledSkryte: false,
    prehledLimit: 60,
    // Okno „Doplnit modelku“: modelka, její řádek Přehledu a zvolené hodnocení
    // Stránka čísla: články a vykreslená alba
    vydaniClanky: [],
    vydaniHtmlAlb: '',
    editovanyClanek: null,
    doplnovanaModelka: null,
    doplnovanyRadek: null,
    doplnovaneHodnoceni: 0,
    doplnovanaTitulni: 0, // id fotky vybrané jako titulní
    prehledSekce: 'souhrn', // ukázaná část Přehledu: souhrn, modelky, vydani, rocniky, kontrola
    // Nejlepší: fotky s aspoň N srdíčky napříč sbírkou, po modelkách; prohlížeč jde přes všechny
    nejlepsiPolozky: [],
    nejlepsiData: null,
    nejlepsiMin: 4,
    // Otevřený vlastní výběr (id); 0 = ukazují se fotky podle srdíček
    nejlepsiVyber: 0,
    vyberyData: [],
    // Interval slideshow v milisekundách; jde změnit v nabídce ⋯
    intervalSlideshow: 4000,
    lbPolozky: [],
    lbIndex: 0,
    lbCasovac: null,
    lbPlakat: null, // prvek .poster právě zobrazené položky
    lbPlne: false, // všechny stránky jsou načtené v plném rozlišení
    lbRozlozeno: false, // plakát vyplní celé okno a posouvá se po délce
    lbPosun: 0, // poloha rozloženého plakátu po délce (0–1)
    lbZobrazeno: { sirka: 0, presah: 0, osa: 'y' },
    lbLupa: null, // obdélník plakátu v okamžiku zapnutí lupy
    lbTazeni: null,
    lbZmeneno: false, // po zavření je potřeba překreslit přehled (změna otočení)
    lbCekaNaOriginal: null, // místo, kde se má zapnout lupa, až dorazí originál
    // Zamíchané pořadí v prohlížeči; původní pořadí se po vypnutí vrátí
    lbPuvodniPoradi: null,
    lbPosledniKrokKoleckem: 0,
    posledniVybrana: null,
    // Formulář modelky slouží pro přidání (modelka = null) i úpravu
    // fronta: doplňování z Přehledu ({ zalozka }); „Uložit a další" pak otevře další modelku z tabulky
    frontaDoplnovani: null,
    nedostupneFotky: [],
    nedostupnychPodezreleMnoho: false,
    // Verze programu pro nabídku ⋯
    verzeProgramu: '',
    pickVyreseni: null,
    // Hledání se spouští až po krátké pauze v psaní; v Přehledu se nehledá
    casovacHledani: null,
};
