package checker

import "github.com/rosberry/rauther/user"

type Checker struct {
	Authable    bool
	Emailable   bool
	Confirmable bool
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

// IsEmailableUser check implement user EmailableUser interface or not
func (c *Checker) IsEmailableUser(u user.User) (ok bool) {
	_, ok = u.(user.EmailableUser)
	return
}

// IsConfirmableUser check implement user ConfirmableUser interface or not
func (c *Checker) IsConfirmableUser(u user.User) (ok bool) {
	_, ok = u.(user.ConfirmableUser)
	return
}

func (c *Checker) checkAllInterfaces(u user.User) {
	c.Authable = c.IsAuthableUser(u)
	c.Emailable = c.IsEmailableUser(u)
	c.Confirmable = c.IsConfirmableUser(u)
}
