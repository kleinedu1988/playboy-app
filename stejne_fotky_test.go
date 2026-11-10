package main

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"pinup-katalog/internal/obsah"
)

// Umělá „fotka“: plynulé přechody a pár ploch, podle semínka jiná
func umelaFotka(semeno, w, h int) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	fs := float64(semeno)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			u, v := float64(x)/float64(w), float64(y)/float64(h)
			r := 127 + 120*math.Sin(6*u*(1+fs/3)+fs)
			g := 127 + 120*math.Cos(5*v*(1+fs/5)-fs)
			b := 127 + 120*math.Sin(4*(u+v)+fs*2)
			if (int(u*4+fs)+int(v*3))%3 == 0 {
				r, g = g, r
			}
			img.Set(x, y, color.RGBA{uint8(r), uint8(g), uint8(b), 255})
		}
	}
	return img
}

func zmensit(img image.Image, w, h int) *image.RGBA {
	b := img.Bounds()
	out := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			out.Set(x, y, img.At(b.Min.X+x*b.Dx()/w, b.Min.Y+y*b.Dy()/h))
		}
	}
	return out
}

func jpegData(t testing.TB, img image.Image, kvalita int) []byte {
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: kvalita}); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestOtiskStejneAJineFotky(t *testing.T) {
	puvodni := umelaFotka(1, 400, 600)
	a, _ := otiskZDat(jpegData(t, puvodni, 92))
	kopie, _ := otiskZDat(jpegData(t, zmensit(puvodni, 267, 400), 70))
	jina, _ := otiskZDat(jpegData(t, umelaFotka(7, 400, 600), 92))
	if d := shodaOtisku(a, kopie); d == "" {
		dd, dp := a.vzdalenost(kopie)
		t.Fatalf("zmenšená a přeuložená kopie se neshoduje (dHash %d, pHash %d)", dd, dp)
	}
	if d := shodaOtisku(a, jina); d != "" {
		dd, dp := a.vzdalenost(jina)
		t.Fatalf("jiná fotka se shoduje (%s; dHash %d, pHash %d)", d, dd, dp)
	}
	if _, ok := spocitatOtisk(image.NewRGBA(image.Rect(0, 0, 4, 4))); ok {
		t.Fatal("z příliš malého obrázku otisk nejde")
	}
}

func soubor(znak string) string { return strings.Repeat(znak, 29) }

// Aplikace se třemi soubory (A a kopie B jsou stejné, C jiná) a s náhledy z paměti
func appSeStejnymiFotkami(t *testing.T) (*App, int, int) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Bára", Tetovani: -1, Piercing: -1})
	anna, bara := idModelky(t, a, "Anna"), idModelky(t, a, "Bára")
	puvodni := umelaFotka(2, 400, 600)
	nahledy := map[string][]byte{
		soubor("A"): jpegData(t, puvodni, 92),
		soubor("B"): jpegData(t, zmensit(puvodni, 300, 450), 75),
		soubor("C"): jpegData(t, umelaFotka(9, 400, 600), 92),
		soubor("D"): jpegData(t, zmensit(puvodni, 320, 480), 80),
	}
	o := a.otisky()
	o.nahled = func(_ context.Context, id string) ([]byte, error) {
		if d, ok := nahledy[id]; ok {
			return d, nil
		}
		return nil, errors.New("není")
	}
	// Anna: A a C v pictorialu, B (kopie A) v jiném albu i znovu v pictorialu; Bára: kopie B ve svém albu
	a.AddBulkPhotos(anna, "Pláž", "Pictorial", soubor("A")+" "+soubor("C")+" "+soubor("B"))
	a.AddBulkPhotos(anna, "Studio", "Pictorial", soubor("B"))
	a.AddBulkPhotos(bara, "Bazén", "Pictorial", soubor("B"))
	return a, anna, bara
}

func TestStejneFotkySkupinySlouceniAVraceni(t *testing.T) {
	a, anna, bara := appSeStejnymiFotkami(t)
	o := a.otisky()
	if !a.SpustitOtisky() {
		t.Fatal("výpočet otisků se nespustil")
	}
	<-o.konec
	if st := a.GetStavOtisku(); st.Hotovo != 3 || st.Celkem != 3 || st.Bezi {
		t.Fatalf("stav otisků %+v", st)
	}
	skupiny := a.GetStejneFotky()
	if len(skupiny) != 1 || len(skupiny[0].Soubory) != 2 {
		t.Fatalf("skupiny %+v", skupiny)
	}
	sk := skupiny[0]
	if sk.Soubory[0].DriveID != soubor("A") || sk.Soubory[1].DriveID != soubor("B") || sk.Duvod == "" {
		t.Fatalf("skupina %+v", sk)
	}
	if len(sk.Soubory[1].Fotky) != 3 {
		t.Fatalf("B má být ve třech albech, je v %d", len(sk.Soubory[1].Fotky))
	}

	// Kopie B v Pláži má víc srdíček a tag: po sloučení je dostane A
	var kopieVPlazi, aVPlazi int
	for _, f := range a.GetFotografieModelky(anna) {
		if f.Album == "Pláž" && f.DriveID == soubor("B") {
			kopieVPlazi = f.ID
		}
		if f.Album == "Pláž" && f.DriveID == soubor("A") {
			aVPlazi = f.ID
		}
	}
	a.db.Exec(`UPDATE fotky SET hodnoceni = 5 WHERE id = ?`, kopieVPlazi)
	a.db.Exec(`INSERT INTO fotky_tagy (fotka_id, tag) VALUES (?, 'plaz')`, kopieVPlazi)

	v := a.SloucitStejneFotky(soubor("A"), []string{soubor("B")})
	if v.Chyba || len(v.Odebrano) != 1 || len(v.Nahrazeno) != 2 {
		t.Fatalf("sloučení %+v", v)
	}
	soubory := func(id int) []string {
		var s []string
		for _, f := range a.GetFotografieModelky(id) {
			s = append(s, f.Album+":"+f.DriveID[:1])
		}
		sort.Strings(s)
		return s
	}
	if got := strings.Join(soubory(anna), " "); got != "Pláž:A Pláž:C Studio:A" {
		t.Fatalf("Anna po sloučení: %s", got)
	}
	if got := strings.Join(soubory(bara), " "); got != "Bazén:A" {
		t.Fatalf("Bára po sloučení: %s", got)
	}
	var srdicka int
	a.db.QueryRow(`SELECT hodnoceni FROM fotky WHERE id = ?`, aVPlazi).Scan(&srdicka)
	if srdicka != 5 || len(tagyFotky(a.db, aVPlazi)) != 1 {
		t.Fatalf("srdíčka %d a tagy %v ponechané fotky", srdicka, tagyFotky(a.db, aVPlazi))
	}
	if len(a.GetStejneFotky()) != 0 {
		t.Fatal("po sloučení už skupina není")
	}

	if !a.VratitSlouceniStejnych(v) {
		t.Fatal("vrácení selhalo")
	}
	if got := strings.Join(soubory(anna), " "); got != "Pláž:A Pláž:B Pláž:C Studio:B" {
		t.Fatalf("Anna po vrácení: %s", got)
	}
	if got := strings.Join(soubory(bara), " "); got != "Bazén:B" {
		t.Fatalf("Bára po vrácení: %s", got)
	}
	a.db.QueryRow(`SELECT hodnoceni FROM fotky WHERE id = ?`, aVPlazi).Scan(&srdicka)
	if srdicka != 0 || len(tagyFotky(a.db, aVPlazi)) != 0 {
		t.Fatalf("po vrácení srdíčka %d a tagy %v ponechané fotky", srdicka, tagyFotky(a.db, aVPlazi))
	}
	var vracena int
	a.db.QueryRow(`SELECT f.id FROM fotky f JOIN alba al ON al.id = f.album_id WHERE al.album = 'Pláž' AND f.drive_file_id = ?`, soubor("B")).Scan(&vracena)
	if tagy := tagyFotky(a.db, vracena); len(tagy) != 1 || tagy[0] != "plaz" {
		t.Fatalf("vrácená kopie má tagy %v", tagy)
	}

	// V pořádku: skupina se přestane hlásit, zrušení ji vrátí
	if !a.OznacitRuzneFotky([]string{soubor("A"), soubor("B")}) || len(a.GetStejneFotky()) != 0 {
		t.Fatal("skupina označená v pořádku se hlásí dál")
	}
	if !a.ZrusitRuzneFotky([]string{soubor("A"), soubor("B")}) || len(a.GetStejneFotky()) != 1 {
		t.Fatal("zrušení výjimky skupinu nevrátilo")
	}
}

func TestKontrolaNoveVlozenychFotek(t *testing.T) {
	a, anna, _ := appSeStejnymiFotkami(t)
	o := a.otisky()
	a.SpustitOtisky()
	<-o.konec
	a.AddBulkPhotos(anna, "Nové", "Pictorial", soubor("D"))
	nalezy := a.ZkontrolovatNoveFotky(soubor("D"))
	if len(nalezy) != 1 || nalezy[0].DriveID != soubor("D") || nalezy[0].Existujici.JmenoModelky == "" {
		t.Fatalf("nálezy %+v", nalezy)
	}
	if len(a.ZkontrolovatNoveFotky(soubor("C"))) != 0 {
		t.Fatal("jiná fotka nemá být nález")
	}
}

// Bez otisků: fotky téže modelky se skoro stejným vektorem obsahu tvoří skupinu „obsah“, jiné modelky ne
func TestStejneFotkyPodleObsahu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Bára", Tetovani: -1, Piercing: -1})
	anna, bara := idModelky(t, a, "Anna"), idModelky(t, a, "Bára")
	a.AddBulkPhotos(anna, "Pláž", "Pictorial", soubor("E")+" "+soubor("F")+" "+soubor("G"))
	a.AddBulkPhotos(bara, "Studio", "Pictorial", soubor("H"))

	slozka := a.slozkaObsahu()
	os.MkdirAll(slozka, 0o700)
	for _, s := range obsah.Soubory {
		os.WriteFile(filepath.Join(slozka, s.Nazev), []byte("x"), 0o600)
	}
	v := obsah.NoveVektory()
	v.Pridat(soubor("E"), vektorObsahu(1, 0))
	v.Pridat(soubor("F"), vektorObsahu(1, 0.05))
	v.Pridat(soubor("G"), vektorObsahu(0, 1))
	v.Pridat(soubor("H"), vektorObsahu(1, 0))
	if err := v.Ulozit(slozka); err != nil {
		t.Fatal(err)
	}
	skupiny := a.GetStejneFotky()
	if len(skupiny) != 1 || skupiny[0].Duvod != "obsah" || skupiny[0].Klic != soubor("E")+"|"+soubor("F") {
		t.Fatalf("skupiny %+v", skupiny)
	}
}

// Kontrola odkazů: platné soubory bez opakování, nové a už uložené s místy; odkaz na složku se pozná
func TestZkontrolovatOdkazy(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	anna := idModelky(t, a, "Anna")
	a.AddBulkPhotos(anna, "Pláž", "Pictorial", soubor("A"))
	k := a.ZkontrolovatOdkazy("https://drive.google.com/file/d/" + soubor("A") + "/view " + soubor("B") + " " + soubor("A") + " https://drive.google.com/drive/folders/x")
	if len(k.Ids) != 2 || len(k.Nove) != 1 || k.Nove[0] != soubor("B") || !k.Slozka {
		t.Fatalf("kontrola %+v", k)
	}
	if len(k.Existujici) != 1 || k.Existujici[0].Mista[0].JmenoModelky != "Anna" || k.Existujici[0].Mista[0].Album != "Pláž" {
		t.Fatalf("existující %+v", k.Existujici)
	}
	if k := a.ZkontrolovatOdkazy("nic"); len(k.Ids) != 0 || k.Ids == nil {
		t.Fatalf("prázdná kontrola %+v", k)
	}
}
