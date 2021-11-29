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

func (r *Rauther) requestRecoveryHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		type recoveryRequest struct {
			UID string `json:"uid" binding:"required"`
		}

		at, ok := r.findAuthType(c, authtype.Password) // FIXME: Password only?
		if !ok {
			log.Print("not found expected auth type")
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

		at, ok := r.findAuthType(c, authtype.Password) // FIXME: Password only?
		if !ok {
			log.Print("not found expected auth type")
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

		at, ok := r.findAuthType(c, authtype.Password) // FIXME: Password only?
		if !ok {
			log.Print("not found expected auth type")
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

		u.(user.PasswordAuthableUser).SetPassword(at.Key, string(encryptedPassword))
		u.(user.RecoverableUser).SetRecoveryCode("")

		err = r.deps.Storage.UserStorer.Save(u)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
			return
		}

		c.JSON(http.StatusOK, gin.H{"result": true})
	}
}