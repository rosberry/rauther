package rauther

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/common"
	"github.com/rosberry/rauther/session"
	"github.com/rosberry/rauther/user"
)

func (r *Rauther) authHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		type authRequest struct {
			DeviceID string `json:"device_id"`
		}

		var request authRequest

		err := c.Bind(&request)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}

		sessionID := request.DeviceID
		if sessionID == "" {
			sessionID = generateSessionID()
		}

		session := r.deps.SessionStorer.LoadByID(sessionID)
		if session == nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionLoad)
			return
		}

		if userID := session.GetUserID(); userID != nil {
			if u, err := r.deps.UserStorer.LoadByID(userID); err == nil && u != nil {
				if !u.(user.GuestUser).IsGuest() {
					session.UnbindUser()
				}
			}
		}

		// Create new guest user if it enabled in config
		if r.Modules.PasswordAuthableUser && r.Config.CreateGuestUser && session.GetUserID() == nil {
			user, errType := r.createGuestUser()
			if errType != 0 {
				errorResponse(c, http.StatusInternalServerError, errType)
				return
			}

			session.BindUser(user)
		}

		session.SetToken(generateSessionToken())

		err = r.deps.SessionStorer.Save(session)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
			return
		}

		respMap := gin.H{
			"result":    true,
			"device_id": sessionID,
			"token":     session.GetToken(),
		}

		if r.hooks.AfterAuth != nil {
			r.hooks.AfterAuth(respMap, session)
		}

		c.JSON(http.StatusOK, respMap)
	}
}

type sessionInfo struct {
	Session     session.Session
	User        user.User
	UserID      interface{}
	UserIsGuest bool
}

// Check user in current session
func (r *Rauther) checkSession(c *gin.Context) (info sessionInfo, success bool) {
	s, ok := c.Get(r.Config.ContextNames.Session)
	if !ok {
		errorResponse(c, http.StatusUnauthorized, common.ErrNotAuth)
		return
	}

	sess, ok := s.(session.Session)
	if !ok {
		log.Fatal("failed 'sess' type assertion to session.Session")
		errorResponse(c, http.StatusUnauthorized, common.ErrNotAuth)

		return
	}

	var currentUserIsGuest bool

	currentUserID := sess.GetUserID()
	if currentUserID != nil {
		currentUser, _ := r.deps.UserStorer.LoadByID(currentUserID)

		if currentUser != nil && r.Config.CreateGuestUser {
			currentUserIsGuest = currentUser.(user.GuestUser).IsGuest()
		}

		return sessionInfo{
			Session:     sess,
			User:        currentUser,
			UserID:      currentUserID,
			UserIsGuest: currentUserIsGuest,
		}, true
	}

	return sessionInfo{
		Session:     sess,
		User:        nil,
		UserID:      currentUserID,
		UserIsGuest: currentUserIsGuest,
	}, true
}
