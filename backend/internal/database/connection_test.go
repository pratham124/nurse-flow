package database

import (
	"net/url"
	"strings"
	"testing"
)

func TestDevelopmentURL(t *testing.T) {
	t.Setenv("NURSEFLOW_DB_PASSWORD", "test:@/password")
	t.Setenv("NURSEFLOW_DB_SSLROOTCERT", "")
	tests := []struct {
		name     string
		host     string
		wantUser string
	}{
		{"development direct", "db." + DevelopmentProject + ".supabase.co", "nurseflow_go"},
		{"session pooler", "aws-1-us-east-1.pooler.supabase.com", "nurseflow_go." + DevelopmentProject},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv("NURSEFLOW_DB_HOST", test.host)
			value, err := DevelopmentURL()
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

func TestDevelopmentURLRejectsOtherTargets(t *testing.T) {
	t.Setenv("NURSEFLOW_DB_PASSWORD", "secret-test-password")
	for _, host := range []string{"", "db.mkljczezkyqtuplzedpj.supabase.co", "localhost", "aws-1-us-east-1.pooler.supabase.com:6543", "example.com"} {
		t.Setenv("NURSEFLOW_DB_HOST", host)
		if _, err := DevelopmentURL(); err == nil {
			t.Fatalf("accepted invalid host %q", host)
		} else if strings.Contains(err.Error(), "secret-test-password") {
			t.Fatal("configuration error exposed password")
		}
	}
	t.Setenv("NURSEFLOW_DB_HOST", "db."+DevelopmentProject+".supabase.co")
	t.Setenv("NURSEFLOW_DB_PASSWORD", "")
	if _, err := DevelopmentURL(); err == nil {
		t.Fatal("accepted missing password")
	}
}
