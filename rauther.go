package rauther

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/google/uuid"
	"github.com/rosberry/auth"
	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/checker"
	"github.com/rosberry/rauther/common"
	"github.com/rosberry/rauther/config"
	"github.com/rosberry/rauther/deps"
	"github.com/rosberry/rauther/hooks"
	"github.com/rosberry/rauther/modules"
	"github.com/rosberry/rauther/sender"
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

	// checker for check implement user interfaces
	checker *checker.Checker

	// types is list of auth types - default or custom sign-up/sign-ip structs and code sender
	types *authtype.AuthTypes

	// defaultSender usage if we not define auth types with senders
	defaultSender sender.Sender
}

// New make new instance of Rauther with default configuration
func New(deps deps.Deps) *Rauther {
	var u user.User
	if deps.Storage.UserStorer != nil {
		u = deps.Storage.UserStorer.Create()
	}

	if deps.SessionStorer == nil {
		log.Fatal(common.Errors[common.ErrSessionStorerDependency])
	}

	if deps.R == nil {
		log.Fatal(common.Errors[common.ErrGinDependency])
	}

	cfg := config.Config{}
	cfg.Default()

	checker := checker.New(u)

	r := &Rauther{
		Config:  cfg,
		deps:    deps,
		Modules: modules.New(checker),
		checker: checker,
	}

	return r
}

func (r *Rauther) checkAuthTypes(user user.User) bool {
	if r.types == nil {
		return false
	}

	ok, badFields := r.types.CheckFieldsDefine(user)
	if !ok {
		log.Print("Please, check `auth` tags in user model:")

		for k, v := range badFields {
			log.Printf("Fields %v for '%v' not found in user model", v, k)
		}
	}

	return ok
}

func (r *Rauther) InitHandlers() error {
	var u user.User
	if r.deps.Storage.UserStorer != nil {
		u = r.deps.Storage.UserStorer.Create()
	}

	if r.types == nil {
		r.types = authtype.New(nil)
	}

	if r.emptyAuthTypes() {
		r.AddAuthType(authtype.Config{
			AuthKey: "email",
		})
	}

	if ok := r.checkAuthTypes(u); !ok {
		log.Fatal("failed auth types")
	}

	log.Printf("\nEnabled auth types:\n- AuthTypePassword: %v\n- AuthTypeSocial: %v\n- AuthTypeOTP: %v",
		authtype.ExistingTypes[authtype.Password],
		authtype.ExistingTypes[authtype.Social],
		authtype.ExistingTypes[authtype.OTP],
	)
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
		if r.Modules.PasswordAuthableUser && authtype.ExistingTypes[authtype.Password] {
			r.includePasswordAuthable(withSession)
		}

		if r.Modules.SocialAuthableUser && authtype.ExistingTypes[authtype.Social] {
			r.includeSocialAuthable(withSession)
		}

		if r.Modules.OTP && authtype.ExistingTypes[authtype.OTP] {
			r.includeOTPAuthable(withSession)
		}
	}
}

func (r *Rauther) includePasswordAuthable(router *gin.RouterGroup) {
	if !r.checker.PasswordAuthable {
		log.Fatal(common.Errors[common.ErrPasswordAuthableUserNotImplement])
	}

	r.checkRemovableUser()

	router.POST(r.Config.Routes.SignUp, r.signUpHandler())
	router.POST(r.Config.Routes.SignIn, r.signInHandler())
	router.POST(r.Config.Routes.SignOut, r.signOutHandler())
	router.POST(r.Config.Routes.ValidateLoginField, r.ValidateLoginField())

	if r.Modules.ConfirmableUser {
		r.includeConfirmable(router)
	}

	if r.Modules.RecoverableUser {
		r.includeRecoverable(router)
	}
}

func (r *Rauther) includeSocialAuthable(router *gin.RouterGroup) {
	r.checkRemovableUser()

	router.POST(r.Config.Routes.SocialSignIn, r.socialSignInHandler())
	router.POST(r.Config.Routes.SocialSignOut, r.signOutHandler())
}

func (r *Rauther) includeOTPAuthable(router *gin.RouterGroup) {
	if !r.checker.OTPAuth {
		log.Fatal(common.Errors[common.ErrOTPNotImplement])
	}

	router.POST(r.Config.Routes.OTPRequestCode, r.otpGetCodeHandler())
	router.POST(r.Config.Routes.OTPCheckCode, r.otpAuthHandler())
}

func (r *Rauther) checkRemovableUser() {
	if r.Config.CreateGuestUser {
		if r.deps.Storage.UserRemover == nil {
			userRemover, isRemovable := r.deps.Storage.UserStorer.(storage.RemovableUserStorer)

			if !isRemovable {
				log.Fatal("If config approve guest then user storer must implement RemovableUserStorer interface. Change it.")
			}

			r.deps.Storage.UserRemover = userRemover
		}
	}
}

func (r *Rauther) includeConfirmable(router *gin.RouterGroup) {
	if !r.checker.Confirmable {
		log.Fatal(common.Errors[common.ErrConfirmableUserNotImplement])
	}

	if !r.checkSender() {
		log.Fatal(common.Errors[common.ErrSenderRequired])
	}

	router.POST(r.Config.Routes.ConfirmCode, r.confirmHandler())
	router.POST(r.Config.Routes.ConfirmResend, r.resendCodeHandler())
}

func (r *Rauther) includeRecoverable(router *gin.RouterGroup) {
	if !r.checker.Recoverable {
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
		if r.Modules.PasswordAuthableUser && r.Config.CreateGuestUser && session.GetUserID() == nil {
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

func (r *Rauther) signUpHandler() gin.HandlerFunc {
	if !r.checker.PasswordAuthable {
		log.Print("Not implement PasswordAuthableUser interface")
		return nil
	}

	return func(c *gin.Context) {
		expectedTypeOfAuthType := authtype.Password
		at := r.types.Select(c, expectedTypeOfAuthType)
		if at == nil {
			log.Print("sign up handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		if at.Type != expectedTypeOfAuthType {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}

		request := clone(at.SignUpRequest).(authtype.AuthRequest)

		err := c.ShouldBindBodyWith(request, binding.JSON)
		if err != nil {
			log.Print("sign up handler:", err)
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		uid, password := request.GetUID(), request.GetPassword()

		if uid == "" || password == "" {
			log.Print("sign up handler: empty uid or password")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

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

		var currentUserIsGuest bool

		if currentUserID != nil {
			currentUser, err := r.deps.UserStorer.LoadByID(currentUserID)

			if currentUser != nil && err == nil {
				currentUserIsGuest = currentUser.(user.GuestUser).IsGuest()
			}

			if !currentUserIsGuest {
				errorResponse(c, http.StatusBadRequest, common.ErrAlreadyAuth)
				return
			}
		}

		u, err := r.deps.UserStorer.LoadByUID(at.Key, uid)
		if err == nil && u != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrUserExist)
			return
		}

		if r.Config.CreateGuestUser && currentUserIsGuest {
			u, _ = r.deps.UserStorer.LoadByID(currentUserID)
			u.SetUID(at.Key, uid)
			u.(user.GuestUser).SetGuest(false)
		} else {
			u = r.deps.UserStorer.Create()
			u.SetUID(at.Key, uid)
		}

		encryptedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			log.Print("encrypt password error:", err)
			errorResponse(c, http.StatusInternalServerError, common.ErrUnknownError)
		}

		u.(user.PasswordAuthableUser).SetPassword(string(encryptedPassword))

		if _, ok := request.(authtype.AuhtRequestFieldable); ok {
			fields := request.(authtype.AuhtRequestFieldable).Fields()
			for fieldKey, fieldValue := range fields {
				err := user.SetFields(u, fieldKey, fieldValue)
				if err != nil {
					log.Printf("sign up: set fields %v: %v", fieldKey, err)
					errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

					return
				}
			}
		}

		if r.Modules.ConfirmableUser {
			confirmCode := generateConfirmCode()

			u.(user.ConfirmableUser).SetConfirmCode(at.Key, confirmCode)

			if r.checker.CodeSentTime && r.Modules.CodeSentTimeUser {
				curTime := time.Now()
				u.(user.CodeSentTimeUser).SetCodeSentTime(at.Key, &curTime)
			}

			err := sendConfirmCode(at.Sender, uid, confirmCode)
			if err != nil {
				log.Printf("failed send confirm code %v: %v", uid, err)
			}
		}

		if err = r.deps.UserStorer.Save(u); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
			return
		}

		sess.BindUser(u)

		err = r.deps.SessionStorer.Save(sess)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
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
	if !r.checker.PasswordAuthable {
		log.Print("Not implement PasswordAuthableUser interface")
		return nil
	}

	return func(c *gin.Context) {
		expectedTypeOfAuthType := authtype.Password
		at := r.types.Select(c, expectedTypeOfAuthType)
		if at == nil {
			log.Print("sign in handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		if at.Type != expectedTypeOfAuthType {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}

		request := clone(at.SignInRequest).(authtype.AuthRequest)

		err := c.ShouldBindBodyWith(request, binding.JSON)
		if err != nil {
			log.Print("sign in handler:", err)
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

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

		var currentUserIsGuest bool

		if currentUserID != nil {
			currentUser, err := r.deps.UserStorer.LoadByID(currentUserID)

			if currentUser != nil && err == nil {
				currentUserIsGuest = currentUser.(user.GuestUser).IsGuest()
			}

			if !currentUserIsGuest {
				errorResponse(c, http.StatusBadRequest, common.ErrAlreadyAuth)
				return
			}
		}

		uid, password := request.GetUID(), request.GetPassword()

		if uid == "" || password == "" {
			log.Print("sign in handler: empty uid or password")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		u, err := r.deps.UserStorer.LoadByUID(at.Key, uid)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
			return
		}

		userPassword := u.(user.PasswordAuthableUser).GetPassword()

		if !passwordCompare(password, userPassword) {
			errorResponse(c, http.StatusForbidden, common.ErrIncorrectPassword)
			return
		}

		sess.BindUser(u)

		if err = r.deps.SessionStorer.Save(sess); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
			return
		}

		if err = r.deps.UserStorer.Save(u); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
			return
		}

		if r.Config.CreateGuestUser && currentUserIsGuest {
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

func (r *Rauther) socialSignInHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		expectedTypeOfAuthType := authtype.Social
		at := r.types.Select(c, expectedTypeOfAuthType)
		if at == nil {
			log.Print("social sign in handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		if at.Type != expectedTypeOfAuthType {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}

		request := clone(at.SocialSignInRequest).(authtype.SocialSignInRequest)

		err := c.ShouldBindBodyWith(request, binding.JSON)
		if err != nil {
			log.Print("social sign in handler:", err)
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		s, ok := c.Get(r.Config.ContextNames.Session)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.ErrNotAuth)
			return
		}

		sess, ok := s.(session.Session)
		if !ok {
			log.Fatal("[socialSignInHandler] failed 'sess' type assertion to session.Session")
		}

		currentUserID := sess.GetUserID()

		var currentUserIsGuest bool

		if currentUserID != nil {
			currentUser, err := r.deps.UserStorer.LoadByID(currentUserID)

			if currentUser != nil && err == nil {
				currentUserIsGuest = currentUser.(user.GuestUser).IsGuest()
			}

			if !currentUserIsGuest {
				errorResponse(c, http.StatusBadRequest, common.ErrAlreadyAuth)
				return
			}
		}

		var u user.User

		token := request.GetToken()
		if token == "" {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidAuthToken)
			return
		}

		userInfo, err := auth.Auth(token, at.SocialAuthType)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidAuthToken)
			return
		}

		u, err = r.deps.UserStorer.LoadByUID(at.Key, userInfo.ID)
		if u == nil {
			// create user if not exist
			u = r.deps.UserStorer.Create()
			u.SetUID(at.Key, userInfo.ID)

			if err = r.deps.UserStorer.Save(u); err != nil {
				errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
				return
			}
		}

		sess.BindUser(u)

		if err = r.deps.SessionStorer.Save(sess); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
			return
		}

		if r.Config.CreateGuestUser && currentUserIsGuest {
			rmStorer, ok := r.deps.UserStorer.(storage.RemovableUserStorer)
			if !ok {
				log.Printf("[socialSignInHandler] failed 'UserStorer' type assertion to storage.RemovableUserStorer")
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

		usr, ok := u.(user.User)
		if !ok {
			log.Fatal("[signOutHandler] failed 'user' type assertion to User")
		}

		guestUser, isGuestInterface := usr.(user.GuestUser)

		if r.Config.CreateGuestUser && isGuestInterface { // nolint:nestif
			if guestUser.IsGuest() {
				rmStorer, ok := r.deps.UserStorer.(storage.RemovableUserStorer)
				if !ok {
					log.Print("[signOutHandler] failed 'UserStorer' type assertion to RemovableUserStorer")
				}

				err := rmStorer.RemoveByID(session.GetUserID())
				if err != nil {
					log.Printf("Failed delete guest user %v: %v", session.GetUserID(), err)
				}
			}

			us, errType := r.createGuestUser()
			if errType != 0 {
				errorResponse(c, http.StatusInternalServerError, errType)
				return
			}

			session.BindUser(us)
		} else {
			session.UnbindUser(usr)
		}

		newToken := uuid.New().String()
		session.SetToken(newToken)

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

func (r *Rauther) ValidateLoginField() gin.HandlerFunc {
	if !r.checker.PasswordAuthable {
		log.Print("Not implement PasswordAuthableUser interface")
		return nil
	}

	return func(c *gin.Context) {
		expectedTypeOfAuthType := authtype.Password
		at := r.types.Select(c, expectedTypeOfAuthType)
		if at == nil {
			log.Print("validate login field handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		if at.Type != expectedTypeOfAuthType {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}

		request := clone(at.CheckUserExistsRequest).(authtype.CheckUserExistsRequest)

		err := c.ShouldBindBodyWith(request, binding.JSON)
		if err != nil {
			log.Print("validate login field handler:", err)
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		uid := request.GetUID()

		if uid == "" {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		u, err := r.deps.UserStorer.LoadByUID(at.Key, uid)
		if err == nil && u != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrUserExist)

			return
		}

		c.JSON(http.StatusOK, gin.H{
			"result": true,
		})
	}
}

func (r *Rauther) confirmHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		type confirmRequest struct {
			UID  string `json:"uid" binding:"required"`
			Code string `json:"code" binding:"required"`
		}

		expectedTypeOfAuthType := authtype.Password
		at := r.types.Select(c, expectedTypeOfAuthType)
		if at == nil {
			log.Print("confirm handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		if at.Type != expectedTypeOfAuthType {
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

		code := u.(user.ConfirmableUser).GetConfirmCode(at.Key)
		if request.Code != code || code == "" {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidConfirmCode)
			return
		}

		u.(user.ConfirmableUser).SetConfirmed(at.Key, true)

		if r.checker.CodeSentTime && r.Modules.CodeSentTimeUser {
			u.(user.CodeSentTimeUser).SetCodeSentTime(at.Key, nil)
		}

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

		expectedTypeOfAuthType := authtype.Password
		at := r.types.Select(c, expectedTypeOfAuthType)
		if at == nil {
			log.Print("resend confirm code handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		if at.Type != expectedTypeOfAuthType {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}

		confirmCode := generateConfirmCode()

		if r.checker.CodeSentTime && r.Modules.CodeSentTimeUser {
			curTime := time.Now()
			lastConfirmationTime := u.(user.CodeSentTimeUser).GetCodeSentTime(at.Key)

			if lastConfirmationTime != nil {
				timeOffset := lastConfirmationTime.Add(r.Config.ValidConfirmationInterval)

				if !curTime.After(timeOffset) {
					errorCodeTimeoutResponse(c, timeOffset, curTime)

					return
				}
			}

			u.(user.ConfirmableUser).SetConfirmCode(at.Key, confirmCode)

			u.(user.CodeSentTimeUser).SetCodeSentTime(at.Key, &curTime)
		} else {
			u.(user.ConfirmableUser).SetConfirmCode(at.Key, confirmCode)
		}

		if err = r.deps.UserStorer.Save(u); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)

			return
		}

		uid := u.GetUID(at.Key)

		err = sendConfirmCode(at.Sender, uid, confirmCode)
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
			UID string `json:"uid" binding:"required"`
		}

		expectedTypeOfAuthType := authtype.Password
		at := r.types.Select(c, expectedTypeOfAuthType)
		if at == nil {
			log.Print("recovery request handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		if at.Type != expectedTypeOfAuthType {
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

		code := generateConfirmCode()

		if r.checker.CodeSentTime && r.Modules.CodeSentTimeUser {
			lastConfirmationTime := u.(user.CodeSentTimeUser).GetCodeSentTime(at.Key)
			curTime := time.Now()

			if lastConfirmationTime != nil {
				timeOffset := lastConfirmationTime.Add(r.Config.ValidConfirmationInterval)

				if !curTime.After(timeOffset) {
					errorCodeTimeoutResponse(c, timeOffset, curTime)

					return
				}
			}

			u.(user.RecoverableUser).SetRecoveryCode(code)

			u.(user.CodeSentTimeUser).SetCodeSentTime(at.Key, &curTime)
		} else {
			u.(user.RecoverableUser).SetRecoveryCode(code)
		}

		err = r.deps.Storage.UserStorer.Save(u)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
			return
		}

		err = sendRecoveryCode(at.Sender, request.UID, code)
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
			UID  string `json:"uid" binding:"required"`
			Code string `json:"code" binding:"required"`
		}

		expectedTypeOfAuthType := authtype.Password
		at := r.types.Select(c, expectedTypeOfAuthType)
		if at == nil {
			log.Print("recovery handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		if at.Type != expectedTypeOfAuthType {
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
			UID      string `json:"uid" binding:"required"`
			Code     string `json:"code" binding:"required"`
			Password string `json:"password" binding:"required"`
		}

		expectedTypeOfAuthType := authtype.Password
		at := r.types.Select(c, expectedTypeOfAuthType)
		if at == nil {
			log.Print("recovery handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		if at.Type != expectedTypeOfAuthType {
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
		if code != request.Code || code == "" {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRecoveryCode)
			return
		}

		encryptedPassword, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
		if err != nil {
			log.Print("encrypt password error:", err)
			errorResponse(c, http.StatusInternalServerError, common.ErrUnknownError)
		}

		u.(user.PasswordAuthableUser).SetPassword(string(encryptedPassword))
		u.(user.RecoverableUser).SetRecoveryCode("")

		err = r.deps.Storage.UserStorer.Save(u)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
			return
		}

		c.JSON(http.StatusOK, gin.H{"result": true})
	}
}

func (r *Rauther) checkSender() (ok bool) {
	if r.types != nil && !r.types.IsEmpty() {
		for _, t := range r.types.List {
			if t.Sender == nil {
				if r.defaultSender == nil {
					log.Fatalf("If you not define auth sender - first define default sender\nDefaultSender(s sender.Sender)")
				}
				t.Sender = r.defaultSender
			}
		}
	} else if r.defaultSender == nil {
		return false
	}

	return true
}

func (r *Rauther) createGuestUser() (user.User, common.ErrTypes) {
	usr := r.deps.UserStorer.Create()
	usr.(user.GuestUser).SetGuest(true)

	err := r.deps.UserStorer.Save(usr)
	if err != nil {
		return nil, common.ErrUserSave
	}

	return usr, common.ErrTypes(0)
}

// AddAuthType adds a new type of authorization and uses a default sender, if not transmitted another
func (r *Rauther) AddAuthType(at authtype.Config) *Rauther {
	if r.types == nil {
		r.types = authtype.New(nil)
	}

	r.types.Add(at)

	return r
}

// AddAuthTypes adds a new types of authorization and uses a default sender, if not transmitted another
func (r *Rauther) AddAuthTypes(arrTypes authtype.Configs) *Rauther {
	if r.types == nil {
		r.types = authtype.New(nil)
	}

	for _, row := range arrTypes {
		r.types.Add(row)
	}

	return r
}

// AuthSelector specifies the selector with which the type of authorization will be selected
func (r *Rauther) AuthSelector(selector authtype.Selector) *Rauther {
	if r.types == nil {
		r.types = authtype.New(selector)
	}

	r.types.Selector = selector

	return r
}

// emptyAuthTypes check auth types nil or empty
func (r *Rauther) emptyAuthTypes() (ok bool) {
	return r.types == nil || r.types.IsEmpty()
}

func (r *Rauther) DefaultSender(s sender.Sender) *Rauther {
	if r == nil {
		log.Fatal("Deps is nil")
	}

	r.defaultSender = s

	return r
}

func (r *Rauther) otpGetCodeHandler() gin.HandlerFunc {
	if !r.checker.OTPAuth {
		log.Print("Not implement OTPAuth interface")
		return nil
	}
	return func(c *gin.Context) {
		expectedTypeOfAuthType := authtype.OTP
		at := r.types.Select(c, expectedTypeOfAuthType)

		if at == nil {
			log.Print("OTP auth handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		if at.Type != expectedTypeOfAuthType {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		request := clone(at.SignUpRequest).(authtype.AuthRequest)

		err := c.ShouldBindBodyWith(request, binding.JSON)
		if err != nil {
			log.Print("OTP auth handler:", err)
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		sessionInfo, success := r.checkSession(c)
		if !success {
			return
		}

		if sessionInfo.User != nil && !sessionInfo.UserIsGuest {
			errorResponse(c, http.StatusBadRequest, common.ErrAlreadyAuth)
			return
		}

		uid := request.GetUID()

		if uid == "" {
			log.Print("otp request handler: empty uid")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		// Find user by UID
		u, err := r.deps.UserStorer.LoadByUID(at.Key, uid)
		if err != nil {
			log.Print(err)
		}

		// User not found
		if u == nil {
			u = r.deps.UserStorer.Create()

			if r.Config.CreateGuestUser {
				u.(user.GuestUser).SetGuest(true)
			}

			u.SetUID(at.Key, uid)
		}

		// Check last send time
		if r.checker.CodeSentTime && r.Modules.CodeSentTimeUser {
			lastCodeSentTime := u.(user.CodeSentTimeUser).GetCodeSentTime(at.Key)
			curTime := time.Now()

			if lastCodeSentTime != nil {
				timeOffset := lastCodeSentTime.Add(r.Config.ValidConfirmationInterval)

				if !curTime.After(timeOffset) {
					errorCodeTimeoutResponse(c, timeOffset, curTime)

					return
				}
			}

			u.(user.CodeSentTimeUser).SetCodeSentTime(at.Key, &curTime) // FIXME: А если дальше чет зафейлится?
		}

		var code string

		if uCodeGenerator, ok := u.(user.OTPAuthCustomCodeGenerator); ok {
			code = uCodeGenerator.GenerateCode()
		} else {
			code = generateNumericCode(r.Config.OTP.CodeLength)
		}

		expiredAt := time.Now().Add(r.Config.OTP.CodeLifeTime)
		u.(user.OTPAuth).SetOTP(code, &expiredAt)

		err = at.Sender.Send(sender.ConfirmationEvent, uid, code)
		if err != nil {
			err = fmt.Errorf("send OTP code error: %w", err)
		}

		if _, ok := request.(authtype.AuhtRequestFieldable); ok {
			fields := request.(authtype.AuhtRequestFieldable).Fields()
			for fieldKey, fieldValue := range fields {
				err := user.SetFields(u, fieldKey, fieldValue)
				if err != nil {
					log.Printf("sign up: set fields %v: %v", fieldKey, err)
					errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

					return
				}
			}
		}

		if err = r.deps.UserStorer.Save(u); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"result": true,
		})
	}
}

// TODO: Move session from current guest user if "auth" user is guest (or not confirmed)
func (r *Rauther) otpAuthHandler() gin.HandlerFunc {
	if !r.checker.OTPAuth {
		log.Print("Not implement OTPAuth interface")
		return nil
	}
	return func(c *gin.Context) {
		expectedTypeOfAuthType := authtype.OTP
		at := r.types.Select(c, expectedTypeOfAuthType)

		if at == nil {
			log.Print("OTP auth handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		if at.Type != expectedTypeOfAuthType {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		request := clone(at.SignInRequest).(authtype.AuthRequest)

		err := c.ShouldBindBodyWith(request, binding.JSON)
		if err != nil {
			log.Print("OTP auth handler:", err)
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		sessionInfo, success := r.checkSession(c)
		if !success {
			return
		}

		if sessionInfo.User != nil && !sessionInfo.UserIsGuest {
			errorResponse(c, http.StatusBadRequest, common.ErrAlreadyAuth)
			return
		}

		uid, code := request.GetUID(), request.GetPassword()

		if uid == "" || code == "" {
			log.Print("otp handler: empty uid or code")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		// Find user by UID
		u, err := r.deps.UserStorer.LoadByUID(at.Key, uid)
		if err != nil {
			log.Print(err)
		}
		if u == nil {
			errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
			return
		}

		userCode, expiredAt := u.(user.OTPAuth).GetOTP()
		if expiredAt.Before(time.Now()) {
			errorResponse(c, http.StatusBadRequest, common.ErrCodeExpired)
			return
		}

		if code != userCode {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidCode)
			return
		}

		if r.Config.CreateGuestUser && sessionInfo.UserIsGuest {
			var removeUserID interface{}

			if u.(user.GuestUser).IsGuest() {
				sessionInfo.User.SetUID(at.Key, uid)
				sessionInfo.User.(user.GuestUser).SetGuest(false)

				removeUserID = u.GetID()

				u = sessionInfo.User
			} else {
				removeUserID = sessionInfo.UserID
			}

			err := r.deps.Storage.UserRemover.RemoveByID(removeUserID)
			if err != nil {
				log.Printf("Failed delete guest user %v: %v", sessionInfo.UserID, err)
			}
		}

		if r.Modules.ConfirmableUser {
			u.(user.ConfirmableUser).SetConfirmed(at.Key, true)
		}

		sessionInfo.Session.BindUser(u)

		err = r.deps.SessionStorer.Save(sessionInfo.Session)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
			return
		}

		u.(user.OTPAuth).SetOTP("", nil)

		if err = r.deps.UserStorer.Save(u); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
			return
		}

		c.Set(r.Config.ContextNames.Session, sessionInfo.Session)
		c.Set(r.Config.ContextNames.User, u)

		c.JSON(http.StatusOK, gin.H{
			"result": true,
		})
	}
}

type sessionInfo struct {
	Session     session.Session
	User        user.User
	UserID      interface{}
	UserIsGuest bool
}

// Check user in current session
func (r *Rauther) checkSession(c *gin.Context) (info sessionInfo, success bool) {
	s, ok := c.Get(r.Config.ContextNames.Session)
	if !ok {
		errorResponse(c, http.StatusUnauthorized, common.ErrNotAuth)
		return
	}

	sess, ok := s.(session.Session)
	if !ok {
		log.Fatal("failed 'sess' type assertion to session.Session")
		errorResponse(c, http.StatusUnauthorized, common.ErrNotAuth)
		return
	}

	var currentUserIsGuest bool

	currentUserID := sess.GetUserID()
	if currentUserID != nil {
		currentUser, _ := r.deps.UserStorer.LoadByID(currentUserID)

		if currentUser != nil && r.Config.CreateGuestUser {
			currentUserIsGuest = currentUser.(user.GuestUser).IsGuest()
		}

		return sessionInfo{
			Session:     sess,
			User:        currentUser,
			UserID:      currentUserID,
			UserIsGuest: currentUserIsGuest,
		}, true
	}

	return sessionInfo{
		Session:     sess,
		User:        nil,
		UserID:      currentUserID,
		UserIsGuest: currentUserIsGuest,
	}, true
}
