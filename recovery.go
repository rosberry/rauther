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
	"golang.org/x/crypto/bcrypt"
)

type recoveryRequest struct {
	UID string `json:"uid" binding:"required"`
}

func (r *Rauther) requestRecoveryHandler(c *gin.Context) {
	at, ok := r.findAuthMethod(c, authtype.Password)
	if !ok {
		log.Print("not found expected auth method")
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	var request recoveryRequest
	if err := c.ShouldBindBodyWith(&request, binding.JSON); err != nil {
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
		return
	}

	u, err := r.LoadByUID(at.Key, request.UID)
	if err != nil {
		errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
		return
	}

	if tempUser, ok := u.(user.TempUser); ok && tempUser.IsTemp() {
		errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
		return
	}

	code := r.generateCode(at)

	// check resend timeout
	if r.checker.CodeSentTime && r.Modules.CodeSentTimeUser {
		curTime := time.Now()
		if resendTime, ok := r.checkResendTime(u, curTime, at); !ok {
			errorCodeTimeoutResponse(c, *resendTime, curTime)
			return
		}

		u.(user.CodeSentTimeUser).SetCodeSentTime(at.Key, &curTime)
	}

	u.(user.RecoverableUser).SetRecoveryCode(at.Key, code)

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

func (r *Rauther) validateRecoveryCodeHandler(c *gin.Context) {
	type recoveryValidationRequest struct {
		UID  string `json:"uid" binding:"required"`
		Code string `json:"code" binding:"required"`
	}

	at, ok := r.findAuthMethod(c, authtype.Password)
	if !ok {
		log.Print("not found expected auth method")
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	var request recoveryValidationRequest
	if err := c.ShouldBindBodyWith(&request, binding.JSON); err != nil {
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
		return
	}

	u, err := r.LoadByUID(at.Key, request.UID)
	if err != nil {
		errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
		return
	}

	if tempUser, ok := u.(user.TempUser); ok && tempUser.IsTemp() {
		errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
		return
	}

	if r.checker.CodeSentTime && r.Modules.CodeSentTimeUser {
		codeSent := u.(user.CodeSentTimeUser).GetCodeSentTime(at.Key)

		expiredAt := calcExpiredAt(codeSent, r.Config.Password.CodeLifeTime)

		if expiredAt.Before(time.Now()) {
			errorResponse(c, http.StatusBadRequest, common.ErrCodeExpired)
			return
		}
	}

	code := u.(user.RecoverableUser).GetRecoveryCode(at.Key)
	if code != request.Code {
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRecoveryCode)
		return
	}

	c.JSON(http.StatusOK, gin.H{"result": true})
}

func (r *Rauther) recoveryHandler(c *gin.Context) {
	type recoveryRequest struct {
		UID      string `json:"uid" binding:"required"`
		Code     string `json:"code" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	at, ok := r.findAuthMethod(c, authtype.Password)
	if !ok {
		log.Print("not found expected auth method")
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	var request recoveryRequest
	if err := c.ShouldBindBodyWith(&request, binding.JSON); err != nil {
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
		return
	}

	u, err := r.LoadByUID(at.Key, request.UID)
	if err != nil {
		errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
		return
	}

	if tempUser, ok := u.(user.TempUser); ok && tempUser.IsTemp() {
		errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
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

	code := u.(user.RecoverableUser).GetRecoveryCode(at.Key)
	if code != request.Code || code == "" {
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRecoveryCode)
		return
	}

	encryptedPassword, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Print("encrypt password error:", err)
		errorResponse(c, http.StatusInternalServerError, common.ErrUnknownError)
	}

	u.(user.PasswordAuthableUser).SetPassword(at.Key, string(encryptedPassword))
	u.(user.RecoverableUser).SetRecoveryCode(at.Key, "")

	err = r.deps.Storage.UserStorer.Save(u)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
		return
	}

	c.JSON(http.StatusOK, gin.H{"result": true})
}
