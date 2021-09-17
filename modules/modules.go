package modules

import (
	"fmt"

	"github.com/rosberry/rauther/checker"
)

type Modules struct {
	Session          bool
	AuthableUser     bool
	ConfirmableUser  bool
	RecoverableUser  bool
	CodeSentTimeUser bool
	OTP              bool
}

func (m Modules) String() string {
	return fmt.Sprintf("- Session: %v\n- AuthableUser: %v\n- ConfirmableUser: %v\n- RecoverableUser: %v\n- CodeSentTimeUser: %v\n- One Time Password: %v",
		m.Session,
		m.AuthableUser,
		m.ConfirmableUser,
		m.RecoverableUser,
		m.CodeSentTimeUser,
		m.OTP)
}

func New(checker *checker.Checker) *Modules {
	return &Modules{
		Session:          true,
		AuthableUser:     checker.Authable,
		ConfirmableUser:  checker.Confirmable,
		RecoverableUser:  checker.Recoverable,
		CodeSentTimeUser: checker.CodeSentTime,
		OTP:              checker.OTPAuth,
	}
}
