package modules

import (
	"fmt"

	"github.com/rosberry/rauther/checker"
	"github.com/rosberry/rauther/user"
)

type Modules struct {
	Session         bool
	AuthableUser    bool
	ConfirmableUser bool
	RecoverableUser bool
}

func (m Modules) String() string {
	return fmt.Sprintf("- Session: %v\n- AuthableUser: %v\n- ConfirmableUser: %v\n- RecoverableUser: %v",
		m.Session,
		m.AuthableUser,
		m.ConfirmableUser,
		m.RecoverableUser)
}

func New(user user.User) *Modules {
	checker := checker.New(user)

	return &Modules{
		Session:         true,
		AuthableUser:    checker.Authable,
		ConfirmableUser: checker.Confirmable,
		RecoverableUser: checker.Recoverable,
	}
}
