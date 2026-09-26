// Package config reads process configuration from the environment.
// No framework: os.Getenv with typed helpers and defaults, same spirit as the
// TS kit's process.env access, just centralized in one place per platform rule.
package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port            int
	LogLevel        string
	DatabaseURL     string
	OTELEndpoint    string
	OTELServiceName string
}

func Load() (Config, error) {
	cfg := Config{
		Port:            envInt("PORT", 8080),
		LogLevel:        envString("LOG_LEVEL", "info"),
		DatabaseURL:     envString("DATABASE_URL", ""),
		OTELEndpoint:    envString("OTEL_EXPORTER_OTLP_ENDPOINT", ""),
		OTELServiceName: envString("OTEL_SERVICE_NAME", "{{project-slug}}"),
	}
	if cfg.DatabaseURL == "" {
		return cfg, fmt.Errorf("DATABASE_URL is required")
	}
	return cfg, nil
}

func envString(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}
