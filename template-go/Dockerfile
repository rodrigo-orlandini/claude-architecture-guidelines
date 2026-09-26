FROM golang:1.26-alpine AS base
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

# Dev: source is bind-mounted by docker-compose.yml, so this stage only needs
# the toolchain + downloaded module cache. `go run` recompiles on each
# container (re)start — no separate watch tool, mirroring the simplicity of
# the TS kit's choice to skip a hot-reload dependency in the dev stage.
FROM base AS dev
CMD ["go", "run", "./cmd/api"]

FROM base AS build
COPY . .
RUN CGO_ENABLED=0 go build -o /out/api ./cmd/api
RUN CGO_ENABLED=0 go build -o /out/migrate ./cmd/migrate

FROM gcr.io/distroless/static-debian12 AS prod
WORKDIR /app
COPY --from=build /out/api /out/migrate ./
COPY --from=build /app/db/migrations ./db/migrations
EXPOSE 8080
ENTRYPOINT ["/app/api"]
