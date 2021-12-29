package modules

import (
	"fmt"

	"github.com/rosberry/rauther/checker"
)

type Modules struct {
	Session              bool
	AuthableUser         bool
	PasswordAuthableUser bool
	SocialAuthableUser   bool
	ConfirmableUser      bool
	RecoverableUser      bool
	CodeSentTimeUser     bool
	OTP                  bool
	LinkAccount          bool
}

func (m Modules) String() string {
	return fmt.Sprintf(`
	- Session: %v
	- AuthableUser: %v
	- PasswordAuthableUser: %v
	- SocialAuthableUser: %v
	- ConfirmableUser: %v
	- RecoverableUser: %v
	- CodeSentTimeUser: %v
	- One Time Password: %v
	- Link account: %v`,
		m.Session,
		m.AuthableUser,
		m.PasswordAuthableUser,
		m.SocialAuthableUser,
		m.ConfirmableUser,
		m.RecoverableUser,
		m.CodeSentTimeUser,
		m.OTP,
		m.LinkAccount,
	)
}

func New(checker *checker.Checker) *Modules {
	return &Modules{
		Session:              true,
		AuthableUser:         checker.Authable,
		PasswordAuthableUser: checker.PasswordAuthable,
		SocialAuthableUser:   true, // no interfaces required
		ConfirmableUser:      checker.Confirmable,
		RecoverableUser:      checker.Recoverable,
		CodeSentTimeUser:     checker.CodeSentTime,
		OTP:                  checker.OTPAuth,
		LinkAccount:          checker.LinkAccount,
	}
}
