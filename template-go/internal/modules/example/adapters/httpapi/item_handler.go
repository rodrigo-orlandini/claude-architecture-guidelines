// Package httpapi holds the example module's HTTP handlers. A handler
// decodes/encodes JSON, calls exactly one use-case, and turns its (T, error)
// into a response — no business rule here (rule: controller/handler only
// matches on the error, never branches on domain state).
package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"{{module-path}}/internal/modules/example/usecase"
	"{{module-path}}/internal/platform/httperr"
)

type ItemHandler struct {
	CreateItem *usecase.CreateItemUseCase
	GetItem    *usecase.GetItemUseCase
	ListItems  *usecase.ListItemsUseCase
}

func (h *ItemHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /items", h.create)
	mux.HandleFunc("GET /items", h.list)
	mux.HandleFunc("GET /items/{itemId}", h.get)
}

func (h *ItemHandler) create(w http.ResponseWriter, r *http.Request) {
	var body createItemRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}

	item, err := h.CreateItem.Execute(r.Context(), usecase.CreateItemInput{Name: body.Name})
	if err != nil {
		writeDomainError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, toItemResponse(item))
}

func (h *ItemHandler) get(w http.ResponseWriter, r *http.Request) {
	itemID := r.PathValue("itemId")

	item, err := h.GetItem.Execute(r.Context(), itemID)
	if err != nil {
		writeDomainError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toItemResponse(item))
}

func (h *ItemHandler) list(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	out, err := h.ListItems.Execute(r.Context(), usecase.ListItemsInput{Page: page, Limit: limit})
	if err != nil {
		writeDomainError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toListItemsResponse(out))
}

func writeDomainError(w http.ResponseWriter, err error) {
	var domainErr *httperr.DomainError
	if errors.As(err, &domainErr) {
		body := httperr.ToHTTP(domainErr)
		writeJSON(w, body.StatusCode, body)
		return
	}
	// Not a *DomainError: infra/bug, not a Left the client should see the reason for.
	writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error")
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, httperr.Body{StatusCode: status, Error: code, Message: message})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
