package session

// Definition of session interface
// Session interface
type Session interface {
	GetID() (id string)
	GetToken() (token string)
	GetUserPID() (pid string)

	SetID(id string)
	SetToken(token string)
	SetUserPID(pid string)
}
