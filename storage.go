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
	// LoadByPID return User by PID or create new if not found.
	LoadByPID(pid string) (user User, exist bool)

	// Save User
	Save(user User) error
}
