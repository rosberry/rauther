package rauther

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/common"
	"github.com/rosberry/rauther/storage"
)

func (r *Rauther) signOutHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionInfo, success := r.checkSession(c)
		if !success {
			return
		}

		sessionInfo.Session.UnbindUser(sessionInfo.User)

		if r.Config.CreateGuestUser && sessionInfo.UserIsGuest { // nolint:nestif
			rmStorer, ok := r.deps.UserStorer.(storage.RemovableUserStorer)
			if !ok {
				log.Print("[signOutHandler] failed 'UserStorer' type assertion to RemovableUserStorer")
			}

			err := rmStorer.RemoveByID(sessionInfo.UserID)
			if err != nil {
				log.Printf("Failed delete guest user %v: %v", sessionInfo.UserID, err)
			}

			us, errType := r.createGuestUser()
			if errType != 0 {
				errorResponse(c, http.StatusInternalServerError, errType)
				return
			}

			sessionInfo.Session.BindUser(us)
		}

		sessionInfo.Session.SetToken(generateSessionToken())

		err := r.deps.SessionStorer.Save(sessionInfo.Session)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"result": true,
			"token":  sessionInfo.Session.GetToken(),
		})
	}
}
