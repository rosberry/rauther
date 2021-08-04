package models

import (
	"errors"
	"log"

	"github.com/rosberry/rauther/user"
)

// User model
type User struct {
	PID      string
	Username string `auth:"username"`
	Password string
	Email    string `auth:"email"`
	Phone    string `auth:"phone"`

	FirstName string `auth:"fname"`
	LastName  string `auth:"lname"`

	ConfirmCode string
	Confirmed   bool
}

func (u *User) GetPID() (pid string) { return u.PID }
func (u *User) SetPID(pid string)    { u.PID = pid }

func (u *User) GetPassword() (password string) { return u.Password }
func (u *User) SetPassword(password string)    { u.Password = password }

func (u *User) GetEmail() (email string) { return u.Email }
func (u *User) SetEmail(email string)    { u.Email = email }

func (u *User) GetConfirmed() (ok bool)       { return u.Confirmed }
func (u *User) GetConfirmCode() (code string) { return u.ConfirmCode }

func (u *User) SetConfirmed(ok bool)       { u.Confirmed = ok }
func (u *User) SetConfirmCode(code string) { u.ConfirmCode = code }

func (u *User) SetRecoveryCode(code string)    { u.ConfirmCode = code }
func (u *User) GetRecoveryCode() (code string) { return u.ConfirmCode }

func (u *User) GetField(key string) (field interface{}, err error) {
	return user.GetField(u, key)
}

func (u *User) SetField(key string, value interface{}) error {
	return user.SetFields(u, key, value)
}

type UserStorer struct {
	Users map[string]*User
}

func (s *UserStorer) Load(pid string) (user user.User, err error) {
	if pid == "" {
		return nil, errors.New("User not found") // nolint:goerr113
	}

	if user, ok := s.Users[pid]; ok {
		for k, v := range s.Users {
			log.Printf("%v: %+v", k, v)
		}
		return user, nil
	}

	return nil, errors.New("User not found") // nolint:goerr113
}

func (s *UserStorer) Create(pid string) (user user.User) {
	u := &User{
		PID: pid,
	}

	s.Users[pid] = u

	return u
}

func (s *UserStorer) Save(user user.User) error {
	s.Users[user.GetPID()] = user.(*User)

	return nil
}
