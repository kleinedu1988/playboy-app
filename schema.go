package main

import (
	"fmt"
	"strings"
)

// Úprava č. 6: album jako plný záznam. Fotky jsou v tabulce fotky a odkazují na album (album_id); vydání
// a spojení plakátu jsou údaje alba; cover časopisu je album bez modelky (modelka_id NULL) místo zástupné
// modelky 0. Cizí klíče jsou zapnuté.
//
// Dosavadní název fotografie zůstává jako pohled se stejnými sloupci jako dřív (modelka_id u coveru je 0,
// vydání je u všech typů vyplněné jednotně), takže čtení se nemění. Zápisy do pohledu převádějí spouštěče:
// fotka se zařadí do alba podle modelky, názvu a typu (album se případně založí) a vydání se spojením se
// zapíšou k albu. Kde je potřeba skutečné id nebo počet změněných řádků, zapisuje se přímo do fotky a alba.

// Vydání alba podle typu: u centerfoldu a coveru je to název alba, u ostatních vlastní údaj
const vydaniPodleTypu = `CASE WHEN %[1]styp IN ('Centerfold', 'Cover') THEN %[1]salbum ELSE COALESCE(%[1]svydani, '') END`

// Pictorial jen na webu (Cyber Girl, Coed, Muse…): nepatří k číslu časopisu, místo vydání má datum nafocení
const typOnline = "Pictorial online"

// Cyber Girl of the Week / of the Month: online alba, u kterých se z data nafocení počítá týden, nebo měsíc
// (v okně alba volba u Pictorial online)
const (
	typCGTydne  = "Cyber Girl týdne"
	typCGMesice = "Cyber Girl měsíce"
)

// Online album (Pictorial online nebo Cyber Girl týdne či měsíce): bez vydání, s datem nafocení
func jeOnlineTyp(typ string) bool { return typ == typOnline || typ == typCGTydne || typ == typCGMesice }

// Uzavřené výčty. Rozšiřovat je jde bez změny schématu (přidáním hodnoty sem a do rozhraní), měnit ne.
var (
	// Typy alb; cover časopisu je album bez modelky, Pictorial online je pictorial jen na webu (bez vydání, s datem)
	typyAlb = map[string]bool{"Pictorial": true, "Centerfold": true, "Cover": true, typOnline: true, typCGTydne: true, typCGMesice: true}
	// Edice kromě výchozí US (ta se do vydání nepíše)
	dalsiEdice = map[string]bool{"CZ": true}
	// Klíče „netýká se" u modelky a u alba
	klicNetykaSeModelky = map[string]bool{"titulni": true, "zakladni": true, "vzhled": true, "zarazeni": true, "centerfold": true, "hodnoceni": true}
	klicNetykaSeAlba    = map[string]bool{"text": true, "vydani": true}
)

// Údaje modelky s pevnou nabídkou ve formuláři; ukládají se v tomto tvaru bez ohledu na velikost písmen
var (
	moznostiPrsaTyp   = []string{"Přírodní", "Silikonová"}
	moznostiOchlupeni = []string{"Oholené", "Zastřižené", "Přírodní"}
)

// Hodnota v tvaru z nabídky; neznámou vrací beze změny s ok = false
func volbaZNabidky(hodnota string, moznosti []string) (string, bool) {
	hodnota = strings.TrimSpace(hodnota)
	if hodnota == "" {
		return "", true
	}
	for _, m := range moznosti {
		if strings.EqualFold(hodnota, m) {
			return m, true
		}
	}
	return hodnota, false
}

// Edice z vydání (RRRR-MM-ED nebo RRRR-ED); prázdná znamená US
func edicePodleVydani(vydani string) string {
	if i := strings.LastIndex(vydani, "-"); i > 0 && len(vydani)-i == 3 && vydani[i+1] >= 'A' {
		return vydani[i+1:]
	}
	return ""
}

// Jedno pravidlo pro klíč alba při zápisu i importu
func (a *App) overitKlicAlba(modelkaID int, album, typ string) error {
	switch {
	case strings.TrimSpace(album) == "":
		return fmt.Errorf("album nemá název")
	case !typyAlb[typ]:
		return fmt.Errorf("neznámý typ alba „%s“", typ)
	case typ == "Cover" && modelkaID != 0:
		return fmt.Errorf("cover patří k vydání, ne k modelce")
	case typ != "Cover" && (modelkaID == 0 || a.jmenoModelky(modelkaID) == ""):
		return fmt.Errorf("modelka neexistuje")
	case (typ == "Centerfold" || typ == "Cover") && !vzorVydani.MatchString(album):
		return fmt.Errorf("název centerfoldu a coveru musí být vydání ve tvaru RRRR-MM nebo RRRR-Snn (s příponou edice, např. 2011-07-CZ)")
	}
	if e := edicePodleVydani(album); (typ == "Centerfold" || typ == "Cover") && e != "" && !dalsiEdice[e] {
		return fmt.Errorf("neznámá edice „%s“", e)
	}
	return nil
}

var krokyAlbumJakoZaznam = []string{
	`CREATE TABLE alba_nova (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		modelka_id INTEGER REFERENCES modelky(id) ON DELETE CASCADE,
		album TEXT NOT NULL,
		typ TEXT NOT NULL,
		vydani TEXT NOT NULL DEFAULT '',
		spojit INTEGER NOT NULL DEFAULT 0,
		popis TEXT,
		fotograf TEXT,
		netyka_se TEXT
	)`,
	`CREATE UNIQUE INDEX alba_klic ON alba_nova(COALESCE(modelka_id, 0), album, typ)`,
	// Stávající řádky alb si nechají id (odkazují na ně další modelky alb)
	`INSERT INTO alba_nova (id, modelka_id, album, typ, popis, fotograf, netyka_se)
		SELECT id, NULLIF(modelka_id, 0), album, typ, popis, fotograf, netyka_se FROM alba`,
	`INSERT OR IGNORE INTO alba_nova (modelka_id, album, typ)
		SELECT DISTINCT NULLIF(modelka_id, 0), album, typ FROM fotografie`,
	// Alba modelek, které už neexistují, nejsou v programu vidět a cizí klíč by je nepřijal
	`DELETE FROM alba_nova WHERE modelka_id IS NOT NULL AND modelka_id NOT IN (SELECT id FROM modelky)`,
	// Stará tabulka má modelku 0 místo NULL (úprava č. 2); porovnání bez COALESCE na její straně použije
	// index fotografie_soubor_v_albu, jinak by každé album procházelo všechny fotky
	`UPDATE alba_nova SET
		vydani = CASE WHEN typ IN ('Centerfold', 'Cover') THEN album ELSE COALESCE((SELECT MAX(f.vydani) FROM fotografie f
			WHERE f.modelka_id = COALESCE(alba_nova.modelka_id, 0) AND f.album = alba_nova.album AND f.typ = alba_nova.typ), '') END,
		spojit = COALESCE((SELECT MAX(f.spojit) FROM fotografie f
			WHERE f.modelka_id = COALESCE(alba_nova.modelka_id, 0) AND f.album = alba_nova.album AND f.typ = alba_nova.typ), 0)`,
	`CREATE TABLE fotky (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		album_id INTEGER NOT NULL REFERENCES alba_nova(id) ON DELETE CASCADE,
		drive_file_id TEXT NOT NULL,
		rotace INTEGER NOT NULL DEFAULT 0,
		hodnoceni INTEGER NOT NULL DEFAULT 0,
		poradi INTEGER,
		pridano TEXT,
		overeno TEXT,
		nedostupne_od TEXT,
		UNIQUE (album_id, drive_file_id)
	)`,
	// Fotky si nechají id (odkazují na ně výběry)
	`INSERT INTO fotky (id, album_id, drive_file_id, rotace, hodnoceni, poradi, pridano, overeno, nedostupne_od)
		SELECT f.id, a.id, f.drive_file_id, COALESCE(f.rotace, 0), COALESCE(f.hodnoceni, 0), f.poradi, f.pridano, f.overeno, f.nedostupne_od
		FROM fotografie f JOIN alba_nova a ON COALESCE(a.modelka_id, 0) = COALESCE(f.modelka_id, 0) AND a.album = f.album AND a.typ = f.typ`,
	`DELETE FROM vybery_fotky WHERE fotografie_id NOT IN (SELECT id FROM fotky)`,
	`DELETE FROM alba_modelky WHERE album_id NOT IN (SELECT id FROM alba_nova)`,
	`DROP TABLE fotografie`,
	`DROP TABLE alba`,
	`ALTER TABLE alba_nova RENAME TO alba`,
	`CREATE INDEX alba_vydani ON alba(vydani)`,
	`CREATE INDEX fotky_album ON fotky(album_id)`,
	`CREATE TRIGGER alba_modelky_po_albu AFTER DELETE ON alba
		BEGIN DELETE FROM alba_modelky WHERE album_id = OLD.id; END`,
	`CREATE TRIGGER vybery_po_fotce AFTER DELETE ON fotky
		BEGIN DELETE FROM vybery_fotky WHERE fotografie_id = OLD.id; END`,

	// Pohled se sloupci dosavadní tabulky fotografie
	`CREATE VIEW fotografie AS
		SELECT f.id, COALESCE(a.modelka_id, 0) AS modelka_id, a.album, a.typ, f.drive_file_id, f.rotace, a.spojit, a.vydani,
			f.hodnoceni, f.poradi, f.pridano, f.overeno, f.nedostupne_od, f.album_id
		FROM fotky f JOIN alba a ON a.id = f.album_id`,
	`CREATE TRIGGER fotografie_vlozit INSTEAD OF INSERT ON fotografie BEGIN
		INSERT OR IGNORE INTO alba (modelka_id, album, typ, vydani, spojit)
			VALUES (NULLIF(NEW.modelka_id, 0), NEW.album, NEW.typ,
				CASE WHEN NEW.typ IN ('Centerfold', 'Cover') THEN NEW.album ELSE COALESCE(NEW.vydani, '') END, COALESCE(NEW.spojit, 0));
		INSERT INTO fotky (album_id, drive_file_id, rotace, hodnoceni, poradi, pridano, overeno, nedostupne_od)
			VALUES ((SELECT id FROM alba WHERE COALESCE(modelka_id, 0) = COALESCE(NEW.modelka_id, 0) AND album = NEW.album AND typ = NEW.typ),
				NEW.drive_file_id, COALESCE(NEW.rotace, 0), COALESCE(NEW.hodnoceni, 0), NEW.poradi, NEW.pridano, NEW.overeno, NEW.nedostupne_od);
	END`,
	// Změna modelky, názvu nebo typu přesune fotku do jiného alba (případně nově založeného); vydání a spojení jdou k albu
	`CREATE TRIGGER fotografie_upravit INSTEAD OF UPDATE ON fotografie BEGIN
		INSERT OR IGNORE INTO alba (modelka_id, album, typ, vydani, spojit)
			VALUES (NULLIF(NEW.modelka_id, 0), NEW.album, NEW.typ,
				CASE WHEN NEW.typ IN ('Centerfold', 'Cover') THEN NEW.album ELSE COALESCE(NEW.vydani, '') END, COALESCE(NEW.spojit, 0));
		UPDATE fotky SET
			album_id = (SELECT id FROM alba WHERE COALESCE(modelka_id, 0) = COALESCE(NEW.modelka_id, 0) AND album = NEW.album AND typ = NEW.typ),
			drive_file_id = NEW.drive_file_id, rotace = COALESCE(NEW.rotace, 0), hodnoceni = COALESCE(NEW.hodnoceni, 0),
			poradi = NEW.poradi, pridano = NEW.pridano, overeno = NEW.overeno, nedostupne_od = NEW.nedostupne_od
		WHERE id = OLD.id;
		UPDATE alba SET
			vydani = CASE WHEN NEW.typ IN ('Centerfold', 'Cover') THEN NEW.album ELSE COALESCE(NEW.vydani, '') END,
			spojit = COALESCE(NEW.spojit, 0)
		WHERE id = (SELECT album_id FROM fotky WHERE id = OLD.id);
	END`,
	`CREATE TRIGGER fotografie_smazat INSTEAD OF DELETE ON fotografie BEGIN
		DELETE FROM fotky WHERE id = OLD.id;
	END`,
}

func (a *App) migraceAlbumJakoZaznam() error {
	for _, krok := range krokyAlbumJakoZaznam {
		if _, err := a.db.Exec(krok); err != nil {
			return err
		}
	}
	return nil
}

// Úprava č. 12: datum nafocení nebo zveřejnění online alba (typ Pictorial online) ve tvaru RRRR, RRRR-MM
// nebo RRRR-MM-DD. Je to jen údaj alba: do vydání, kalendáře ani titulní fotky modelky se nepřenáší.
func (a *App) migraceDatumAlba() error {
	if a.maSloupec("alba", "datum") {
		return nil
	}
	_, err := a.db.Exec("ALTER TABLE alba ADD COLUMN datum TEXT")
	return err
}

// Úprava č. 13: hodnocení modelky po polovinách srdíčka (0–5 po 0,5). Nový sloupec hodnoceni_pul je počet
// polovin (0–10) a program čte ten (řádek bez něj, NULL, se čte jako hodnoceni × 2). Dosavadní sloupec
// hodnoceni zůstává a program do něj dál zapisuje celá srdíčka zaokrouhlená dolů (hodnoceni_pul / 2): starší
// program, který databázi ve schématu 13 otevře jen pro čtení, tak ukáže 3½ srdíčka jako 3 a nic nepokazí.
// Spouštěče drží oba sloupce v souladu i při zápisu jen do jednoho z nich (ruční SQL, starší kód). Hodnocení
// fotek zůstává v celých srdíčkách.
const sloupecHodnoceniPul = "COALESCE(hodnoceni_pul, MIN(MAX(COALESCE(hodnoceni, 0), 0), 5) * 2)"

var krokyHodnoceniPul = []string{
	`ALTER TABLE modelky ADD COLUMN hodnoceni_pul INTEGER`,
	`UPDATE modelky SET hodnoceni_pul = MIN(MAX(COALESCE(hodnoceni, 0), 0), 5) * 2`,
	// Zápis jen celých srdíček (starší způsob): poloviny se odvodí z nich
	`CREATE TRIGGER modelky_hodnoceni_cela AFTER UPDATE OF hodnoceni ON modelky
		WHEN NEW.hodnoceni_pul IS NULL OR NEW.hodnoceni_pul / 2 <> COALESCE(NEW.hodnoceni, 0)
		BEGIN UPDATE modelky SET hodnoceni_pul = MIN(MAX(COALESCE(NEW.hodnoceni, 0), 0), 5) * 2 WHERE id = NEW.id; END`,
	// Zápis jen polovin: celá srdíčka zaokrouhlená dolů pro starší čtenáře
	`CREATE TRIGGER modelky_hodnoceni_poloviny AFTER UPDATE OF hodnoceni_pul ON modelky
		WHEN NEW.hodnoceni_pul IS NOT NULL AND COALESCE(NEW.hodnoceni, 0) <> NEW.hodnoceni_pul / 2
		BEGIN UPDATE modelky SET hodnoceni = NEW.hodnoceni_pul / 2 WHERE id = NEW.id; END`,
}

func (a *App) migraceHodnoceniPul() error {
	if a.maSloupec("modelky", "hodnoceni_pul") {
		return nil
	}
	for _, krok := range krokyHodnoceniPul {
		if _, err := a.db.Exec(krok); err != nil {
			return err
		}
	}
	return nil
}
