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

func (r *Rauther) socialSignInHandler(c *gin.Context) {
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

	var linkAccount bool

	if sessionInfo.User != nil && !sessionInfo.UserIsGuest {
		if !r.Config.LinkAccount {
			errorResponse(c, http.StatusBadRequest, common.ErrAlreadyAuth)
			return
		}

		linkAccount = true
	}

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

	var u user.User
	var isNew bool

	if socialStorer, ok := r.deps.UserStorer.(storage.SocialStorer); ok {
		u, _ = socialStorer.LoadBySocial(at.Key, user.SocialDetails(userInfo))
	} else {
		u, _ = r.deps.UserStorer.LoadByUID(at.Key, userInfo.ID)
	}

	if u == nil {
		isNew = true
		// create user if not exist
		if linkAccount {
			u = sessionInfo.User

			if foundUID := u.(user.AuthableUser).GetUID(at.Key); foundUID != "" {
				errorResponse(c, http.StatusBadRequest, common.ErrAuthIdentityExists)

				return
			}
		} else {
			u = r.deps.UserStorer.Create()
		}

		u.(user.AuthableUser).SetUID(at.Key, userInfo.ID)

		if r.Modules.ConfirmableUser && r.checker.Confirmable {
			u.(user.ConfirmableUser).SetConfirmed(at.Key, true)
		}

		if socialUser, ok := u.(user.SocialAuthableUser); ok {
			socialUser.SetUserDetails(at.Key, user.SocialDetails(userInfo))
		}

		if fieldableRequest, ok := request.(authtype.AuthRequestFieldable); ok {
			if ok := r.fillFields(fieldableRequest, u); !ok {
				errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
				return
			}
		}

		if err = r.deps.UserStorer.Save(u); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
			return
		}
	} else if linkAccount {
		errorResponse(c, http.StatusBadRequest, common.ErrUserExist)
		return
	}
	// User exist. TODO: Merge if link account?

	sessionInfo.Session.BindUser(u)

	if err = r.deps.SessionStorer.Save(sessionInfo.Session); err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
		return
	}

	if r.Config.CreateGuestUser && sessionInfo.UserIsGuest {
		if err := r.deps.Storage.UserRemover.RemoveByID(sessionInfo.UserID); err != nil {
			log.Printf("Failed delete guest user %v: %v", sessionInfo.UserID, err)
		}
	}

	c.Set(r.Config.ContextNames.Session, sessionInfo.Session)
	c.Set(r.Config.ContextNames.User, u)

	respMap := gin.H{
		"result": true,
	}

	if isNew {
		if r.hooks.AfterSocialSignUp != nil {
			r.hooks.AfterSocialSignUp(respMap, sessionInfo.Session, u, at.Key)
		}
	} else if r.hooks.AfterSocialSignIn != nil {
		r.hooks.AfterSocialSignIn(respMap, sessionInfo.Session, u, at.Key)
	}

	c.JSON(http.StatusOK, respMap)
}
