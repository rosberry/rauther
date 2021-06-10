package models

import (
	"errors"

	"github.com/rosberry/rauther"
)

// User model
type User struct {
	PID      string
	Password string
	Email    string

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

type UserStorer struct {
	Users map[string]*User
}

func (s *UserStorer) Load(pid string) (user rauther.User, err error) {
	if user, ok := s.Users[pid]; ok {
		return user, nil
	}

	return nil, errors.New("User not found") // nolint:goerr113
}

func (s *UserStorer) Create(pid string) (user rauther.User) {
	u := &User{
		PID: pid,
	}

	s.Users[pid] = u

	return u
}

func (s *UserStorer) Save(user rauther.User) error {
	s.Users[user.GetPID()] = user.(*User)

	return nil
}
