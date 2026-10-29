package database

import (
	"net/url"
	"strings"
	"testing"

	"github.com/pratham124/nurse-flow/backend/internal/supabaseproject"
)

func TestURL(t *testing.T) {
	t.Setenv("NURSEFLOW_DB_PASSWORD", "test:@/password")
	t.Setenv("NURSEFLOW_DB_SSLROOTCERT", "")
	tests := []struct {
		name     string
		ref      string
		host     string
		wantUser string
	}{
		{"development direct", supabaseproject.Development, "db." + supabaseproject.Development + ".supabase.co", "nurseflow_go"},
		{"development pooler", supabaseproject.Development, "aws-1-us-east-1.pooler.supabase.com", "nurseflow_go." + supabaseproject.Development},
		{"production direct", supabaseproject.Production, "db." + supabaseproject.Production + ".supabase.co", "nurseflow_go"},
		{"production pooler", supabaseproject.Production, "aws-1-us-east-1.pooler.supabase.com", "nurseflow_go." + supabaseproject.Production},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv("NURSEFLOW_DB_HOST", test.host)
			value, err := URL(test.ref)
			if err != nil {
				t.Fatal(err)
			}
			parsed, err := url.Parse(value)
			if err != nil {
				t.Fatal(err)
			}
			password, _ := parsed.User.Password()
			if parsed.User.Username() != test.wantUser || password != "test:@/password" {
				t.Fatal("connection credentials were not encoded correctly")
			}
			if parsed.Port() != "5432" || parsed.Query().Get("sslmode") != "verify-full" {
				t.Fatal("session/direct port and certificate verification must be configured")
			}
		})
	}
}

func TestURLRejectsOtherTargets(t *testing.T) {
	t.Setenv("NURSEFLOW_DB_PASSWORD", "secret-test-password")
	otherProject := map[string]string{
		supabaseproject.Development: supabaseproject.Production,
		supabaseproject.Production:  supabaseproject.Development,
	}
	for ref, other := range otherProject {
		hosts := []string{"", "db." + other + ".supabase.co", "localhost", "aws-1-us-east-1.pooler.supabase.com:6543", "example.com"}
		for _, host := range hosts {
			t.Setenv("NURSEFLOW_DB_HOST", host)
			if _, err := URL(ref); err == nil {
				t.Fatalf("project %s accepted invalid host %q", ref, host)
			} else if strings.Contains(err.Error(), "secret-test-password") {
				t.Fatal("configuration error exposed password")
			}
		}
	}
	t.Setenv("NURSEFLOW_DB_HOST", "db."+supabaseproject.Development+".supabase.co")
	t.Setenv("NURSEFLOW_DB_PASSWORD", "")
	if _, err := URL(supabaseproject.Development); err == nil {
		t.Fatal("accepted missing password")
	}
}

func TestURLRejectsUnknownProject(t *testing.T) {
	t.Setenv("NURSEFLOW_DB_PASSWORD", "secret-test-password")
	t.Setenv("NURSEFLOW_DB_HOST", "db.abcdefghijklmnopqrst.supabase.co")
	for _, ref := range []string{"", "abcdefghijklmnopqrst"} {
		if _, err := URL(ref); err == nil {
			t.Fatalf("accepted project ref %q", ref)
		}
	}
}
