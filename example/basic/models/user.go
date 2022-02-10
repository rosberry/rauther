package models

import (
	"errors"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/rosberry/rauther/user"
	"github.com/rs/zerolog/log"
)

// User model
type (
	User struct {
		ID uint `json:"id"`

		Auths map[string]AuthIdentities `json:"auths"`

		Username string `auth:"username" json:"username"`

		Guest bool   `json:"guest"`
		Email string `auth:"email"`

		FirstName string `auth:"fname" json:"firstName"`
		LastName  string `auth:"lname" json:"lastName"`

		Temp bool `json:"-"`
	}

	AuthIdentities struct {
		Type         string     `json:"type"`
		UID          string     `json:"uid"`
		Password     string     `json:"password"`
		ConfirmCode  string     `json:"confirmCode"`
		RecoveryCode string     `json:"recoveryCode"`
		Confirmed    bool       `json:"confirmed"`
		SentAt       *time.Time `json:"sentAt"`
	}
)

func (u *User) GetID() interface{} {
	return u.ID
}

func (u *User) GetUID(authType string) (uid string) {
	if at, ok := u.Auths[authType]; ok {
		return at.UID
	}

	return ""
}

func (u *User) SetUID(authType, uid string) {
	u.Auths[authType] = AuthIdentities{
		Type: authType,
		UID:  uid,
	}
}

func (u *User) GetPassword(authType string) (password string) {
	if at, ok := u.Auths[authType]; ok {
		return at.Password
	}

	return u.Auths[authType].Password
}

func (u *User) SetPassword(authType, password string) {
	if at, ok := u.Auths[authType]; ok {
		at.Password = password
		u.Auths[authType] = at
	}
}

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

func (u *User) SetCodeSentTime(authType string, t *time.Time) {
	at := u.Auths[authType]
	at.SentAt = t
	u.Auths[authType] = at
}

func (u *User) GetCodeSentTime(authType string) *time.Time {
	return u.Auths[authType].SentAt
}

func (u *User) SetRecoveryCode(authType, code string) {
	at := u.Auths[authType]
	at.RecoveryCode = code
	u.Auths[authType] = at
}

func (u *User) GetRecoveryCode(authType string) (code string) {
	return u.Auths[authType].RecoveryCode
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

func (u *User) GetOTP(authType string) (code string) {
	return u.Auths[authType].Password
}

func (u *User) SetOTP(authType string, code string) error {
	at := u.Auths[authType]
	at.Password = code
	u.Auths[authType] = at

	return nil
}

func (u *User) IsTemp() bool {
	return u.Temp
}

func (u *User) SetTemp(temp bool) {
	u.Temp = temp
}

type UserStorer struct {
	mu    sync.RWMutex
	Users map[uint]*User
}

func (s *UserStorer) LoadByUID(authType, uid string) (user user.User, err error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for key, u := range s.Users {
		if ai, ok := u.Auths[authType]; ok {
			if ai.UID == uid {
				user := *s.Users[key]
				auths := make(map[string]AuthIdentities)

				for sKey, baseAI := range user.Auths {
					auths[sKey] = baseAI
				}
				user.Auths = auths

				return &user, nil
			}
		}
	}

	return nil, fmt.Errorf("User not found by type and uid: %v %v", authType, uid) // nolint:goerr113
}

// GetUserIDByUID returns user id by uid without mutex lock
func (s *UserStorer) GetUserIDByUID(authType, uid string) (userID uint, err error) {
	for _, u := range s.Users {
		if ai, ok := u.Auths[authType]; ok {
			if ai.UID == uid {
				return u.ID, nil
			}
		}
	}

	return 0, fmt.Errorf("User not found by type and uid: %v %v", authType, uid) // nolint:goerr113
}

func (s *UserStorer) LoadByID(id interface{}) (user user.User, err error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	userID, ok := id.(uint)
	if !ok {
		return nil, errors.New("id must be uint") //nolint
	}

	if u, ok := s.Users[userID]; ok {
		user := *u
		auths := make(map[string]AuthIdentities)

		for sKey, baseAI := range user.Auths {
			auths[sKey] = baseAI
		}
		user.Auths = auths

		return &user, nil
	}

	return nil, fmt.Errorf("User not found by id: %v", id) // nolint:goerr113
}

func (s *UserStorer) Create() (user user.User) {
	u := &User{
		ID:    uint(rand.Uint64()), // nolint
		Auths: map[string]AuthIdentities{},
	}

	return u
}

func (s *UserStorer) Save(u user.User) error {
	user, ok := u.(*User)
	if !ok {
		return errors.New("failed user interface assertion to user model") //nolint
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for sKey, baseAI := range user.Auths {
		log.Debug().Uint("ID", user.ID).Str("auth type", sKey).Interface("auth", baseAI).Msg("[dbg]")
		userID, err := s.GetUserIDByUID(sKey, baseAI.UID)

		if err == nil && userID != user.ID {
			return errors.New("duplicate auth identity") // nolint
		}
	}

	s.Users[user.ID] = user

	return nil
}

// Removable

func (s *UserStorer) RemoveByUID(authType, uid string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	u, err := s.LoadByUID(authType, uid)
	if err != nil {
		return err
	}

	user, ok := u.(*User)
	if !ok {
		return fmt.Errorf("Failed user type assertion") // nolint
	}

	delete(s.Users, user.ID)

	return nil
}

func (s *UserStorer) RemoveByID(id interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.Users, id.(uint))

	for k, u := range s.Users {
		log.Info().Interface(fmt.Sprintf("%v", k), u).Msg("")
	}

	return nil
}
