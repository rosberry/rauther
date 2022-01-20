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
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	sessionInfo, success := r.checkSession(c)
	if !success {
		return
	}

	uid := request.GetUID()
	if uid == "" {
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	var linkAccount bool

	var u user.User

	if sessionInfo.User != nil && !sessionInfo.UserIsGuest {
		if !r.Modules.LinkAccount {
			errorResponse(c, http.StatusBadRequest, common.ErrAlreadyAuth)
			return
		}

		u, err = r.initLinkAccount(sessionInfo, at.Key, uid)
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
			case errors.As(err, &customErr):
				customErrorResponse(c, customErr)
			default:
				errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			}

			return
		}

		linkAccount = true
	}

	if !linkAccount {
		// Find user by UID
		u, err = r.deps.UserStorer.LoadByUID(at.Key, uid)
		if err != nil {
			log.Print(err)
			var customErr CustomError
			if errors.As(err, &customErr) {
				customErrorResponse(c, customErr)
				return
			}
		}

		// User not found
		if u == nil {
			u = r.deps.UserStorer.Create()

			if r.Modules.GuestUser {
				u.(user.GuestUser).SetGuest(true)
			}

			u.(user.AuthableUser).SetUID(at.Key, uid)
		}

		if tempUser, ok := u.(user.TempUser); ok && tempUser.IsTemp() {
			tempUser.SetTemp(false)
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
		errorResponse(c, http.StatusInternalServerError, common.ErrUnknownError)

		return
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
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	uid, code := request.GetUID(), request.GetPassword()

	if uid == "" || code == "" {
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
		if !r.Modules.LinkAccount {
			errorResponse(c, http.StatusBadRequest, common.ErrAlreadyAuth)
			return
		}

		linkAccount = true
	}

	// Find user by UID
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

	if r.Modules.LinkAccount {
		isTempUser := u.(user.TempUser).IsTemp()

		if isTempUser && !linkAccount {
			errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
			return
		}
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

	isNew := !u.(user.OTPAuth).GetConfirmed(at.Key)

	// If current user is GUEST, and OTP user is guest (new user) - use current user as actual
	if r.Modules.GuestUser && sessionInfo.UserIsGuest && !linkAccount {
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
	}

	if !u.(user.OTPAuth).GetConfirmed(at.Key) {
		u.(user.OTPAuth).SetConfirmed(at.Key, true)
	}

	if linkAccount {
		var mergeConfirm bool

		if requestWithMergeConfirm, ok := request.(authtype.MergeConfirmRequest); ok {
			mergeConfirm = requestWithMergeConfirm.MergeConfirm()
		}

		err := r.linkAccount(sessionInfo, u, at, mergeConfirm)
		if err != nil {
			var mergeErr MergeError

			switch {
			case errors.As(err, &mergeErr):
				mergeErrorResponse(c, mergeErr)
			default:
				errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			}

			return
		}
	} else {
		sessionInfo.Session.BindUser(u)
		err = r.deps.SessionStorer.Save(sessionInfo.Session)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
			return
		}

		if fieldableRequest, ok := request.(authtype.AuthRequestFieldable); ok {
			if ok := r.fillFields(fieldableRequest, u); !ok {
				errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
				return
			}
		}

		err = u.(user.OTPAuth).SetOTP(at.Key, "")
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUnknownError)
			return
		}

		if err = r.deps.UserStorer.Save(u); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
			return
		}

		c.Set(r.Config.ContextNames.User, u)
		c.Set(r.Config.ContextNames.Session, sessionInfo.Session)
	}

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
