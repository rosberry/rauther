package checker

import (
	"github.com/rosberry/rauther/user"
)

type Checker struct {
	Authable           bool
	PasswordAuthable   bool
	Guest              bool
	Confirmable        bool
	Recoverable        bool
	CodeSentTime       bool
	OTPAuth            bool
	LinkAccount        bool
	MergeAccount       bool
	CustomMergeAccount bool
}

func New(user user.User) *Checker {
	checker := &Checker{}
	checker.checkAllInterfaces(user)

	return checker
}

// IsAuthableUser checks if user implements AuthableUser interface
func (c *Checker) IsAuthableUser(u user.User) (ok bool) {
	_, ok = u.(user.AuthableUser)
	return
}

// IsPasswordAuthableUser checks if user implements IsPasswordAuthableUser interface
func (c *Checker) IsPasswordAuthableUser(u user.User) (ok bool) {
	_, ok = u.(user.PasswordAuthableUser)
	return
}

func (c *Checker) IsGuest(u user.User) (ok bool) {
	_, ok = u.(user.GuestUser)
	return
}

// IsConfirmableUser checks if user implements ConfirmableUser interface
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

func (c *Checker) IsLinkAccount(u user.User) (ok bool) {
	_, ok = u.(user.TempUser)
	return
}

func (c *Checker) IsMergeAccount(u user.User) (ok bool) {
	_, ok = u.(user.MergeUser)
	return
}

func (c *Checker) IsCustomMergeAccount(u user.User) (ok bool) {
	_, ok = u.(user.CustomMergeUser)
	return
}

func (c *Checker) checkAllInterfaces(u user.User) {
	c.Authable = c.IsAuthableUser(u)
	c.PasswordAuthable = c.IsPasswordAuthableUser(u)
	c.Guest = c.IsGuest(u)
	c.Confirmable = c.IsConfirmableUser(u)
	c.Recoverable = c.IsRecoverableUser(u)
	c.CodeSentTime = c.IsCodeSentTimeUser(u)
	c.OTPAuth = c.IsOTPAuth(u)
	c.LinkAccount = c.IsLinkAccount(u)
	c.MergeAccount = c.IsMergeAccount(u)
	c.CustomMergeAccount = c.IsCustomMergeAccount(u)
}
