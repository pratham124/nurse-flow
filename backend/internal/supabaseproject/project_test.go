package supabaseproject

import "testing"

func TestFromEnvironmentAcceptsKnownProjects(t *testing.T) {
	for _, ref := range []string{Development, Production} {
		t.Setenv("NURSEFLOW_SUPABASE_PROJECT_REF", ref)
		got, err := FromEnvironment()
		if err != nil || got != ref {
			t.Fatalf("FromEnvironment() = %q, %v; want %q", got, err, ref)
		}
	}
}

func TestFromEnvironmentRejectsOtherValues(t *testing.T) {
	for _, ref := range []string{"", "abcdefghijklmnopqrst", " " + Development, Development + " ", "NMITCTYXTJMLAKCSMNUJ"} {
		t.Setenv("NURSEFLOW_SUPABASE_PROJECT_REF", ref)
		if got, err := FromEnvironment(); err == nil {
			t.Fatalf("accepted %q as %q", ref, got)
		}
	}
}

func TestValid(t *testing.T) {
	if !Valid(Development) || !Valid(Production) {
		t.Fatal("known project refs must be valid")
	}
	if Valid("") || Valid("other") {
		t.Fatal("unknown project refs must be invalid")
	}
}
