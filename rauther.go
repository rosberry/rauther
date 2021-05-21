package rauther

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rosberry/rauther/common"
)

// Rauther main object - contains configuration and other details for running.
type Rauther struct {
	Config
	deps Deps
}

// New make new instance of Rauther with default configuration
func New(deps Deps) *Rauther {
	cfg := Config{}
	cfg.Default()

	r := &Rauther{
		Config: cfg,
		deps:   deps,
	}

	r.deps.R.POST(r.Config.AuthPath, r.authHandler())

	return r
}

func (r *Rauther) authHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := c.Query(r.Config.SessionToken)

		session := r.deps.SessionStorer.LoadByID(sessionID)
		if session == nil {
			err := common.Errors[common.ErrSessionLoad]

			log.Print(err)
			errorResponse(c, http.StatusInternalServerError, err)

			return
		}

		session.SetToken(uuid.New().String())

		err := r.deps.SessionStorer.Save(session)
		if err != nil {
			err := common.Errors[common.ErrSessionSave]

			log.Print(err)
			errorResponse(c, http.StatusInternalServerError, err)

			return
		}

		c.JSON(http.StatusOK, gin.H{
			"result": true,
			"token":  session.GetToken(),
		})
	}
}

// AuthMiddleware provide public access to auth middleware
func (r *Rauther) AuthMiddleware() gin.HandlerFunc {
	return r.authMiddleware()
}

func (r *Rauther) authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if authHeader := c.Request.Header.Get("Authorization"); authHeader != "" { // nolint:nestif
			if strings.HasPrefix(authHeader, "Bearer ") {
				if token := authHeader[7:]; len(token) > 0 {
					session := r.deps.SessionStorer.FindByToken(token)
					if session == nil {
						err := common.Errors[common.ErrAuthFailed]
						errorResponse(c, http.StatusUnauthorized, err)
						c.Abort()

						return
					}

					c.Set(r.Config.SessionCtxName, session)
					c.Next()

					return
				}
			}
		}

		err := common.Errors[common.ErrNotAuth]
		errorResponse(c, http.StatusUnauthorized, err)
		c.Abort()
	}
}
