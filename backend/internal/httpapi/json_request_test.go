package httpapi

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeJSONRequest(t *testing.T) {
	for _, test := range []struct {
		name, contentType, body string
		wantError               bool
	}{
		{"valid with trailing whitespace", "application/json", "{\"name\":\"Floor\"}\n\t ", false},
		{"charset parameter", "application/json; charset=utf-8", `{"name":"Floor"}`, false},
		{"empty object", "application/json", `{}`, false},
		{"empty body", "application/json", "", true},
		{"null", "application/json", `null`, true},
		{"array", "application/json", `[]`, true},
		{"primitive", "application/json", `42`, true},
		{"wrong field type", "application/json", `{"name":42}`, true},
		{"unknown field", "application/json", `{"name":"Floor","owner":"other"}`, true},
		{"multiple values", "application/json", `{"name":"Floor"} {}`, true},
		{"trailing invalid bytes", "application/json", `{"name":"Floor"} !`, true},
		{"wrong media type", "text/plain", `{}`, true},
		{"missing media type", "", `{}`, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(test.body))
			r.Header.Set("Content-Type", test.contentType)
			var body struct {
				Name string `json:"name"`
			}
			err := decodeJSONRequest(httptest.NewRecorder(), r, &body)
			if (err != nil) != test.wantError {
				t.Fatalf("error=%v, wantError=%v", err, test.wantError)
			}
			if !test.wantError && test.body != "{}" && body.Name != "Floor" {
				t.Fatal("decoded body missing its name")
			}
		})
	}
}

func TestDecodeJSONRequestKeepsSizeErrors(t *testing.T) {
	for _, body := range []string{
		`{"name":"` + strings.Repeat("x", maxJSONRequestBodyBytes) + `"}`,
		`{}` + strings.Repeat(" ", maxJSONRequestBodyBytes),
	} {
		r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		var value struct{ Name string }
		var tooLarge *http.MaxBytesError
		if err := decodeJSONRequest(httptest.NewRecorder(), r, &value); !errors.As(err, &tooLarge) {
			t.Fatalf("error=%v, want size error for handler's HTTP 413 mapping", err)
		}
	}
}
