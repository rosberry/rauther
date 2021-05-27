package models

import "github.com/rosberry/rauther"

// User model
type User struct {
	PID      string
	Password string
}

func (u *User) GetPID() (pid string) { return u.PID }
func (u *User) SetPID(pid string)    { u.PID = pid }

func (u *User) GetPassword() (password string) { return u.Password }
func (u *User) SetPassword(password string)    { u.Password = password }

type UserStorer struct {
	Users map[string]*User
}

func (s *UserStorer) LoadByPID(pid string) (user rauther.User, exist bool) {
	if user, ok := s.Users[pid]; ok {
		return user, true
	}

	u := &User{
		PID: pid,
	}

	s.Users[pid] = u

	return u, false
}

func (s *UserStorer) Save(user rauther.User) error {
	s.Users[user.GetPID()] = user.(*User)

	return nil
}
