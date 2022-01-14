package rauther

import (
	"errors"
	"fmt"

	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/user"
)

var (
	errUserAlreadyRegistered   = errors.New("user already registered")
	errCurrentUserNotConfirmed = errors.New("current user not confirmed")
	errAuthIdentityExists      = errors.New("auth identity already exists")
	errFailedLinkUser          = errors.New("failed to link user")
)

func (r *Rauther) initLinkAccount(sessionInfo sessionInfo, authKey string, uid string) (u user.User, err error) {
	err = r.checkUserCanLinkAccount(sessionInfo.User, authKey)
	if err != nil {
		return nil, err
	}

	u, err = r.deps.UserStorer.LoadByUID(authKey, uid)
	if err != nil {
		var customErr CustomError
		if errors.As(err, &customErr) {
			return nil, customErr
		}
	}

	// User not found
	if u == nil {
		u = r.deps.UserStorer.Create()
		u.(user.TempUser).SetTemp(true)
		u.(user.AuthableUser).SetUID(authKey, uid)
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

func (r *Rauther) checkUserCanLinkAccount(currentUser user.User, authKey string) error {
	if currentConfirmUser, ok := currentUser.(user.ConfirmableUser); ok && !currentConfirmUser.Confirmed() {
		return errCurrentUserNotConfirmed
	}

	if foundUID := currentUser.(user.AuthableUser).GetUID(authKey); foundUID != "" {
		return errAuthIdentityExists
	}

	return nil
}

func (r *Rauther) linkAccount(sessionInfo sessionInfo, linkingUser user.User, at *authtype.AuthMethod) error {
	err := r.checkUserCanLinkAccount(sessionInfo.User, at.Key)
	if err != nil {
		return err
	}

	switch {
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

	err = r.deps.UserRemover.RemoveByID(linkingUser.GetID())
	if err != nil {
		return fmt.Errorf("failed to remove user: %w", err)
	}

	return nil
}
