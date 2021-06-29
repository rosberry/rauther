package modules

import (
	"github.com/rosberry/rauther/checker"
	"github.com/rosberry/rauther/user"
)

type Modules struct {
	Session         bool
	AuthableUser    bool
	ConfirmableUser bool
	// RecoverableUser bool
}

func New(user user.User) *Modules {
	checker := checker.New(user)

	return &Modules{
		Session:         true,
		AuthableUser:    checker.Authable,
		ConfirmableUser: checker.Confirmable,
	}
}
