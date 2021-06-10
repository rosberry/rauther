package rauther

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rosberry/rauther/common"
)

// Rauther main object - contains configuration and other details for running.
type Rauther struct {
	Config
	Modules *Modules
	deps    Deps
}

// New make new instance of Rauther with default configuration
func New(deps Deps) *Rauther {
	if deps.SessionStorer == nil {
		log.Fatal(common.Errors[common.ErrSessionStorerDependency])
	}

	if deps.R == nil {
		log.Fatal(common.Errors[common.ErrGinDependency])
	}

	cfg := Config{}
	cfg.Default()

	deps.checker = &Checker{}

	var user User
	if deps.UserStorer != nil {
		user = deps.UserStorer.Create("")
	}

	deps.checker.checkAllInterfaces(user)

	r := &Rauther{
		Config:  cfg,
		deps:    deps,
		Modules: defaultModules(user),
	}

	return r
}

func (r *Rauther) InitHandlers() error {
	if r.Modules.Session {
		r.includeSession()
	}

	return nil
}

func (r *Rauther) includeSession() {
	r.deps.R.POST(r.Config.Routes.Auth, r.authHandler())
	withSession := r.deps.R.Group("", r.authMiddleware())
	{
		if r.Modules.AuthableUser {
			r.includeAuthable(withSession)
		}
	}
}

func (r *Rauther) includeAuthable(router *gin.RouterGroup) {
	if !r.deps.checker.Authable {
		log.Fatal(common.Errors[common.ErrAuthableUserNotImplement])
	}

	router.POST(r.Config.Routes.SignUp, r.signUpHandler())
	router.POST(r.Config.Routes.SignIn, r.signInHandler())

	if r.Modules.ConfirmableUser {
		r.includeConfirmable(router)
	}
}

func (r *Rauther) includeConfirmable(router *gin.RouterGroup) {
	if !r.deps.checker.Confirmable {
		log.Fatal(common.Errors[common.ErrConfirmableUserNotImplement])
	}

	router.GET(r.Config.Routes.EmailConfirm, r.confirmEmailHandler())
}

func (r *Rauther) authHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		type authRequest struct {
			DeviceID string `json:"device_id"`
		}

		var request authRequest

		err := c.Bind(&request)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRequest])
			return
		}

		sessionID := request.DeviceID

		if sessionID == "" {
			errorResponse(c, http.StatusUnauthorized, common.Errors[common.ErrNotSessionID])
			return
		}

		session := r.deps.SessionStorer.LoadByID(sessionID)
		if session == nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrSessionLoad])
			return
		}

		// Create new guest user if it enabled in config
		if r.Config.CreateGuestUser && session.GetUserPID() == "" {
			tempUserPID := "guest:" + uuid.New().String()

			user, _ := r.deps.UserStorer.Load(tempUserPID)
			if user != nil {
				errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrUserExist])
				return
			}

			user = r.deps.UserStorer.Create(tempUserPID)

			err = r.deps.UserStorer.Save(user)
			if err != nil {
				errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrUserSave])
				return
			}

			session.SetUserPID(tempUserPID)
		}

		session.SetToken(uuid.New().String())

		err = r.deps.SessionStorer.Save(session)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrSessionSave])
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
		if token := parseAuthToken(c); token != "" {
			session := r.deps.SessionStorer.FindByToken(token)
			if session == nil {
				err := common.Errors[common.ErrAuthFailed]
				errorResponse(c, http.StatusUnauthorized, err)
				c.Abort()

				return
			}

			if r.Config.CreateGuestUser {
				user, _ := r.deps.UserStorer.Load(session.GetUserPID())
				c.Set(r.Config.ContextNames.User, user)
			}

			c.Set(r.Config.ContextNames.Session, session)
			c.Next()

			return
		}

		err := common.Errors[common.ErrNotAuth]
		errorResponse(c, http.StatusUnauthorized, err)
		c.Abort()
	}
}

func (r *Rauther) signUpHandler() gin.HandlerFunc {
	if !r.deps.checker.Authable {
		log.Print("Not implement AuthableUser interface")
		return nil
	}

	return func(c *gin.Context) {
		var request SignUpRequest

		request, err := parseSignUpRequestData(r, c)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRequest])
			return
		}

		pid, password := request.GetPID(), request.GetPassword()

		s, ok := c.Get(r.Config.ContextNames.Session)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.Errors[common.ErrNotAuth])
			return
		}

		sess := s.(Session)
		sess.SetUserPID(pid)

		if err = r.deps.SessionStorer.Save(sess); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrSessionSave])
			return
		}

		user, err := r.deps.UserStorer.Load(pid)
		if err == nil && user != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrUserExist])
			return
		}

		user = r.deps.UserStorer.Create(pid)

		user.(AuthableUser).SetPassword(password)

		if r.deps.checker.Emailable {
			email := request.(SignUpEmailableRequest).GetEmail()
			user.(EmailableUser).SetEmail(email)

			if r.deps.checker.Confirmable {
				confirmCode := generateConfirmCode()

				user.(ConfirmableUser).SetConfirmCode(confirmCode)
				r.sendConfirmCode(user.(ConfirmableUser).GetEmail(), confirmCode)
			}
		}

		if err = r.deps.UserStorer.Save(user); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrUserSave])
			return
		}

		c.Set(r.Config.ContextNames.Session, sess)
		c.Set(r.Config.ContextNames.User, user)

		c.JSON(http.StatusOK, gin.H{
			"result": true,
			"pid":    user.GetPID(),
			// "code":   user.(ConfirmableUser).GetConfirmCode(), // FIXME: Debug
		})
	}
}

func (r *Rauther) SignUpHandler() gin.HandlerFunc {
	f := r.signUpHandler()
	if f == nil {
		log.Fatal(common.Errors[common.ErrAuthableUserNotImplement])
	}

	return f
}

func (r *Rauther) signInHandler() gin.HandlerFunc {
	if !r.deps.checker.Authable {
		log.Print("Not implement AuthableUser interface")
		return nil
	}

	return func(c *gin.Context) {
		var request SignUpRequest

		request, err := parseSignUpRequestData(r, c)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRequest])
			return
		}

		pid, password := request.GetPID(), request.GetPassword()

		s, ok := c.Get(r.Config.ContextNames.Session)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.Errors[common.ErrNotAuth])
			return
		}

		sess := s.(Session)
		sess.SetUserPID(pid)

		user, err := r.deps.UserStorer.Load(pid)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrUserNotFound])
			return
		}

		userPassword := user.(AuthableUser).GetPassword()

		if !passwordCompare(userPassword, password) {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrIncorrectPassword])
			return
		}

		if r.deps.checker.Confirmable && !user.(ConfirmableUser).GetConfirmed() {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrNotConfirmed])
			return
		}

		if err = r.deps.SessionStorer.Save(sess); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrSessionSave])
			return
		}

		if err = r.deps.UserStorer.Save(user); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrUserSave])
			return
		}

		c.Set(r.Config.ContextNames.Session, sess)
		c.Set(r.Config.ContextNames.User, user)

		c.JSON(http.StatusOK, gin.H{
			"result": true,
		})
	}
}

func (r *Rauther) SignInHandler() gin.HandlerFunc {
	f := r.signInHandler()
	if f == nil {
		log.Fatal(common.Errors[common.ErrAuthableUserNotImplement])
	}

	return f
}

func (r *Rauther) sendConfirmCode(email, code string) {
	log.Printf("Confirm code for %s: %s", email, code)
}

func (r *Rauther) confirmEmailHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		pid := c.Query(r.Config.QueryNames.EmailConfirm.PID)
		if pid == "" {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRequest])
			return
		}

		confirmCode := c.Query(r.Config.QueryNames.EmailConfirm.Code)
		if confirmCode == "" {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRequest])
			return
		}

		user, err := r.deps.UserStorer.Load(pid)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrUserNotFound])
			return
		}

		if confirmCode != user.(ConfirmableUser).GetConfirmCode() {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidConfirmCode])
			return
		}

		user.(ConfirmableUser).SetConfirmed(true)

		err = r.deps.UserStorer.Save(user)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrUserSave])
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"result": true,
		})
	}
}
