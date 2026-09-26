<!-- rtk-instructions v2 -->
# Command output

Command output here is condensed to save tokens, keeping every signal and
dropping costly noise. Treat it as the complete result: run commands
normally, and batch related commands into one call to avoid extra turns.
Truncated results state their recovery path in their own output. Re-run a
command as `rtk proxy <cmd>` only when its result is unusable: empty when
output was clearly expected, contradicting its exit code, or garbled.
<!-- /rtk-instructions -->

# Prompts

Save every relevant prompt in `prompts/`. See `prompts/CLAUDE.md` for the naming convention and structure.

# Docker

The engine runs inside WSL (Ubuntu), without Docker Desktop. If `docker` on
its own fails (e.g.: `unknown command: docker compose`, npipe error), run it
prefixed with `wsl`, e.g.: `wsl docker compose -f docker-compose.test.yml up -d`.
Node/npm/vitest keep running on Windows normally — WSL2 container ports
are already exposed on Windows' localhost.
