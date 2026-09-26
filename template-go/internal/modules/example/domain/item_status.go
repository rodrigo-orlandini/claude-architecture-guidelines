package domain

import (
	"fmt"

	"{{module-path}}/internal/platform/httperr"
)

// ItemStatus is a Go enum: a named string type with a closed set of consts,
// plus a transition table. This is the idiomatic replacement for the TS kit's
// item-status.ts VO — no runtime enum object needed, `switch` gives exhaustiveness
// checks via `go vet`/staticcheck when every case is handled explicitly.
type ItemStatus string

const (
	ItemStatusActive   ItemStatus = "ACTIVE"
	ItemStatusArchived ItemStatus = "ARCHIVED"
)

// transitions mirrors item-status.ts: ACTIVE -> ARCHIVED, ARCHIVED is terminal.
var transitions = map[ItemStatus][]ItemStatus{
	ItemStatusActive:   {ItemStatusArchived},
	ItemStatusArchived: {},
}

// ParseItemStatus validates a raw string against the known set — used by the
// mapper when reading the "status" column (stored as TEXT, never a DB-native
// enum, so the domain owns validation instead of the schema).
func ParseItemStatus(raw string) (ItemStatus, error) {
	switch ItemStatus(raw) {
	case ItemStatusActive, ItemStatusArchived:
		return ItemStatus(raw), nil
	default:
		return "", httperr.New("INVALID_ITEM_STATUS", fmt.Sprintf("invalid item status: %s", raw))
	}
}

// TransitionTo returns the next status, or a DomainError if the transition
// isn't allowed by the table above.
func (s ItemStatus) TransitionTo(next ItemStatus) (ItemStatus, error) {
	for _, allowed := range transitions[s] {
		if allowed == next {
			return next, nil
		}
	}
	return "", httperr.New(
		"INVALID_ITEM_STATUS_TRANSITION",
		fmt.Sprintf("cannot change item status from %s to %s", s, next),
	)
}
