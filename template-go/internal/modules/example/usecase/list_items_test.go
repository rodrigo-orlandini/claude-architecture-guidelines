package usecase

import (
	"context"
	"testing"
	"time"

	"{{module-path}}/internal/modules/example/domain"
)

func makeItem(t *testing.T, id string, createdAt time.Time) domain.Item {
	t.Helper()
	name, err := domain.NewItemName("Item " + id)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	return domain.RehydrateItem(id, name, domain.ItemStatusActive, createdAt)
}

func TestListItemsUseCase_Execute(t *testing.T) {
	t.Run("returns empty page when there are no items", func(t *testing.T) {
		uc := NewListItemsUseCase(&InMemoryItemRepository{})

		out, err := uc.Execute(context.Background(), ListItemsInput{})

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(out.Data) != 0 || out.Meta != (PaginationMeta{Page: 1, Limit: 20, Total: 0, TotalPages: 0}) {
			t.Errorf("got %+v", out)
		}
	})

	t.Run("returns newest items first", func(t *testing.T) {
		repo := &InMemoryItemRepository{Items: []domain.Item{
			makeItem(t, "old", time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)),
			makeItem(t, "new", time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)),
		}}
		uc := NewListItemsUseCase(repo)

		out, err := uc.Execute(context.Background(), ListItemsInput{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if out.Data[0].ID() != "new" || out.Data[1].ID() != "old" {
			t.Errorf("got order %q, %q; want new, old", out.Data[0].ID(), out.Data[1].ID())
		}
	})

	t.Run("paginates: 25 items, page 3 of limit 10 has 5 items and 3 pages total", func(t *testing.T) {
		items := make([]domain.Item, 25)
		for i := range items {
			items[i] = makeItem(t, string(rune('a'+i)), time.Date(2026, 1, i+1, 0, 0, 0, 0, time.UTC))
		}
		uc := NewListItemsUseCase(&InMemoryItemRepository{Items: items})

		out, err := uc.Execute(context.Background(), ListItemsInput{Page: 3, Limit: 10})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(out.Data) != 5 {
			t.Errorf("got %d items, want 5", len(out.Data))
		}
		if out.Meta.TotalPages != 3 {
			t.Errorf("got %d total pages, want 3", out.Meta.TotalPages)
		}
	})
}
