package hooks

import (
	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/session"
)

type HookOptions struct {
	AfterAuth      func(gin.H, session.Session)
	AfterAuthCheck func(gin.H, session.Session)
}
