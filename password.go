package rauther

import (
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/common"
	"github.com/rosberry/rauther/user"
	"golang.org/x/crypto/bcrypt"
)

func (r *Rauther) signUpHandler(c *gin.Context) {
	at, ok := r.findAuthMethod(c, authtype.Password)
	if !ok {
		log.Print("not found expected auth method")
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

	sessionInfo, success := r.checkSession(c)
	if !success {
		return
	}

	// Find user by UID
	u, err := r.deps.UserStorer.LoadByUID(at.Key, uid)
	if err != nil {
		log.Print(err)
		var customErr CustomError
		if errors.As(err, &customErr) {
			customErrorResponse(c, customErr)
			return
		}
	}

	// User exists
	if u != nil {
		if tempUser, ok := u.(user.TempUser); !(ok && tempUser.IsTemp()) {
			errorResponse(c, http.StatusBadRequest, common.ErrUserExist)
			return
		}

		err := r.deps.Storage.UserRemover.RemoveByID(u.GetID())
		if err != nil {
			log.Printf("Failed delete guest user %v: %v", sessionInfo.UserID, err)
		}
	}

	if r.Modules.GuestUser && sessionInfo.UserIsGuest {
		u = sessionInfo.User
		u.(user.GuestUser).SetGuest(false)
	} else {
		u = r.deps.UserStorer.Create()
	}

	u.(user.AuthableUser).SetUID(at.Key, uid)

	encryptedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Print("encrypt password error:", err)
		errorResponse(c, http.StatusInternalServerError, common.ErrUnknownError)

		return
	}

	u.(user.PasswordAuthableUser).SetPassword(at.Key, string(encryptedPassword))

	if fieldableRequest, ok := request.(authtype.AuthRequestFieldable); ok {
		if ok := r.fillFields(fieldableRequest, u); !ok {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}
	}

	if r.Modules.ConfirmableUser {
		confirmCode := r.generateCode(at)

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

	sessionInfo.Session.BindUser(u)
	c.Set(r.Config.ContextNames.User, u)
	c.Set(r.Config.ContextNames.Session, sessionInfo.Session)

	err = r.deps.SessionStorer.Save(sessionInfo.Session)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
		return
	}

	respMap := gin.H{
		"result": true,
		"uid":    uid,
	}

	if r.hooks.AfterPasswordSignUp != nil {
		r.hooks.AfterPasswordSignUp(respMap, sessionInfo.Session, u, at.Key)
	}

	c.JSON(http.StatusOK, respMap)
}

func (r *Rauther) signInHandler(c *gin.Context) {
	at, ok := r.findAuthMethod(c, authtype.Password)
	if !ok {
		log.Print("not found expected auth method")
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

	sessionInfo, success := r.checkSession(c)
	if !success {
		return
	}

	if sessionInfo.User != nil && !sessionInfo.UserIsGuest {
		errorResponse(c, http.StatusBadRequest, common.ErrAlreadyAuth)
		return
	}

	uid, password := request.GetUID(), request.GetPassword()

	if uid == "" || password == "" {
		log.Print("sign in handler: empty uid or password")
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	u, err := r.LoadByUID(at.Key, uid)
	if err != nil {
		log.Print(err)
		var customErr CustomError
		if errors.As(err, &customErr) {
			customErrorResponse(c, customErr)
			return
		}
	}

	if u == nil {
		errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
		return
	}

	if tempUser, ok := u.(user.TempUser); ok && tempUser.IsTemp() {
		// TODO: Correct error about user is temporary?
		errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
		return
	}

	userPassword := u.(user.PasswordAuthableUser).GetPassword(at.Key)

	if !passwordCompare(password, userPassword) {
		errorResponse(c, http.StatusForbidden, common.ErrIncorrectPassword)
		return
	}

	sessionInfo.Session.BindUser(u)

	if err = r.deps.SessionStorer.Save(sessionInfo.Session); err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
		return
	}

	if err = r.deps.UserStorer.Save(u); err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
		return
	}

	if r.Modules.GuestUser && sessionInfo.UserIsGuest {
		err := r.deps.Storage.UserRemover.RemoveByID(sessionInfo.UserID)
		if err != nil {
			log.Printf("Failed delete guest user %v: %v", sessionInfo.UserID, err)
		}
	}

	c.Set(r.Config.ContextNames.Session, sessionInfo.Session)
	c.Set(r.Config.ContextNames.User, u)

	respMap := gin.H{
		"result": true,
	}

	if r.hooks.AfterPasswordSignIn != nil {
		r.hooks.AfterPasswordSignIn(respMap, sessionInfo.Session, u, at.Key)
	}

	c.JSON(http.StatusOK, respMap)
}

func (r *Rauther) validateLoginField(c *gin.Context) {
	at, ok := r.findAuthMethod(c, authtype.Password)
	if !ok {
		log.Print("not found expected auth method")
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

	u, err := r.LoadByUID(at.Key, uid)
	if err != nil {
		log.Print(err)
		var customErr CustomError
		if errors.As(err, &customErr) {
			customErrorResponse(c, customErr)
			return
		}
	} else if u != nil {
		errorResponse(c, http.StatusBadRequest, common.ErrUserExist)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"result": true,
	})
}

func (r *Rauther) initLinkingPasswordAccount(c *gin.Context) {
	at, ok := r.findAuthMethod(c, authtype.Password)
	if !ok {
		log.Print("not found expected auth method")
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	request := clone(at.CheckUserExistsRequest).(authtype.CheckUserExistsRequest)

	err := c.ShouldBindBodyWith(request, binding.JSON)
	if err != nil {
		log.Print("sign up handler:", err)
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	uid := request.GetUID()

	if uid == "" {
		log.Print("init linking password account handler: empty uid")
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	sessionInfo, success := r.checkSession(c)
	if !success {
		return
	}

	u, err := r.initLinkAccount(sessionInfo, at.Key, uid)
	if err != nil {
		log.Print(err)

		var customErr CustomError

		switch {
		case errors.Is(err, errAuthIdentityExists):
			errorResponse(c, http.StatusBadRequest, common.ErrAuthIdentityExists)
		case errors.Is(err, errCurrentUserNotConfirmed):
			errorResponse(c, http.StatusBadRequest, common.ErrUserNotConfirmed)
		case errors.Is(err, errUserAlreadyRegistered):
			errorResponse(c, http.StatusBadRequest, common.ErrAlreadyAuth)
		case errors.As(err, &customErr):
			customErrorResponse(c, customErr)
		default:
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
		}

		return
	}

	// confirmation
	confirmCode := r.generateCode(at)

	u.(user.ConfirmableUser).SetConfirmCode(at.Key, confirmCode)

	if r.checker.CodeSentTime && r.Modules.CodeSentTimeUser {
		curTime := time.Now()
		u.(user.CodeSentTimeUser).SetCodeSentTime(at.Key, &curTime)
	}

	err = sendConfirmCode(at.Sender, uid, confirmCode)
	if err != nil {
		log.Printf("failed send confirm code %v: %v", uid, err)
	}

	if err = r.deps.UserStorer.Save(u); err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
		return
	}

	err = r.deps.SessionStorer.Save(sessionInfo.Session)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
		return
	}

	respMap := gin.H{
		"result": true,
		"uid":    uid,
	}

	if r.hooks.AfterPasswordSignUp != nil {
		// TODO: Add AfterLinkPasswordAccount hook?
		r.hooks.AfterPasswordSignUp(respMap, sessionInfo.Session, u, at.Key)
	}

	c.JSON(http.StatusOK, respMap)
}

func (r *Rauther) linkPasswordAccount(c *gin.Context) {
	at, ok := r.findAuthMethod(c, authtype.Password)
	if !ok {
		log.Print("not found expected auth method")
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	type linkAccountRequest struct {
		UID      string `json:"uid" binding:"required"`
		Password string `json:"password" binding:"required"`
		Code     string `json:"code" binding:"required"`
	}

	var request linkAccountRequest

	if err := c.ShouldBindBodyWith(&request, binding.JSON); err != nil {
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
		return
	}

	sessionInfo, success := r.checkSession(c)
	if !success {
		return
	}

	u, err := r.LoadByUID(at.Key, request.UID)
	if err != nil || u == nil {
		errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
		return
	}

	laUser := u.(user.TempUser)

	if sessionInfo.User.GetID() != laUser.GetID() && !laUser.IsTemp() {
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
		return
	}

	if laUser.GetConfirmed(at.Key) {
		c.JSON(http.StatusOK, gin.H{
			"result": true,
		})

		return
	}

	// check code
	code := laUser.(user.ConfirmableUser).GetConfirmCode(at.Key)
	if request.Code != code || code == "" {
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidConfirmCode)
		return
	}

	if r.checker.CodeSentTime && r.Modules.CodeSentTimeUser {
		codeSent := laUser.(user.CodeSentTimeUser).GetCodeSentTime(at.Key)

		expiredAt := calcExpiredAt(codeSent, r.Config.Password.CodeLifeTime)

		if expiredAt.Before(time.Now()) {
			errorResponse(c, http.StatusBadRequest, common.ErrCodeExpired)
			return
		}

		laUser.(user.CodeSentTimeUser).SetCodeSentTime(at.Key, nil)
	}

	laUser.SetConfirmed(at.Key, true)

	// set password
	encryptedPassword, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Print("encrypt password error:", err)
		errorResponse(c, http.StatusInternalServerError, common.ErrUnknownError)

		return
	}

	laUser.(user.PasswordAuthableUser).SetPassword(at.Key, string(encryptedPassword))

	err = r.deps.UserStorer.Save(u)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
		return
	}

	if laUser.IsTemp() {
		err := r.linkAccount(sessionInfo, laUser, at)
		if err != nil {
			// TODO: Error handling and return correct err
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"result": true,
	})
}
