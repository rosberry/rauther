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
	ErrNotSessionID
	ErrInvalidRequest
	ErrUserExist
	ErrUserNotFound
	ErrIncorrectPassword
	ErrUserLoad
	ErrUserSave
	ErrUnknownError
	ErrNotConfirmed
	ErrInvalidConfirmCode
	ErrGinDependency
	ErrSessionStorerDependency
	ErrAuthableUserNotImplement
	ErrConfirmableUserNotImplement
	ErrSenderRequired
	ErrRecoverableUserNotImplement
	ErrInvalidRecoveryCode
	ErrAlreadyAuth
	ErrNotSignIn
)

var Errors = map[ErrTypes]Err{
	ErrSessionLoad:                 {"failed_load_session", "Failed load session"},
	ErrSessionSave:                 {"failed_save_session", "Failed save session"},
	ErrNotAuth:                     {"not_auth", "Auth token required"},
	ErrNotSignIn:                   {"not_sign_in", "Authorized user required"},
	ErrAuthFailed:                  {"auth_failed", "Invalid token"},
	ErrNotSessionID:                {"not_session", "Session ID required"},
	ErrInvalidRequest:              {"req_invalid", "The request is not valid"},
	ErrUserExist:                   {"user_exist", "User already exist"},
	ErrUserNotFound:                {"user_not_found", "User not found"},
	ErrIncorrectPassword:           {"incorrect_password", "Incorrect password"},
	ErrUserLoad:                    {"failed_load_user", "Failed load user"},
	ErrUserSave:                    {"failed_save_user", "Failed save user"},
	ErrUnknownError:                {"unknown_error", "Unknown server error"},
	ErrNotConfirmed:                {"email_not_confirmed", "Email not confirmed"},
	ErrInvalidConfirmCode:          {"invalid_code", "Invalid confirm code"},
	ErrGinDependency:               {"gin_dependency_nil", "Nil gin dependency"},
	ErrSessionStorerDependency:     {"session_storer_nil", "Nil SessionStorer dependency"},
	ErrAuthableUserNotImplement:    {"authable_user_not_implement", "Please implement AuthableUser interface"},
	ErrConfirmableUserNotImplement: {"confirmable_user_not_implement", "Please implement ConfirmableUser interface"},
	ErrSenderRequired:              {"sender_required", "At least one sender is required"},
	ErrRecoverableUserNotImplement: {"recoverable_user_not_implement", "Please implement RecoverableUser interface"},
	ErrInvalidRecoveryCode:         {"invalid_code", "Invalid recovery code"},
	ErrAlreadyAuth:                 {"already_auth", "User already authorised"},
}
