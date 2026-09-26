-- name: UpsertItem :exec
INSERT INTO items (id, name, status, created_at)
VALUES ($1, $2, $3, $4)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;

-- name: GetItemByID :one
SELECT id, name, status, created_at FROM items WHERE id = $1;

-- name: ListItems :many
SELECT id, name, status, created_at FROM items
ORDER BY created_at DESC, id ASC
LIMIT $1 OFFSET $2;

-- name: CountItems :one
SELECT count(*) FROM items;
