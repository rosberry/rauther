package rauther

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/google/uuid"
	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/common"
	"github.com/rosberry/rauther/config"
	"github.com/rosberry/rauther/deps"
	"github.com/rosberry/rauther/hooks"
	"github.com/rosberry/rauther/modules"
	"github.com/rosberry/rauther/sender"
	"github.com/rosberry/rauther/session"
	"github.com/rosberry/rauther/storage"
	"github.com/rosberry/rauther/user"
)

// Rauther main object - contains configuration and other details for running.
type Rauther struct {
	Config  config.Config
	Modules *modules.Modules
	deps    deps.Deps
	hooks   hooks.HookOptions
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

	if deps.EmptyAuthTypes() {
		deps.AddAuthType("email", nil, nil, nil)
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
	if r.deps.Types() == nil {
		return false
	}

	ok, badFields := r.deps.Types().CheckFieldsDefine(user)
	if !ok {
		log.Print("Please, check `auth` tags in user model:")
		for k, v := range badFields {
			log.Printf("Fields %v for '%v' not found in user model", v, k)
		}
	}

	return ok
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

	_, isRemovable := r.deps.Storage.UserStorer.(storage.RemovableUserStorer)

	if r.Config.CreateGuestUser && !isRemovable {
		log.Fatal("If config approve guest then user storer must implement RemovableUserStorer interface. Change it.")
	}

	router.POST(r.Config.Routes.SignUp, r.signUpHandler())
	router.POST(r.Config.Routes.SignIn, r.signInHandler())
	router.POST(r.Config.Routes.SignOut, r.signOutHandler())

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

	if !r.checkSender() {
		log.Fatal(common.Errors[common.ErrSenderRequired])
	}

	router.POST(r.Config.Routes.ConfirmCode, r.confirmHandler())
	router.GET(r.Config.Routes.ConfirmResend, r.resendCodeHandler())
}

func (r *Rauther) includeRecoverable(router *gin.RouterGroup) {
	if !r.deps.Checker().Recoverable {
		log.Fatal(common.Errors[common.ErrRecoverableUserNotImplement])
	}

	if !r.checkSender() {
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
		if r.Modules.AuthableUser && r.Config.CreateGuestUser && session.GetUserPID() == "" {
			user, err := r.createGuestUser()
			if err != nil {
				errorResponse(c, http.StatusInternalServerError, err.(common.Err))
				return
			}

			session.BindUser(user)
		}

		session.SetToken(uuid.New().String())

		err = r.deps.SessionStorer.Save(session)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrSessionSave])
			return
		}

		respMap := gin.H{
			"result":    true,
			"device_id": sessionID,
			"token":     session.GetToken(),
		}

		if r.hooks.AfterAuth != nil {
			r.hooks.AfterAuth(respMap, session)
		}

		c.JSON(http.StatusOK, respMap)
	}
}

func (r *Rauther) AfterAuth(f func(resp gin.H, ses session.Session)) {
	r.hooks.AfterAuth = f
}

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
			if session == nil {
				err := common.Errors[common.ErrAuthFailed]
				errorResponse(c, http.StatusUnauthorized, err)
				c.Abort()

				return
			}

			if r.Modules.AuthableUser {
				if u, err := r.deps.UserStorer.Load(session.GetUserPID()); err == nil && u != nil {
					c.Set(r.Config.ContextNames.User, u)
				}
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

func (r *Rauther) authUserMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		_, ok := c.Get(r.Config.ContextNames.User)

		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.Errors[common.ErrNotAuth])
			c.Abort()

			return
		}

		c.Next()
	}
}

func (r *Rauther) authUserConfirmedMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		u, ok := c.Get(r.Config.ContextNames.User)

		if !ok {
			err := common.Errors[common.ErrNotAuth]
			errorResponse(c, http.StatusUnauthorized, err)
			c.Abort()

			return
		}

		user := u.(user.ConfirmableUser)

		if !user.GetConfirmed() {
			err := common.Errors[common.ErrNotAuth]
			errorResponse(c, http.StatusUnauthorized, err)
			c.Abort()

			return
		}

		c.Next()
	}
}

func (r *Rauther) signUpHandler() gin.HandlerFunc {
	if !r.deps.Checker().Authable {
		log.Print("Not implement AuthableUser interface")
		return nil
	}

	return func(c *gin.Context) {
		at := r.deps.Types().Select(c)
		if at == nil {
			log.Print("sign up handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRequest])

			return
		}

		req := at.SignUpRequest

		err := c.ShouldBindBodyWith(&req, binding.JSON)
		if err != nil {
			log.Print("sign up handler:", err)
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRequest])

			return
		}

		request := req.(authtype.AuthRequest)

		pid, password := request.GetPID(), request.GetPassword()

		s, ok := c.Get(r.Config.ContextNames.Session)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.Errors[common.ErrNotAuth])
			return
		}

		sess := s.(session.Session)

		u, err := r.deps.UserStorer.Load(pid)
		if err == nil && u != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrUserExist])
			return
		}

		oldPID := sess.GetUserPID()
		if oldPID != "" && !IsGuest(oldPID) {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrAlreadyAuth])
			return
		}

		if r.Config.CreateGuestUser && IsGuest(oldPID) {
			u, _ = r.deps.UserStorer.Load(oldPID)
			u.SetPID(pid)
		} else {
			u = r.deps.UserStorer.Create(pid)
		}

		u.(user.AuthableUser).SetPassword(password)

		sess.BindUser(u)

		err = r.deps.SessionStorer.Save(sess)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrSessionSave])
			return
		}

		if _, ok := request.(authtype.AuhtRequestFieldable); ok {
			contacts := request.(authtype.AuhtRequestFieldable).Fields()
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

				contact, _ := user.GetField(u, at.Sender.RecipientKey())
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

func (r *Rauther) signInHandler() gin.HandlerFunc {
	if !r.deps.Checker().Authable {
		log.Print("Not implement AuthableUser interface")
		return nil
	}

	return func(c *gin.Context) {
		at := r.deps.Types().Select(c)
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

		request := req.(authtype.AuthRequest)

		pid, password := request.GetPID(), request.GetPassword()

		s, ok := c.Get(r.Config.ContextNames.Session)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.Errors[common.ErrNotAuth])
			return
		}

		sess := s.(session.Session)
		oldPID := sess.GetUserPID()

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

		sess.BindUser(u)

		if err = r.deps.SessionStorer.Save(sess); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrSessionSave])
			return
		}

		if err = r.deps.UserStorer.Save(u); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrUserSave])
			return
		}

		if r.Config.CreateGuestUser && IsGuest(oldPID) {
			rmStorer := r.deps.UserStorer.(storage.RemovableUserStorer)

			err := rmStorer.Remove(oldPID)
			if err != nil {
				errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrUnknownError])
				return
			}
		}

		c.Set(r.Config.ContextNames.Session, sess)
		c.Set(r.Config.ContextNames.User, u)

		c.JSON(http.StatusOK, gin.H{
			"result": true,
		})
	}
}

func (r *Rauther) signOutHandler() gin.HandlerFunc {
	if !r.deps.Checker().Authable {
		log.Print("Not implement AuthableUser interface")
		return nil
	}

	return func(c *gin.Context) {
		s, ok := c.Get(r.Config.ContextNames.Session)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.Errors[common.ErrNotAuth])
			return
		}

		session := s.(session.Session)

		u, ok := c.Get(r.Config.ContextNames.User)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.Errors[common.ErrNotAuth])
			return
		}

		user := u.(user.User)
		newToken := uuid.New().String()
		session.SetToken(newToken)

		session.UnbindUser(user)

		if r.Modules.AuthableUser && r.Config.CreateGuestUser {
			pid := user.GetPID()
			if IsGuest(pid) {
				rmStorer := r.deps.UserStorer.(storage.RemovableUserStorer)

				err := rmStorer.Remove(pid)
				if err != nil {
					errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrUnknownError])
					return
				}
			}

			user, err := r.createGuestUser()
			if err != nil {
				errorResponse(c, http.StatusInternalServerError, err.(common.Err))
				return
			}

			session.BindUser(user)
		}

		err := r.deps.SessionStorer.Save(session)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrSessionSave])
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"result": true,
			"token":  newToken,
		})
	}
}

func sendConfirmCode(s sender.Sender, recipient, code string) error {
	log.Printf("Confirm code for %s: %s", recipient, code)

	err := s.Send(sender.ConfirmationEvent, recipient, code)
	if err != nil {
		err = fmt.Errorf("sendConfirmCode error: %w", err)
	}

	return err
}

func sendRecoveryCode(s sender.Sender, recipient, code string) error {
	log.Printf("Recovery code for %s: %s", recipient, code)

	err := s.Send(sender.PasswordRecoveryEvent, recipient, code)
	if err != nil {
		err = fmt.Errorf("sendRecoveryCode error: %w", err)
	}

	return err
}

func (r *Rauther) confirmHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		type confirmRequest struct {
			PID  string `json:"pid"`
			Code string `json:"code"`
		}

		var request confirmRequest

		if err := c.ShouldBindBodyWith(&request, binding.JSON); err != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrInvalidRequest])
			return
		}

		u, err := r.deps.UserStorer.Load(request.PID)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.Errors[common.ErrUserNotFound])
			return
		}

		if request.Code != u.(user.ConfirmableUser).GetConfirmCode() {
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

		at := r.deps.Types().Select(c)
		contact, _ := user.GetField(u, at.Sender.RecipientKey())

		err = sendConfirmCode(at.Sender, contact.(string), confirmCode)
		if err != nil {
			log.Print(err)
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrUnknownError])
			return
		}

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

		at := r.deps.Types().Select(c)
		contact, _ := user.GetField(u, at.Sender.RecipientKey())

		err = sendRecoveryCode(at.Sender, contact.(string), code)
		if err != nil {
			log.Print(err)
			errorResponse(c, http.StatusInternalServerError, common.Errors[common.ErrUnknownError])

			return
		}

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

func (r *Rauther) checkSender() (ok bool) {
	if r.deps.Types() != nil && !r.deps.Types().IsEmpty() {
		if !r.deps.Types().CheckSenders() {
			return false
		}
	} else if !r.deps.CheckDefaultSender() {
		return false
	}

	return true
}

func (r *Rauther) createGuestUser() (user.User, error) {
	tempUserPID := "guest:" + uuid.New().String()

	u, _ := r.deps.UserStorer.Load(tempUserPID)
	if u != nil {
		return nil, common.Errors[common.ErrUserExist]
	}

	usr := r.deps.UserStorer.Create(tempUserPID)

	err := r.deps.UserStorer.Save(usr)
	if err != nil {
		return nil, common.Errors[common.ErrUserSave]
	}

	return usr, nil
}

func IsGuest(pid string) bool {
	return strings.HasPrefix(pid, "guest:")
}
