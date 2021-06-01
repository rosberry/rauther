package rauther

type Checker struct {
	Authable    bool
	Emailable   bool
	Confirmable bool
}

func newCheckerByUser(user User) *Checker {
	checker := &Checker{}
	checker.checkAllInterfaces(user)

	return checker
}

// IsAuthableUser check implement user AuthableUser interface or not
func (c *Checker) IsAuthableUser(user User) (ok bool) {
	_, ok = user.(AuthableUser)
	return
}

// IsEmailableUser check implement user EmailableUser interface or not
func (c *Checker) IsEmailableUser(user User) (ok bool) {
	_, ok = user.(EmailableUser)
	return
}

// IsConfirmableUser check implement user ConfirmableUser interface or not
func (c *Checker) IsConfirmableUser(user User) (ok bool) {
	_, ok = user.(ConfirmableUser)
	return
}

func (c *Checker) checkAllInterfaces(user User) {
	c.Authable = c.IsAuthableUser(user)
	c.Emailable = c.IsEmailableUser(user)
	c.Confirmable = c.IsConfirmableUser(user)
}
