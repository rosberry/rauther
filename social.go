package rauther

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/rosberry/auth"
	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/common"
	"github.com/rosberry/rauther/session"
	"github.com/rosberry/rauther/storage"
	"github.com/rosberry/rauther/user"
)

func (r *Rauther) socialSignInHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		expectedTypeOfAuthType := authtype.Social
		at := r.types.Select(c, expectedTypeOfAuthType)
		if at == nil {
			log.Print("social sign in handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		if at.Type != expectedTypeOfAuthType {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}

		request := clone(at.SocialSignInRequest).(authtype.SocialSignInRequest)

		err := c.ShouldBindBodyWith(request, binding.JSON)
		if err != nil {
			log.Print("social sign in handler:", err)
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		s, ok := c.Get(r.Config.ContextNames.Session)
		if !ok {
			errorResponse(c, http.StatusUnauthorized, common.ErrNotAuth)
			return
		}

		sess, ok := s.(session.Session)
		if !ok {
			log.Fatal("[socialSignInHandler] failed 'sess' type assertion to session.Session")
		}

		currentUserID := sess.GetUserID()

		var currentUserIsGuest bool

		if currentUserID != nil {
			currentUser, err := r.deps.UserStorer.LoadByID(currentUserID)

			if currentUser != nil && err == nil {
				currentUserIsGuest = currentUser.(user.GuestUser).IsGuest()
			}

			if !currentUserIsGuest {
				errorResponse(c, http.StatusBadRequest, common.ErrAlreadyAuth)
				return
			}
		}

		var u user.User

		token := request.GetToken()
		if token == "" {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidAuthToken)
			return
		}

		userInfo, err := auth.Auth(token, at.SocialAuthType)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidAuthToken)
			return
		}

		u, err = r.deps.UserStorer.LoadByUID(at.Key, userInfo.ID)
		if u == nil {
			// create user if not exist
			u = r.deps.UserStorer.Create()
			u.(user.AuthableUser).SetUID(at.Key, userInfo.ID)

			if err = r.deps.UserStorer.Save(u); err != nil {
				errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
				return
			}
		}

		sess.BindUser(u)

		if err = r.deps.SessionStorer.Save(sess); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
			return
		}

		if r.Config.CreateGuestUser && currentUserIsGuest {
			rmStorer, ok := r.deps.UserStorer.(storage.RemovableUserStorer)
			if !ok {
				log.Printf("[socialSignInHandler] failed 'UserStorer' type assertion to storage.RemovableUserStorer")
			}

			err := rmStorer.RemoveByID(currentUserID)
			if err != nil {
				log.Printf("Failed delete guest user %v: %v", currentUserID, err)
			}
		}

		c.Set(r.Config.ContextNames.Session, sess)
		c.Set(r.Config.ContextNames.User, u)

		c.JSON(http.StatusOK, gin.H{
			"result": true,
		})
	}
}
