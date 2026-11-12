package google

import (
	"strings"
	"testing"
)

// Chyby Disku česky (0.02.084): skutečná odpověď Googlu při vypnutém Drive API a další běžné případy
func TestChybaDisku(t *testing.T) {
	vypnuto := `{"error":{"code":403,"message":"Google Drive API has not been used in project 123 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=123 then retry.","errors":[{"message":"…","domain":"usageLimits","reason":"accessNotConfigured","extendedHelp":"https://console.developers.google.com"}],"status":"PERMISSION_DENIED","details":[{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"SERVICE_DISABLED","domain":"googleapis.com","metadata":{"activationUrl":"https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=123","service":"drive.googleapis.com"}}]}}`
	bezDetailu := `{"error":{"code":403,"message":"Google Drive API has not been used in project 123 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=123 then retry.","errors":[{"reason":"accessNotConfigured"}]}}`
	for _, c := range []struct {
		kod        int
		telo       string
		obsahuje   string
		neobsahuje string
	}{
		{403, vypnuto, "není zapnuté Google Drive API", "{"},
		{403, vypnuto, "Adresa: https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=123", "then retry"},
		{403, bezDetailu, "?project=123", "then retry"},
		{403, `{"error":{"code":403,"errors":[{"reason":"storageQuotaExceeded"}]}}`, "Disk je plný", "{"},
		{403, `{"error":{"code":403,"status":"PERMISSION_DENIED","details":[{"reason":"ACCESS_TOKEN_SCOPE_INSUFFICIENT"}]}}`, "nemá přístup k Disku", "{"},
		{401, `{"error":{"code":401,"message":"Invalid Credentials"}}`, "vypršelo", "{"},
		{404, `{"error":{"code":404,"message":"File not found: x."}}`, "nebyl nalezen", "{"},
		{429, ``, "příliš mnoho", "{"},
		{503, `<html>Service Unavailable</html>`, "nedostupný (chyba 503)", "<html>"},
		{400, `{"error":{"code":400,"message":"Invalid Value"}}`, "chybou 400: Invalid Value", "{"},
		{400, `nesmysl`, "chybou 400: Bad Request", "nesmysl"},
	} {
		z := ChybaDisku(c.kod, []byte(c.telo))
		if !strings.Contains(z, c.obsahuje) || strings.Contains(z, c.neobsahuje) {
			t.Errorf("%d %.40s…: %q", c.kod, c.telo, z)
		}
	}
}
