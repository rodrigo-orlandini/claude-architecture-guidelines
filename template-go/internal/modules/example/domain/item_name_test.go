package domain

import (
	"errors"
	"strings"
	"testing"

	"{{module-path}}/internal/platform/httperr"
)

func TestNewItemName(t *testing.T) {
	t.Run("creates with a valid name and trims whitespace", func(t *testing.T) {
		name, err := NewItemName("  Blue mug  ")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if name.String() != "Blue mug" {
			t.Errorf("got %q, want %q", name.String(), "Blue mug")
		}
	})

	t.Run("rejects empty string", func(t *testing.T) {
		_, err := NewItemName("")
		assertInvalidItemName(t, err)
	})

	t.Run("rejects whitespace-only string", func(t *testing.T) {
		_, err := NewItemName("   ")
		assertInvalidItemName(t, err)
	})

	t.Run("accepts exactly 120 characters", func(t *testing.T) {
		if _, err := NewItemName(strings.Repeat("a", 120)); err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("rejects 121 characters", func(t *testing.T) {
		_, err := NewItemName(strings.Repeat("a", 121))
		assertInvalidItemName(t, err)
	})
}

func assertInvalidItemName(t *testing.T, err error) {
	t.Helper()
	var domainErr *httperr.DomainError
	if !errors.As(err, &domainErr) {
		t.Fatalf("expected *httperr.DomainError, got %T (%v)", err, err)
	}
	if domainErr.Code != "INVALID_ITEM_NAME" {
		t.Errorf("got code %q, want %q", domainErr.Code, "INVALID_ITEM_NAME")
	}
}
