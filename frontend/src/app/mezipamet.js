// Mezipaměť dat, která sdílí víc pohledů. Po každém zápisu do databáze se zahodí (viz backend.js).
import { GetCasopisy, GetModelky, GetSpecialy } from './backend';
import { nastavitCasopisy, nastavitNazvySpecialu } from '../lib/format';
import { poZmeneDat } from './udalosti';
import { stav } from './stav';

let modelky = null;

// Všechny modelky; seznam se načte jednou a sdílí, dokud se data nezmění. Volající dostane vlastní kopii pole.
export async function vsechnyModelky() {
    if (!modelky) {
        modelky = GetModelky('').then(seznam => seznam || []);
        modelky.catch(() => { modelky = null; });
    }
    return (await modelky).slice();
}

// Modelky podle id (chytré hledání ve fotkách: vlasy:, vyska:, pas: … platí pro modelku fotky)
export async function modelkyPodleId() {
    return new Map((await vsechnyModelky()).map(m => [m.id, m]));
}

// Oblíbenost modelek podle id (řazení fotek se stejnými srdíčky v Nejlepších a na stěně)
export async function oblibenostModelek() {
    return new Map((await vsechnyModelky()).map(m => [m.id, m.oblibenost || 0]));
}

// Názvy speciálů a časopisů pro nazevVydani; po změně dat se načtou znovu
export async function nacistSpecialy() {
    const [specialy, casopisy] = await Promise.all([GetSpecialy(), GetCasopisy().catch(() => [])]);
    nastavitNazvySpecialu(specialy);
    nastavitCasopisy(casopisy);
}

poZmeneDat((rozsah) => {
    modelky = null;
    stav.stenaData = stav.coveryData = stav.nejlepsiData = null;
    // Hodnocení nemění vydání ani speciály
    if (rozsah === 'hodnoceni') return;
    nacistSpecialy();
    stav.kalendarData = stav.stavyVydaniData = null;
});
