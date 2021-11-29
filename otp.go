package rauther

import (
	"fmt"
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

			u.(user.AuthableUser).SetUID(at.Key, uid)
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
		u.(user.OTPAuth).SetOTP(at.Key, code, &expiredAt)

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

		u.(user.OTPAuth).SetOTP(at.Key, "", nil)

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
