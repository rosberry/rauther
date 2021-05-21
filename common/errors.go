package common

// Contain common errors
type Err struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e Err) Error() string {
	return e.Message
}

type ErrTypes int

const (
	ErrSessionLoad ErrTypes = 100 + iota
	ErrSessionSave
	ErrNotAuth
	ErrAuthFailed
)

var Errors = map[ErrTypes]Err{
	ErrSessionLoad: {"failed_load_session", "Failed load session"},
	ErrSessionSave: {"failed_save_session", "Failed save session"},
	ErrNotAuth:     {"not_auth", "Auth token required"},
	ErrAuthFailed:  {"auth_failed", "Invalid token"},
}
