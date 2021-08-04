package session

import "github.com/rosberry/rauther/user"

// Definition of session interface
// Session interface
type Session interface {
	GetToken() (token string)
	GetUserPID() (pid string)

	SetToken(token string)
	BindUser(u user.User)
	UnbindUser(u user.User)
}
