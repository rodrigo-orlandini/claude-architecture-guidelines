package domain

import (
	"errors"
	"testing"
	"time"

	"{{module-path}}/internal/platform/httperr"
)

func mustName(t *testing.T, raw string) ItemName {
	t.Helper()
	name, err := NewItemName(raw)
	if err != nil {
		t.Fatalf("unexpected error building name: %v", err)
	}
	return name
}

func TestNewItem(t *testing.T) {
	item := NewItem(mustName(t, "Mug"))

	if item.ID() == "" {
		t.Error("expected a generated id")
	}
	if item.Status() != ItemStatusActive {
		t.Errorf("got status %q, want ACTIVE", item.Status())
	}
	if item.Name().String() != "Mug" {
		t.Errorf("got name %q, want Mug", item.Name())
	}
}

func TestRehydrateItem(t *testing.T) {
	createdAt := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	item := RehydrateItem("fixed-id", mustName(t, "Mug"), ItemStatusArchived, createdAt)

	if item.ID() != "fixed-id" {
		t.Errorf("got id %q, want fixed-id", item.ID())
	}
	if !item.CreatedAt().Equal(createdAt) {
		t.Errorf("got createdAt %v, want %v", item.CreatedAt(), createdAt)
	}
	if item.Status() != ItemStatusArchived {
		t.Errorf("got status %q, want ARCHIVED", item.Status())
	}
}

func TestItem_Archive(t *testing.T) {
	t.Run("archives an active item", func(t *testing.T) {
		item := NewItem(mustName(t, "Mug"))
		if err := item.Archive(); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if item.Status() != ItemStatusArchived {
			t.Errorf("got status %q, want ARCHIVED", item.Status())
		}
	})

	t.Run("refuses to archive twice", func(t *testing.T) {
		item := NewItem(mustName(t, "Mug"))
		_ = item.Archive()

		err := item.Archive()
		var domainErr *httperr.DomainError
		if !errors.As(err, &domainErr) || domainErr.Code != "INVALID_ITEM_STATUS_TRANSITION" {
			t.Fatalf("expected INVALID_ITEM_STATUS_TRANSITION, got %v", err)
		}
	})
}
