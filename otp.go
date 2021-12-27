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
	"github.com/rosberry/rauther/sender"
	"github.com/rosberry/rauther/user"
)

func (r *Rauther) otpGetCodeHandler(c *gin.Context) {
	at, ok := r.findAuthMethod(c, authtype.OTP)
	if !ok {
		log.Print("not found expected auth method")
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

	var linkAccount bool

	if sessionInfo.User != nil && !sessionInfo.UserIsGuest {
		if !r.Config.LinkAccount {
			errorResponse(c, http.StatusBadRequest, common.ErrAlreadyAuth)
			return
		}

		linkAccount = true
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
		if errors.As(err, &common.CustomError{}) {
			customErrorResponse(c, err.(common.CustomError))
			return
		}
	}

	// User not found
	if u == nil {
		u = r.deps.UserStorer.Create()

		if r.Config.CreateGuestUser {
			u.(user.GuestUser).SetGuest(true)
		}

		if linkAccount {
			if foundUID := sessionInfo.User.(user.AuthableUser).GetUID(at.Key); foundUID != "" {
				errorResponse(c, http.StatusBadRequest, common.ErrAuthIdentityExists)

				return
			}
		}

		u.(user.AuthableUser).SetUID(at.Key, uid)
	} else if linkAccount {
		if confirmableUser, ok := u.(user.ConfirmableUser); ok {
			if confirmableUser.GetConfirmed(at.Key) {
				errorResponse(c, http.StatusBadRequest, common.ErrUserExist)
				return
			}
		} else {
			errorResponse(c, http.StatusBadRequest, common.ErrUserExist)
			return
		}
	}

	// Check last send time
	if r.checker.CodeSentTime && r.Modules.CodeSentTimeUser {
		curTime := time.Now()
		if resendTime, ok := r.checkResendTime(u, curTime, at); !ok {
			errorCodeTimeoutResponse(c, *resendTime, curTime)
			return
		}

		u.(user.CodeSentTimeUser).SetCodeSentTime(at.Key, &curTime)
	}

	code := r.generateCode(at)

	err = u.(user.OTPAuth).SetOTP(at.Key, code)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrUnknownError)
		return
	}

	err = at.Sender.Send(sender.ConfirmationEvent, uid, code)
	if err != nil {
		log.Printf("send OTP code error: %v", err)
	}

	if err = r.deps.UserStorer.Save(u); err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"result": true,
	})
}

func (r *Rauther) otpAuthHandler(c *gin.Context) {
	// Check auth method
	at, ok := r.findAuthMethod(c, authtype.OTP)
	if !ok {
		log.Print("not found expected auth method")
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	request := clone(at.SignInRequest).(authtype.AuthRequest)

	// Check request data
	err := c.ShouldBindBodyWith(request, binding.JSON)
	if err != nil {
		log.Print("OTP auth handler:", err)
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	uid, code := request.GetUID(), request.GetPassword()

	if uid == "" || code == "" {
		log.Print("otp handler: empty uid or code")
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	// Check current session
	sessionInfo, success := r.checkSession(c)
	if !success {
		return
	}

	// Check User in current session
	var linkAccount bool

	if sessionInfo.User != nil && !sessionInfo.UserIsGuest {
		if !r.Config.LinkAccount {
			errorResponse(c, http.StatusBadRequest, common.ErrAlreadyAuth)
			return
		}

		linkAccount = true
	}

	// Find user by UID
	u, err := r.deps.UserStorer.LoadByUID(at.Key, uid)
	if err != nil {
		log.Print(err)
		if errors.As(err, &common.CustomError{}) {
			customErrorResponse(c, err.(common.CustomError))
			return
		}
	}

	if u == nil {
		errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
		return
	}

	// Check user code (password)
	userCode := u.(user.OTPAuth).GetOTP(at.Key)

	if r.checker.CodeSentTime && r.Modules.CodeSentTimeUser {
		codeSent := u.(user.CodeSentTimeUser).GetCodeSentTime(at.Key)

		expiredAt := calcExpiredAt(codeSent, r.Config.OTP.CodeLifeTime)

		if expiredAt.Before(time.Now()) {
			errorResponse(c, http.StatusBadRequest, common.ErrCodeExpired)
			return
		}
	}

	if code != userCode {
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidCode)
		return
	}

	var isNew bool

	// If current user is GUEST, and OTP user is guest (new user) - use current user as actual
	if r.Config.CreateGuestUser && sessionInfo.UserIsGuest {
		isNew = true
		var removeUserID interface{}

		if u.(user.GuestUser).IsGuest() {
			sessionInfo.User.(user.AuthableUser).SetUID(at.Key, uid)
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
	} else if linkAccount {
		isNew = true

		sessionInfo.User.(user.AuthableUser).SetUID(at.Key, uid)

		removeUserID := u.GetID()
		u = sessionInfo.User

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

	err = u.(user.OTPAuth).SetOTP(at.Key, "")
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrUnknownError)
		return
	}

	if fieldableRequest, ok := request.(authtype.AuthRequestFieldable); ok {
		if ok := r.fillFields(fieldableRequest, u); !ok {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}
	}

	if err = r.deps.UserStorer.Save(u); err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
		return
	}

	c.Set(r.Config.ContextNames.Session, sessionInfo.Session)
	c.Set(r.Config.ContextNames.User, u)

	respMap := gin.H{
		"result": true,
	}

	if isNew {
		if r.hooks.AfterOTPSignUp != nil {
			r.hooks.AfterOTPSignUp(respMap, sessionInfo.Session, u, at.Key)
		}
	} else if r.hooks.AfterOTPSignIn != nil {
		r.hooks.AfterOTPSignIn(respMap, sessionInfo.Session, u, at.Key)
	}

	c.JSON(http.StatusOK, respMap)
}

func (r *Rauther) checkResendTime(u user.User, curTime time.Time, authMethod *authtype.AuthMethod) (resendTime *time.Time, ok bool) {
	lastCodeSentTime := u.(user.CodeSentTimeUser).GetCodeSentTime(authMethod.Key)

	if lastCodeSentTime != nil {
		var resendInterval time.Duration

		switch authMethod.Type { // nolint:exhaustive
		case authtype.Password:
			resendInterval = r.Config.Password.ResendDelay
		case authtype.OTP:
			resendInterval = r.Config.OTP.ResendDelay
		}

		resendTime := lastCodeSentTime.Add(resendInterval)

		if !curTime.After(resendTime) {
			return &resendTime, false
		}
	}

	u.(user.CodeSentTimeUser).SetCodeSentTime(authMethod.Key, &curTime)

	return nil, true
}
