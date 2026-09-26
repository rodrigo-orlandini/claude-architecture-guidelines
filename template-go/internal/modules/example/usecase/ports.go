// Package usecase holds the example module's use-cases and the ports
// (interfaces) they depend on. Rule: a use-case imports only domain, dtos in
// this same package, and interfaces it defines itself here — never a concrete
// adapter. Go convention (unlike the TS kit's `I` prefix): no Hungarian
// notation; the interface is just ItemRepository, defined by the consumer
// (this package), not by the implementer (adapters/postgres).
package usecase

import (
	"context"

	"{{module-path}}/internal/modules/example/domain"
)

type FindManyParams struct {
	Page  int
	Limit int
}

type FindManyResult struct {
	Items []domain.Item
	Total int
}

// ItemRepository is the port. Implementations: adapters/postgres (real),
// InMemoryItemRepository below (test fake).
type ItemRepository interface {
	Save(ctx context.Context, item domain.Item) error
	FindByID(ctx context.Context, id string) (*domain.Item, error)
	FindMany(ctx context.Context, params FindManyParams) (FindManyResult, error)
}
