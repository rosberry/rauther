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
	"github.com/rosberry/rauther/storage"
	"github.com/rosberry/rauther/user"
	"golang.org/x/crypto/bcrypt"
)

func (r *Rauther) signUpHandler() gin.HandlerFunc {
	if !r.checker.PasswordAuthable {
		log.Print("Not implement PasswordAuthableUser interface")
		return nil
	}

	return func(c *gin.Context) {
		expectedTypeOfAuthType := authtype.Password
		at := r.types.Select(c, expectedTypeOfAuthType)
		if at == nil {
			log.Print("sign up handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		if at.Type != expectedTypeOfAuthType {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}

		request := clone(at.SignUpRequest).(authtype.AuthRequest)

		err := c.ShouldBindBodyWith(request, binding.JSON)
		if err != nil {
			log.Print("sign up handler:", err)
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		uid, password := request.GetUID(), request.GetPassword()

		if uid == "" || password == "" {
			log.Print("sign up handler: empty uid or password")
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
			log.Fatal("[signUpHandler] failed 'sess' type assertion to session.Session")
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

		u, err := r.deps.UserStorer.LoadByUID(at.Key, uid)
		if err == nil && u != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrUserExist)
			return
		}

		if r.Config.CreateGuestUser && currentUserIsGuest {
			u, _ = r.deps.UserStorer.LoadByID(currentUserID)
			u.(user.AuthableUser).SetUID(at.Key, uid)
			u.(user.GuestUser).SetGuest(false)
		} else {
			u = r.deps.UserStorer.Create()
			u.(user.AuthableUser).SetUID(at.Key, uid)
		}

		encryptedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			log.Print("encrypt password error:", err)
			errorResponse(c, http.StatusInternalServerError, common.ErrUnknownError)
		}

		u.(user.PasswordAuthableUser).SetPassword(at.Key, string(encryptedPassword))

		if _, ok := request.(authtype.AuhtRequestFieldable); ok {
			fields := request.(authtype.AuhtRequestFieldable).Fields()
			for fieldKey, fieldValue := range fields {
				err := user.SetFields(u, fieldKey, fieldValue)
				if err != nil {
					log.Printf("sign up: set fields %v: %v", fieldKey, err)
					errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

					return
				}
			}
		}

		if r.Modules.ConfirmableUser {
			confirmCode := generateConfirmCode()

			u.(user.ConfirmableUser).SetConfirmCode(at.Key, confirmCode)

			if r.checker.CodeSentTime && r.Modules.CodeSentTimeUser {
				curTime := time.Now()
				u.(user.CodeSentTimeUser).SetCodeSentTime(at.Key, &curTime)
			}

			err := sendConfirmCode(at.Sender, uid, confirmCode)
			if err != nil {
				log.Printf("failed send confirm code %v: %v", uid, err)
			}
		}

		if err = r.deps.UserStorer.Save(u); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
			return
		}

		sess.BindUser(u)

		err = r.deps.SessionStorer.Save(sess)
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
			return
		}

		c.Set(r.Config.ContextNames.Session, sess)
		c.Set(r.Config.ContextNames.User, u)

		c.JSON(http.StatusOK, gin.H{
			"result": true,
			"uid":    uid,
		})
	}
}

func (r *Rauther) signInHandler() gin.HandlerFunc {
	if !r.checker.PasswordAuthable {
		log.Print("Not implement PasswordAuthableUser interface")
		return nil
	}

	return func(c *gin.Context) {
		expectedTypeOfAuthType := authtype.Password
		at := r.types.Select(c, expectedTypeOfAuthType)
		if at == nil {
			log.Print("sign in handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		if at.Type != expectedTypeOfAuthType {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}

		request := clone(at.SignInRequest).(authtype.AuthRequest)

		err := c.ShouldBindBodyWith(request, binding.JSON)
		if err != nil {
			log.Print("sign in handler:", err)
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
			log.Fatal("[signInHandler] failed 'sess' type assertion to session.Session")
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

		uid, password := request.GetUID(), request.GetPassword()

		if uid == "" || password == "" {
			log.Print("sign in handler: empty uid or password")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		u, err := r.deps.UserStorer.LoadByUID(at.Key, uid)
		if err != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
			return
		}

		userPassword := u.(user.PasswordAuthableUser).GetPassword(at.Key)

		if !passwordCompare(password, userPassword) {
			errorResponse(c, http.StatusForbidden, common.ErrIncorrectPassword)
			return
		}

		sess.BindUser(u)

		if err = r.deps.SessionStorer.Save(sess); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
			return
		}

		if err = r.deps.UserStorer.Save(u); err != nil {
			errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
			return
		}

		if r.Config.CreateGuestUser && currentUserIsGuest {
			rmStorer, ok := r.deps.UserStorer.(storage.RemovableUserStorer)
			if !ok {
				log.Printf("[signInHandler] failed 'UserStorer' type assertion to storage.RemovableUserStorer")
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

func (r *Rauther) validateLoginField() gin.HandlerFunc {
	if !r.checker.PasswordAuthable {
		log.Print("Not implement PasswordAuthableUser interface")
		return nil
	}

	return func(c *gin.Context) {
		expectedTypeOfAuthType := authtype.Password
		at := r.types.Select(c, expectedTypeOfAuthType)
		if at == nil {
			log.Print("validate login field handler: not found auth type")
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		if at.Type != expectedTypeOfAuthType {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}

		request := clone(at.CheckUserExistsRequest).(authtype.CheckUserExistsRequest)

		err := c.ShouldBindBodyWith(request, binding.JSON)
		if err != nil {
			log.Print("validate login field handler:", err)
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		uid := request.GetUID()

		if uid == "" {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		u, err := r.deps.UserStorer.LoadByUID(at.Key, uid)
		if err == nil && u != nil {
			errorResponse(c, http.StatusBadRequest, common.ErrUserExist)

			return
		}

		c.JSON(http.StatusOK, gin.H{
			"result": true,
		})
	}
}
