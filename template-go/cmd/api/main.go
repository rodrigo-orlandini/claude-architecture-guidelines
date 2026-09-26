// Command api boots the process: config -> logger -> tracer -> migrations ->
// db pool -> module wiring -> HTTP server -> graceful shutdown. Mirrors
// src/main.ts in the TS kit's bootstrap() step order.
package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // registers the "pgx" database/sql driver

	"{{module-path}}/internal/modules/example"
	"{{module-path}}/internal/platform/config"
	"{{module-path}}/internal/platform/db"
	"{{module-path}}/internal/platform/httpserver"
	"{{module-path}}/internal/platform/observability"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	ctx := context.Background()

	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}

	observability.InitLogger(cfg.LogLevel)

	shutdownTracer, err := observability.InitTracer(ctx, cfg.OTELServiceName)
	if err != nil {
		return fmt.Errorf("initializing tracer: %w", err)
	}
	defer func() { _ = shutdownTracer(context.Background()) }()

	// Migrations run on every boot, same as the TS kit's dev Docker CMD
	// (`prisma migrate deploy && tsx watch`) — idempotent, a no-op when the
	// schema is already current.
	sqlDB, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("opening migration connection: %w", err)
	}
	if err := db.RunMigrations(sqlDB, "db/migrations", "up"); err != nil {
		sqlDB.Close()
		return fmt.Errorf("running migrations: %w", err)
	}
	sqlDB.Close()

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("connecting to database: %w", err)
	}
	defer pool.Close()

	// Register one module per bounded context here — same slot as
	// registerCatalogModule/registerCheckoutModule in the TS kit's main.ts.
	exampleModule := example.New(pool)

	handler := httpserver.New(exampleModule)
	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Port),
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		observability.FromContext(ctx).Info("server listening", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		return fmt.Errorf("server error: %w", err)
	case <-stop:
		observability.FromContext(ctx).Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdownCtx)
	}
}
