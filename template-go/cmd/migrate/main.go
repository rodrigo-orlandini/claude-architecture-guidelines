// Command migrate applies db/migrations against DATABASE_URL:
//
//	go run ./cmd/migrate up
//	go run ./cmd/migrate status
//
// goose is a library dependency (github.com/pressly/goose/v3), not a
// globally installed CLI — nothing beyond the Go toolchain is required.
package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib" // registers the "pgx" database/sql driver

	"{{module-path}}/internal/platform/db"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: migrate <up|down|status>")
		os.Exit(1)
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL is required")
		os.Exit(1)
	}

	sqlDB, err := sql.Open("pgx", databaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "opening database: %v\n", err)
		os.Exit(1)
	}
	defer sqlDB.Close()

	if err := db.RunMigrations(sqlDB, "db/migrations", os.Args[1]); err != nil {
		fmt.Fprintf(os.Stderr, "migrate %s: %v\n", os.Args[1], err)
		os.Exit(1)
	}
}
