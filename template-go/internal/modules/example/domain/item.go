// Package domain holds the example module's entity, value objects and domain
// errors. Rule (see docs/architecture-rules.md): this package imports nothing
// from internal/modules or internal/platform except platform/httperr — no
// database driver, no HTTP, no other module.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// Item is the module's entity. Fields are unexported; behavior goes through
// methods so invariants (like the status transition) can't be bypassed by
// direct field assignment from outside the package.
type Item struct {
	id        string
	name      ItemName
	status    ItemStatus
	createdAt time.Time
}

// NewItem creates a brand-new item: fresh id, ACTIVE status, now() timestamp.
func NewItem(name ItemName) Item {
	return Item{
		id:        uuid.NewString(),
		name:      name,
		status:    ItemStatusActive,
		createdAt: time.Now().UTC(),
	}
}

// RehydrateItem reconstructs an Item from already-validated persisted state —
// used only by the mapper (adapters/postgres) when reading a row back.
// Never call this from a use-case; use NewItem there instead.
func RehydrateItem(id string, name ItemName, status ItemStatus, createdAt time.Time) Item {
	return Item{id: id, name: name, status: status, createdAt: createdAt}
}

func (i Item) ID() string           { return i.id }
func (i Item) Name() ItemName       { return i.name }
func (i Item) Status() ItemStatus   { return i.status }
func (i Item) CreatedAt() time.Time { return i.createdAt }

// Archive is entity behavior: it delegates the transition rule to the status
// VO and only mutates state if the transition is legal.
func (i *Item) Archive() error {
	next, err := i.status.TransitionTo(ItemStatusArchived)
	if err != nil {
		return err
	}
	i.status = next
	return nil
}
