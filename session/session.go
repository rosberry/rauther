package session

import "github.com/rosberry/rauther/user"

// Definition of session interface
// Session interface
type Session interface {
	GetID() (id string)
	GetToken() (token string)
	GetUserPID() (pid string)

	SetID(id string)
	SetToken(token string)
	BindUser(u user.User)
	UnbindUser(u user.User)
}
