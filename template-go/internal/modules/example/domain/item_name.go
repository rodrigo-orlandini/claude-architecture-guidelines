package domain

import (
	"strings"

	"{{module-path}}/internal/platform/httperr"
)

// ItemName is a value object: unexported field forces callers through NewItemName,
// the Go equivalent of a private constructor + static create() in the TS kit.
type ItemName struct {
	value string
}

const itemNameMaxLength = 120

// NewItemName validates and trims raw input. Returns (ItemName, error) — Go's
// idiomatic stand-in for the TS kit's Either<InvalidXError, X>: no Either type,
// just the language's native two-value return plus a typed *httperr.DomainError.
func NewItemName(raw string) (ItemName, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || len(trimmed) > itemNameMaxLength {
		return ItemName{}, httperr.New("INVALID_ITEM_NAME", "item name must be non-empty and at most 120 characters")
	}
	return ItemName{value: trimmed}, nil
}

func (n ItemName) String() string { return n.value }
