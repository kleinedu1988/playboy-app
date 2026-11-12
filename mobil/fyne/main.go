// Kostra telefonu ve Fyne (0.02.078, varianta C, jen pro měření): celé rozhraní v Go; vzhled programu by se tu
// musel nakreslit znovu.
package main

import (
	"image/color"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
)

func main() {
	a := app.NewWithID("cz.pinupkatalog.fyne")
	a.Settings().SetTheme(theme.DarkTheme())
	w := a.NewWindow("Pinup Katalog")
	nazev := canvas.NewText("PINUP KATALOG", color.NRGBA{0xe2, 0xbd, 0x6a, 0xff})
	nazev.TextSize = 26
	nazev.Alignment = fyne.TextAlignCenter
	popis := canvas.NewText("Kostra aplikace pro telefon (Fyne)", color.NRGBA{0xb9, 0xa3, 0xad, 0xff})
	popis.Alignment = fyne.TextAlignCenter
	pozadi := canvas.NewLinearGradient(color.NRGBA{0x5c, 0x10, 0x30, 0xff}, color.NRGBA{0x12, 0x0a, 0x0e, 0xff}, 160)
	w.SetContent(container.NewStack(pozadi, container.NewCenter(container.NewVBox(nazev, popis))))
	w.ShowAndRun()
}
