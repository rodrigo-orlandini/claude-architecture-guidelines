//go:build integration

// Integration tests run with `go test -tags=integration ./...` against a real
// Postgres (docker-compose.test.yml). Build tags are Go's equivalent of the
// TS kit's separate vitest.integration.ts config / *.integration-spec.ts
// suffix: same idea (keep slow, I/O-bound tests out of the default `go test
// ./...` run), different mechanism.
package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"{{module-path}}/internal/modules/example/domain"
	"{{module-path}}/internal/modules/example/usecase"
)

func testPool(t *testing.T) *pgxpool.Pool {
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
	return pool
}

func mustItem(t *testing.T, id, name string, createdAt time.Time) domain.Item {
	t.Helper()
	itemName, err := domain.NewItemName(name)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	return domain.RehydrateItem(id, itemName, domain.ItemStatusActive, createdAt)
}

func TestItemRepository_SaveAndFindByID(t *testing.T) {
	repo := NewItemRepository(testPool(t))
	ctx := context.Background()

	item := mustItem(t, "00000000-0000-0000-0000-000000000001", "Mug", time.Now().UTC())
	if err := repo.Save(ctx, item); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	found, err := repo.FindByID(ctx, item.ID())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if found == nil || found.Name().String() != "Mug" {
		t.Fatalf("got %+v, want Mug", found)
	}
}

func TestItemRepository_FindByID_unknown(t *testing.T) {
	repo := NewItemRepository(testPool(t))
	found, err := repo.FindByID(context.Background(), "00000000-0000-0000-0000-000000000099")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if found != nil {
		t.Fatalf("got %+v, want nil", found)
	}
}

func TestItemRepository_FindMany_newestFirstWithTotal(t *testing.T) {
	pool := testPool(t)
	repo := NewItemRepository(pool)
	ctx := context.Background()

	old := mustItem(t, "00000000-0000-0000-0000-000000000001", "Old", time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC))
	newer := mustItem(t, "00000000-0000-0000-0000-000000000002", "New", time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC))
	_ = repo.Save(ctx, old)
	_ = repo.Save(ctx, newer)

	result, err := repo.FindMany(ctx, usecase.FindManyParams{Page: 1, Limit: 10})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Total != 2 {
		t.Errorf("got total %d, want 2", result.Total)
	}
	if result.Items[0].Name().String() != "New" || result.Items[1].Name().String() != "Old" {
		t.Errorf("got order %q, %q; want New, Old", result.Items[0].Name(), result.Items[1].Name())
	}
}
