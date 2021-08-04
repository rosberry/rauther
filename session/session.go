package session

// Definition of session interface
// Session interface
type Session interface {
	GetToken() (token string)
	GetUserPID() (pid string)

	SetToken(token string)
	SetUserPID(pid string)
}
