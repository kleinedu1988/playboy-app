package uceni

import (
	"encoding/binary"
	"encoding/hex"

	"playboy-app/internal/hledani"
)

// Verze výpočtu: změna kódu modelů (jiné výsledky ze stejných údajů) zneplatní uloženou mezipaměť
const VerzeModeluUceni = "uceni-1"

// PredponaOtiskuKontroly je verze výpočtu otisku údajů modelky pro kontrolu
const PredponaOtiskuKontroly = "k2:"

// OtiskUdajuKontroly vrátí otisk údajů modelky, ze kterých kontrola hlásí nálezy (pro poznání, že uživatel nález opravil).
func OtiskUdajuKontroly(m hledani.Modelka) string {
	m.Hodnoceni, m.CoverID, m.CoverURL, m.Tags, m.Poznamka, m.Pridano = 0, "", "", "", "", ""
	o := NovyOtiskovac()
	o.Modelka(&m)
	return PredponaOtiskuKontroly + o.Hex()
}

// Otiskovac počítá FNV-64a otisk přímo nad bajty textů a čísel bez reflexe a bez alokací.
type Otiskovac struct{ h uint64 }

const (
	zakladFNV = 14695981039346656037
	prvociFNV = 1099511628211
)

func NovyOtiskovac() Otiskovac { return Otiskovac{h: zakladFNV} }

func (o *Otiskovac) Text(texty ...string) {
	h := o.h
	for _, t := range texty {
		for i := 0; i < len(t); i++ {
			h = (h ^ uint64(t[i])) * prvociFNV
		}
		h *= prvociFNV // za každým textem bajt 0
	}
	o.h = h
}

func (o *Otiskovac) Cisla(cisla ...int) {
	h := o.h
	for _, c := range cisla {
		for i := range 8 {
			h = (h ^ uint64(byte(uint64(c)>>(8*i)))) * prvociFNV
		}
	}
	o.h = h
}

// Hex vrátí otisk jako šestnáct šestnáctkových číslic (jako hex.EncodeToString(fnv.Sum(nil)))
func (o *Otiskovac) Hex() string {
	var b [8]byte
	binary.BigEndian.PutUint64(b[:], o.h)
	return hex.EncodeToString(b[:])
}

func (o *Otiskovac) Modelka(m *hledani.Modelka) {
	o.Cisla(m.ID, m.VyskaCm, m.VahaKg, m.ObvodHrudnikCm, m.ObvodPasCm, m.ObvodBokyCm, m.Tetovani, m.Piercing, m.HodnoceniPul(), m.PocetFotek)
	pm := "false"
	if m.PlaymateMesice {
		pm = "true"
	}
	o.Text(m.Jmeno, m.NarozeniDatum, m.UmrtiDatum, m.NarozeniMisto, m.Narodnost, m.Etnicita, m.VlasyBarva, m.OciBarva, m.Miry,
		m.VelikostPrsou, m.PrsaTyp, m.Ochlupeni, m.Vystoupeni, m.PictorialVydani, m.Role, m.Tags, m.DalsiJmena, m.Poznamka,
		m.NetykaSe, m.CyberGirl, m.PlaymateRoku, pm, m.CoverID, m.Pridano)
	for _, seznam := range [4][]string{m.Vydani, m.Centerfoldy, m.Obalky, m.OnlineAlba} {
		o.Cisla(len(seznam))
		o.Text(seznam...)
	}
}
