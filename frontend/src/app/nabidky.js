// Kontextové nabídky pravého tlačítka
import { contextMenu, otevritKontextovouNabidku, zavritKontextovouNabidku } from '../ui/nabidka';
import { OdebratModelkuZAlba, OdebratZVyberu, SetSpojeniAlba, ZrusitPoradiAlba } from './backend';
import { nazevAlba, nazevVydani, rozlozitVydani } from '../lib/format';
import { stav } from './stav';
import { calendar, covers, detailView, issueView, searchInput, wall } from './prvky';
import { zpet } from './navigace';
import { nacistFotkyModelky, posunoutStranku, prepnoutRozbaleniAlba } from './profil';
import { obnovitStranku, otevritVydani, upravitVydani } from './vydani';
import { nabidkaCisla, nabidkaRoku } from './kalendar';
import { nacistCovery } from './stena';
import { nabidkaUdrzby } from './udrzba';
import { nacistNejlepsi } from './nejlepsi';
import { otevritCoverModal, otevritProfilPodleId } from './cover';
import { lbPrepnoutLupu, lightbox, otevritLightbox, zavritLightbox } from './prohlizec';
import { selectionBar, zrusitVyber } from './vyber';
import { upravitVyrez } from './vyrez';
import { otevritModelModal, otevritRychlePridani, smazatModelku } from './formular-modelky';
import { otevritAlbumModal, pridatCenterfold, smazatAlbum } from './formular-alba';
import { polozkySpravy, presunoutAlbum, pridatModelkuKAlbu, sloucitAlbum, sloucitModelku, smazatCover } from './sprava';
import { zavritOkno } from './ulozeni';
import { akceFotky } from './akce-fotky';

// Nabídka akcí pro prvek pod kurzorem; otevírá ji pravé tlačítko i tlačítko ⋯ na dlaždici a v prohlížeči
export function otevritNabidku(cil, x, y) {
    if (stav.zamceno) return;

    // Tlačítko ⋯ v prohlížeči (i klávesa nabídky nad otevřeným prohlížečem): akce s fotkou, která je vidět
    if (cil.closest('#lbMore') || (!lightbox.classList.contains('hidden') && !cil.closest('.modal-overlay'))) {
        const polozka = stav.lbPolozky[stav.lbIndex];
        if (polozka) otevritKontextovouNabidku(x, y, akceFotky(polozka, null, { poOdebrani: zavritLightbox }));
        return;
    }

    // Údržba: položka (úkol, nález kontroly, návrh), štítek nebo skupina – akce a odložení (Netýká se, V pořádku…)
    if (nabidkaUdrzby(cil, x, y)) return;

    if (cil.closest('.modal-overlay, .lightbox')) {
        zavritKontextovouNabidku();
        return;
    }

    const card = cil.closest('.card');
    let polozky;

    // Fotka v Nejlepších nebo ve vlastním výběru
    const dlazdiceNejlepsich = cil.closest('#best [data-index]');
    if (dlazdiceNejlepsich) {
        const polozka = stav.nejlepsiPolozky[parseInt(dlazdiceNejlepsich.dataset.index)];
        const fotka = polozka.fotky[0];
        otevritKontextovouNabidku(x, y, [
            { text: 'Otevřít fotku', akce: () => otevritLightbox(parseInt(dlazdiceNejlepsich.dataset.index), false, stav.nejlepsiPolozky) },
            ...akceFotky(polozka, fotka),
            ...(stav.nejlepsiVyber ? [{ text: 'Odebrat z tohoto výběru', akce: async () => { await OdebratZVyberu(stav.nejlepsiVyber, [fotka.id]); nacistNejlepsi(searchInput.value); } }] : []),
        ]);
        return;
    }

    if (card) {
        const id = parseInt(card.getAttribute('data-id'));
        const modelka = stav.nacteneModelky.find(item => item.id === id);
        if (!modelka) return;
        polozky = [
            { text: 'Otevřít profil', akce: () => otevritProfilPodleId(modelka.id) },
            { text: 'Upravit modelku…', akce: () => otevritModelModal(modelka) },
            { text: 'Upravit výřez titulní fotky', akce: () => upravitVyrez(modelka) },
            { text: 'Přidat fotky nebo album…', akce: () => otevritAlbumModal(modelka) },
            null,
            { text: 'Sloučit s jinou modelkou…', akce: () => sloucitModelku(modelka) },
            { text: 'Smazat modelku', akce: () => smazatModelku(modelka), nebezpecne: true },
        ];
    } else if (cil.closest('.wall-item')) {
        // Centerfold na stěně plakátů
        const index = parseInt(cil.closest('.wall-item').dataset.index);
        polozky = [
            { text: 'Otevřít centerfold', akce: () => otevritLightbox(index, false, stav.stenaPolozky) },
            { text: 'Otevřít profil modelky', akce: () => otevritProfilPodleId(stav.stenaPolozky[index].modelkaId) },
            { text: `Otevřít číslo ${nazevVydani(stav.stenaPolozky[index].album)}`, akce: () => otevritVydani(stav.stenaPolozky[index].album) },
            null,
            ...akceFotky(stav.stenaPolozky[index], null, { profil: false, odebrat: false }),
        ];
    } else if (cil.closest('.album')) {
        // Album v profilu modelky: na fotce jen akce fotky (album je pod jednou položkou), jinde v albu akce alba
        const album = stav.aktualniAlba[parseInt(cil.closest('.album').dataset.album)];
        const prvekPolozky = cil.closest('[data-index]');
        if (!prvekPolozky) {
            polozky = polozkyAlba(album, cil.closest('.album'));
        } else {
            const index = parseInt(prvekPolozky.dataset.index);
            const prvekFotky = cil.closest('[data-foto-id]');
            const fotka = prvekFotky && album.fotky.find(f => f.id === parseInt(prvekFotky.dataset.fotoId));
            polozky = [
                { text: album.typ === 'Centerfold' ? 'Otevřít centerfold' : 'Otevřít fotku', akce: () => otevritLightbox(index) },
                // Bez fotky (tlačítko ⋯, klávesa nabídky) jde o plakát jako celek: akce se všemi jeho stránkami
                ...akceFotky(stav.aktualniPolozky[index], fotka || null, { profil: false }),
            ];
            // Stránky spojeného plakátu se nedají přetáhnout, řadí se po jedné
            if (fotka && album.spojit) {
                const misto = album.fotky.indexOf(fotka);
                polozky.push(null);
                if (misto > 0) polozky.push({ text: 'Posunout stránku dřív', akce: () => posunoutStranku(album, fotka, -1) });
                if (misto < album.fotky.length - 1) polozky.push({ text: 'Posunout stránku později', akce: () => posunoutStranku(album, fotka, 1) });
            }
            const prvekAlba = cil.closest('.album');
            polozky.push(null, { text: `Album „${nazevAlba(album.album, album.typ)}“…`, akce: () => otevritKontextovouNabidku(x, y, polozkyAlba(album, prvekAlba)) });
        }
    } else if (!issueView.classList.contains('hidden') && cil.closest('.rocnik-karta[data-vydani], [data-prazdne]')) {
        // Měsíc na stránce ročníku (i chybějící): nabídka toho čísla, ne celého ročníku
        const karta = cil.closest('.rocnik-karta[data-vydani], [data-prazdne]');
        nabidkaCisla(karta.dataset.vydani || karta.dataset.prazdne, x, y, { poZmene: obnovitStranku });
        return;
    } else if (!issueView.classList.contains('hidden')) {
        // Stránka vydání, ročníku nebo fotografa: úpravy se dělají v profilu modelky a v přehledu coverů
        const prvekPolozky = cil.closest('[data-index]');
        polozky = [];
        if (prvekPolozky) {
            const index = parseInt(prvekPolozky.dataset.index);
            const polozka = stav.vydaniPolozky[index];
            const prvekFotky = cil.closest('[data-foto-id]');
            const fotka = prvekFotky && polozka.fotky.find(f => f.id === parseInt(prvekFotky.dataset.fotoId));
            polozky.push({ text: 'Otevřít fotku', akce: () => otevritLightbox(index, false, stav.vydaniPolozky) });
            polozky.push(...akceFotky(polozka, fotka || null), null);
        }
        if (stav.vydaniPolozky.length) polozky.push({ text: 'Spustit slideshow', akce: () => otevritLightbox(0, true, stav.vydaniPolozky) });
        // Jen u čísla s měsícem; ročník a stránka fotografa číslo nejsou
        if (rozlozitVydani(stav.aktualniVydani || '')?.mesic) polozky.push({ text: 'Upravit číslo…', akce: () => upravitVydani(stav.aktualniVydani) });
    } else if (!detailView.classList.contains('hidden')) {
        // Volné místo v profilu: Upravit a Přidat fotky jsou tlačítka pod jménem, tady je zbytek akcí s modelkou
        const modelka = stav.aktualniModelka;
        polozky = [
            ...(stav.aktualniPolozky.length ? [{ text: 'Spustit slideshow modelky', akce: () => otevritLightbox(0, true) }] : []),
            null,
            { text: 'Sloučit s jinou modelkou…', akce: () => sloucitModelku(modelka) },
            { text: 'Smazat modelku', akce: () => smazatModelku(modelka), nebezpecne: true },
        ];
    } else if (cil.closest('.cislo')) {
        // Číslo časopisu: společná nabídka čísla, s coverem i jeho akce; po označení se stránka Čísla obnoví
        const cislo = cil.closest('.cislo');
        const index = cislo.dataset.cover === undefined ? -1 : parseInt(cislo.dataset.cover);
        const cover = stav.coveryPolozky[index];
        nabidkaCisla(cislo.dataset.vydani, x, y, {
            poZmene: () => nacistCovery(searchInput.value),
            navic: cover ? [
                { text: 'Otevřít cover', akce: () => otevritLightbox(index, false, stav.coveryPolozky) },
                { text: 'Upravit cover', akce: () => otevritCoverModal(cover) },
                { text: 'Smazat cover', akce: () => smazatCover(cover), nebezpecne: true },
            ] : [],
        });
        return;
    } else if (!calendar.classList.contains('hidden')) {
        // Kalendář: nadpis roku, číslo (i prázdné políčko), jinak jen přidání coveru
        const rok = cil.closest('.cal-year-link');
        const cislo = cil.closest('[data-vydani], [data-prazdne]');
        if (rok) nabidkaRoku(rok.dataset.vydani, x, y);
        else if (cislo) nabidkaCisla(cislo.dataset.vydani || cislo.dataset.prazdne, x, y);
        else otevritKontextovouNabidku(x, y, [{ text: 'Přidat cover…', akce: () => otevritCoverModal() }]);
        return;
    } else if (!covers.classList.contains('hidden')) {
        // Volný prostor na stránce Čísla
        polozky = [{ text: 'Přidat cover…', akce: () => otevritCoverModal() }];
    } else if (!wall.classList.contains('hidden')) {
        // Volný prostor na stěně centerfoldů
        polozky = [{ text: 'Přidat centerfold…', akce: pridatCenterfold }];
    } else {
        polozky = [{ text: 'Přidat modelku…', akce: otevritRychlePridani }, ...polozkySpravy()];
    }

    otevritKontextovouNabidku(x, y, polozky);
}

// Akce alba v profilu modelky (⋯ v hlavičce alba, pravé tlačítko mimo fotky, položka „Album …“ v nabídce fotky).
// Vydání alba je štítek v hlavičce a úprava modelky tlačítko v panelu, proto tu nejsou.
function polozkyAlba(album, prvekAlba) {
    const centerfold = album.typ === 'Centerfold';
    // Úpravy alba jdou vždy na jeho hlavní modelku, i když je otevřený profil další modelky
    const vlastnik = { id: album.modelkaId, jmeno: '' };
    const mrizka = prvekAlba.querySelector('.photos-grid.zkracena, .photos-grid.rozbalena');
    const zkracena = mrizka?.classList.contains('zkracena');
    return [
        { text: 'Spustit slideshow alba', akce: () => otevritLightbox(stav.aktualniPolozky.indexOf(album.polozky[0]), true) },
        { text: 'Upravit album nebo přidat fotky…', akce: () => otevritAlbumModal(vlastnik, album) },
        ...(mrizka ? [{ text: zkracena ? 'Rozbalit album' : 'Sbalit album', akce: () => prepnoutRozbaleniAlba(mrizka, zkracena) }] : []),
        ...(centerfold && album.fotky.length > 1 ? [{
            text: album.spojit ? 'Rozdělit plakát na samostatné fotky' : 'Spojit stránky do jednoho plakátu',
            akce: async () => {
                await SetSpojeniAlba(album.modelkaId, album.album, album.typ, !album.spojit);
                nacistFotkyModelky(stav.aktualniModelka.id);
            },
        }] : []),
        ...(album.rucniPoradi && !centerfold ? [{
            text: 'Řadit album podle srdíček',
            akce: async () => {
                await ZrusitPoradiAlba(album.modelkaId, album.album, album.typ);
                nacistFotkyModelky(stav.aktualniModelka.id);
            },
        }] : []),
        null,
        { text: 'Přidat další modelku k albu…', akce: () => pridatModelkuKAlbu(album) },
        ...album.dalsiModelky.map(m => ({ text: `Odebrat z alba: ${m.jmeno}`, akce: async () => {
            await OdebratModelkuZAlba(album.modelkaId, album.album, album.typ, m.id);
            nacistFotkyModelky(stav.aktualniModelka.id);
        } })),
        { text: 'Přesunout k jiné modelce…', akce: () => presunoutAlbum(album) },
        ...(stav.aktualniAlba.some(a => a !== album && a.modelkaId === album.modelkaId)
            ? [{ text: 'Sloučit s jiným albem…', akce: () => sloucitAlbum(album) }] : []),
        { text: 'Smazat album', akce: () => smazatAlbum(album, album.fotky.length), nebezpecne: true },
    ];
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    document.addEventListener('contextmenu', (e) => {
        // V textových polích a v modálních oknech vlastní nabídku nezobrazujeme
        if (e.target.closest('input, textarea, select')) return;
        e.preventDefault();
        otevritNabidku(e.target, e.clientX, e.clientY);
    });

    // Tlačítko ⋯ otevře tutéž nabídku jako pravé tlačítko; zachytí se dřív, než klik otevře fotku
    document.addEventListener('click', (e) => {
        const tlacitko = e.target.closest('.tile-more');
        if (!tlacitko) return;
        e.stopPropagation();
        e.preventDefault();
        const r = tlacitko.getBoundingClientRect();
        otevritNabidku(tlacitko, r.left, r.bottom + 4);
    }, true);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#contextMenu')) zavritKontextovouNabidku();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        // Esc zavře nabídku, jinak se z profilu vrátí na výběr modelek
        const okno = [...document.querySelectorAll('.modal-overlay:not(.hidden)')].pop();
        if (!contextMenu.classList.contains('hidden')) {
            zavritKontextovouNabidku();
        } else if (okno) {
            zavritOkno(okno);
        } else if (!lightbox.classList.contains('hidden')) {
            // Esc nejdřív vypne lupu, teprve potom zavře prohlížeč; výběr pod ním zůstane
            if (stav.lbLupa) lbPrepnoutLupu(false);
            else zavritLightbox();
        } else if (!selectionBar.classList.contains('hidden')) {
            zrusitVyber();
        } else if (stav.zrusitUpravuVyrezu) {
            stav.zrusitUpravuVyrezu();
        } else if ((!detailView.classList.contains('hidden') || !issueView.classList.contains('hidden')) && !document.querySelector('.modal-overlay:not(.hidden)')) {
            zpet();
        }
    });

    window.addEventListener('blur', zavritKontextovouNabidku);

    window.addEventListener('resize', zavritKontextovouNabidku);
}
