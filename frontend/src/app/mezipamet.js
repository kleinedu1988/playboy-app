// Mezipaměť dat, která sdílí víc pohledů. Po každém zápisu do databáze se zahodí (viz backend.js).
import { GetModelky } from './backend';
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

poZmeneDat(() => {
    modelky = null;
    stav.stenaData = stav.coveryData = stav.kalendarData = stav.stavyVydaniData = stav.nejlepsiData = null;
});
