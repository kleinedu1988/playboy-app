# Skrytý WebKitGTK: podle úlohy (JSON s velikostmi okna a kroky v JS) nafotí obrazovky programu.
# Spouští ho snimky_rozhrani_test.go (go test -tags snimky); argumenty: adresa, výstupní složka, úloha.
import gi, sys, json
gi.require_version('Gtk','3.0'); gi.require_version('WebKit2','4.1')
from gi.repository import Gtk, WebKit2, GLib
# foto.py adresa vystup_slozka uloha.json
adresa, vystup, uloha = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
kroky = []
for sirka, vyska in uloha['velikosti']:
    for k in uloha['kroky']:
        kroky.append((sirka, vyska, k))
stav = {'i': 0}
w = Gtk.OffscreenWindow()
v = WebKit2.WebView()
nast = v.get_settings(); nast.set_enable_developer_extras(True)
w.add(v)
def js(kod, hotovo=None):
    def konec(view, res):
        try:
            val = view.evaluate_javascript_finish(res)
            txt = val.to_string() if val else ''
        except Exception as e:
            txt = 'CHYBA ' + str(e)
        if hotovo: hotovo(txt)
    v.evaluate_javascript(kod, -1, None, None, None, konec)
def dalsi():
    if stav['i'] >= len(kroky):
        Gtk.main_quit(); return False
    sirka, vyska, k = kroky[stav['i']]
    if w.get_size() != (sirka, vyska):
        w.resize(sirka, vyska); w.set_size_request(sirka, vyska)
    js(k['js'], lambda txt: GLib.timeout_add(k.get('cekat', 1500), lambda: foto(sirka, k, txt)))
    return False
def foto(sirka, k, txt):
    nazev = f"{vystup}/{k['nazev']}-{sirka}.png"
    def ulozeno(view, res):
        view.get_snapshot_finish(res).write_to_png(nazev)
        print('SNÍMEK', nazev, '|', txt[:3000], flush=True)
        stav['i'] += 1
        GLib.idle_add(dalsi)
    v.get_snapshot(WebKit2.SnapshotRegion.VISIBLE, WebKit2.SnapshotOptions.NONE, None, ulozeno)
    return False
def nacteno(view, ev):
    if ev == WebKit2.LoadEvent.FINISHED:
        GLib.timeout_add(uloha.get('start', 6000), dalsi)
sirka, vyska = uloha['velikosti'][0]
w.set_default_size(sirka, vyska); w.set_size_request(sirka, vyska); w.show_all()
v.connect('load-changed', nacteno); v.load_uri(adresa)
GLib.timeout_add(420000, Gtk.main_quit); Gtk.main()
