package hooks

import (
	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/session"
	"github.com/rosberry/rauther/user"
)

type HookOptions struct {
	AfterAuth      func(gin.H, session.Session)
	AfterAuthCheck func(gin.H, session.Session)

	AfterPasswordSignUp func(resp gin.H, sess session.Session, u user.User, authKey string)
	AfterSocialSignUp   func(resp gin.H, sess session.Session, u user.User, authKey string)
	AfterOTPSignUp      func(resp gin.H, sess session.Session, u user.User, authKey string)

	AfterPasswordSignIn func(resp gin.H, sess session.Session, u user.User, authKey string)
	AfterSocialSignIn   func(resp gin.H, sess session.Session, u user.User, authKey string)
	AfterOTPSignIn      func(resp gin.H, sess session.Session, u user.User, authKey string)
}
