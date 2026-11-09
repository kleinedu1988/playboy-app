import './style.css';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { oznamit } from './ui/oznameni';
import { GetOblibenost, GetSezona, GetStavUceniTagu, GetVerze, MaZamek, ObnovitOkno, Predpripravit, StavDatabaze } from './app/backend';
import { krokUvodu, pockatNaNahledy, seznamUvodu, stavUvodu, tlacitkoUvodu, skrytUvod, ukazatUvod, ulozitProfilovkyUvodu, verzeUvodu, zapomenoutProfilovkyUvodu } from './ui/uvod';
import { stav } from './app/stav';
import { nacistSpecialy, vsechnyModelky } from './app/mezipamet';
import { prepinacRezimu, prepnoutRezim } from './app/navigace';
import { nacistGalerii } from './app/galerie';
import { kontrolaPoSpusteni, odemknoutPriStartu } from './app/sprava';
import * as obrazky from './app/obrazky';
import * as galerie from './app/galerie';
import * as profil from './app/profil';
import * as stena from './app/stena';
import * as vydani from './app/vydani';
import * as kalendar from './app/kalendar';
import * as prehled from './app/prehled';
import * as nejlepsi from './app/nejlepsi';
import { pripravitVkus } from './app/vkus';
import * as cover from './app/cover';
import * as prohlizec from './app/prohlizec';
import * as vyber from './app/vyber';
import * as okno from './app/okno';
import * as formularModelky from './app/formular-modelky';
import * as formularAlba from './app/formular-alba';
import * as sprava from './app/sprava';
import * as nabidky from './app/nabidky';
import * as ulozeni from './app/ulozeni';
import * as klavesnice from './app/klavesnice';
import * as napoveda from './app/napoveda';
import * as doplneni from './app/doplneni';
import * as clanky from './app/clanky';
import * as ctecka from './app/ctecka';
import * as naseptavac from './app/naseptavac';
import * as hledaniCipy from './app/hledani-cipy';
import * as chytreVybery from './app/chytre-vybery';
import * as zdrojeUdaju from './app/zdroje-udaju';
import * as kontextCisla from './app/kontext-cisla';
import * as wikiOdkazy from './app/wiki-odkazy';
import * as casopis from './app/casopis';
import * as statistiky from './app/statistiky';
import * as oblibenost from './app/oblibenost';
import * as zkratky from './app/zkratky';
import * as editorTextu from './ui/editor-textu';
import { statistikyView } from './app/prvky';
import { vyhlasitSezonu } from './app/vyhlaseni-sezony';
import { pripravitVUvodu as pripravitPohledyVUvodu, spustitPredpripravu } from './app/predpriprava';
import { zaznamenatStart } from './app/vykon';
import { naplanovatPoStartu as stahovatNahledyPoStartu } from './app/nahledy-pozadi';
import * as obsahFotek from './app/obsah-fotek';
import { nabidnoutPoSpusteni as nabidnoutDnesniVyber } from './app/dnesni-vyber';

// Obsluha událostí se registruje v pořadí, v jakém byla v původním souboru. Přehled zkratek je první:
// když je otevřený, jeho obsluha kláves zastaví ostatní
zkratky.pripravit();
obrazky.pripravit();
galerie.pripravit();
hledaniCipy.pripravit();
chytreVybery.pripravit();
zdrojeUdaju.pripravit();
kontextCisla.pripravit();
wikiOdkazy.pripravit();
casopis.pripravit();
pripravitVkus();
profil.pripravit();
stena.pripravit();
vydani.pripravit();
kalendar.pripravit();
prehled.pripravit();
oblibenost.pripravit();
nejlepsi.pripravit();
cover.pripravit();
prohlizec.pripravit();
vyber.pripravit();
okno.pripravit();
formularModelky.pripravit();
formularAlba.pripravit();
sprava.pripravit();
nabidky.pripravit();
ulozeni.pripravit();
klavesnice.pripravit();
napoveda.pripravit();
doplneni.pripravit();
clanky.pripravit();
editorTextu.pripravit();
ctecka.pripravit();
naseptavac.pripravit();
statistiky.pripravit(statistikyView);

// Chyby z backendu se ukazují v okně, ne jen v konzoli
EventsOn('chyba', (zprava) => oznamit(zprava));
StavDatabaze().then((chyba) => {
    if (chyba) oznamit(chyba, { text: 'Rozumím', akce: () => {} });
});

// Kroky přípravy na úvodní obrazovce
const KROKY_UVODU = [
    ['databaze', 'Databáze'], ['sbirka', 'Sbírka'], ['galerie', 'Galerie a náhledy'], ['modely', 'Obrazové modely'],
    ['hodnoceni', 'Oblíbenost a sezóna'], ['odhady', 'Odhady z obsahu fotek'], ['tipy', 'Mohlo by se ti líbit'],
    ['kolekce', 'Kolekce Galerie'], ['pohledy', 'Ostatní pohledy'],
];
// Příprava po obrazových modelech smí trvat nejvýš tak dlouho (pak úvod zmizí a zbytek doběhne za chodu);
// po PRESKOCIT_PO nabídne „Přeskočit přípravu“
const LIMIT_PRIPRAVY = 60000;
const PRESKOCIT_PO = 6000;
const cislo = n => n.toLocaleString('cs-CZ');

// Stav obrazových modelů do seznamu úvodu: [stav, podrobnost]
function popisModelu(s) {
    if (s.faze === 'vypnuto') return ['preskoceno', 'nestažené'];
    if (s.faze === 'chyba') return ['chyba', 'stažení se nepovedlo'];
    if (s.faze === 'stahuje') return ['hotovo', 'stahují se na pozadí'];
    if (s.celkem && s.vektoru < s.celkem) return ['hotovo', `obsah ${cislo(s.vektoru)} / ${cislo(s.celkem)} fotek`];
    return ['hotovo', s.vektoru ? `obsah ${cislo(s.vektoru)} fotek` : 'připravené'];
}

// Spuštění pod úvodní obrazovkou (ui/uvod.js): nejdřív případný zámek, potom přehled, ve kterém se program naposledy
// zavřel, jeho náhledy a data Hodnocení; úvod zmizí, až je vše připravené
// Konec úvodu: malé okno úvodní obrazovky dostane uloženou velikost a polohu (nastaveni.go ObnovitOkno), pak
// úvod zmizí; volá se jednou (pojistka, konec přípravy)
let uvodSkoncil = false;
async function konecUvodu() {
    if (uvodSkoncil) return;
    uvodSkoncil = true;
    await ObnovitOkno().catch(() => {});
    skrytUvod();
}

(async () => {
    // Pojistka: úvod nesmí zůstat viset, ani kdyby se příprava zasekla
    let pojistka = setTimeout(konecUvodu, 15000);
    try {
        GetVerze().then(verzeUvodu).catch(() => {});
        stav.maZamek = await MaZamek();
        if (stav.maZamek) {
            // Okno s heslem potřebuje plné okno, ne malé okno úvodu
            await ObnovitOkno().catch(() => {});
            ukazatUvod(false);
            await odemknoutPriStartu();
            ukazatUvod(true);
        }

        // Kroky přípravy jsou vidět na úvodu (ui/uvod.js); program naběhne připravený, i když start trvá déle
        seznamUvodu(KROKY_UVODU);
        stavUvodu('databaze', 'hotovo', stav.maZamek ? 'odemčeno' : 'otevřena');

        krokUvodu('Načítám sbírku…', 0.12);
        stavUvodu('sbirka', 'bezi');
        const specialy = nacistSpecialy();
        const modelky = await vsechnyModelky().catch(() => []);
        await specialy;
        stavUvodu('sbirka', 'hotovo', `${cislo(modelky?.length || 0)} modelek`);

        krokUvodu('Sestavuji galerii…', 0.22);
        stavUvodu('galerie', 'bezi');
        let posledni = null;
        try { posledni = localStorage.getItem('posledniRezim'); } catch { /* bez úložiště začne galerií */ }
        if (posledni === 'nejlepsi') oblibenost.nastavitNejlepsiVOblibenosti(true);
        if (['kalendar', 'nejlepsi', 'centerfoldy', 'statistiky'].includes(posledni) || prepinacRezimu.querySelector(`[data-rezim="${posledni}"]`)) prepnoutRezim(posledni);
        await nacistGalerii().catch(() => {});
        krokUvodu('Načítám náhledy první obrazovky…', 0.3);
        await pockatNaNahledy(8000);
        stavUvodu('galerie', 'hotovo');

        // Obsah fotek: model zkontrolovat, chybějící stáhnout s průběhem (vlastní tlačítko „pokračovat bez čekání“)
        krokUvodu('Kontroluji obrazové modely…', 0.4);
        stavUvodu('modely', 'bezi');
        clearTimeout(pojistka);
        await obsahFotek.pripravitVUvodu(krokUvodu, tlacitkoUvodu).catch(() => {});
        stavUvodu('modely', ...popisModelu(obsahFotek.stavObsahuFotek()));
        pojistka = setTimeout(konecUvodu, LIMIT_PRIPRAVY);
        // Po čase jde přípravu přeskočit (dokončí se pak za chodu)
        let nabidkaPreskoceni = 0;
        const preskocit = new Promise((hotovo) => {
            nabidkaPreskoceni = setTimeout(() => tlacitkoUvodu('Přeskočit přípravu').then(hotovo), PRESKOCIT_PO);
        });
        const preskoceno = { ano: false };
        preskocit.then(() => { preskoceno.ano = true; });
        const nebo = slib => Promise.race([slib, preskocit]);

        krokUvodu('Počítám oblíbenost a sezónu…', 0.55);
        stavUvodu('hodnoceni', 'bezi');
        await nebo(Promise.all([GetOblibenost(), GetSezona()]).catch(() => {}));
        stavUvodu('hodnoceni', preskoceno.ano ? 'preskoceno' : 'hotovo');

        if (!preskoceno.ano && obsahFotek.stavObsahuFotek().vektoru) {
            krokUvodu('Učím se z tvých srdíček a z Průvodce…', 0.65);
            stavUvodu('odhady', 'bezi');
            await nebo(Predpripravit('obsah').catch(() => {}));
            const u = await GetStavUceniTagu().catch(() => null);
            stavUvodu('odhady', preskoceno.ano ? 'preskoceno' : 'hotovo',
                u?.fotek ? `z ${cislo(u.fotek)} fotek Průvodce · podle tebe ${u.pouzito} tagů` : 'srdíčka fotek');
        } else {
            stavUvodu('odhady', 'preskoceno', preskoceno.ano ? '' : 'bez obsahu fotek');
        }

        if (!preskoceno.ano) {
            krokUvodu('Vybírám, co by se ti mohlo líbit…', 0.75);
            stavUvodu('tipy', 'bezi');
            await nebo(Predpripravit('oblibenost').catch(() => {}));
            stavUvodu('tipy', preskoceno.ano ? 'preskoceno' : 'hotovo');
        } else stavUvodu('tipy', 'preskoceno');

        // Kolekce Galerie (řady pod bannerem, styly, barvy): jinak by je počítalo až první otevření Galerie (~1,5 s)
        if (!preskoceno.ano) {
            krokUvodu('Skládám kolekce Galerie…', 0.78);
            stavUvodu('kolekce', 'bezi');
            await nebo(Predpripravit('kolekce').catch(() => {}));
            stavUvodu('kolekce', preskoceno.ano ? 'preskoceno' : 'hotovo');
        } else stavUvodu('kolekce', 'preskoceno');

        if (!preskoceno.ano) {
            stavUvodu('pohledy', 'bezi');
            await nebo(pripravitPohledyVUvodu((hotovo, celkem) => {
                krokUvodu(`Připravuji Sbírku, Čísla, hledání a Statistiky… ${hotovo}/${celkem}`, 0.8 + 0.2 * (hotovo / celkem));
                stavUvodu('pohledy', 'bezi', `${hotovo} / ${celkem}`);
            }));
            stavUvodu('pohledy', preskoceno.ano ? 'preskoceno' : 'hotovo');
        } else stavUvodu('pohledy', 'preskoceno');
        clearTimeout(nabidkaPreskoceni);
        tlacitkoUvodu('');
    } finally {
        clearTimeout(pojistka);
        await konecUvodu();
        zaznamenatStart();
    }
    // Nový náhodný výběr profilovek pro úvod příštího spuštění, až program doběhne (seznam modelek je už načtený);
    // se zámkem se neukládají – úvod je vidět dřív než okno s heslem
    setTimeout(() => {
        if (stav.maZamek) zapomenoutProfilovkyUvodu();
        else vsechnyModelky().then(m => ulozitProfilovkyUvodu(m, obrazky.adresaTitulni)).catch(() => {});
    }, 4000);
    // Dnešní výběr: po úvodu nenápadná kartička s nabídkou krátké dávky porovnávání (app/dnesni-vyber.js)
    setTimeout(() => nabidnoutDnesniVyber().catch(() => {}), 2500);
    // Mezipaměti backendu pro další pohledy se připraví v klidu po úvodu (app/predpriprava.js)
    spustitPredpripravu();
    // Náhledy celé sbírky na disk, minutu po startu v klidu (app/nahledy-pozadi.js)
    stahovatNahledyPoStartu();
    // Po aktualizaci jednou ukáže, co je nového (až po odemčení a úvodu)
    napoveda.ukazatNovinkyPoAktualizaci();
    // Denní ověření souborů až po prvním vykreslení, ať nebrzdí start
    setTimeout(() => kontrolaPoSpusteni(), 5000);
    // Skončená sezóna oblíbenosti čeká na vyhlášení Favoritky (app/vyhlaseni-sezony.js); až po úvodních oknech
    setTimeout(() => vyhlasitSezonu(), 1500);
})();
