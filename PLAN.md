# Plán a odložené nápady

Sem se zapisuje, co se má udělat později, aby se to neztratilo. Hotové věci se odsud mažou.
Větší plán po etapách je v `ROADMAP.md`; tady zůstávají chyby z alfy, drobné nápady a rozhodnutí.

## Chyby z alfy

Chyby nalezené při používání na skutečné sbírce (co, kde, jak to vyvolat). Opravují se v dalších verzích řady 0.5x.

Zatím žádné otevřené. Ověřeno na Fedoře 20. 10. 2026: poblikávání okna a kontextové nabídky je pryč (0.33.18),
databáze přešla do režimu WAL (0.51.0), karty, plakáty a mozaika se při rychlém rolování zaplňují rychleji
(0.51.1–0.51.3). Kdyby se poblikávání vrátilo, vyzkoušet `WEBKIT_DISABLE_DMABUF_RENDERER=1`,
`WEBKIT_DISABLE_COMPOSITING_MODE=1` nebo `GDK_BACKEND=x11` a funkční nastavit v `instalovat.sh`.

## Otevřené otázky

- Které číslo je první číslo české edice? Mapa výtisků CZ v Přehledu začíná lednem 1991.
- Evidovat u americké edice „mám PDF“? Zatím ne (viz `ROADMAP.md`, verze 1.1).

## Rozhodnuto nedělat

- Pevná lišta filtrů nad galerií a boční panel s filtry; filtry jsou v panelu pod tlačítkem Filtry v liště voleb.
- Alba jako sbalené dlaždice v profilu modelky.
- Patkové a dekorativní písmo, zlatá barva, ručně psané prvky – vzhled zůstává střídmý.
- Zůstává závislost na Google Disku: fotky musí být sdílené „kdokoli s odkazem“ a bez připojení se nenačtou.
