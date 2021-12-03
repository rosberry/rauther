package rauther

import (
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

		u.(user.AuthableUser).SetUID(at.Key, uid)
	}

	// Check last send time
	if r.checker.CodeSentTime && r.Modules.CodeSentTimeUser {
		curTime := time.Now()
		if timeOffset, ok := r.checkCodeSent(u, at.Key); !ok {
			errorCodeTimeoutResponse(c, *timeOffset, curTime)
			return
		}
	}

	code := r.getOTPCode(u)

	expiredAt := time.Now().Add(r.Config.OTP.CodeLifeTime)

	err = u.(user.OTPAuth).SetOTP(at.Key, code, &expiredAt)
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
	at, ok := r.findAuthMethod(c, authtype.OTP)
	if !ok {
		log.Print("not found expected auth method")
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

	userCode, expiredAt := u.(user.OTPAuth).GetOTP(at.Key)
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

	if r.Modules.ConfirmableUser {
		u.(user.ConfirmableUser).SetConfirmed(at.Key, true)
	}

	sessionInfo.Session.BindUser(u)

	err = r.deps.SessionStorer.Save(sessionInfo.Session)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
		return
	}

	err = u.(user.OTPAuth).SetOTP(at.Key, "", nil)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrUnknownError)
		return
	}

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

func (r *Rauther) getOTPCode(u user.User) (code string) {
	if uCodeGenerator, ok := u.(user.OTPAuthCustomCodeGenerator); ok {
		code = uCodeGenerator.GenerateCode()
	} else {
		code = generateNumericCode(r.Config.OTP.CodeLength)
	}

	return
}

func (r *Rauther) checkCodeSent(u user.User, authKey string) (timeOffset *time.Time, ok bool) {
	lastCodeSentTime := u.(user.CodeSentTimeUser).GetCodeSentTime(authKey)
	curTime := time.Now()

	if lastCodeSentTime != nil {
		timeOffset := lastCodeSentTime.Add(r.Config.ValidConfirmationInterval)

		if !curTime.After(timeOffset) {
			return &timeOffset, false
		}
	}

	u.(user.CodeSentTimeUser).SetCodeSentTime(authKey, &curTime)

	return nil, true
}
