package httpapi

import (
	"time"

	"{{module-path}}/internal/modules/example/domain"
	"{{module-path}}/internal/modules/example/usecase"
)

// itemResponse is the domain -> HTTP contract, the Go equivalent of the TS
// kit's ItemPresenter. The only place that decides the response shape.
type itemResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
}

func toItemResponse(item domain.Item) itemResponse {
	return itemResponse{
		ID:        item.ID(),
		Name:      item.Name().String(),
		Status:    string(item.Status()),
		CreatedAt: item.CreatedAt().Format(time.RFC3339Nano),
	}
}

type paginationMetaResponse struct {
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

type listItemsResponse struct {
	Data []itemResponse         `json:"data"`
	Meta paginationMetaResponse `json:"meta"`
}

func toListItemsResponse(out usecase.ListItemsOutput) listItemsResponse {
	data := make([]itemResponse, len(out.Data))
	for i, item := range out.Data {
		data[i] = toItemResponse(item)
	}
	return listItemsResponse{
		Data: data,
		Meta: paginationMetaResponse{
			Page: out.Meta.Page, Limit: out.Meta.Limit,
			Total: out.Meta.Total, TotalPages: out.Meta.TotalPages,
		},
	}
}

// createItemRequest is the request body. DisallowUnknownFields (set by the
// decoder in handler.go) rejects an unknown field with 400 — the Go
// equivalent of Fastify's `additionalProperties: false`, and it works out of
// the box: no removeAdditional-style footgun to disable, unlike the TS kit.
type createItemRequest struct {
	Name string `json:"name"`
}
