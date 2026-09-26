package postgres

import (
	"fmt"

	"{{module-path}}/internal/modules/example/adapters/postgres/sqlcgen"
	"{{module-path}}/internal/modules/example/domain"
)

// toDomain mirrors the TS kit's ItemMapper.toDomain: re-validates every value
// object on the way out of the database. A row sqlc can decode but the domain
// rejects (e.g. a name written by some other process, a status not in the
// enum) is a data bug — panic here, don't hide it behind a *found=false*.
func toDomain(row sqlcgen.Item) (domain.Item, error) {
	name, err := domain.NewItemName(row.Name)
	if err != nil {
		return domain.Item{}, fmt.Errorf("invalid item name in DB (id=%s): %w", row.ID, err)
	}
	status, err := domain.ParseItemStatus(row.Status)
	if err != nil {
		return domain.Item{}, fmt.Errorf("invalid item status in DB (id=%s): %w", row.ID, err)
	}
	return domain.RehydrateItem(row.ID, name, status, row.CreatedAt.Time), nil
}
