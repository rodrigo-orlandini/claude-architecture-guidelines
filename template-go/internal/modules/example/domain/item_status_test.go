package domain

import (
	"errors"
	"testing"

	"{{module-path}}/internal/platform/httperr"
)

func TestParseItemStatus(t *testing.T) {
	t.Run("accepts a known raw value", func(t *testing.T) {
		status, err := ParseItemStatus("ARCHIVED")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if status != ItemStatusArchived {
			t.Errorf("got %q, want %q", status, ItemStatusArchived)
		}
	})

	t.Run("rejects an unknown raw value", func(t *testing.T) {
		_, err := ParseItemStatus("DELETED")
		var domainErr *httperr.DomainError
		if !errors.As(err, &domainErr) || domainErr.Code != "INVALID_ITEM_STATUS" {
			t.Fatalf("expected INVALID_ITEM_STATUS, got %v", err)
		}
	})
}

func TestItemStatus_TransitionTo(t *testing.T) {
	t.Run("allows ACTIVE to ARCHIVED", func(t *testing.T) {
		if _, err := ItemStatusActive.TransitionTo(ItemStatusArchived); err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("rejects ARCHIVED to ACTIVE (terminal state)", func(t *testing.T) {
		_, err := ItemStatusArchived.TransitionTo(ItemStatusActive)
		var domainErr *httperr.DomainError
		if !errors.As(err, &domainErr) || domainErr.Code != "INVALID_ITEM_STATUS_TRANSITION" {
			t.Fatalf("expected INVALID_ITEM_STATUS_TRANSITION, got %v", err)
		}
	})
}
