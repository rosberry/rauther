package rauther

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/common"
	"github.com/rosberry/rauther/session"
	"github.com/rosberry/rauther/user"
)

func (r *Rauther) confirmHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		type confirmRequest struct {
			UID  string `json:"uid" binding:"required"`
			Code string `json:"code" binding:"required"`
		}

		at, ok := r.findAuthType(c, authtype.Password) // FIXME: Password only?
		if !ok {
			log.Print("not found expected auth type")
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

		at, ok := r.findAuthType(c, authtype.Password) // FIXME: Password only?
		if !ok {
			log.Print("not found expected auth type")
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

		uid := u.(user.AuthableUser).GetUID(at.Key)

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
