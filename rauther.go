package rauther

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/google/uuid"
	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/common"
	"github.com/rosberry/rauther/config"
	"github.com/rosberry/rauther/deps"
	"github.com/rosberry/rauther/modules"
	"github.com/rosberry/rauther/sender"
	"github.com/rosberry/rauther/session"
	"github.com/rosberry/rauther/user"
)

// Rauther main object - contains configuration and other details for running.
type Rauther struct {
	Config  config.Config
	Modules *modules.Modules
	deps    deps.Deps
}

// New make new instance of Rauther with default configuration
func New(deps deps.Deps) *Rauther {
	if deps.SessionStorer == nil {
		log.Fatal(common.Errors[common.ErrSessionStorerDependency])
	}

	if deps.R == nil {
		log.Fatal(common.Errors[common.ErrGinDependency])
	}

	cfg := config.Config{}
	cfg.Default()

	var u user.User
	if deps.Storage.UserStorer != nil {
		u = deps.Storage.UserStorer.Create("")
	}

	r := &Rauther{
		Config:  cfg,
		deps:    deps,
		Modules: modules.New(u),
	}

	if ok := r.checkAuthTypes(u); !ok {
		log.Fatal("failed auth types")
	}

	return r
}

func (r *Rauther) checkAuthTypes(user user.User) bool {
	if r.deps.Types == nil {
		return false
	}

	return r.deps.Types.Valid(user)
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
	if !r.deps.Checker().Authable {
		log.Fatal(common.Errors[common.ErrAuthableUserNotImplement])
	}

	router.POST(r.Config.Routes.SignUp, r.signUpHandler())
	router.POST(r.Config.Routes.SignIn, r.signInHandler())

	if r.Modules.ConfirmableUser {
		r.includeConfirmable(router)
	}

	if r.Modules.RecoverableUser {
		r.includeRecoverable(router)
	}
}

func (r *Rauther) includeConfirmable(router *gin.RouterGroup) {
	if !r.deps.Checker().Confirmable {
		log.Fatal(common.Errors[common.ErrConfirmableUserNotImplement])
	}

	if r.deps.Types == nil || r.deps.Types.IsEmpty() {
		log.Fatal(common.Errors[common.ErrSenderRequired])
	}

	router.GET(r.Config.Routes.ConfirmCode, r.confirmEmailHandler())
	router.GET(r.Config.Routes.ConfirmResend, r.resendCodeHandler())
}

func (r *Rauther) includeRecoverable(router *gin.RouterGroup) {
	if !r.deps.Checker().Recoverable {
		log.Fatal(common.Errors[common.ErrRecoverableUserNotImplement])
	}

	if r.deps.Types == nil || r.deps.Types.IsEmpty() {
		log.Fatal(common.Errors[common.ErrSenderRequired])
	}

	router.POST(r.Config.Routes.RecoveryRequest, r.requestRecoveryHandler())
	router.POST(r.Config.Routes.RecoveryCode, r.recoveryHandler())
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
			sessionID = generateSessionID()
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
			"result":    true,
			"device_id": sessionID,
			"token":     session.GetToken(),
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

			user, err := r.deps.UserStorer.Load(session.GetUserPID())
			if err != nil && r.Config.CreateGuestUser {
				user = r.deps.UserStorer.Create(session.GetUserPID())
			}

			c.Set(r.Config.ContextNames.User, user)
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
	if !r.deps.Checker().Authable {
		log.Print("Not implement AuthableUser interface")
		return nil
	}

	return func(c *gin.Context) {
		at := r.deps.Types.Select(c)
		if at == nil {
			log.Print("sign up handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRequest])
		}

		req := at.SignUpRequest

		err := c.ShouldBindBodyWith(&req, binding.JSON)
		if err != nil {
			log.Print("sign up handler:", err)
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRequest])

			return
		}

		request := req.(authtype.SignUpRequest)

		pid, password := request.GetPID(), request.GetPassword()

		s, ok := c.Get(r.Config.ContextNames.Session)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.Errors[common.ErrNotAuth])
			return
		}

		sess := s.(session.Session)
		sess.SetUserPID(pid)

		err = r.deps.SessionStorer.Save(sess)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrSessionSave])
			return
		}

		u, err := r.deps.UserStorer.Load(pid)
		if err == nil && u != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrUserExist])
			return
		}

		u = r.deps.UserStorer.Create(pid)

		u.(user.AuthableUser).SetPassword(password)

		if r.deps.Checker().WithExpandableFields {
			contacts := request.(authtype.SignUpContactableRequest).Fields()
			for contactType, contact := range contacts {
				err := user.SetFields(u, contactType, contact)
				if err != nil {
					log.Printf("sign up: set fields %v: %v", contactType, err)
					errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRequest])

					return
				}
			}

			if r.Modules.ConfirmableUser {
				confirmCode := generateConfirmCode()

				u.(user.ConfirmableUser).SetConfirmCode(confirmCode)

				contact, _ := u.(user.WithExpandableFieldsUser).GetField(at.Sender.RecipientKey())
				sendConfirmCode(at.Sender, contact.(string), confirmCode)
			}
		}

		if err = r.deps.UserStorer.Save(u); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrUserSave])
			return
		}

		c.Set(r.Config.ContextNames.Session, sess)
		c.Set(r.Config.ContextNames.User, u)

		c.JSON(http.StatusOK, gin.H{
			"result": true,
			"pid":    u.GetPID(),
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
	if !r.deps.Checker().Authable {
		log.Print("Not implement AuthableUser interface")
		return nil
	}

	return func(c *gin.Context) {
		at := r.deps.Types.Select(c)
		if at == nil {
			log.Print("sign in handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRequest])
			return
		}

		req := at.SignInRequest

		err := c.ShouldBindBodyWith(&req, binding.JSON)
		if err != nil {
			log.Print("sign in handler:", err)
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRequest])
			return
		}

		request := req.(authtype.SignUpRequest)

		pid, password := request.GetPID(), request.GetPassword()

		s, ok := c.Get(r.Config.ContextNames.Session)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.Errors[common.ErrNotAuth])
			return
		}

		sess := s.(session.Session)
		sess.SetUserPID(pid)

		u, err := r.deps.UserStorer.Load(pid)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrUserNotFound])
			return
		}

		userPassword := u.(user.AuthableUser).GetPassword()

		if !passwordCompare(userPassword, password) {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrIncorrectPassword])
			return
		}

		if r.Modules.ConfirmableUser && !u.(user.ConfirmableUser).GetConfirmed() {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrNotConfirmed])
			return
		}

		if err = r.deps.SessionStorer.Save(sess); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrSessionSave])
			return
		}

		if err = r.deps.UserStorer.Save(u); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrUserSave])
			return
		}

		c.Set(r.Config.ContextNames.Session, sess)
		c.Set(r.Config.ContextNames.User, u)

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

func sendConfirmCode(sender sender.Sender, recipient, code string) {
	log.Printf("Confirm code for %s: %s", recipient, code)

	err := sender.Send(common.CodeConfirmationEvent, recipient, code)
	if err != nil {
		log.Print(err)
	}
}

func sendRecoveryCode(sender sender.Sender, recipient, code string) {
	log.Printf("Recovery code for %s: %s", recipient, code)

	err := sender.Send(common.PasswordRecoveryEvent, recipient, code)
	if err != nil {
		log.Print(err)
	}
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

		u, err := r.deps.UserStorer.Load(pid)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrUserNotFound])
			return
		}

		if confirmCode != u.(user.ConfirmableUser).GetConfirmCode() {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidConfirmCode])
			return
		}

		u.(user.ConfirmableUser).SetConfirmed(true)

		err = r.deps.UserStorer.Save(u)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrUserSave])
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"result": true,
		})
	}
}

func (r *Rauther) resendCodeHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		s, ok := c.Get(r.Config.ContextNames.Session)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.Errors[common.ErrNotAuth])
			return
		}

		sess := s.(session.Session)

		pid := sess.GetUserPID()
		if pid == "" {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrUserNotFound])
			return
		}

		u, err := r.deps.UserStorer.Load(pid)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrUserNotFound])
			return
		}

		confirmCode := generateConfirmCode()
		u.(user.ConfirmableUser).SetConfirmCode(confirmCode)

		at := r.deps.Types.Select(c)
		contact, _ := u.(user.WithExpandableFieldsUser).GetField(at.Sender.RecipientKey())
		sendConfirmCode(at.Sender, contact.(string), confirmCode)

		c.JSON(http.StatusOK, gin.H{
			"result": true,
		})
	}
}

func (r *Rauther) requestRecoveryHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		type recoveryRequest struct {
			PID string `json:"pid"`
		}

		var request recoveryRequest
		if err := c.ShouldBindBodyWith(&request, binding.JSON); err != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRequest])
			return
		}

		u, err := r.deps.Storage.UserStorer.Load(request.PID)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrUserNotFound])
			return
		}

		if r.Modules.ConfirmableUser && !u.(user.ConfirmableUser).GetConfirmed() {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrNotConfirmed])
			return
		}

		code := generateConfirmCode()
		u.(user.RecoverableUser).SetRecoveryCode(code)

		err = r.deps.Storage.UserStorer.Save(u)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrUserSave])
			return
		}

		at := r.deps.Types.Select(c)
		contact, _ := u.(user.RecoverableUser).GetField(at.Sender.RecipientKey())
		sendRecoveryCode(at.Sender, contact.(string), code)
		c.JSON(http.StatusOK, gin.H{"result": true})
	}
}

func (r *Rauther) recoveryHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		type recoveryRequest struct {
			PID      string `json:"pid"`
			Code     string `json:"code"`
			Password string `json:"password"`
		}

		var request recoveryRequest
		if err := c.ShouldBindBodyWith(&request, binding.JSON); err != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRequest])
			return
		}

		u, err := r.deps.Storage.UserStorer.Load(request.PID)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrUserNotFound])
			return
		}

		code := u.(user.RecoverableUser).GetRecoveryCode()
		if code != request.Code {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRecoveryCode])
			return
		}

		u.(user.AuthableUser).SetPassword(request.Password)

		err = r.deps.Storage.UserStorer.Save(u)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrUserSave])
			return
		}

		c.JSON(http.StatusOK, gin.H{"result": true})
	}
}
