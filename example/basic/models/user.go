package models

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/rosberry/rauther/user"
)

// User model
type (
	User struct {
		ID uint `json:"id"`

		Auths map[string]AuthIdentities `json:"auths"`

		Username string `auth:"username" json:"username"`
		Password string `json:"password"`

		Guest bool   `json:"guest"`
		Email string `auth:"email"`

		FirstName string `auth:"fname" json:"firstName"`
		LastName  string `auth:"lname" json:"lastName"`

		RecoveryCode         string       `json:"recoveryCode"`
		LastConfirmationTime sql.NullTime `json:"lastConfirmationTime"`
	}

	AuthIdentities struct {
		Type        string `json:"type"`
		UID         string `json:"uid"`
		ConfirmCode string `json:"confirmCode"`
		Confirmed   bool   `json:"confirmed"`
	}
)

func (u *User) GetUID(authType string) (uid string) {
	if at, ok := u.Auths[authType]; ok {
		return at.UID
	}

	return "" // FIXME: return error?
}

func (u *User) SetUID(authType, uid string) {
	u.Auths[authType] = AuthIdentities{
		Type: authType,
		UID:  uid,
	}
}

func (u *User) GetPassword() (password string) { return u.Password }
func (u *User) SetPassword(password string)    { u.Password = password }

func (u *User) Confirmed() (ok bool) {
	for _, at := range u.Auths {
		if at.Confirmed {
			return true
		}
	}

	return false
}

func (u *User) GetConfirmed(authType string) (ok bool) {
	return u.Auths[authType].Confirmed
}

func (u *User) GetConfirmCode(authType string) (code string) {
	return u.Auths[authType].ConfirmCode
}

func (u *User) SetConfirmed(authType string, ok bool) {
	at := u.Auths[authType]
	at.Confirmed = ok
	u.Auths[authType] = at
}

func (u *User) SetConfirmCode(authType, code string) {
	at := u.Auths[authType]
	at.ConfirmCode = code
	u.Auths[authType] = at
}

func (u *User) SetConfirmationCodeSentTime(authType string, t *time.Time) {
	if t != nil {
		u.LastConfirmationTime.Time = *t
		u.LastConfirmationTime.Valid = true
	} else {
		u.LastConfirmationTime.Valid = false
	}
}

func (u *User) GetConfirmationCodeSentTime(authType string) *time.Time {
	if !u.LastConfirmationTime.Valid {
		return nil
	}

	return &u.LastConfirmationTime.Time
}

func (u *User) SetRecoveryCode(code string) {
	u.RecoveryCode = code
}

func (u *User) GetRecoveryCode() (code string) {
	return u.RecoveryCode
}

func (u *User) GetField(key string) (field interface{}, err error) {
	return user.GetField(u, key) // nolint
}

func (u *User) SetField(key string, value interface{}) error {
	return user.SetFields(u, key, value) // nolint
}

func (u *User) IsGuest() bool {
	return u.Guest
}

func (u *User) SetGuest(guest bool) {
	u.Guest = guest
}

type UserStorer struct {
	Users map[uint]*User
}

func (s *UserStorer) LoadByUID(authType, uid string) (user user.User, err error) {
	log.Printf("[LoadByUID] type: %s uid: %s", authType, uid)

	for _, u := range s.Users {
		if at, ok := u.Auths[authType]; ok {
			log.Printf("[LoadByUID] Found authtype. UID is '%v'", at.UID)

			if at.UID == uid {
				log.Printf("[LoadByUID] at.UID == uid")
				return u, nil
			} else {
				log.Printf("[LoadByUID] at.UID != uid")
			}
		}
	}

	return nil, fmt.Errorf("User not found by type and uid: %v %v", authType, uid) // nolint:goerr113
}

func (s *UserStorer) LoadByID(id interface{}) (user user.User, err error) {
	userID, ok := id.(uint)
	if !ok {
		return nil, errors.New("id must be uint") //nolint
	}

	if user, ok := s.Users[userID]; ok {
		for k, v := range s.Users {
			log.Printf("%v: %+v", k, v)
		}

		return user, nil
	}

	return nil, fmt.Errorf("User not found by id: %v", id) // nolint:goerr113
}

func (s *UserStorer) Create() (user user.User) {
	rand.Seed(time.Now().Unix())

	u := &User{
		ID:    uint(rand.Uint64()),
		Auths: map[string]AuthIdentities{},
	}

	return u
}

func (s *UserStorer) Save(u user.User) error {
	user, ok := u.(*User)
	if !ok {
		return errors.New("failed user interface assertion to user model") //nolint
	}

	s.Users[user.ID] = user

	return nil
}

// Removable

func (s *UserStorer) RemoveByUID(authType, uid string) error {
	u, err := s.LoadByUID(authType, uid)
	if err != nil {
		return err
	}

	user, ok := u.(*User)
	if !ok {
		return fmt.Errorf("Failed user type assertion")
	}

	delete(s.Users, user.ID)

	return nil
}

func (s *UserStorer) RemoveByID(id interface{}) error {
	delete(s.Users, id.(uint))

	return nil
}
