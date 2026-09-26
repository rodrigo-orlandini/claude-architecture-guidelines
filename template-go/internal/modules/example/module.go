// Package example is the module's wiring root — the only file that imports
// both usecase and the concrete adapters (postgres, httpapi). Nothing else
// in the module, and nothing outside it, is allowed to construct these
// concrete types directly (rule: no `New...` of an adapter outside module.go).
package example

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"{{module-path}}/internal/modules/example/adapters/httpapi"
	"{{module-path}}/internal/modules/example/adapters/postgres"
	"{{module-path}}/internal/modules/example/usecase"
)

type Module struct {
	handler *httpapi.ItemHandler
}

func New(pool *pgxpool.Pool) *Module {
	repo := postgres.NewItemRepository(pool)

	return &Module{
		handler: &httpapi.ItemHandler{
			CreateItem: usecase.NewCreateItemUseCase(repo),
			GetItem:    usecase.NewGetItemUseCase(repo),
			ListItems:  usecase.NewListItemsUseCase(repo),
		},
	}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) {
	m.handler.RegisterRoutes(mux)
}
