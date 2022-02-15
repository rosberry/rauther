package modules

import (
	"fmt"

	"github.com/rosberry/rauther/checker"
)

type Modules struct {
	Session                  bool
	AuthableUser             bool
	GuestUser                bool
	PasswordAuthableUser     bool
	SocialAuthableUser       bool
	ConfirmableUser          bool
	RecoverableUser          bool
	CodeSentTimeUser         bool
	OTP                      bool
	LinkAccount              bool
	MergeAccount             bool
	CustomizableMergeAccount bool
}

func (m Modules) String() string {
	return fmt.Sprintf(`
	- Session: %v
	- AuthableUser: %v
	- GuestUser: %v
	- PasswordAuthableUser: %v
	- SocialAuthableUser: %v
	- ConfirmableUser: %v
	- RecoverableUser: %v
	- CodeSentTimeUser: %v
	- One Time Password: %v
	- Link account: %v
	- Merge account: %v
	- Customizable Merge account: %v`,
		m.Session,
		m.AuthableUser,
		m.GuestUser,
		m.PasswordAuthableUser,
		m.SocialAuthableUser,
		m.ConfirmableUser,
		m.RecoverableUser,
		m.CodeSentTimeUser,
		m.OTP,
		m.LinkAccount,
		m.MergeAccount,
		m.CustomizableMergeAccount,
	)
}

func New(checker *checker.Checker) *Modules {
	return &Modules{
		Session:                  true,
		AuthableUser:             checker.Authable,
		GuestUser:                checker.Guest,
		PasswordAuthableUser:     checker.PasswordAuthable,
		SocialAuthableUser:       true, // no interfaces required // FIXME
		ConfirmableUser:          checker.Confirmable,
		RecoverableUser:          checker.Recoverable,
		CodeSentTimeUser:         checker.CodeSentTime,
		OTP:                      checker.OTPAuth,
		LinkAccount:              checker.LinkAccount,
		MergeAccount:             checker.MergeAccount,
		CustomizableMergeAccount: checker.CustomMergeAccount,
	}
}
