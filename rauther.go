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

	r.deps.R.POST(r.Config.Routes.Auth, r.authHandler())
	authable := r.deps.R.Group("", r.authMiddleware())
	{
		authable.POST(r.Config.Routes.SignUp, r.signUpHandler())
		authable.POST(r.Config.Routes.SignIn, r.signInHandler())
	}

	return r
}

func (r *Rauther) authHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := c.Query(r.Config.SessionToken)
		if sessionID == "" {
			err := common.Errors[common.ErrNotSessionID]

			log.Print(err)
			errorResponse(c, http.StatusUnauthorized, err)

			return
		}

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

					c.Set(r.Config.ContextNames.Session, session)
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

func (r *Rauther) signUpHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		var request SignUpRequest

		request, err := parseSignUpRequestData(r, c)
		if err != nil {
			log.Print(err)
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRequest])

			return
		}

		pid := request.GetPID()
		password := request.GetPassword()

		s, ok := c.Get(r.Config.ContextNames.Session)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.Errors[common.ErrNotAuth])
			return
		}

		sess := s.(Session)
		sess.SetUserPID(pid)

		user, exist := r.deps.UserStorer.LoadByPID(pid)
		if exist {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrUserExist])
			return
		}

		authableUser, ok := user.(AuthableUser)
		if !ok {
			panic("Not implement AuthableUser interface")
		}

		authableUser.SetPassword(password)

		err = r.deps.SessionStorer.Save(sess)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrSessionSave])
			return
		}

		err = r.deps.UserStorer.Save(authableUser)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrUserSave])
			return
		}

		c.Set(r.Config.ContextNames.Session, sess)
		c.Set(r.Config.ContextNames.User, authableUser)

		c.JSON(http.StatusOK, gin.H{
			"result": true,
			"pid":    authableUser.GetPID(),
		})
	}
}

func (r *Rauther) SignUpHandler() gin.HandlerFunc {
	return r.signUpHandler()
}

func (r *Rauther) signInHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		var request SignUpRequest

		request, err := parseSignUpRequestData(r, c)
		if err != nil {
			log.Print(err)
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRequest])

			return
		}

		pid := request.GetPID()
		password := request.GetPassword()

		s, ok := c.Get(r.Config.ContextNames.Session)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.Errors[common.ErrNotAuth])
			return
		}

		sess := s.(Session)
		sess.SetUserPID(pid)

		user, exist := r.deps.UserStorer.LoadByPID(pid)
		if !exist {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrUserNotFound])
			return
		}

		authableUser, ok := user.(AuthableUser)
		if !ok {
			panic("Not implement AuthableUser interface")
		}

		userPassword := authableUser.GetPassword()

		if !passwordCompare(userPassword, password) {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrIncorrectPassword])
			return
		}

		err = r.deps.SessionStorer.Save(sess)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrSessionSave])
			return
		}

		err = r.deps.UserStorer.Save(authableUser)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrUserSave])
			return
		}

		c.Set(r.Config.ContextNames.Session, sess)
		c.Set(r.Config.ContextNames.User, authableUser)

		c.JSON(http.StatusOK, gin.H{
			"result": true,
		})
	}
}

func (r *Rauther) SignInHandler() gin.HandlerFunc {
	return r.signInHandler()
}
