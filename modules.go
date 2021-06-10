package rauther

type Modules struct {
	Session         bool
	AuthableUser    bool
	ConfirmableUser bool
	// RecoverableUser bool
}

func defaultModules(user User) *Modules {
	checker := newCheckerByUser(user)

	return &Modules{
		Session:         true,
		AuthableUser:    checker.Authable,
		ConfirmableUser: checker.Confirmable,
	}
}
