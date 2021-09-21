package modules

import (
	"fmt"

	"github.com/rosberry/rauther/checker"
)

type Modules struct {
	Session                 bool
	AuthableUser            bool
	ConfirmableUser         bool
	RecoverableUser         bool
	ConfirmableSentTimeUser bool
}

func (m Modules) String() string {
	return fmt.Sprintf("- Session: %v\n- AuthableUser: %v\n- ConfirmableUser: %v\n- RecoverableUser: %v\n- ConfirmableSentTimeUser: %v",
		m.Session,
		m.AuthableUser,
		m.ConfirmableUser,
		m.RecoverableUser,
		m.ConfirmableSentTimeUser,
	)
}

func New(checker *checker.Checker) *Modules {
	return &Modules{
		Session:                 true,
		AuthableUser:            checker.Authable,
		ConfirmableUser:         checker.Confirmable,
		RecoverableUser:         checker.Recoverable,
		ConfirmableSentTimeUser: checker.ConfirmableSentTime,
	}
}
