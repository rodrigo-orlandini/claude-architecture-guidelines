package usecase

import (
	"context"
	"errors"
	"testing"

	"{{module-path}}/internal/modules/example/domain"
	"{{module-path}}/internal/platform/httperr"
)

func TestGetItemUseCase_Execute(t *testing.T) {
	t.Run("returns the item when it exists", func(t *testing.T) {
		name, _ := domain.NewItemName("Mug")
		item := domain.NewItem(name)
		repo := &InMemoryItemRepository{Items: []domain.Item{item}}
		uc := NewGetItemUseCase(repo)

		found, err := uc.Execute(context.Background(), item.ID())

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if found.Name().String() != "Mug" {
			t.Errorf("got name %q, want Mug", found.Name())
		}
	})

	t.Run("fails with ITEM_NOT_FOUND when the item does not exist", func(t *testing.T) {
		repo := &InMemoryItemRepository{}
		uc := NewGetItemUseCase(repo)

		_, err := uc.Execute(context.Background(), "missing")

		var domainErr *httperr.DomainError
		if !errors.As(err, &domainErr) || domainErr.Code != "ITEM_NOT_FOUND" {
			t.Fatalf("expected ITEM_NOT_FOUND, got %v", err)
		}
	})
}
