package storage

import (
	"github.com/rosberry/rauther/session"
	"github.com/rosberry/rauther/user"
)

// Definition of storage interfaces.
// Storage describe getting and save objects in DB

// SessionStorer interface
type SessionStorer interface {
	// LoadById return Session or create new if not found
	LoadByID(id string) session.Session

	// FindByToken return Session or nil if not found
	FindByToken(token string) session.Session

	// Save Session
	Save(session session.Session) error
}

// UserStorer interface
type UserStorer interface {
	// Load return User by uid and auth type or return error if not found.
	LoadByUID(authType, uid string) (user user.User, err error)

	// Load return User by ID or return error if not found.
	LoadByID(id interface{}) (user user.User, err error)

	// Create new User
	Create() (user user.User)

	// Save User
	Save(user user.User) error
}

type RemovableUserStorer interface {
	RemoveByID(id interface{}) error
}
