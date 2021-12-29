package rauther

import (
	"errors"
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

func (r *Rauther) signUpHandler(c *gin.Context) {
	at, ok := r.findAuthMethod(c, authtype.Password)
	if !ok {
		log.Print("not found expected auth method")
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

	sessionInfo, success := r.checkSession(c)
	if !success {
		return
	}

	var u user.User

	var linkAccount bool

	if sessionInfo.User != nil && !sessionInfo.UserIsGuest {
		if !r.Modules.LinkAccount {
			errorResponse(c, http.StatusBadRequest, common.ErrAlreadyAuth)
			return
		}

		u, err = r.initAccountLinking(c, sessionInfo, at.Key, uid)
		if err != nil {
			// TODO: Error handling
			log.Print(err)
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

			return
		}

		linkAccount = true
	}

	if u == nil {
		u, err = r.deps.UserStorer.LoadByUID(at.Key, uid)
		if err != nil {
			log.Print(err)
			var customErr CustomError
			if errors.As(err, &customErr) {
				customErrorResponse(c, customErr)
				return
			}
		}

		if u != nil {
			if tempUser, ok := u.(user.TempUser); !ok || !tempUser.IsTemp() {
				errorResponse(c, http.StatusBadRequest, common.ErrUserExist)
				return
			}

			var removeUserID interface{}

			if u.(user.GuestUser).IsGuest() {
				sessionInfo.User.(user.AuthableUser).SetUID(at.Key, uid)
				sessionInfo.User.(user.GuestUser).SetGuest(false)

				removeUserID = u.GetID()

				u = sessionInfo.User
			} else {
				removeUserID = sessionInfo.UserID
			}

			u.(user.TempUser).SetTemp(false)

			err := r.deps.Storage.UserRemover.RemoveByID(removeUserID)
			if err != nil {
				log.Printf("Failed delete guest user %v: %v", sessionInfo.UserID, err)
			}
		} else {
			if r.Modules.GuestUser && sessionInfo.UserIsGuest {
				u, _ = r.deps.UserStorer.LoadByID(sessionInfo.UserID)
				u.(user.GuestUser).SetGuest(false)
			} else {
				u = r.deps.UserStorer.Create()
			}
		}
	}

	u.(user.AuthableUser).SetUID(at.Key, uid)

	encryptedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Print("encrypt password error:", err)
		errorResponse(c, http.StatusInternalServerError, common.ErrUnknownError)

		return
	}

	u.(user.PasswordAuthableUser).SetPassword(at.Key, string(encryptedPassword))

	if fieldableRequest, ok := request.(authtype.AuthRequestFieldable); ok {
		if ok := r.fillFields(fieldableRequest, u); !ok {
			errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)
			return
		}
	}

	if r.Modules.ConfirmableUser {
		confirmCode := r.generateCode(at)

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

	if !linkAccount {
		sessionInfo.Session.BindUser(u)
		c.Set(r.Config.ContextNames.User, u)
	}

	c.Set(r.Config.ContextNames.Session, sessionInfo.Session)

	err = r.deps.SessionStorer.Save(sessionInfo.Session)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
		return
	}

	respMap := gin.H{
		"result": true,
		"uid":    uid,
	}

	if r.hooks.AfterPasswordSignUp != nil {
		r.hooks.AfterPasswordSignUp(respMap, sessionInfo.Session, u, at.Key)
	}

	c.JSON(http.StatusOK, respMap)
}

func (r *Rauther) signInHandler(c *gin.Context) {
	at, ok := r.findAuthMethod(c, authtype.Password)
	if !ok {
		log.Print("not found expected auth method")
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

	sessionInfo, success := r.checkSession(c)
	if !success {
		return
	}

	if sessionInfo.User != nil && !sessionInfo.UserIsGuest {
		errorResponse(c, http.StatusBadRequest, common.ErrAlreadyAuth)
		return
	}

	uid, password := request.GetUID(), request.GetPassword()

	if uid == "" || password == "" {
		log.Print("sign in handler: empty uid or password")
		errorResponse(c, http.StatusBadRequest, common.ErrInvalidRequest)

		return
	}

	u, err := r.deps.UserStorer.LoadByUID(at.Key, uid)
	if err != nil {
		log.Print(err)
		var customErr CustomError
		if errors.As(err, &customErr) {
			customErrorResponse(c, customErr)
			return
		}
	}

	if u == nil {
		errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
		return
	}

	if tempUser, ok := u.(user.TempUser); ok && tempUser.IsTemp() {
		// TODO: Correct error about user is temporary?
		errorResponse(c, http.StatusBadRequest, common.ErrUserNotFound)
		return
	}

	userPassword := u.(user.PasswordAuthableUser).GetPassword(at.Key)

	if !passwordCompare(password, userPassword) {
		errorResponse(c, http.StatusForbidden, common.ErrIncorrectPassword)
		return
	}

	sessionInfo.Session.BindUser(u)

	if err = r.deps.SessionStorer.Save(sessionInfo.Session); err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrSessionSave)
		return
	}

	if err = r.deps.UserStorer.Save(u); err != nil {
		errorResponse(c, http.StatusInternalServerError, common.ErrUserSave)
		return
	}

	if r.Modules.GuestUser && sessionInfo.UserIsGuest {
		err := r.deps.Storage.UserRemover.RemoveByID(sessionInfo.UserID)
		if err != nil {
			log.Printf("Failed delete guest user %v: %v", sessionInfo.UserID, err)
		}
	}

	c.Set(r.Config.ContextNames.Session, sessionInfo.Session)
	c.Set(r.Config.ContextNames.User, u)

	respMap := gin.H{
		"result": true,
	}

	if r.hooks.AfterPasswordSignIn != nil {
		r.hooks.AfterPasswordSignIn(respMap, sessionInfo.Session, u, at.Key)
	}

	c.JSON(http.StatusOK, respMap)
}

func (r *Rauther) validateLoginField(c *gin.Context) {
	at, ok := r.findAuthMethod(c, authtype.Password)
	if !ok {
		log.Print("not found expected auth method")
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
	if err != nil {
		log.Print(err)
		var customErr CustomError
		if errors.As(err, &customErr) {
			customErrorResponse(c, customErr)
			return
		}
	} else if u != nil {
		errorResponse(c, http.StatusBadRequest, common.ErrUserExist)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"result": true,
	})
}
