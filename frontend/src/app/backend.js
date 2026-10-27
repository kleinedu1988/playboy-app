// Volání backendu. Každý zápis po dokončení ohlásí změnu dat, aby se mezipaměti pohledů zneplatnily
// na jednom místě a žádný pohled neukázal stav před změnou. Nové volání backendu se přidává i sem
// (hlídá to test backend.test.js); pokud jen čte, patří do seznamu CTENI.
import * as App from '../../wailsjs/go/main/App';
import { ohlasitZmenuDat } from './udalosti';

const CTENI = new Set([
    'GetAlbaFotografa',
    'GetCenterfoldy',
    'GetCovery',
    'GetDuvodOdhadu',
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
    'GetOblibenost',
    'GetPrehled',
    'GetPrehledOblibenosti',
    'GetPrehledVydani',
    'GetSablonaObrazku',
    'GetSinSlavy',
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
    // Zápis zájmu (otevření profilu, prohlížení fotek) jde jen do databáze učení a pohledy nemění: změnu dat
    // neohlašuje, jinak by každé otevření profilu znovu načítalo galerii
    'ZaznamenatZajem',
]);

function obalit(jmeno) {
    const funkce = App[jmeno];
    if (CTENI.has(jmeno)) return (...argumenty) => funkce(...argumenty);
    return async (...argumenty) => {
        try {
            return await funkce(...argumenty);
        } finally {
            ohlasitZmenuDat();
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
export const GetKalendar = /** @type {typeof App.GetKalendar} */ (obalit('GetKalendar'));
export const GetModelky = /** @type {typeof App.GetModelky} */ (obalit('GetModelky'));
export const GetNavrhyDoplneni = /** @type {typeof App.GetNavrhyDoplneni} */ (obalit('GetNavrhyDoplneni'));
export const GetNejlepsiFotky = /** @type {typeof App.GetNejlepsiFotky} */ (obalit('GetNejlepsiFotky'));
export const GetPrehled = /** @type {typeof App.GetPrehled} */ (obalit('GetPrehled'));
export const GetPrehledVydani = /** @type {typeof App.GetPrehledVydani} */ (obalit('GetPrehledVydani'));
export const GetSablonaObrazku = /** @type {typeof App.GetSablonaObrazku} */ (obalit('GetSablonaObrazku'));
export const GetSinSlavy = /** @type {typeof App.GetSinSlavy} */ (obalit('GetSinSlavy'));
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
export const SetNetykaSe = /** @type {typeof App.SetNetykaSe} */ (obalit('SetNetykaSe'));
export const SetNetykaSeAlba = /** @type {typeof App.SetNetykaSeAlba} */ (obalit('SetNetykaSeAlba'));
export const SetPopisAlba = /** @type {typeof App.SetPopisAlba} */ (obalit('SetPopisAlba'));
export const SetPoradiFotek = /** @type {typeof App.SetPoradiFotek} */ (obalit('SetPoradiFotek'));
export const SetRotaceFotek = /** @type {typeof App.SetRotaceFotek} */ (obalit('SetRotaceFotek'));
export const SetSablonaObrazku = /** @type {typeof App.SetSablonaObrazku} */ (obalit('SetSablonaObrazku'));
export const SetSpojeniAlba = /** @type {typeof App.SetSpojeniAlba} */ (obalit('SetSpojeniAlba'));
export const SetStavVydani = /** @type {typeof App.SetStavVydani} */ (obalit('SetStavVydani'));
export const SetTitulniFotka = /** @type {typeof App.SetTitulniFotka} */ (obalit('SetTitulniFotka'));
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
