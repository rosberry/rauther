package deps

import (
	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/checker"
	"github.com/rosberry/rauther/sender"
	"github.com/rosberry/rauther/storage"
	"github.com/rosberry/rauther/user"
)

// Deps contain dependencies for Rauther
type Deps struct {
	// R is gin Engine
	R *gin.Engine

	// Storage is wrapper for User/Session and other storers
	Storage

	// checker for check implement user interfaces
	checker *checker.Checker

	// senders - list of senders for various types of sending
	Senders *sender.Senders
}

type Storage struct {
	// SessionStorer for load/save sessions
	SessionStorer storage.SessionStorer

	// UserStorer for load/save users
	UserStorer storage.UserStorer
}

func New(r *gin.Engine, storage Storage) Deps {
	var u user.User
	if storage.UserStorer != nil {
		u = storage.UserStorer.Create("")
	}

	return Deps{
		R:       r,
		Storage: storage,
		checker: checker.New(u),
	}
}

func (d *Deps) Checker() *checker.Checker {
	return d.checker
}
