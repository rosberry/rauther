package session

import "github.com/rosberry/rauther/user"

// Definition of session interface
// Session interface
type Session interface {
	GetToken() (token string)
	GetUserID() (userID interface{})

	SetToken(token string)
	BindUser(u user.User)
	UnbindUser(u user.User)
}
