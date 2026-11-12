package main

// Aplikace pro telefon na Disku (0.02.088): nové verze aplikace bez kabelu. mobil/sestavit.sh sestaví APK do
// mobil/vystup (s verzí v pinup-katalog.verze); program ho při nahrání zálohy nahraje do skryté složky programu
// na Disku jako telefon-aplikace-<verze>.apk, pokud tam ta verze ještě není, a starší smaže. Aplikace v telefonu
// si novější verzi najde a nabídne instalaci. APK hledá v klonu zdrojů (klonZdroje, aktualizace.go) – bez klonu
// nebo bez sestaveného APK se nic nenahrává.

import (
	"context"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

const predponaAplikaceTelefonu = "telefon-aplikace-"

// Sestavené APK a jeho verze; "" když není
func sestavenaAplikaceTelefonu() (cesta, verze string) {
	klon := klonZdroje()
	if klon == "" {
		return "", ""
	}
	vystup := filepath.Join(klon, "mobil", "vystup")
	data, err := os.ReadFile(filepath.Join(vystup, "pinup-katalog.verze"))
	verze = strings.TrimSpace(string(data))
	cesta = filepath.Join(vystup, "pinup-katalog.apk")
	if _, errApk := os.Stat(cesta); err != nil || errApk != nil || verze == "" || strings.ContainsAny(verze, "/\\ ") {
		return "", ""
	}
	return cesta, verze
}

// Nahraje sestavené APK na Disk, pokud tam ta verze ještě není; starší verze smaže (až po nahrání nové)
func (a *App) nahratAplikaciTelefonu(ctx context.Context) error {
	cesta, verze := sestavenaAplikaceTelefonu()
	if cesta == "" {
		return nil
	}
	nazev := predponaAplikaceTelefonu + verze + ".apk"
	zamekDisku.Lock()
	defer zamekDisku.Unlock()
	soubory, err := a.souboryNaDisku(ctx)
	if err != nil {
		return err
	}
	for _, f := range soubory {
		if f.Name == nazev {
			return nil
		}
	}
	s, err := os.Open(cesta)
	if err != nil {
		return err
	}
	defer s.Close()
	info, err := s.Stat()
	if err != nil {
		return err
	}
	if err := a.nahratNaDisk(ctx, nazev, "application/vnd.android.package-archive", s, info.Size()); err != nil {
		return err
	}
	for _, f := range soubory {
		if !strings.HasPrefix(f.Name, predponaAplikaceTelefonu) {
			continue
		}
		o, err := a.driveVolani(ctx, http.MethodDelete, adresaDriveAPI+"/drive/v3/files/"+url.PathEscape(f.ID), nil, nil)
		if err != nil {
			return err
		}
		o.Body.Close()
	}
	return nil
}
