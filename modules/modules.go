package modules

import (
	"fmt"

	"github.com/rosberry/rauther/checker"
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

func New(checker *checker.Checker) *Modules {
	return &Modules{
		Session:         true,
		AuthableUser:    checker.Authable,
		ConfirmableUser: checker.Confirmable,
		RecoverableUser: checker.Recoverable,
	}
}
