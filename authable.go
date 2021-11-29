package rauther

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rosberry/rauther/common"
	"github.com/rosberry/rauther/session"
	"github.com/rosberry/rauther/storage"
	"github.com/rosberry/rauther/user"
)

func (r *Rauther) signOutHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		s, ok := c.Get(r.Config.ContextNames.Session)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.ErrNotAuth)
			return
		}

		session, ok := s.(session.Session)
		if !ok {
			log.Fatal("[signOutHandler] failed 's' type assertion to session.Session")
		}

		u, ok := c.Get(r.Config.ContextNames.User)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.ErrNotSignIn)
			return
		}

		usr, ok := u.(user.User)
		if !ok {
			log.Fatal("[signOutHandler] failed 'user' type assertion to User")
		}

		guestUser, isGuestInterface := usr.(user.GuestUser)

		if r.Config.CreateGuestUser && isGuestInterface { // nolint:nestif
			if guestUser.IsGuest() {
				rmStorer, ok := r.deps.UserStorer.(storage.RemovableUserStorer)
				if !ok {
					log.Print("[signOutHandler] failed 'UserStorer' type assertion to RemovableUserStorer")
				}

				err := rmStorer.RemoveByID(session.GetUserID())
				if err != nil {
					log.Printf("Failed delete guest user %v: %v", session.GetUserID(), err)
				}
			}

			us, errType := r.createGuestUser()
			if errType != 0 {
				errorResponse(c, http.StatusInternalServerError, errType)
				return
			}

			session.BindUser(us)
		} else {
			session.UnbindUser(usr)
		}

		newToken := uuid.New().String()
		session.SetToken(newToken)

		err := r.deps.SessionStorer.Save(session)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"result": true,
			"token":  newToken,
		})
	}
}
