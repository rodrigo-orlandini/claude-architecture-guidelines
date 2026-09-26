// Package httperr maps domain errors to HTTP responses.
package httperr

import "net/http"

// DomainError is the Go equivalent of the TS kit's DomainError: a typed error
// carrying a semantic Code, distinct from Go's plain "error wraps error" chains.
// Constructors live next to the type that produces them (see domain package);
// this package only knows how to turn a Code into an HTTP status.
type DomainError struct {
	Code    string
	Message string
}

func (e *DomainError) Error() string { return e.Message }

func New(code, message string) *DomainError {
	return &DomainError{Code: code, Message: message}
}

// Body is the wire format: {"statusCode":..,"error":"CODE","message":".."} — identical
// shape to the TS kit's http-error-mapper, so client code migrating between stacks
// doesn't need to change its error handling.
type Body struct {
	StatusCode int    `json:"statusCode"`
	Error      string `json:"error"`
	Message    string `json:"message"`
}

// statusByCode mirrors template/src/shared/errors/http-error-mapper.ts HTTP_STATUS_MAP.
// Every new DomainError code needs an entry here — no entry falls back to 500.
var statusByCode = map[string]int{
	"VALIDATION_ERROR":               422,
	"NOT_FOUND":                      404,
	"CONFLICT":                       409,
	"ITEM_NOT_FOUND":                 404,
	"INVALID_ITEM_NAME":              422,
	"INVALID_ITEM_STATUS":            422,
	"INVALID_ITEM_STATUS_TRANSITION": 409,
}

// ToHTTP resolves the status code for a DomainError. Call sites still decide
// whether the error IS a *DomainError (via errors.As) before calling this.
func ToHTTP(err *DomainError) Body {
	status, ok := statusByCode[err.Code]
	if !ok {
		status = http.StatusInternalServerError
	}
	return Body{StatusCode: status, Error: err.Code, Message: err.Message}
}
