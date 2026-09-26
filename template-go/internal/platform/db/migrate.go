package db

import (
	"database/sql"

	"github.com/pressly/goose/v3"
)

// RunMigrations drives goose as a library against dir (a plain OS path, e.g.
// "db/migrations") using a *database/sql.DB — a second, short-lived
// connection distinct from the pgxpool.Pool the app uses for queries, since
// goose speaks database/sql. command is one of "up", "down", "status".
//
// Called by cmd/migrate (manual/CI use) and by cmd/api at boot (the Go
// equivalent of the TS kit's Docker dev CMD running `prisma migrate deploy`
// before starting the server).
func RunMigrations(sqlDB *sql.DB, dir, command string) error {
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	return goose.Run(command, sqlDB, dir)
}
