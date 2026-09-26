// Command compose is a portable `docker compose` wrapper: uses native Docker
// when available, falls back to Docker Engine inside WSL on Windows without
// Docker Desktop. Needs nothing beyond the Go toolchain already required to
// build the app — no Node, no extra install. Usage:
//
//	go run ./scripts/compose -- -f docker-compose.test.yml up -d --wait
package main

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
)

func works(name string, args ...string) bool {
	cmd := exec.Command(name, append(args, "compose", "version")...)
	return cmd.Run() == nil
}

func main() {
	args := os.Args[1:]
	if len(args) > 0 && args[0] == "--" {
		args = args[1:]
	}

	name := "docker"
	prefix := []string{}

	if !works("docker") {
		if runtime.GOOS == "windows" && works("wsl", "docker") {
			name = "wsl"
			prefix = []string{"docker"}
		} else {
			fmt.Fprintln(os.Stderr, "docker compose not found (native or via WSL). See _architecture/SETUP.md section 1.")
			os.Exit(1)
		}
	}

	cmd := exec.Command(name, append(append(prefix, "compose"), args...)...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	if err := cmd.Run(); err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			os.Exit(exitErr.ExitCode())
		}
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
