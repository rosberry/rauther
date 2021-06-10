package rauther_test

import (
	"errors"

	"github.com/rosberry/rauther"
)

// sessionStorer
// Helper for test
type sessionStorer struct {
	Sessions map[string]*Session
}

func (s *sessionStorer) LoadByID(id string) rauther.Session {
	if id == "nil" {
		return nil
	}

	if sess, ok := s.Sessions[id]; ok {
		return sess
	}

	s.Sessions[id] = &Session{
		SessionID: id,
	}

	return s.Sessions[id]
}

func (s *sessionStorer) FindByToken(token string) rauther.Session {
	for _, sess := range s.Sessions {
		if sess.Token == token {
			return sess
		}
	}

	return nil
}

func (s *sessionStorer) Save(session rauther.Session) error {
	if session.GetID() == "error_session" {
		return errors.New("some error")
	}

	s.Sessions[session.GetID()] = session.(*Session)

	return nil
}

type Session struct {
	SessionID string
	Token     string
	UserPID   string
}

func (s *Session) GetID() (id string)       { return s.SessionID }
func (s *Session) GetToken() (token string) { return s.Token }
func (s *Session) GetUserPID() (pid string) { return s.UserPID }

func (s *Session) SetID(id string)       { s.SessionID = id }
func (s *Session) SetToken(token string) { s.Token = token }
func (s *Session) SetUserPID(pid string) { s.UserPID = pid }

// userStorer
// Helper for test

type userStorer struct {
	Users map[string]*User
}

func (s *userStorer) Load(pid string) (user rauther.User, err error) {
	if user, ok := s.Users[pid]; ok {
		return user, nil
	}

	return nil, errors.New("User not found")
}

func (s *userStorer) Create(pid string) (user rauther.User) {
	u := &User{
		PID: pid,
	}

	s.Users[pid] = u

	return u
}

func (s *userStorer) Save(user rauther.User) error {
	s.Users[user.GetPID()] = user.(*User)

	return nil
}

type User struct {
	PID      string
	Password string
}

func (u *User) GetPID() (pid string)           { return u.PID }
func (u *User) SetPID(pid string)              { u.PID = pid }
func (u *User) GetPassword() (password string) { return u.Password }
func (u *User) SetPassword(password string)    { u.Password = password }
