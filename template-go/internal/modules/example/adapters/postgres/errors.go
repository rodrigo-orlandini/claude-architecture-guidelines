package postgres

import (
	"errors"

	"github.com/jackc/pgx/v5"
)

func isNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}

// isUniqueViolation is here for modules that need it: when an invariant is
// enforced by a DB constraint under concurrency (e.g. "no two bookings for
// the same slot"), catch the driver error and turn it into a domain Either
// instead of trusting a check-then-write race. See docs/architecture-rules.md,
// "Padrões de domínio". Not used by the example module (Item has no such
// constraint) — kept here as the pattern to copy.
//
// func isUniqueViolation(err error) bool {
// 	var pgErr *pgconn.PgError
// 	return errors.As(err, &pgErr) && pgErr.Code == "23505"
// }
