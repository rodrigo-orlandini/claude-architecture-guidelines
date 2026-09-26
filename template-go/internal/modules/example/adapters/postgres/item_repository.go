// Package postgres implements the example module's ports against a real
// Postgres database via sqlc-generated queries + pgx. Nothing above this
// package (usecase, domain) imports it — only module.go wires it in behind
// the ItemRepository interface (rule: infra/ implements interfaces, it is
// never imported by use-cases or entities).
package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"{{module-path}}/internal/modules/example/adapters/postgres/sqlcgen"
	"{{module-path}}/internal/modules/example/domain"
	"{{module-path}}/internal/modules/example/usecase"
)

type ItemRepository struct {
	q *sqlcgen.Queries
}

// Compile-time check that ItemRepository satisfies the port defined by the
// use-case layer — catches a drifted signature at build time, not at wiring.
var _ usecase.ItemRepository = (*ItemRepository)(nil)

func NewItemRepository(pool *pgxpool.Pool) *ItemRepository {
	return &ItemRepository{q: sqlcgen.New(pool)}
}

func (r *ItemRepository) Save(ctx context.Context, item domain.Item) error {
	return r.q.UpsertItem(ctx, sqlcgen.UpsertItemParams{
		ID:        item.ID(),
		Name:      item.Name().String(),
		Status:    string(item.Status()),
		CreatedAt: pgtype.Timestamptz{Time: item.CreatedAt(), Valid: true},
	})
}

func (r *ItemRepository) FindByID(ctx context.Context, id string) (*domain.Item, error) {
	row, err := r.q.GetItemByID(ctx, id)
	if err != nil {
		if isNoRows(err) {
			return nil, nil
		}
		return nil, err
	}
	item, err := toDomain(row)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *ItemRepository) FindMany(ctx context.Context, params usecase.FindManyParams) (usecase.FindManyResult, error) {
	offset := int32((params.Page - 1) * params.Limit)
	rows, err := r.q.ListItems(ctx, sqlcgen.ListItemsParams{Limit: int32(params.Limit), Offset: offset})
	if err != nil {
		return usecase.FindManyResult{}, err
	}

	items := make([]domain.Item, 0, len(rows))
	for _, row := range rows {
		item, err := toDomain(row)
		if err != nil {
			return usecase.FindManyResult{}, err
		}
		items = append(items, item)
	}

	total, err := r.q.CountItems(ctx)
	if err != nil {
		return usecase.FindManyResult{}, err
	}

	return usecase.FindManyResult{Items: items, Total: int(total)}, nil
}
