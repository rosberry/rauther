package deps

import (
	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/storage"
)

// Deps contain dependencies for Rauther
type Deps struct {
	// R is gin RouterGroup
	R *gin.RouterGroup

	// Storage is wrapper for User/Session and other storers
	Storage
}

type Storage struct {
	// SessionStorer for load/save sessions
	SessionStorer storage.SessionStorer

	// UserStorer for load/save users
	UserStorer storage.UserStorer

	// UserRemover
	UserRemover storage.RemovableUserStorer
}

func New(r *gin.RouterGroup, storage Storage) Deps {
	return Deps{
		R:       r,
		Storage: storage,
	}
}
