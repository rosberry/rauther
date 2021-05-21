package rauther

import "github.com/gin-gonic/gin"

// Deps contain dependencies for Rauther
type Deps struct {
	// R is gin Engine
	R *gin.Engine

	// SessionStorer for load/save sessions
	SessionStorer SessionStorer
}
