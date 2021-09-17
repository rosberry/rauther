package checker

import (
	"github.com/rosberry/rauther/user"
)

type Checker struct {
	Authable     bool
	Confirmable  bool
	Recoverable  bool
	CodeSentTime bool
	OTPAuth      bool
}

func New(user user.User) *Checker {
	checker := &Checker{}
	checker.checkAllInterfaces(user)

	return checker
}

// IsAuthableUser check implement user AuthableUser interface or not
func (c *Checker) IsAuthableUser(u user.User) (ok bool) {
	_, ok = u.(user.AuthableUser)
	return
}

// IsConfirmableUser check implement user ConfirmableUser interface or not
func (c *Checker) IsConfirmableUser(u user.User) (ok bool) {
	_, ok = u.(user.ConfirmableUser)
	return
}

func (c *Checker) IsRecoverableUser(u user.User) (ok bool) {
	_, ok = u.(user.RecoverableUser)
	return
}

func (c *Checker) IsCodeSentTimeUser(u user.User) (ok bool) {
	_, ok = u.(user.CodeSentTimeUser)
	return
}

func (c *Checker) IsOTPAuth(u user.User) (ok bool) {
	_, ok = u.(user.OTPAuth)
	return
}

func (c *Checker) checkAllInterfaces(u user.User) {
	c.Authable = c.IsAuthableUser(u)
	c.Confirmable = c.IsConfirmableUser(u)
	c.Recoverable = c.IsRecoverableUser(u)
	c.CodeSentTime = c.IsCodeSentTimeUser(u)
	c.OTPAuth = c.IsOTPAuth(u)
}
