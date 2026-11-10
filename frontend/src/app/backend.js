// Volání backendu. Každý zápis po dokončení ohlásí změnu dat, aby se mezipaměti pohledů zneplatnily
// na jednom místě a žádný pohled neukázal stav před změnou. Nové volání backendu se přidává i sem
// (hlídá to test backend.test.js); pokud jen čte, patří do seznamu CTENI.
import * as App from '../../wailsjs/go/main/App';
import { ohlasitZmenuDat } from './udalosti';
import { zaznamenatVolani } from './vykon';

const CTENI = new Set([
    'GetAlbaFotografa',
    'GetCenterfoldy',
    'GetCovery',
    'GetDuvodOdhadu',
    'GetFrontaHodnoceni',
    'GetDvojiceKPorovnani',
    'GetFotkyVyberu',
    'GetFotografieModelky',
    'GetFotografove',
    'GetClanky',
    'GetStatistiky',
    'GetVyvojVCase',
    'GetClankyModelky',
    'HledatClanky',
    'HledatTexty',
    'GetKalendar',
    'GetModelky',
    'GetMohloByTeLibit',
    'GetNahledyModelek',
    'GetNavrhSrdicek',
    'GetNavrhyDoplneni',
    'GetNejlepsiFotky',
    'GetNehodnoceneFotky',
    'GetPocetNehodnocenychFotek',
    'GetKatalogTagu',
    'GetTagyFotek',
    'GetPoctyTagu',
    'GetNepotagovaneFotky',
    'GetTemataSezon',
    'GetNavrhSezony',
    'GetTitulySezonModelky',
    'GetKrokyPruvodce',
    'GetFotkyKPruvodci',
    'GetStrankuPruvodce',
    'GetGalerieNejlepsich',
    'GetStrankuNehodnocenych',
    'GetPocetFotekKPruvodci',
    'GetTemataKOdemceni',
    'GetFotkyKOdemceni',
    'GetNahledyTematu',
    'GetOblibenost',
    'GetPrehled',
    'GetPrehledOblibenosti',
    'GetPrehledVydani',
    'GetSablonaObrazku',
    'GetSinSlavy',
    'GetSezona',
    'GetOdznakyModelky',
    // Fotka záhlaví (hero Profilů a Statistik, profil): jen čte; jako zápis by ve Statistikách točila přepočet dokola
    'GetProfilovaFotka',
    'GetSoubojeModelky',
    'GetSpecialy',
    'GetStavUceni',
    'GetStavyVydani',
    'GetTagy',
    'GetVerze',
    'GetVybery',
    'GetVydani',
    'GetVydaniInfo',
    'MaZamek',
    'Odemknout',
    'OveritOdkaz',
    'SeznamZaloh',
    'SlozkaZaloh',
    'StavDatabaze',
    'VybratSouboryImportu',
    'ExportovatDoSouboru',
    // Předpříprava jen plní mezipaměti backendu (app/predpriprava.js); změna dat by vyprázdnila mezipaměti okna
    'Predpripravit',
    // Stahování náhledů na pozadí jen plní mezipaměť obrázků na disku (app/nahledy-pozadi.js)
    'SpustitStahovaniNahledu',
    'ZastavitStahovaniNahledu',
    'GetStavStahovaniNahledu',
    // Obsah fotek: model a vektory jsou mimo databázi sbírky, pohledy se jimi nemění (app/obsah-fotek.js)
    'GetStavObsahu',
    'GetPodobneFotky',
    'GetPodobnostObsahu',
    'GetStejneFotky',
    'GetChytreVybery',
    'NajitUdajeModelky',
    'GetZminky',
    'GetZdraviSbirky',
    'RozdilZalohy',
    'RocnikPodleWikipedie',
    'GetNavrhyZWebu',
    'GetStavPruchoduWebem',
    'PocetOdmitnutychZWebu',
    'GetStavOtoceni',
    'GetRokVeSbirce',
    // Kontrola nové verze pracuje jen s gitem klonu programu a nastavením
    'GetNovaVerze',
    'GetChangelogNoveVerze',
    'ZkontrolovatNovouVerzi',
    'NastavitKontroluVerze',
    // Kapesní katalog čte sbírku a zapisuje jen do zvolené složky
    'GetPodkladyKatalogu',
    'GetNahledyKatalogu',
    'UlozitKatalog',
    'GetOtoceneFotky',
    'GetTitulniBezVyrezu',
    'NavrhnoutVyrezy',
    // Kontrola otočení a „v pořádku“ mění jen soubor obsahu a nastavení, ne sbírku
    'SpustitKontroluOtoceni',
    'PrerusitKontroluOtoceni',
    // Kvalita fotek: měření jde do souboru vedle mezipaměti náhledů, ne do sbírky
    'GetStavKvality',
    'PozastavitOtisky',
    'GetSlabeFotky',
    'SpustitKontroluKvality',
    'PrerusitKontroluKvality',
    // Průchod webem a odmítnutí mění jen stav v nastavení, ne sbírku
    'SpustitPruchodWebem',
    'PrerusitPruchodWebem',
    'OdmitnoutNavrhyZWebu',
    'ZrusitOdmitnutiZWebu',
    'PlaymatePodleWikipedie',
    'ZkontrolovatOdkazy',
    'GetStavOtisku',
    // Otisky fotek a výjimky Stejných fotek jsou mimo data sbírky (soubor otisků, nastavení); Údržba se obnoví sama
    'SpustitOtisky',
    'ZkontrolovatNoveFotky',
    'OznacitRuzneFotky',
    'ZrusitRuzneFotky',
    'ZapnoutObsah',
    'ZastavitObsah',
    'VypnoutObsah',
    'GetNavrhyTagu',
    'GetPokrytiOdhadu',
    // Okno po úvodní obrazovce dostane uloženou velikost (nastaveni.go); data nemění
    'ObnovitOkno',
    // Dnešní výběr (app/dnesni-vyber.js): čtveřice, lákadlo a pořadí jen čtou
    'GetCtvericeKPorovnani',
    'GetLakadloPorovnani',
    'GetPoradiModelek',
    'GetGalerieFotek',
    'GetKolekceGalerie',
    'GetVsechnyKolekce',
    'GetIdealniModelka',
    'GetVyberyGalerie',
    // Uložené výběry Galerie jsou jen nastavení (tabulka nastaveni), data sbírky ani pohledy nemění
    'UlozitVyberGalerie',
    'SmazatVyberGalerie',
    // Zájem o kolekce jen ladí pořadí řad v Galerii (galerie_zajem.go)
    'ZaznamenatKolekci',
    // Hledání slovy: textový model je mimo databázi sbírky (stejně jako obsah fotek)
    'GetStavHledaniSlovy',
    'ZapnoutHledaniSlovy',
    'GetStavUceniTagu',
    // Zápis zájmu (otevření profilu, prohlížení fotek) jde jen do databáze učení a pohledy nemění: změnu dat
    // neohlašuje, jinak by každé otevření profilu znovu načítalo galerii
    'ZaznamenatZajem',
]);

// Zápisy, které mění jen hodnocení (srdíčka, souboje, tagy průvodce, ověření souborů): seznamy vydání, speciálů,
// kalendáře a fotografů zůstanou v mezipaměti (viz poZmeneDat v udalosti.js)
const JEN_HODNOCENI = new Set([
    'PorovnatModelky',
    'PorovnatModelkyVTematu',
    'PorovnatCtverici',
    'VratitCtverici',
    'VratitPorovnani',
    'SetHodnoceni',
    'SetHodnoceniFotek',
    'SetHodnoceniOdhadem',
    'SetTagyFotek',
    'UlozitPruvodceFotky',
    'VratitPruvodceFotky',
    'ZkontrolovatDavku',
    'ZkontrolovatSoubory',
]);

// Čtení, která si ve stejnou chvíli žádá víc pohledů (stav sezóny chce Porovnat, Síň slávy i vyhlášení naráz):
// souběžná stejná volání dostanou jednu odpověď. Výsledek nesmí volající měnit na místě.
const SLOUCIT = new Set(['GetSezona', 'GetNavrhSezony', 'GetTemataKOdemceni', 'GetSpecialy', 'GetPocetFotekKPruvodci']);
const probihajici = new Map();

// Počet rozběhnutých volání backendu: předpříprava (app/predpriprava.js) čeká, dokud nějaké běží
let rozbehnutych = 0;
export const pocetRozbehnutychVolani = () => rozbehnutych;
function pocitat(slib, jmeno) {
    rozbehnutych++;
    const zacatek = performance.now();
    const konec = () => {
        rozbehnutych--;
        zaznamenatVolani(jmeno, performance.now() - zacatek);
    };
    Promise.resolve(slib).then(konec, konec);
    return slib;
}

function obalit(jmeno) {
    const puvodni = App[jmeno];
    const funkce = (...argumenty) => pocitat(puvodni(...argumenty), jmeno);
    if (SLOUCIT.has(jmeno)) {
        return (...argumenty) => {
            const klic = `${jmeno}${JSON.stringify(argumenty)}`;
            let p = probihajici.get(klic);
            if (!p) {
                p = funkce(...argumenty);
                probihajici.set(klic, p);
                const uklid = () => { if (probihajici.get(klic) === p) probihajici.delete(klic); };
                p.then(uklid, uklid);
            }
            return p;
        };
    }
    if (CTENI.has(jmeno)) return (...argumenty) => funkce(...argumenty);
    const rozsah = JEN_HODNOCENI.has(jmeno) ? 'hodnoceni' : 'vse';
    return async (...argumenty) => {
        try {
            return await funkce(...argumenty);
        } finally {
            // Čtení zahájené před zápisem by vrátilo stará data
            probihajici.clear();
            ohlasitZmenuDat(rozsah);
        }
    };
}

export const AddBulkPhotos = /** @type {typeof App.AddBulkPhotos} */ (obalit('AddBulkPhotos'));
export const AddClanek = /** @type {typeof App.AddClanek} */ (obalit('AddClanek'));
export const AddCover = /** @type {typeof App.AddCover} */ (obalit('AddCover'));
export const AddModelka = /** @type {typeof App.AddModelka} */ (obalit('AddModelka'));
export const DeleteAlbum = /** @type {typeof App.DeleteAlbum} */ (obalit('DeleteAlbum'));
export const DeleteClanek = /** @type {typeof App.DeleteClanek} */ (obalit('DeleteClanek'));
export const DeleteFotografie = /** @type {typeof App.DeleteFotografie} */ (obalit('DeleteFotografie'));
export const DeleteFotografieHromadne = /** @type {typeof App.DeleteFotografieHromadne} */ (obalit('DeleteFotografieHromadne'));
export const DeleteModelka = /** @type {typeof App.DeleteModelka} */ (obalit('DeleteModelka'));
export const DeleteVse = /** @type {typeof App.DeleteVse} */ (obalit('DeleteVse'));
export const ExportovatDoSouboru = /** @type {typeof App.ExportovatDoSouboru} */ (obalit('ExportovatDoSouboru'));
export const GetAlbaFotografa = /** @type {typeof App.GetAlbaFotografa} */ (obalit('GetAlbaFotografa'));
export const GetCenterfoldy = /** @type {typeof App.GetCenterfoldy} */ (obalit('GetCenterfoldy'));
export const GetStavStahovaniNahledu = /** @type {typeof App.GetStavStahovaniNahledu} */ (obalit('GetStavStahovaniNahledu'));
export const SpustitStahovaniNahledu = /** @type {typeof App.SpustitStahovaniNahledu} */ (obalit('SpustitStahovaniNahledu'));
export const ZastavitStahovaniNahledu = /** @type {typeof App.ZastavitStahovaniNahledu} */ (obalit('ZastavitStahovaniNahledu'));
export const GetStavObsahu = /** @type {typeof App.GetStavObsahu} */ (obalit('GetStavObsahu'));
export const GetPodobneFotky = /** @type {typeof App.GetPodobneFotky} */ (obalit('GetPodobneFotky'));
export const GetPodobnostObsahu = /** @type {typeof App.GetPodobnostObsahu} */ (obalit('GetPodobnostObsahu'));
export const GetStejneFotky = /** @type {typeof App.GetStejneFotky} */ (obalit('GetStejneFotky'));
export const ZkontrolovatOdkazy = /** @type {typeof App.ZkontrolovatOdkazy} */ (obalit('ZkontrolovatOdkazy'));
export const GetStavOtisku = /** @type {typeof App.GetStavOtisku} */ (obalit('GetStavOtisku'));
export const SpustitOtisky = /** @type {typeof App.SpustitOtisky} */ (obalit('SpustitOtisky'));
export const PozastavitOtisky = /** @type {typeof App.PozastavitOtisky} */ (obalit('PozastavitOtisky'));
export const ZkontrolovatNoveFotky = /** @type {typeof App.ZkontrolovatNoveFotky} */ (obalit('ZkontrolovatNoveFotky'));
export const OznacitRuzneFotky = /** @type {typeof App.OznacitRuzneFotky} */ (obalit('OznacitRuzneFotky'));
export const ZrusitRuzneFotky = /** @type {typeof App.ZrusitRuzneFotky} */ (obalit('ZrusitRuzneFotky'));
export const SloucitStejneFotky = /** @type {typeof App.SloucitStejneFotky} */ (obalit('SloucitStejneFotky'));
export const VratitSlouceniStejnych = /** @type {typeof App.VratitSlouceniStejnych} */ (obalit('VratitSlouceniStejnych'));
export const ZapnoutObsah = /** @type {typeof App.ZapnoutObsah} */ (obalit('ZapnoutObsah'));
export const ZastavitObsah = /** @type {typeof App.ZastavitObsah} */ (obalit('ZastavitObsah'));
export const VypnoutObsah = /** @type {typeof App.VypnoutObsah} */ (obalit('VypnoutObsah'));
export const GetNavrhyTagu = /** @type {typeof App.GetNavrhyTagu} */ (obalit('GetNavrhyTagu'));
export const GetPokrytiOdhadu = /** @type {typeof App.GetPokrytiOdhadu} */ (obalit('GetPokrytiOdhadu'));
export const ObnovitOkno = /** @type {typeof App.ObnovitOkno} */ (obalit('ObnovitOkno'));
export const GetCtvericeKPorovnani = /** @type {typeof App.GetCtvericeKPorovnani} */ (obalit('GetCtvericeKPorovnani'));
export const GetLakadloPorovnani = /** @type {typeof App.GetLakadloPorovnani} */ (obalit('GetLakadloPorovnani'));
export const GetPoradiModelek = /** @type {typeof App.GetPoradiModelek} */ (obalit('GetPoradiModelek'));
export const GetGalerieFotek = /** @type {typeof App.GetGalerieFotek} */ (obalit('GetGalerieFotek'));
export const GetKolekceGalerie = /** @type {typeof App.GetKolekceGalerie} */ (obalit('GetKolekceGalerie'));
export const GetVsechnyKolekce = /** @type {typeof App.GetVsechnyKolekce} */ (obalit('GetVsechnyKolekce'));
export const GetIdealniModelka = /** @type {typeof App.GetIdealniModelka} */ (obalit('GetIdealniModelka'));
export const GetVyberyGalerie = /** @type {typeof App.GetVyberyGalerie} */ (obalit('GetVyberyGalerie'));
export const GetChytreVybery = /** @type {typeof App.GetChytreVybery} */ (obalit('GetChytreVybery'));
export const UlozitChytryVyber = /** @type {typeof App.UlozitChytryVyber} */ (obalit('UlozitChytryVyber'));
export const SmazatChytryVyber = /** @type {typeof App.SmazatChytryVyber} */ (obalit('SmazatChytryVyber'));
export const ZmrazitChytryVyber = /** @type {typeof App.ZmrazitChytryVyber} */ (obalit('ZmrazitChytryVyber'));
export const NajitUdajeModelky = /** @type {typeof App.NajitUdajeModelky} */ (obalit('NajitUdajeModelky'));
export const UlozitUdajeZeZdroju = /** @type {typeof App.UlozitUdajeZeZdroju} */ (obalit('UlozitUdajeZeZdroju'));
export const PlaymatePodleWikipedie = /** @type {typeof App.PlaymatePodleWikipedie} */ (obalit('PlaymatePodleWikipedie'));
export const GetZminky = /** @type {typeof App.GetZminky} */ (obalit('GetZminky'));
export const GetZdraviSbirky = /** @type {typeof App.GetZdraviSbirky} */ (obalit('GetZdraviSbirky'));
export const RozdilZalohy = /** @type {typeof App.RozdilZalohy} */ (obalit('RozdilZalohy'));
export const RocnikPodleWikipedie = /** @type {typeof App.RocnikPodleWikipedie} */ (obalit('RocnikPodleWikipedie'));
export const PrijmoutJmenoZWikipedie = /** @type {typeof App.PrijmoutJmenoZWikipedie} */ (obalit('PrijmoutJmenoZWikipedie'));
export const SpustitPruchodWebem = /** @type {typeof App.SpustitPruchodWebem} */ (obalit('SpustitPruchodWebem'));
export const PrerusitPruchodWebem = /** @type {typeof App.PrerusitPruchodWebem} */ (obalit('PrerusitPruchodWebem'));
export const GetStavPruchoduWebem = /** @type {typeof App.GetStavPruchoduWebem} */ (obalit('GetStavPruchoduWebem'));
export const GetNavrhyZWebu = /** @type {typeof App.GetNavrhyZWebu} */ (obalit('GetNavrhyZWebu'));
export const PrijmoutNavrhyZWebu = /** @type {typeof App.PrijmoutNavrhyZWebu} */ (obalit('PrijmoutNavrhyZWebu'));
export const OdmitnoutNavrhyZWebu = /** @type {typeof App.OdmitnoutNavrhyZWebu} */ (obalit('OdmitnoutNavrhyZWebu'));
export const PocetOdmitnutychZWebu = /** @type {typeof App.PocetOdmitnutychZWebu} */ (obalit('PocetOdmitnutychZWebu'));
export const ZrusitOdmitnutiZWebu = /** @type {typeof App.ZrusitOdmitnutiZWebu} */ (obalit('ZrusitOdmitnutiZWebu'));
export const GetNovaVerze = /** @type {typeof App.GetNovaVerze} */ (obalit('GetNovaVerze'));
export const GetChangelogNoveVerze = /** @type {typeof App.GetChangelogNoveVerze} */ (obalit('GetChangelogNoveVerze'));
export const ZkontrolovatNovouVerzi = /** @type {typeof App.ZkontrolovatNovouVerzi} */ (obalit('ZkontrolovatNovouVerzi'));
export const NastavitKontroluVerze = /** @type {typeof App.NastavitKontroluVerze} */ (obalit('NastavitKontroluVerze'));
export const GetPodkladyKatalogu = /** @type {typeof App.GetPodkladyKatalogu} */ (obalit('GetPodkladyKatalogu'));
export const GetNahledyKatalogu = /** @type {typeof App.GetNahledyKatalogu} */ (obalit('GetNahledyKatalogu'));
export const UlozitKatalog = /** @type {typeof App.UlozitKatalog} */ (obalit('UlozitKatalog'));
export const GetRokVeSbirce = /** @type {typeof App.GetRokVeSbirce} */ (obalit('GetRokVeSbirce'));
export const GetStavOtoceni = /** @type {typeof App.GetStavOtoceni} */ (obalit('GetStavOtoceni'));
export const SpustitKontroluOtoceni = /** @type {typeof App.SpustitKontroluOtoceni} */ (obalit('SpustitKontroluOtoceni'));
export const PrerusitKontroluOtoceni = /** @type {typeof App.PrerusitKontroluOtoceni} */ (obalit('PrerusitKontroluOtoceni'));
export const GetOtoceneFotky = /** @type {typeof App.GetOtoceneFotky} */ (obalit('GetOtoceneFotky'));
export const OznacitOtoceniVPoradku = /** @type {typeof App.OznacitOtoceniVPoradku} */ (obalit('OznacitOtoceniVPoradku'));
export const GetStavKvality = /** @type {typeof App.GetStavKvality} */ (obalit('GetStavKvality'));
export const GetSlabeFotky = /** @type {typeof App.GetSlabeFotky} */ (obalit('GetSlabeFotky'));
export const SpustitKontroluKvality = /** @type {typeof App.SpustitKontroluKvality} */ (obalit('SpustitKontroluKvality'));
export const PrerusitKontroluKvality = /** @type {typeof App.PrerusitKontroluKvality} */ (obalit('PrerusitKontroluKvality'));
export const OznacitKvalituVPoradku = /** @type {typeof App.OznacitKvalituVPoradku} */ (obalit('OznacitKvalituVPoradku'));
export const NavrhnoutVyrezy = /** @type {typeof App.NavrhnoutVyrezy} */ (obalit('NavrhnoutVyrezy'));
export const GetTitulniBezVyrezu = /** @type {typeof App.GetTitulniBezVyrezu} */ (obalit('GetTitulniBezVyrezu'));
export const OznacitVyrezVychozi = /** @type {typeof App.OznacitVyrezVychozi} */ (obalit('OznacitVyrezVychozi'));
export const UlozitVyberGalerie = /** @type {typeof App.UlozitVyberGalerie} */ (obalit('UlozitVyberGalerie'));
export const SmazatVyberGalerie = /** @type {typeof App.SmazatVyberGalerie} */ (obalit('SmazatVyberGalerie'));
export const ZaznamenatKolekci = /** @type {typeof App.ZaznamenatKolekci} */ (obalit('ZaznamenatKolekci'));
export const GetStavHledaniSlovy = /** @type {typeof App.GetStavHledaniSlovy} */ (obalit('GetStavHledaniSlovy'));
export const ZapnoutHledaniSlovy = /** @type {typeof App.ZapnoutHledaniSlovy} */ (obalit('ZapnoutHledaniSlovy'));
export const PorovnatCtverici = /** @type {typeof App.PorovnatCtverici} */ (obalit('PorovnatCtverici'));
export const VratitCtverici = /** @type {typeof App.VratitCtverici} */ (obalit('VratitCtverici'));
export const GetStavUceniTagu = /** @type {typeof App.GetStavUceniTagu} */ (obalit('GetStavUceniTagu'));
export const GetStatistiky = /** @type {typeof App.GetStatistiky} */ (obalit('GetStatistiky'));
export const GetVyvojVCase = /** @type {typeof App.GetVyvojVCase} */ (obalit('GetVyvojVCase'));
export const GetClanky = /** @type {typeof App.GetClanky} */ (obalit('GetClanky'));
export const GetClankyModelky = /** @type {typeof App.GetClankyModelky} */ (obalit('GetClankyModelky'));
export const HledatClanky = /** @type {typeof App.HledatClanky} */ (obalit('HledatClanky'));
export const HledatTexty = /** @type {typeof App.HledatTexty} */ (obalit('HledatTexty'));
export const GetCovery = /** @type {typeof App.GetCovery} */ (obalit('GetCovery'));
export const GetFotkyVyberu = /** @type {typeof App.GetFotkyVyberu} */ (obalit('GetFotkyVyberu'));
export const GetFotografieModelky = /** @type {typeof App.GetFotografieModelky} */ (obalit('GetFotografieModelky'));
export const GetFotografove = /** @type {typeof App.GetFotografove} */ (obalit('GetFotografove'));
export const GetFrontaHodnoceni = /** @type {typeof App.GetFrontaHodnoceni} */ (obalit('GetFrontaHodnoceni'));
export const GetKalendar = /** @type {typeof App.GetKalendar} */ (obalit('GetKalendar'));
export const GetModelky = /** @type {typeof App.GetModelky} */ (obalit('GetModelky'));
export const GetNavrhyDoplneni = /** @type {typeof App.GetNavrhyDoplneni} */ (obalit('GetNavrhyDoplneni'));
export const GetNejlepsiFotky = /** @type {typeof App.GetNejlepsiFotky} */ (obalit('GetNejlepsiFotky'));
export const GetNehodnoceneFotky = /** @type {typeof App.GetNehodnoceneFotky} */ (obalit('GetNehodnoceneFotky'));
export const GetPocetNehodnocenychFotek = /** @type {typeof App.GetPocetNehodnocenychFotek} */ (obalit('GetPocetNehodnocenychFotek'));
export const GetKatalogTagu = /** @type {typeof App.GetKatalogTagu} */ (obalit('GetKatalogTagu'));
export const GetTagyFotek = /** @type {typeof App.GetTagyFotek} */ (obalit('GetTagyFotek'));
export const SetTagyFotek = /** @type {typeof App.SetTagyFotek} */ (obalit('SetTagyFotek'));
export const GetPoctyTagu = /** @type {typeof App.GetPoctyTagu} */ (obalit('GetPoctyTagu'));
export const GetNepotagovaneFotky = /** @type {typeof App.GetNepotagovaneFotky} */ (obalit('GetNepotagovaneFotky'));
export const GetTemataSezon = /** @type {typeof App.GetTemataSezon} */ (obalit('GetTemataSezon'));
export const GetNavrhSezony = /** @type {typeof App.GetNavrhSezony} */ (obalit('GetNavrhSezony'));
export const GetTitulySezonModelky = /** @type {typeof App.GetTitulySezonModelky} */ (obalit('GetTitulySezonModelky'));
export const GetKrokyPruvodce = /** @type {typeof App.GetKrokyPruvodce} */ (obalit('GetKrokyPruvodce'));
export const GetStrankuNehodnocenych = /** @type {typeof App.GetStrankuNehodnocenych} */ (obalit('GetStrankuNehodnocenych'));
export const GetGalerieNejlepsich = /** @type {typeof App.GetGalerieNejlepsich} */ (obalit('GetGalerieNejlepsich'));
export const GetStrankuPruvodce = /** @type {typeof App.GetStrankuPruvodce} */ (obalit('GetStrankuPruvodce'));
export const GetFotkyKPruvodci = /** @type {typeof App.GetFotkyKPruvodci} */ (obalit('GetFotkyKPruvodci'));
export const GetPocetFotekKPruvodci = /** @type {typeof App.GetPocetFotekKPruvodci} */ (obalit('GetPocetFotekKPruvodci'));
export const UlozitPruvodceFotky = /** @type {typeof App.UlozitPruvodceFotky} */ (obalit('UlozitPruvodceFotky'));
export const VratitPruvodceFotky = /** @type {typeof App.VratitPruvodceFotky} */ (obalit('VratitPruvodceFotky'));
export const GetTemataKOdemceni = /** @type {typeof App.GetTemataKOdemceni} */ (obalit('GetTemataKOdemceni'));
export const GetFotkyKOdemceni = /** @type {typeof App.GetFotkyKOdemceni} */ (obalit('GetFotkyKOdemceni'));
export const SetObdobiSezony = /** @type {typeof App.SetObdobiSezony} */ (obalit('SetObdobiSezony'));
export const PorovnatModelkyVTematu = /** @type {typeof App.PorovnatModelkyVTematu} */ (obalit('PorovnatModelkyVTematu'));
export const GetNahledyTematu = /** @type {typeof App.GetNahledyTematu} */ (obalit('GetNahledyTematu'));
export const GetPrehled = /** @type {typeof App.GetPrehled} */ (obalit('GetPrehled'));
export const GetPrehledVydani = /** @type {typeof App.GetPrehledVydani} */ (obalit('GetPrehledVydani'));
export const GetSablonaObrazku = /** @type {typeof App.GetSablonaObrazku} */ (obalit('GetSablonaObrazku'));
export const GetSinSlavy = /** @type {typeof App.GetSinSlavy} */ (obalit('GetSinSlavy'));
export const GetSezona = /** @type {typeof App.GetSezona} */ (obalit('GetSezona'));
export const UzavritSezonu = /** @type {typeof App.UzavritSezonu} */ (obalit('UzavritSezonu'));
export const GetOdznakyModelky = /** @type {typeof App.GetOdznakyModelky} */ (obalit('GetOdznakyModelky'));
export const GetSoubojeModelky = /** @type {typeof App.GetSoubojeModelky} */ (obalit('GetSoubojeModelky'));
export const GetStavyVydani = /** @type {typeof App.GetStavyVydani} */ (obalit('GetStavyVydani'));
export const GetTagy = /** @type {typeof App.GetTagy} */ (obalit('GetTagy'));
export const GetVerze = /** @type {typeof App.GetVerze} */ (obalit('GetVerze'));
export const GetVybery = /** @type {typeof App.GetVybery} */ (obalit('GetVybery'));
export const GetVydani = /** @type {typeof App.GetVydani} */ (obalit('GetVydani'));
export const GetVydaniInfo = /** @type {typeof App.GetVydaniInfo} */ (obalit('GetVydaniInfo'));
export const ImportovatSoubory = /** @type {typeof App.ImportovatSoubory} */ (obalit('ImportovatSoubory'));
export const MaZamek = /** @type {typeof App.MaZamek} */ (obalit('MaZamek'));
export const NastavitHeslo = /** @type {typeof App.NastavitHeslo} */ (obalit('NastavitHeslo'));
export const ObnovitFotky = /** @type {typeof App.ObnovitFotky} */ (obalit('ObnovitFotky'));
export const ObnovitZalohu = /** @type {typeof App.ObnovitZalohu} */ (obalit('ObnovitZalohu'));
export const OdebratFotky = /** @type {typeof App.OdebratFotky} */ (obalit('OdebratFotky'));
export const OdebratModelkuZAlba = /** @type {typeof App.OdebratModelkuZAlba} */ (obalit('OdebratModelkuZAlba'));
export const OdebratZVyberu = /** @type {typeof App.OdebratZVyberu} */ (obalit('OdebratZVyberu'));
export const OdmitnoutNavrh = /** @type {typeof App.OdmitnoutNavrh} */ (obalit('OdmitnoutNavrh'));
export const Odemknout = /** @type {typeof App.Odemknout} */ (obalit('Odemknout'));
export const OveritOdkaz = /** @type {typeof App.OveritOdkaz} */ (obalit('OveritOdkaz'));
export const Predpripravit = /** @type {typeof App.Predpripravit} */ (obalit('Predpripravit'));
export const PrejmenovatFotografa = /** @type {typeof App.PrejmenovatFotografa} */ (obalit('PrejmenovatFotografa'));
export const PrejmenovatTag = /** @type {typeof App.PrejmenovatTag} */ (obalit('PrejmenovatTag'));
export const PrejmenovatVyber = /** @type {typeof App.PrejmenovatVyber} */ (obalit('PrejmenovatVyber'));
export const PresunoutAlbum = /** @type {typeof App.PresunoutAlbum} */ (obalit('PresunoutAlbum'));
export const PresunoutFotky = /** @type {typeof App.PresunoutFotky} */ (obalit('PresunoutFotky'));
export const PrijmoutNavrh = /** @type {typeof App.PrijmoutNavrh} */ (obalit('PrijmoutNavrh'));
export const PrijmoutNavrhy = /** @type {typeof App.PrijmoutNavrhy} */ (obalit('PrijmoutNavrhy'));
export const PridatDoVyberu = /** @type {typeof App.PridatDoVyberu} */ (obalit('PridatDoVyberu'));
export const PridatModelkuKAlbu = /** @type {typeof App.PridatModelkuKAlbu} */ (obalit('PridatModelkuKAlbu'));
export const SetCoverVyrez = /** @type {typeof App.SetCoverVyrez} */ (obalit('SetCoverVyrez'));
export const SetDatumAlba = /** @type {typeof App.SetDatumAlba} */ (obalit('SetDatumAlba'));
export const SetHodnoceni = /** @type {typeof App.SetHodnoceni} */ (obalit('SetHodnoceni'));
export const SetHodnoceniFotek = /** @type {typeof App.SetHodnoceniFotek} */ (obalit('SetHodnoceniFotek'));
export const SetHodnoceniOdhadem = /** @type {typeof App.SetHodnoceniOdhadem} */ (obalit('SetHodnoceniOdhadem'));
export const SetNetykaSe = /** @type {typeof App.SetNetykaSe} */ (obalit('SetNetykaSe'));
export const SetNetykaSeAlba = /** @type {typeof App.SetNetykaSeAlba} */ (obalit('SetNetykaSeAlba'));
export const SetPopisAlba = /** @type {typeof App.SetPopisAlba} */ (obalit('SetPopisAlba'));
export const SetPoradiFotek = /** @type {typeof App.SetPoradiFotek} */ (obalit('SetPoradiFotek'));
export const SetRotaceFotek = /** @type {typeof App.SetRotaceFotek} */ (obalit('SetRotaceFotek'));
export const SetSablonaObrazku = /** @type {typeof App.SetSablonaObrazku} */ (obalit('SetSablonaObrazku'));
export const SetSpojeniAlba = /** @type {typeof App.SetSpojeniAlba} */ (obalit('SetSpojeniAlba'));
export const SetStavVydani = /** @type {typeof App.SetStavVydani} */ (obalit('SetStavVydani'));
export const SetTitulniFotka = /** @type {typeof App.SetTitulniFotka} */ (obalit('SetTitulniFotka'));
export const SetProfilovaFotka = /** @type {typeof App.SetProfilovaFotka} */ (obalit('SetProfilovaFotka'));
export const SetProfilovyVyrez = /** @type {typeof App.SetProfilovyVyrez} */ (obalit('SetProfilovyVyrez'));
export const GetProfilovaFotka = /** @type {typeof App.GetProfilovaFotka} */ (obalit('GetProfilovaFotka'));
export const SetVydaniAlba = /** @type {typeof App.SetVydaniAlba} */ (obalit('SetVydaniAlba'));
export const SetVydaniInfo = /** @type {typeof App.SetVydaniInfo} */ (obalit('SetVydaniInfo'));
export const SeznamZaloh = /** @type {typeof App.SeznamZaloh} */ (obalit('SeznamZaloh'));
export const SloucitAlba = /** @type {typeof App.SloucitAlba} */ (obalit('SloucitAlba'));
export const SloucitModelky = /** @type {typeof App.SloucitModelky} */ (obalit('SloucitModelky'));
export const SlozkaZaloh = /** @type {typeof App.SlozkaZaloh} */ (obalit('SlozkaZaloh'));
export const SmazatVyber = /** @type {typeof App.SmazatVyber} */ (obalit('SmazatVyber'));
export const StavDatabaze = /** @type {typeof App.StavDatabaze} */ (obalit('StavDatabaze'));
export const UpdateAlbum = /** @type {typeof App.UpdateAlbum} */ (obalit('UpdateAlbum'));
export const UpdateClanek = /** @type {typeof App.UpdateClanek} */ (obalit('UpdateClanek'));
export const UpdateCover = /** @type {typeof App.UpdateCover} */ (obalit('UpdateCover'));
export const UpdateModelka = /** @type {typeof App.UpdateModelka} */ (obalit('UpdateModelka'));
export const VyberPodleNazvu = /** @type {typeof App.VyberPodleNazvu} */ (obalit('VyberPodleNazvu'));
export const VybratSouboryImportu = /** @type {typeof App.VybratSouboryImportu} */ (obalit('VybratSouboryImportu'));
export const VymazatMezipamet = /** @type {typeof App.VymazatMezipamet} */ (obalit('VymazatMezipamet'));
export const ZkontrolovatDavku = /** @type {typeof App.ZkontrolovatDavku} */ (obalit('ZkontrolovatDavku'));
export const ZkontrolovatSoubory = /** @type {typeof App.ZkontrolovatSoubory} */ (obalit('ZkontrolovatSoubory'));
export const ZrusitPoradiAlba = /** @type {typeof App.ZrusitPoradiAlba} */ (obalit('ZrusitPoradiAlba'));
export const GetSpecialy = /** @type {typeof App.GetSpecialy} */ (obalit('GetSpecialy'));
export const SetNazevSpecialu = /** @type {typeof App.SetNazevSpecialu} */ (obalit('SetNazevSpecialu'));
export const ZalozitSpecial = /** @type {typeof App.ZalozitSpecial} */ (obalit('ZalozitSpecial'));
export const GetStavUceni = /** @type {typeof App.GetStavUceni} */ (obalit('GetStavUceni'));
export const ZapomenoutUceni = /** @type {typeof App.ZapomenoutUceni} */ (obalit('ZapomenoutUceni'));
export const ZaznamenatOpravu = /** @type {typeof App.ZaznamenatOpravu} */ (obalit('ZaznamenatOpravu'));
export const GetDuvodOdhadu = /** @type {typeof App.GetDuvodOdhadu} */ (obalit('GetDuvodOdhadu'));
export const GetDvojiceKPorovnani = /** @type {typeof App.GetDvojiceKPorovnani} */ (obalit('GetDvojiceKPorovnani'));
export const PorovnatModelky = /** @type {typeof App.PorovnatModelky} */ (obalit('PorovnatModelky'));
export const VratitPorovnani = /** @type {typeof App.VratitPorovnani} */ (obalit('VratitPorovnani'));
export const ZapomenoutPorovnani = /** @type {typeof App.ZapomenoutPorovnani} */ (obalit('ZapomenoutPorovnani'));
export const GetOblibenost = /** @type {typeof App.GetOblibenost} */ (obalit('GetOblibenost'));
export const GetPrehledOblibenosti = /** @type {typeof App.GetPrehledOblibenosti} */ (obalit('GetPrehledOblibenosti'));
export const ZaznamenatZajem = /** @type {typeof App.ZaznamenatZajem} */ (obalit('ZaznamenatZajem'));
export const GetMohloByTeLibit = /** @type {typeof App.GetMohloByTeLibit} */ (obalit('GetMohloByTeLibit'));
export const GetNahledyModelek = /** @type {typeof App.GetNahledyModelek} */ (obalit('GetNahledyModelek'));
export const GetNavrhSrdicek = /** @type {typeof App.GetNavrhSrdicek} */ (obalit('GetNavrhSrdicek'));
