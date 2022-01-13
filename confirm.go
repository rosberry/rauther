package rauther

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/common"
	"github.com/rosberry/rauther/user"
)

func (r *Rauther) confirmHandler(c *gin.Context) {
	type confirmRequest struct {
		UID  string `json:"uid" binding:"required"`
		Code string `json:"code" binding:"required"`
	}

	at, ok := r.findAuthMethod(c, authtype.Password)
	if !ok {
		log.Print("not found expected auth method")
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	var request confirmRequest

	if err := c.ShouldBindBodyWith(&request, binding.JSON); err != nil {
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
		return
	}

	u, err := r.LoadByUID(at.Key, request.UID)
	if err != nil || u == nil {
		errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
		return
	}

	var linkAccount bool

	if r.Modules.LinkAccount {
		sessionInfo, success := r.checkSession(c)
		if !success {
			return
		}

		if sessionInfo.User != nil &&
			sessionInfo.User.GetID() != u.GetID() {
			if !u.(user.TempUser).IsTemp() {
				errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
				return
			}

			linkAccount = true
		}
	}

	if u.(user.ConfirmableUser).GetConfirmed(at.Key) {
		c.JSON(http.StatusOK, gin.H{
			"result": true,
		})

		return
	}

	code := u.(user.ConfirmableUser).GetConfirmCode(at.Key)
	if request.Code != code || code == "" {
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidConfirmCode)
		return
	}

	if r.checker.CodeSentTime && r.Modules.CodeSentTimeUser {
		codeSent := u.(user.CodeSentTimeUser).GetCodeSentTime(at.Key)

		expiredAt := calcExpiredAt(codeSent, r.Config.Password.CodeLifeTime)

		if expiredAt.Before(time.Now()) {
			errorResponse(c, http.StatusBadRequest, common.ErrCodeExpired)
			return
		}

		u.(user.CodeSentTimeUser).SetCodeSentTime(at.Key, nil)
	}

	u.(user.ConfirmableUser).SetConfirmed(at.Key, true)

	err = r.deps.UserStorer.Save(u)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
		return
	}

	if linkAccount {
		if tempUser, ok := u.(user.TempUser); ok && tempUser.IsTemp() {
			sessionInfo, success := r.checkSession(c)
			if !success {
				return
			}

			err := r.linkAccount(sessionInfo, tempUser, at)
			if err != nil {
				// TODO: Error handling and return correct err
				errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
				return
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"result": true,
	})
}

func (r *Rauther) resendCodeHandler(c *gin.Context) {
	at, ok := r.findAuthMethod(c, authtype.Password)
	if !ok {
		log.Print("not found expected auth method")
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	sessionInfo, success := r.checkSession(c)
	if !success {
		return
	}

	if sessionInfo.User == nil {
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
		return
	}

	u := sessionInfo.User

	uid := u.(user.AuthableUser).GetUID(at.Key)
	if uid == "" {
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
		return
	}

	confirmCode := r.generateCode(at)

	// check resend timeout
	if r.checker.CodeSentTime && r.Modules.CodeSentTimeUser {
		curTime := time.Now()
		if resendTime, ok := r.checkResendTime(u, curTime, at); !ok {
			errorCodeTimeoutResponse(c, *resendTime, curTime)
			return
		}
	}

	u.(user.ConfirmableUser).SetConfirmCode(at.Key, confirmCode)

	if err := r.deps.UserStorer.Save(u); err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)

		return
	}

	err := sendConfirmCode(at.Sender, uid, confirmCode)
	if err != nil {
		log.Print(err)
		errorResponse(c, http.StatusInternalServerError, common.ErrUnknownError)

		return
	}

	c.JSON(http.StatusOK, gin.H{
		"result": true,
	})
}
