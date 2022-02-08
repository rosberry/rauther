package rauther

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"

	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/user"
)

var (
	errUserAlreadyRegistered   = errors.New("user already registered")
	errCurrentUserNotConfirmed = errors.New("current user not confirmed")
	errAuthIdentityExists      = errors.New("auth identity already exists")
	errFailedLinkUser          = errors.New("failed to link user")
	errMergeWarning            = errors.New("merge warning")
	errAuthMethodExist         = errors.New("auth method already exists")
	errAuthMethodNotConfirmed  = errors.New("auth method not confirmed")
	errCannotMergeSelf         = errors.New("cannot merge self")
)

func (r *Rauther) initLinkAccount(sessionInfo sessionInfo, authKey string, uid string) (u user.User, err error) {
	err = r.checkUserCanLinkAccount(sessionInfo.User, authKey, uid)
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
		if !r.Modules.MergeAccount {
			return nil, errUserAlreadyRegistered
		}

		fmt.Printf("Current session user id: %d, user id to merge: %d\n")
		if u.GetID() == sessionInfo.User.GetID() {
			return nil, errCannotMergeSelf
		}
	}

	return u, nil
}

func (r *Rauther) checkUserCanLinkAccount(currentUser user.User, authKey, uid string) error {
	if currentConfirmUser, ok := currentUser.(user.ConfirmableUser); ok && !currentConfirmUser.Confirmed() {
		return errCurrentUserNotConfirmed
	}

	if foundUID := currentUser.(user.AuthableUser).GetUID(authKey); foundUID != "" {
		if foundUID == uid {
			return errCannotMergeSelf
		}
		return errAuthIdentityExists
	}

	return nil
}

func (r *Rauther) linkAccount(sessionInfo sessionInfo, link user.User, at *authtype.AuthMethod, mergeConfirm bool) error {
	uid := link.(user.AuthableUser).GetUID(at.Key)

	err := r.checkUserCanLinkAccount(sessionInfo.User, at.Key, uid)
	if err != nil {
		return err
	}

	switch {
	case sessionInfo.User == nil:
		return errFailedLinkUser
	case sessionInfo.UserIsGuest:
		return errFailedLinkUser
	}

	if uid == "" {
		return errFailedLinkUser
	}

	if !link.(user.TempUser).IsTemp() {
		if r.Modules.MergeAccount {
			err = r.mergeUsers(sessionInfo.User, link, mergeConfirm)
			if err != nil {
				return fmt.Errorf("merge error: %w", err)
			}

			return nil
		}

		return errUserAlreadyRegistered
	}

	sessionInfo.User.(user.AuthableUser).SetUID(at.Key, uid)

	if at.Type == authtype.Password {
		password := link.(user.PasswordAuthableUser).GetPassword(at.Key)
		sessionInfo.User.(user.PasswordAuthableUser).SetPassword(at.Key, password)
	}

	if confirmableUser, ok := link.(user.ConfirmableUser); ok {
		confirmed := confirmableUser.GetConfirmed(at.Key)
		sessionInfo.User.(user.ConfirmableUser).SetConfirmed(at.Key, confirmed)
	}

	err = r.deps.UserRemover.RemoveByID(link.GetID())
	if err != nil {
		return fmt.Errorf("failed to remove user: %w", err)
	}

	return nil
}

func (r *Rauther) mergeUsers(current, link user.User, mergeConfirm bool) error {
	// move all auth identities from link user to current user
	err := r.moveAuthIdentities(current, link, mergeConfirm)
	if err != nil {
		return fmt.Errorf("failed to move auth identities: %w", err)
	}

	if !mergeConfirm {
		return newMergeError(nil)
	}

	err = current.(user.MergeUser).Merge(link)
	if err != nil {
		return fmt.Errorf("failed to run merge function: %w", err)
	}

	err = r.deps.UserRemover.RemoveByID(link.GetID())
	if err != nil {
		return fmt.Errorf("failed to remove user: %w", err)
	}

	return nil
}

func (r *Rauther) moveAuthIdentities(current, link user.User, mergeConfirm bool) error {
	failedMethods := []authDescrip{}

	for key, at := range r.methods.List {
		uid := link.(user.AuthableUser).GetUID(key)
		if uid == "" {
			continue
		}

		if current.(user.AuthableUser).GetUID(key) != "" {
			log.Printf("Skip auth method %q: current type exists in current user", key)

			failedMethods = append(failedMethods, authDescrip{
				Key: key,
				UID: uid,
				Err: errAuthMethodExist,
			})

			continue
		}

		// It is expected that all auth identities are already confirmed,
		// but we check it twice, if the linking process changes
		if !link.(user.ConfirmableUser).GetConfirmed(key) {
			log.Printf("Skip move unconfirmed auth method %q: %s", key, uid)

			failedMethods = append(failedMethods, authDescrip{
				Key: key,
				UID: uid,
				Err: errAuthMethodNotConfirmed,
			})

			continue
		}

		if mergeConfirm {
			switch at.Type {
			case authtype.Password:
				password := link.(user.PasswordAuthableUser).GetPassword(key)

				current.(user.PasswordAuthableUser).SetUID(key, uid)
				current.(user.PasswordAuthableUser).SetPassword(key, password)
			case authtype.Social:
				current.(user.AuthableUser).SetUID(key, uid)
			case authtype.OTP:
				current.(user.AuthableUser).SetUID(key, uid)
			default:
				log.Printf("unknown auth type: %v", at.Type)
			}

			if r.Modules.ConfirmableUser {
				current.(user.ConfirmableUser).SetConfirmed(key,
					link.(user.ConfirmableUser).GetConfirmed(key),
				)
			}
		}
	}

	if len(failedMethods) > 0 && !mergeConfirm {
		return newMergeError(failedMethods)
	}

	return nil
}

type (
	MergeError struct {
		e                 error
		removeAuthMethods []authDescrip
	}

	authDescrip struct {
		Key string `json:"type"`
		UID string `json:"uid"`
		Err error  `json:"err"`
	}
)

func newMergeError(authMethods []authDescrip) MergeError {
	return MergeError{
		e:                 errMergeWarning,
		removeAuthMethods: authMethods,
	}
}

func (err MergeError) MarshalJSON() ([]byte, error) {
	type lostAuth struct {
		Type  string `json:"type"`
		UID   string `json:"uid"`
		Error string `json:"error"`
	}

	lostAuths := make([]lostAuth, len(err.removeAuthMethods))

	for i := range err.removeAuthMethods {
		lostAuths[i] = lostAuth{
			Type:  err.removeAuthMethods[i].Key,
			UID:   err.removeAuthMethods[i].UID,
			Error: err.removeAuthMethods[i].Err.Error(),
		}
	}

	return json.Marshal(lostAuths)
}

func (err MergeError) Error() string {
	return fmt.Sprintf("merge error: %s", err.e.Error())
}
