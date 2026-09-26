package usecase

import (
	"context"
	"sort"

	"{{module-path}}/internal/modules/example/domain"
)

// InMemoryItemRepository is a test fake implementing ItemRepository — never a
// mock of the Prisma^H^H^Hpgx/sqlc implementation. Shared by more than one
// use-case's tests, so it lives here rather than co-located under one
// use-case's own file (rule: fakes used by a single use-case's tests can be
// co-located instead).
type InMemoryItemRepository struct {
	Items []domain.Item
}

func (r *InMemoryItemRepository) Save(_ context.Context, item domain.Item) error {
	for i, existing := range r.Items {
		if existing.ID() == item.ID() {
			r.Items[i] = item
			return nil
		}
	}
	r.Items = append(r.Items, item)
	return nil
}

func (r *InMemoryItemRepository) FindByID(_ context.Context, id string) (*domain.Item, error) {
	for _, item := range r.Items {
		if item.ID() == id {
			found := item
			return &found, nil
		}
	}
	return nil, nil
}

func (r *InMemoryItemRepository) FindMany(_ context.Context, params FindManyParams) (FindManyResult, error) {
	sorted := make([]domain.Item, len(r.Items))
	copy(sorted, r.Items)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].CreatedAt().After(sorted[j].CreatedAt()) })

	skip := (params.Page - 1) * params.Limit
	end := skip + params.Limit
	if skip > len(sorted) {
		skip = len(sorted)
	}
	if end > len(sorted) {
		end = len(sorted)
	}

	return FindManyResult{Items: sorted[skip:end], Total: len(r.Items)}, nil
}
