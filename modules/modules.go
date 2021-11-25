package modules

import (
	"fmt"

	"github.com/rosberry/rauther/checker"
)

type Modules struct {
	Session              bool
	PasswordAuthableUser bool
	SocialAuthableUser   bool
	ConfirmableUser      bool
	RecoverableUser      bool
	CodeSentTimeUser     bool
	OTP                  bool
}

func (m Modules) String() string {
	return fmt.Sprintf("- Session: %v\n- AuthableUser: %v\n- SocialAuthableUser: %v\n- ConfirmableUser: %v\n- RecoverableUser: %v\n- CodeSentTimeUser: %v\n- One Time Password: %v",
		m.Session,
		m.PasswordAuthableUser,
		m.SocialAuthableUser,
		m.ConfirmableUser,
		m.RecoverableUser,
		m.CodeSentTimeUser,
		m.OTP)
}

func New(checker *checker.Checker) *Modules {
	return &Modules{
		Session:              true,
		PasswordAuthableUser: checker.PasswordAuthable,
		SocialAuthableUser:   true, // no interfaces required
		ConfirmableUser:      checker.Confirmable,
		RecoverableUser:      checker.Recoverable,
		CodeSentTimeUser:     checker.CodeSentTime,
		OTP:                  checker.OTPAuth,
	}
}
