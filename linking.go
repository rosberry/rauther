package rauther

import (
	"errors"
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/user"
)

var (
	errUserAlreadyRegistered   = errors.New("user already registered")
	errCurrentUserNotConfirmed = errors.New("current user not confirmed")
	errAuthIdentityExists      = errors.New("auth identity already exists")
)

// FIXME: Not sessionInfo as argument?
func (r *Rauther) initAccountLinking(c *gin.Context, sessionInfo sessionInfo, authKey string, uid string) (u user.User, err error) {
	if currentConfirmUser, ok := sessionInfo.User.(user.ConfirmableUser); ok && !currentConfirmUser.Confirmed() {
		return nil, errCurrentUserNotConfirmed
	}

	if foundUID := sessionInfo.User.(user.AuthableUser).GetUID(authKey); foundUID != "" {
		return nil, errAuthIdentityExists
	}

	u, _ = r.deps.UserStorer.LoadByUID(authKey, uid)

	// User not found
	if u == nil {
		u = r.deps.UserStorer.Create()
		u.(user.TempUser).SetTemp(true)
	}

	// User found
	// User !temp
	if !u.(user.TempUser).IsTemp() {
		// Linked user not temp
		// TODO: Merge users
		return nil, errUserAlreadyRegistered
	}

	return u, nil
}

var errFailedLinkUser = errors.New("failed to link user")

func (r *Rauther) linkAccount(c *gin.Context, linkingUser user.User, at *authtype.AuthMethod) error {
	sessionInfo, success := r.checkSession(c)

	switch {
	case !success:
		return errFailedLinkUser
	case sessionInfo.User == nil:
		return errFailedLinkUser
	case sessionInfo.UserIsGuest:
		return errFailedLinkUser
	}

	uid := linkingUser.(user.AuthableUser).GetUID(at.Key)
	if uid == "" {
		return errFailedLinkUser
	}

	sessionInfo.User.(user.AuthableUser).SetUID(at.Key, uid)

	if at.Type == authtype.Password {
		password := linkingUser.(user.PasswordAuthableUser).GetPassword(at.Key)
		sessionInfo.User.(user.PasswordAuthableUser).SetPassword(at.Key, password)
	}

	if confirmableUser, ok := linkingUser.(user.ConfirmableUser); ok {
		confirmed := confirmableUser.GetConfirmed(at.Key)
		sessionInfo.User.(user.ConfirmableUser).SetConfirmed(at.Key, confirmed)
	}

	err := r.deps.UserRemover.RemoveByID(linkingUser.GetID())
	if err != nil {
		return fmt.Errorf("failed to remove user: %w", err)
	}

	return nil
}
