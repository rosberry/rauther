package rauther

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/common"
	"github.com/rosberry/rauther/user"
)

// AuthMiddleware provide public access to auth middleware
func (r *Rauther) AuthMiddleware() gin.HandlerFunc {
	return r.authMiddleware()
}

func (r *Rauther) AuthUserMiddleware() gin.HandlerFunc {
	return r.authUserMiddleware()
}

func (r *Rauther) AuthUserConfirmedMiddleware() gin.HandlerFunc {
	return r.authUserConfirmedMiddleware()
}

func (r *Rauther) authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if token := parseAuthToken(c); token != "" {
			session := r.deps.SessionStorer.FindByToken(token)
			if session == nil || session.GetToken() == "" {
				errorResponse(c, http.StatusUnauthorized, common.ErrAuthFailed)
				c.Abort()

				return
			}

			if r.Modules.PasswordAuthableUser {
				if u, err := r.deps.UserStorer.LoadByID(session.GetUserID()); err == nil && u != nil {
					c.Set(r.Config.ContextNames.User, u)
				}
			}

			c.Set(r.Config.ContextNames.Session, session)

			c.Next()

			return
		}

		errorResponse(c, http.StatusUnauthorized, common.ErrNotAuth)
		c.Abort()
	}
}

func (r *Rauther) authUserMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		u, ok := c.Get(r.Config.ContextNames.User)

		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.ErrNotAuth)
			c.Abort()

			return
		}

		usr, ok := u.(user.User)
		if !ok {
			log.Fatal("[authUserMiddleware] failed 'user' type assertion to user.User")
		}

		if r.Config.CreateGuestUser && usr.(user.GuestUser).IsGuest() {
			errorResponse(c, http.StatusUnauthorized, common.ErrNotSignIn)
			c.Abort()

			return
		}

		c.Next()
	}
}

func (r *Rauther) authUserConfirmedMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !r.Modules.ConfirmableUser {
			c.Next()

			return
		}

		u, ok := c.Get(r.Config.ContextNames.User)

		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.ErrNotAuth)
			c.Abort()

			return
		}

		user, ok := u.(user.ConfirmableUser)
		if !ok {
			log.Fatal("[authUserConfirmedMiddleware] failed 'user' type assertion to user.ConfirmableUser")
		}

		if !user.Confirmed() {
			errorResponse(c, http.StatusUnauthorized, common.ErrNotConfirmed)
			c.Abort()

			return
		}

		c.Next()
	}
}
