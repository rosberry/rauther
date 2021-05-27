package rauther

type Checker struct{}

// IsAuthableUser check implement user AuthableUser interface or not
func (c *Checker) IsAuthableUser(user User) (ok bool) {
	_, ok = user.(AuthableUser)
	return
}
