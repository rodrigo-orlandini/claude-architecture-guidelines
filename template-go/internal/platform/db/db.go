// Package db wires the shared Postgres connection pool (pgxpool). Equivalent
// to shared/database/prisma-client.ts: a single client shared by every
// module's repository, opened once in cmd/api/main.go.
package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}
