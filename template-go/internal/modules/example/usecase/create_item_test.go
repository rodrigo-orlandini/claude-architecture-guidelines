package usecase

import (
	"context"
	"errors"
	"testing"

	"{{module-path}}/internal/platform/httperr"
)

func TestCreateItemUseCase_Execute(t *testing.T) {
	t.Run("persists a new ACTIVE item with the trimmed name", func(t *testing.T) {
		repo := &InMemoryItemRepository{}
		uc := NewCreateItemUseCase(repo)

		item, err := uc.Execute(context.Background(), CreateItemInput{Name: "  Mug  "})

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(repo.Items) != 1 {
			t.Fatalf("got %d items, want 1", len(repo.Items))
		}
		if item.Name().String() != "Mug" {
			t.Errorf("got name %q, want Mug", item.Name())
		}
	})

	t.Run("fails with INVALID_ITEM_NAME and persists nothing when the name is blank", func(t *testing.T) {
		repo := &InMemoryItemRepository{}
		uc := NewCreateItemUseCase(repo)

		_, err := uc.Execute(context.Background(), CreateItemInput{Name: "   "})

		var domainErr *httperr.DomainError
		if !errors.As(err, &domainErr) || domainErr.Code != "INVALID_ITEM_NAME" {
			t.Fatalf("expected INVALID_ITEM_NAME, got %v", err)
		}
		if len(repo.Items) != 0 {
			t.Errorf("expected nothing persisted, got %d items", len(repo.Items))
		}
	})
}
