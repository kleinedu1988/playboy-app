# Plán a odložené nápady

Sem se zapisuje, co se má udělat později, aby se to neztratilo. Hotové věci se odsud mažou.
Větší plán po etapách je v `ROADMAP.md`; tady zůstávají chyby z alfy, drobné nápady a rozhodnutí.

## Chyby z bety

Chyby nalezené při používání (co, kde, jak to vyvolat). Opravují se ve verzích 0.90.1, 0.90.2…

Opravené (žádné otevřené):
- 0.94.2–0.94.4 (22. 10. 2026): listování obsahem čísla na kartě kalendáře poblikávalo (prolínání ve WebKitGTK).
- 0.99.4 (23. 10. 2026): Esc nebo Zrušit zavřel rozepsaný článek, úpravu čísla, Doplnit modelku a rychlou
  Novou modelku bez dotazu „Zahodit změny?“; album s víc fotografy (odděleno čárkou) chybělo na stránce každého
  z nich a přejmenování fotografa přepsalo celé pole. Nalezeno při revizi kódu pro plán 1.x.
- 0.99.6–0.99.8 (23. 10. 2026), revize kódu pěti agenty (zprávy `docs/REVIZE-*.md`): dotaz „Zahodit změny?“
  pod oknem (chyba z 0.99.4); hledání `rok:`/`narozena:`/`vydani:` s měsícem jako rozsah; holá ID mezi odkazy se
  ztrácela; falešné „úmrtí před vydáním“ u data jen rokem; Statistiky ztrácely výběr po Zpět; Zpět na smazanou
  modelku; opakovaný import zakládal stejnojmenné modelky znovu; obnovení zmizelé zálohy obnovilo prázdnou sbírku;
  sloučení modelek odpojilo články; neúplný export se uložil jako úplný; zápisy bez transakce (přejmenování, cover,
  kontrola souborů); prázdné album po nedostupných odkazech; instalátor nainstaloval i při překlepu v přepínači;
  hledání viditelné na zamčené obrazovce.
- 0.99.21 (25. 10. 2026): uložení alba (a klik na tag ve formuláři modelky) šlo na Fedoře až na druhý klik – náhled
  a text tlačítka se při opuštění pole přepisovaly a WebKitGTK první klik zahodil. Nahlášeno uživatelem.
- 0.99.9 (24. 10. 2026): online pictorialy jako výjimka v betě (úprava schématu č. 12, export 8). Není to oprava
  chyby; lhůta do 1.0.0 běží od této verze. Přitom opravený i poměr „Alba s vydáním“ v Přehledu.

Na Fedoře u uživatele prošel `./zkontrolovat.sh` bez chyb (0.99.8, 23. 10. 2026). Beta 0.90.0 prošla testovacím scénářem na čistém účtu Fedory (21. 10. 2026), včetně
Content-Security-Policy (okno není prázdné). Z alfy: Ověřeno na Fedoře 20. 10. 2026: poblikávání okna a kontextové nabídky je pryč (0.33.18),
databáze přešla do režimu WAL (0.51.0), karty, plakáty a mozaika se při rychlém rolování zaplňují rychleji
(0.51.1–0.51.3). Kdyby se poblikávání vrátilo, vyzkoušet `WEBKIT_DISABLE_DMABUF_RENDERER=1`,
`WEBKIT_DISABLE_COMPOSITING_MODE=1` nebo `GDK_BACKEND=x11` a funkční nastavit v `instalovat.sh`.

## Otevřené otázky

- Evidovat u americké edice „mám PDF“? Zatím ne (viz `ROADMAP.md`, rezerva po 1.0.0).

## Rozhodnuto nedělat

- Pevná lišta filtrů nad galerií a boční panel s filtry; filtry jsou v panelu pod tlačítkem Filtry v liště voleb.
- Alba jako sbalené dlaždice v profilu modelky.
- Patkové a dekorativní písmo, zlatá barva, ručně psané prvky – vzhled zůstává střídmý.
  Výjimkou je ikona programu (0.51.21, vybraná uživatelem): barevná retro ilustrace patří jen do nabídky
  aplikací a okna, rozhraní programu dál zůstává střídmé s jednou růžovou barvou.
- Zůstává závislost na Google Disku: fotky musí být sdílené „kdokoli s odkazem“ a bez připojení se nenačtou
  (po 1.6 Náhledy na disku se bez připojení ukážou aspoň uložené náhledy).
