package models

import (
	"fmt"
	"log"

	"github.com/rosberry/rauther/session"
	"github.com/rosberry/rauther/user"
)

type Sessioner struct {
	Sessions map[string]*Session
}

func (s *Sessioner) LoadByID(id string) session.Session {
	if sess, ok := s.Sessions[id]; ok {
		return sess
	}

	s.Sessions[id] = &Session{
		SessionID: id,
	}

	return s.Sessions[id]
}

func (s *Sessioner) RemoveByID(id string) error {
	if _, ok := s.Sessions[id]; !ok {
		return fmt.Errorf("session not found") // nolint:goerr113
	}

	delete(s.Sessions, id)

	return nil
}

func (s *Sessioner) FindByToken(token string) session.Session {
	for _, sess := range s.Sessions {
		if sess.Token == token {
			return sess
		}
	}

	return nil
}

func (s *Sessioner) Save(sess session.Session) error {
	session, ok := sess.(*Session)
	if !ok {
		return fmt.Errorf("failed session type assertion") // nolint:goerr113
	}

	s.Sessions[session.GetID()] = session

	return nil
}

type Session struct {
	SessionID string
	Token     string
	UserID    uint
}

func (s *Session) GetID() (id string)       { return s.SessionID }
func (s *Session) GetToken() (token string) { return s.Token }
func (s *Session) GetUserID() (userID interface{}) {
	if s.UserID == 0 {
		return nil
	}

	return s.UserID
}

func (s *Session) SetID(id string)       { s.SessionID = id }
func (s *Session) SetToken(token string) { s.Token = token }
func (s *Session) BindUser(u user.User) {
	user, ok := u.(*User)
	if !ok {
		log.Printf("failed user type assertion")
	}

	s.UserID = user.ID
}

func (s *Session) UnbindUser() {
	s.UserID = 0
}
