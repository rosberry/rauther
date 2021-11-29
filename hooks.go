package rauther

import (
	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/session"
)

func (r *Rauther) AfterAuth(f func(resp gin.H, ses session.Session)) {
	r.hooks.AfterAuth = f
}
