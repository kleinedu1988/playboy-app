// Zájem o modelky pro oblíbenost (oblibenost_zajem.go): otevření profilu a čas prohlížení fotek v prohlížeči.
// Zapisuje se jen do databáze učení; pohledy se kvůli tomu nepřenačítají.
import { ZaznamenatZajem } from './backend';

// Déle u jedné fotky se nepočítá (nejspíš jsi od počítače odešel); skryté okno se nepočítá vůbec
const MAX_NA_FOTKU = 60_000;

let modelka = 0;
let od = 0;
const sekundy = new Map();

const zapsat = (id, druh, s) => ZaznamenatZajem(id, druh, s).catch(() => { /* zájem je jen doplněk */ });

export function zaznamenatProfil(id) {
    if (id > 0) zapsat(id, 'profil', 0);
}

function pricist() {
    if (modelka && od) sekundy.set(modelka, (sekundy.get(modelka) || 0) + Math.min(performance.now() - od, MAX_NA_FOTKU) / 1000);
    od = 0;
}

// Prohlížeč ukázal fotku modelky (0 = obálka bez modelky)
export function sledovatFotku(id) {
    pricist();
    modelka = id > 0 ? id : 0;
    od = modelka && !document.hidden ? performance.now() : 0;
}

// Zavření prohlížeče: čas za každou modelku se zapíše
export function ukoncitProhlizeni() {
    pricist();
    modelka = 0;
    for (const [id, s] of sekundy) zapsat(id, 'fotky', Math.round(s));
    sekundy.clear();
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) pricist();
    else if (modelka) od = performance.now();
});
