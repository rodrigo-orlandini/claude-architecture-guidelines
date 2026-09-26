package domain

import (
	"fmt"

	"{{module-path}}/internal/platform/httperr"
)

// ItemNotFoundError-equivalent: a constructor function producing the shared
// *httperr.DomainError type. Errors used by more than one caller live here
// (rule: errors/<name>-error.ts equivalent); an error produced by only one VO
// stays next to that VO (see item_name.go, item_status.go).
func NewItemNotFoundError(id string) error {
	return httperr.New("ITEM_NOT_FOUND", fmt.Sprintf("item %s not found", id))
}
