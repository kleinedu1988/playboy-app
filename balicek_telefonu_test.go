package main

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"
	"time"
)

// Balíček pro telefon (0.02.077): 3000 modelek s titulní i profilovou fotkou se vejde do 5 MB; explicitní fotka
// do balíčku nepatří; nové nahrání na Disk nahradí předchozí balíček
func TestBalicekTelefonu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	naplnitSbirkuNavrhu(t, a, 3000)
	// Titulní fotka každé modelky, profilová z jejího prvního alba
	if _, err := a.db.Exec(`UPDATE modelky SET drive_cover_id = printf('T%07dxxxxxxxxxxxxxxxxxxxxxxx', id), hodnoceni_pul = id % 11,
		profil_fotka_id = (SELECT f.id FROM fotky f JOIN alba al ON al.id = f.album_id WHERE al.modelka_id = modelky.id LIMIT 1),
		profil_zoom = 1.4, profil_x = 50, profil_y = 30`); err != nil {
		t.Fatal(err)
	}
	var prvni int
	a.db.QueryRow(`SELECT MIN(id) FROM modelky`).Scan(&prvni)
	explicitni := fmt.Sprintf("T%07dxxxxxxxxxxxxxxxxxxxxxxx", prvni)
	if _, err := a.db.Exec(`INSERT INTO druhy_fotek (drive_file_id, druh) VALUES (?, 'sex')`, explicitni); err != nil {
		t.Fatal(err)
	}

	b, err := a.balicekTelefonu()
	if err != nil || len(b.Modelky) != 3000 || b.Verze != verzeBalickuTelefonu || b.SablonaObrazku == "" {
		t.Fatalf("balíček: %d modelek, %v", len(b.Modelky), err)
	}
	profilu := 0
	for _, m := range b.Modelky {
		if m.CoverID == explicitni {
			t.Fatal("explicitní titulní fotka v balíčku")
		}
		if m.ProfilID != "" {
			profilu++
		}
		if m.ID == prvni && m.CoverID != "" {
			t.Fatalf("modelka s explicitní titulní fotkou: %+v", m)
		}
	}
	if profilu < 2900 {
		t.Fatalf("profilových fotek jen %d", profilu)
	}
	data, err := zabalitBalicek(b)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("balíček 3000 modelek: %d kB", len(data)/1024)
	if len(data) > 5<<20 {
		t.Fatalf("balíček má %d B, víc než 5 MB", len(data))
	}
	// Rozbalení vrátí totéž
	z, _ := gzip.NewReader(bytes.NewReader(data))
	var zpet BalicekTelefonu
	if err := json.NewDecoder(z).Decode(&zpet); err != nil || len(zpet.Modelky) != 3000 || zpet.Modelky[5].Jmeno != b.Modelky[5].Jmeno {
		t.Fatalf("rozbalení: %v", err)
	}

	// Nahrání na falešný Disk dvakrát: zůstane jeden balíček
	puvodniSlozka, puvodniAPI := slozkaNastaveniGoogle, adresaDriveAPI
	t.Cleanup(func() { slozkaNastaveniGoogle, adresaDriveAPI = puvodniSlozka, puvodniAPI })
	nastaveni := t.TempDir()
	slozkaNastaveniGoogle = func() string { return nastaveni }
	disk := &falesnyDisk{soubory: map[string][2]string{}, relace: map[string]string{}}
	server := httptest.NewServer(disk)
	defer server.Close()
	adresaDriveAPI = server.URL
	ulozitTokenGoogle(&tokenGoogle{Obnovovaci: "obnova", Pristupovy: "pristup", Platnost: time.Now().Add(time.Hour)})
	for range 2 {
		if err := a.nahratBalicekTelefonu(t.Context()); err != nil {
			t.Fatal(err)
		}
	}
	balicku := 0
	for _, s := range disk.soubory {
		if s[0] == nazevBalickuTelefonu {
			balicku++
		}
	}
	if balicku != 1 {
		t.Fatalf("balíčků na Disku: %d", balicku)
	}
}
