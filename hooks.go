package rauther

import (
	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/session"
	"github.com/rosberry/rauther/user"
)

func (r *Rauther) AfterAuth(f func(resp gin.H, ses session.Session)) {
	r.hooks.AfterAuth = f
}

func (r *Rauther) AfterAuthCheck(f func(resp gin.H, ses session.Session)) {
	r.hooks.AfterAuthCheck = f
}

func (r *Rauther) AfterPasswordSignIn(f func(resp gin.H, sess session.Session, u user.User, authKey string)) {
	r.hooks.AfterPasswordSignIn = f
}

func (r *Rauther) AfterSocialSignIn(f func(resp gin.H, sess session.Session, u user.User, authKey string)) {
	r.hooks.AfterSocialSignIn = f
}

func (r *Rauther) AfterOTPSignIn(f func(resp gin.H, sess session.Session, u user.User, authKey string)) {
	r.hooks.AfterOTPSignIn = f
}

func (r *Rauther) AfterPasswordSignUp(f func(resp gin.H, sess session.Session, u user.User, authKey string)) {
	r.hooks.AfterPasswordSignUp = f
}

func (r *Rauther) AfterSocialSignUp(f func(resp gin.H, sess session.Session, u user.User, authKey string)) {
	r.hooks.AfterSocialSignUp = f
}

func (r *Rauther) AfterOTPSignUp(f func(resp gin.H, sess session.Session, u user.User, authKey string)) {
	r.hooks.AfterOTPSignUp = f
}
