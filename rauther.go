package rauther

import (
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
	"github.com/rosberry/rauther/session"
	"github.com/rosberry/rauther/storage"
	"github.com/rosberry/rauther/user"
	"golang.org/x/crypto/bcrypt"
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
		u = deps.Storage.UserStorer.Create("temp", "")
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
	log.Printf("\nEnabled auth modules:\n%v", r.Modules)

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
	router.POST(r.Config.Routes.ConfirmResend, r.resendCodeHandler())
}

func (r *Rauther) includeRecoverable(router *gin.RouterGroup) {
	if !r.deps.Checker().Recoverable {
		log.Fatal(common.Errors[common.ErrRecoverableUserNotImplement])
	}

	if !r.checkSender() {
		log.Fatal(common.Errors[common.ErrSenderRequired])
	}

	router.POST(r.Config.Routes.RecoveryRequest, r.requestRecoveryHandler())
	router.POST(r.Config.Routes.RecoveryValidateCode, r.validateRecoveryCodeHandler())
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
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}

		sessionID := request.DeviceID

		if sessionID == "" {
			sessionID = generateSessionID()
		}

		session := r.deps.SessionStorer.LoadByID(sessionID)
		if session == nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionLoad)
			return
		}

		// Create new guest user if it enabled in config
		if r.Modules.AuthableUser && r.Config.CreateGuestUser && session.GetUserID() == "" {
			user, errType := r.createGuestUser()
			if errType != 0 {
				errorResponse(c, http.StatusInternalServerError, errType)
				return
			}

			session.BindUser(user)
		}

		session.SetToken(uuid.New().String())

		err = r.deps.SessionStorer.Save(session)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
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
				errorResponse(c, http.StatusUnauthorized, common.ErrAuthFailed)
				c.Abort()

				return
			}

			if r.Modules.AuthableUser {
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

		user, ok := u.(user.User)
		if !ok {
			log.Fatal("[authUserMiddleware] failed 'user' type assertion to user.User")
		}

		_, uid := user.GetUID()

		if r.Config.CreateGuestUser && IsGuest(uid) {
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

		if !user.GetConfirmed() {
			errorResponse(c, http.StatusUnauthorized, common.ErrNotConfirmed)
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
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		request := at.SignUpRequest

		err := c.ShouldBindBodyWith(&request, binding.JSON)
		if err != nil {
			log.Print("sign up handler:", err)
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		uid, password := request.GetUID(), request.GetPassword()

		s, ok := c.Get(r.Config.ContextNames.Session)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.ErrNotAuth)
			return
		}

		sess, ok := s.(session.Session)
		if !ok {
			log.Fatal("[signUpHandler] failed 'sess' type assertion to session.Session")
		}

		currentUserID := sess.GetUserID()
		if currentUserID != "" && !IsGuest(currentUserID) {
			errorResponse(c, http.StatusBadRequest, common.ErrAlreadyAuth)
			return
		}

		u, err := r.deps.UserStorer.LoadByUID(at.Key, uid)
		if err == nil && u != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrUserExist)
			return
		}

		if r.Config.CreateGuestUser && IsGuest(currentUserID) {
			u, _ = r.deps.UserStorer.LoadByID(currentUserID)
			u.SetUID(at.Key, uid)
		} else {
			u = r.deps.UserStorer.Create(at.Key, uid)
		}

		encryptedPassword, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)

		u.(user.AuthableUser).SetPassword(string(encryptedPassword))

		sess.BindUser(u)

		err = r.deps.SessionStorer.Save(sess)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
			return
		}

		if _, ok := request.(authtype.AuhtRequestFieldable); ok {
			contacts := request.(authtype.AuhtRequestFieldable).Fields()
			for contactType, contact := range contacts {
				err := user.SetFields(u, contactType, contact)
				if err != nil {
					log.Printf("sign up: set fields %v: %v", contactType, err)
					errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

					return
				}
			}

			if r.Modules.ConfirmableUser {
				confirmCode := generateConfirmCode()

				u.(user.ConfirmableUser).SetConfirmCode(confirmCode)

				contact, _ := user.GetField(u, at.Sender.RecipientKey())

				err := sendConfirmCode(at.Sender, contact.(string), confirmCode)
				if err != nil {
					log.Printf("failed send confirm code %v: %v", contact.(string), err)
				}
			}
		}

		if err = r.deps.UserStorer.Save(u); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
			return
		}

		c.Set(r.Config.ContextNames.Session, sess)
		c.Set(r.Config.ContextNames.User, u)

		c.JSON(http.StatusOK, gin.H{
			"result": true,
			"uid":    uid,
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
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		request := at.SignInRequest

		err := c.ShouldBindBodyWith(&request, binding.JSON)
		if err != nil {
			log.Print("sign in handler:", err)
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		uid, password := request.GetUID(), request.GetPassword()

		u, err := r.deps.UserStorer.LoadByUID(at.Key, uid)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
			return
		}

		userPassword := u.(user.AuthableUser).GetPassword()

		if !passwordCompare(userPassword, password) {
			errorResponse(c, http.StatusBadRequest, common.ErrIncorrectPassword)
			return
		}

		s, ok := c.Get(r.Config.ContextNames.Session)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.ErrNotAuth)
			return
		}

		sess, ok := s.(session.Session)
		if !ok {
			log.Fatal("[signInHandler] failed 'sess' type assertion to session.Session")
		}

		currentUserID := sess.GetUserID()
		sess.BindUser(u)

		if err = r.deps.SessionStorer.Save(sess); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
			return
		}

		if err = r.deps.UserStorer.Save(u); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
			return
		}

		if r.Config.CreateGuestUser && IsGuest(currentUserID) {
			rmStorer, ok := r.deps.UserStorer.(storage.RemovableUserStorer)
			if !ok {
				log.Printf("[signInHandler] failed 'UserStorer' type assertion to storage.RemovableUserStorer")
			}

			err := rmStorer.RemoveByID(currentUserID)
			if err != nil {
				log.Printf("Failed delete guest user %v: %v", currentUserID, err)
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
			errorResponse(c, http.StatusUnauthorized, common.ErrNotAuth)
			return
		}

		session, ok := s.(session.Session)
		if !ok {
			log.Fatal("[signOutHandler] failed 's' type assertion to session.Session")
		}

		u, ok := c.Get(r.Config.ContextNames.User)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.ErrNotSignIn)
			return
		}

		user, ok := u.(user.User)
		if !ok {
			log.Fatal("[signOutHandler] failed 'user' type assertion to User")
		}

		newToken := uuid.New().String()
		session.SetToken(newToken)

		session.UnbindUser(user)

		if r.Modules.AuthableUser && r.Config.CreateGuestUser { // nolint:nestif
			at, uid := user.GetUID()
			if IsGuest(uid) {
				rmStorer, ok := r.deps.UserStorer.(storage.RemovableUserStorer)
				if !ok {
					log.Print("[signOutHandler] failed 'UserStorer' type assertion to RemovableUserStorer")
				}

				err := rmStorer.RemoveByUID(at, uid)
				if err != nil {
					log.Printf("Failed delete guest user %v: %v", uid, err)
				}
			}

			user, errType := r.createGuestUser()
			if errType != 0 {
				errorResponse(c, http.StatusInternalServerError, errType)
				return
			}

			session.BindUser(user)
		}

		err := r.deps.SessionStorer.Save(session)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"result": true,
			"token":  newToken,
		})
	}
}

func (r *Rauther) confirmHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		type confirmRequest struct {
			UID  string `json:"uid"`
			Code string `json:"code"`
		}

		at := r.deps.Types().Select(c)
		if at == nil {
			log.Print("sign in handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		var request confirmRequest

		if err := c.ShouldBindBodyWith(&request, binding.JSON); err != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}

		u, err := r.deps.UserStorer.LoadByUID(at.Key, request.UID)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
			return
		}

		if request.Code != u.(user.ConfirmableUser).GetConfirmCode() {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidConfirmCode)
			return
		}

		u.(user.ConfirmableUser).SetConfirmed(true)

		err = r.deps.UserStorer.Save(u)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
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
			errorResponse(c, http.StatusUnauthorized, common.ErrNotAuth)
			return
		}

		sess, ok := s.(session.Session)
		if !ok {
			log.Fatal("[resendCodeHandler] failed 's' type assertion to Session")
		}

		userID := sess.GetUserID()
		if userID == "" {
			errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
			return
		}

		u, err := r.deps.UserStorer.LoadByID(userID)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
			return
		}

		confirmCode := generateConfirmCode()
		u.(user.ConfirmableUser).SetConfirmCode(confirmCode)

		if err = r.deps.UserStorer.Save(u); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
			return
		}

		at := r.deps.Types().Select(c)
		contact, _ := user.GetField(u, at.Sender.RecipientKey())

		err = sendConfirmCode(at.Sender, contact.(string), confirmCode)
		if err != nil {
			log.Print(err)
			errorResponse(c, http.StatusInternalServerError, common.ErrUnknownError)

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
			UID string `json:"uid"`
		}

		at := r.deps.Types().Select(c)
		if at == nil {
			log.Print("sign in handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		var request recoveryRequest
		if err := c.ShouldBindBodyWith(&request, binding.JSON); err != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}

		u, err := r.deps.Storage.UserStorer.LoadByUID(at.Key, request.UID)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
			return
		}

		if r.Modules.ConfirmableUser && !u.(user.ConfirmableUser).GetConfirmed() {
			errorResponse(c, http.StatusBadRequest, common.ErrNotConfirmed)
			return
		}

		code := generateConfirmCode()
		u.(user.RecoverableUser).SetRecoveryCode(code)

		err = r.deps.Storage.UserStorer.Save(u)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
			return
		}

		contact, _ := user.GetField(u, at.Sender.RecipientKey())

		err = sendRecoveryCode(at.Sender, contact.(string), code)
		if err != nil {
			log.Print(err)
			errorResponse(c, http.StatusInternalServerError, common.ErrUnknownError)

			return
		}

		c.JSON(http.StatusOK, gin.H{"result": true})
	}
}

func (r *Rauther) validateRecoveryCodeHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		type recoveryValidationRequest struct {
			UID  string `json:"uid"`
			Code string `json:"code"`
		}

		at := r.deps.Types().Select(c)
		if at == nil {
			log.Print("sign in handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		var request recoveryValidationRequest
		if err := c.ShouldBindBodyWith(&request, binding.JSON); err != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}

		u, err := r.deps.Storage.UserStorer.LoadByUID(at.Key, request.UID)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
			return
		}

		code := u.(user.RecoverableUser).GetRecoveryCode()
		if code != request.Code {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRecoveryCode)
			return
		}

		c.JSON(http.StatusOK, gin.H{"result": true})
	}
}

func (r *Rauther) recoveryHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		type recoveryRequest struct {
			UID      string `json:"uid"`
			Code     string `json:"code"`
			Password string `json:"password"`
		}

		at := r.deps.Types().Select(c)
		if at == nil {
			log.Print("sign in handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		var request recoveryRequest
		if err := c.ShouldBindBodyWith(&request, binding.JSON); err != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}

		u, err := r.deps.Storage.UserStorer.LoadByUID(at.Key, request.UID)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
			return
		}

		code := u.(user.RecoverableUser).GetRecoveryCode()
		if code != request.Code {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRecoveryCode)
			return
		}

		u.(user.AuthableUser).SetPassword(request.Password)

		err = r.deps.Storage.UserStorer.Save(u)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
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

func (r *Rauther) createGuestUser() (user.User, common.ErrTypes) {
	const guestType = "guest"
	tempUserUID := "guest:" + uuid.New().String()

	u, _ := r.deps.UserStorer.LoadByUID(guestType, tempUserUID)
	if u != nil {
		return nil, common.ErrUserExist
	}

	usr := r.deps.UserStorer.Create(guestType, tempUserUID)

	err := r.deps.UserStorer.Save(usr)
	if err != nil {
		return nil, common.ErrUserSave
	}

	return usr, common.ErrTypes(0)
}

func IsGuest(uid interface{}) bool {
	return strings.HasPrefix(uid.(string), "guest:")
}
