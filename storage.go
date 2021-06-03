package rauther

// Definition of storage interfaces.
// Storage describe getting and save objects in DB

// SessionStorer interface
type SessionStorer interface {
	// LoadById return Session or create new if not found
	LoadByID(id string) Session

	// FindByToken return Session or nil if not found
	FindByToken(token string) Session

	// Save Session
	Save(session Session) error
}

// UserStorer interface
type UserStorer interface {
	// Load return User by PID or return error if not found.
	Load(pid string) (user User, err error)

	// CreateByPID create new user and set PID to him
	CreateByPID(pid string) (user User)

	// Save User
	Save(user User) error
}
