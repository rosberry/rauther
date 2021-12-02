package rauther

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/rosberry/auth"
	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/common"
	"github.com/rosberry/rauther/storage"
	"github.com/rosberry/rauther/user"
)

func (r *Rauther) socialSignInHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		at, ok := r.findAuthMethod(c, authtype.Social)
		if !ok {
			log.Print("not found expected auth method")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		request := clone(at.SocialSignInRequest).(authtype.SocialAuthRequest)

		err := c.ShouldBindBodyWith(request, binding.JSON)
		if err != nil {
			log.Print("social sign in handler:", err)
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		sessionInfo, success := r.checkSession(c)
		if !success {
			return
		}

		if !sessionInfo.UserIsGuest {
			errorResponse(c, http.StatusBadRequest, common.ErrAlreadyAuth)
			return
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

		u, _ = r.deps.UserStorer.LoadByUID(at.Key, userInfo.ID)
		if u == nil {
			// create user if not exist
			u = r.deps.UserStorer.Create()
			u.(user.AuthableUser).SetUID(at.Key, userInfo.ID)

			if err = r.deps.UserStorer.Save(u); err != nil {
				errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
				return
			}
		}

		sessionInfo.Session.BindUser(u)

		if err = r.deps.SessionStorer.Save(sessionInfo.Session); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
			return
		}

		if r.Config.CreateGuestUser && sessionInfo.UserIsGuest {
			rmStorer, ok := r.deps.UserStorer.(storage.RemovableUserStorer)
			if !ok {
				log.Printf("[socialSignInHandler] failed 'UserStorer' type assertion to storage.RemovableUserStorer")
			}

			err := rmStorer.RemoveByID(sessionInfo.UserID)
			if err != nil {
				log.Printf("Failed delete guest user %v: %v", sessionInfo.UserID, err)
			}
		}

		c.Set(r.Config.ContextNames.Session, sessionInfo.Session)
		c.Set(r.Config.ContextNames.User, u)

		c.JSON(http.StatusOK, gin.H{
			"result": true,
		})
	}
}
