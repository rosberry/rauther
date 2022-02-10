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

const (
	linkAction  = "link"
	mergeAction = "merge"
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
		r.setAndSendConfirmCode(at, u, uid)
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

const (
	actionKey              = "action"
	confirmCodeRequiredKey = "confirmCodeRequired"
)

func (r *Rauther) initLinkingPasswordAccount(c *gin.Context) {
	at, ok := r.findAuthMethod(c, authtype.Password)
	if !ok {
		log.Print("not found expected auth method")
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	if at.DisableLink {
		errorResponse(c, http.StatusBadRequest, common.ErrLinkingNotAllowed)
		return
	}

	type linkAccountRequest struct {
		UID string `json:"uid" binding:"required"`
	}
	var request linkAccountRequest

	err := c.ShouldBindBodyWith(&request, binding.JSON)
	if err != nil {
		log.Print("init linking password account:", err)
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	uid := request.UID

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
			errorResponse(c, http.StatusBadRequest, common.ErrUserExist)
		case errors.Is(err, errCannotMergeSelf):
			errorResponse(c, http.StatusBadRequest, common.ErrCannotMergeSelf)
		case errors.As(err, &customErr):
			customErrorResponse(c, customErr)
		default:
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
		}

		return
	}

	action := linkAction
	if !u.(user.TempUser).IsTemp() {
		action = mergeAction
	}

	// confirmation
	var confirmCodeRequired bool

	if !u.(user.ConfirmableUser).GetConfirmed(at.Key) {
		confirmCodeRequired = true

		if r.checker.CodeSentTime && r.Modules.CodeSentTimeUser {
			curTime := time.Now()
			if resendTime, ok := r.checkResendTime(u, curTime, at); !ok {
				resp, code := getCodeTimeoutResponse(*resendTime, curTime)

				resp[actionKey] = action
				resp[confirmCodeRequiredKey] = confirmCodeRequired

				c.JSON(code, resp)

				return
			}
		}

		r.setAndSendConfirmCode(at, u, uid)
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
		"result":               true,
		actionKey:              action,
		confirmCodeRequiredKey: confirmCodeRequired,
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

	if at.DisableLink {
		errorResponse(c, http.StatusBadRequest, common.ErrLinkingNotAllowed)
		return
	}

	type linkAccountRequest struct {
		UID          string `json:"uid" binding:"required"`
		Password     string `json:"password" binding:"required"`
		Code         string `json:"code"`
		Merge        bool   `json:"merge"`
		ConfirmMerge bool   `json:"confirmMerge"`
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
	isTempUser := laUser.IsTemp()
	var mergeAccount bool

	if r.Modules.MergeAccount && request.Merge {
		if isTempUser {
			errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
			return
		}

		mergeAccount = true

	} else if !isTempUser {
		errorResponse(c, http.StatusBadRequest, common.ErrUserExist)
		return
	}

	// check code
	if !laUser.(user.ConfirmableUser).GetConfirmed(at.Key) {
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
	}

	// check or create password
	if mergeAccount {
		userPassword := laUser.(user.PasswordAuthableUser).GetPassword(at.Key)

		if !passwordCompare(request.Password, userPassword) {
			errorResponse(c, http.StatusForbidden, common.ErrIncorrectPassword)
			return
		}
	} else {
		encryptedPassword, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
		if err != nil {
			log.Print("encrypt password error:", err)
			errorResponse(c, http.StatusInternalServerError, common.ErrUnknownError)

			return
		}

		laUser.(user.PasswordAuthableUser).SetPassword(at.Key, string(encryptedPassword))
	}

	// TODO: Unnecessary saving? Remove?
	err = r.deps.UserStorer.Save(laUser)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
		return
	}

	var confirmMerge bool

	if r.Modules.MergeAccount {
		confirmMerge = request.Merge && request.ConfirmMerge
	}

	err = r.linkAccount(sessionInfo, laUser, at, confirmMerge)
	if err != nil {
		var customErr CustomError
		var mergeErr MergeError

		switch {
		case errors.Is(err, errAuthIdentityExists):
			errorResponse(c, http.StatusBadRequest, common.ErrAuthIdentityExists)
		case errors.Is(err, errCurrentUserNotConfirmed):
			errorResponse(c, http.StatusBadRequest, common.ErrUserNotConfirmed)
		case errors.Is(err, errUserAlreadyRegistered):
			errorResponse(c, http.StatusBadRequest, common.ErrUserExist)
		case errors.Is(err, errCannotMergeSelf):
			errorResponse(c, http.StatusBadRequest, common.ErrCannotMergeSelf)
		case errors.As(err, &customErr):
			customErrorResponse(c, customErr)
		case errors.As(err, &mergeErr):
			mergeErrorResponse(c, mergeErr)
		default:
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
		}

		return
	}

	err = r.deps.UserStorer.Save(sessionInfo.User)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"result": true,
	})
}

func (r *Rauther) setAndSendConfirmCode(at *authtype.AuthMethod, u user.User, uid string) error {
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

	return err
}
