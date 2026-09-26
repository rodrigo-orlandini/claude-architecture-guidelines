//go:build integration

// HTTP routes exercised end to end with httptest + real DI wiring + real
// Postgres — the Go equivalent of the TS kit's item-controller.integration-spec.ts
// (built with app.inject). httptest.NewServer gives a real listening socket,
// so this also proves the middleware chain (correlation id, recovery) works.
package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"{{module-path}}/internal/modules/example"
	"{{module-path}}/internal/platform/httpserver"
)

func testServer(t *testing.T) *httptest.Server {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = "postgres://postgres:postgres@localhost:5433/{{project_db}}_test?sslmode=disable"
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("connecting to test database: %v", err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(context.Background(), "TRUNCATE TABLE items"); err != nil {
		t.Fatalf("truncating items: %v", err)
	}

	mod := example.New(pool)
	srv := httptest.NewServer(httpserver.New(mod))
	t.Cleanup(srv.Close)
	return srv
}

func postJSON(t *testing.T, srv *httptest.Server, path, body string) *http.Response {
	t.Helper()
	resp, err := http.Post(srv.URL+path, "application/json", bytes.NewBufferString(body))
	if err != nil {
		t.Fatalf("POST %s: %v", path, err)
	}
	return resp
}

func TestItemRoutes_CreateAndGet(t *testing.T) {
	srv := testServer(t)

	created := postJSON(t, srv, "/items", `{"name":"Mug"}`)
	defer created.Body.Close()
	if created.StatusCode != http.StatusCreated {
		t.Fatalf("got status %d, want 201", created.StatusCode)
	}
	if got := created.Header.Get("x-correlation-id"); got == "" {
		t.Error("expected x-correlation-id header on response")
	}

	var body struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	_ = json.NewDecoder(created.Body).Decode(&body)
	if body.Status != "ACTIVE" {
		t.Errorf("got status %q, want ACTIVE", body.Status)
	}

	found, err := http.Get(srv.URL + "/items/" + body.ID)
	if err != nil {
		t.Fatalf("GET /items/%s: %v", body.ID, err)
	}
	defer found.Body.Close()
	if found.StatusCode != http.StatusOK {
		t.Fatalf("got status %d, want 200", found.StatusCode)
	}
}

func TestItemRoutes_Create_rejectsUnknownField(t *testing.T) {
	srv := testServer(t)

	resp := postJSON(t, srv, "/items", `{"name":"Mug","hacker":true}`)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("got status %d, want 400 (unknown field must be rejected, not silently dropped)", resp.StatusCode)
	}
}

func TestItemRoutes_Create_blankNameIs422(t *testing.T) {
	srv := testServer(t)

	resp := postJSON(t, srv, "/items", `{"name":"   "}`)
	defer resp.Body.Close()

	if resp.StatusCode != 422 {
		t.Fatalf("got status %d, want 422", resp.StatusCode)
	}
	var body struct {
		Error string `json:"error"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&body)
	if body.Error != "INVALID_ITEM_NAME" {
		t.Errorf("got error %q, want INVALID_ITEM_NAME", body.Error)
	}
}

func TestItemRoutes_Get_unknownIdIs404(t *testing.T) {
	srv := testServer(t)

	resp, err := http.Get(srv.URL + "/items/00000000-0000-0000-0000-000000000099")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("got status %d, want 404", resp.StatusCode)
	}
}

func TestItemRoutes_List_paginationMeta(t *testing.T) {
	srv := testServer(t)
	postJSON(t, srv, "/items", `{"name":"A"}`).Body.Close()
	postJSON(t, srv, "/items", `{"name":"B"}`).Body.Close()

	resp, err := http.Get(srv.URL + "/items?limit=1")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()

	var body struct {
		Meta struct {
			Page, Limit, Total, TotalPages int
		} `json:"meta"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&body)
	if body.Meta.Total != 2 || body.Meta.TotalPages != 2 {
		t.Errorf("got meta %+v", body.Meta)
	}
}
