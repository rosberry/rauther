package rauther

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/common"
)

func (r *Rauther) signOutHandler(c *gin.Context) {
	sessionInfo, success := r.checkSession(c)
	if !success {
		return
	}

	sessionInfo.Session.UnbindUser()

	if r.Config.CreateGuestUser {
		if sessionInfo.UserIsGuest {
			err := r.deps.Storage.UserRemover.RemoveByID(sessionInfo.UserID)
			if err != nil {
				log.Printf("Failed delete guest user %v: %v", sessionInfo.UserID, err)
			}
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
