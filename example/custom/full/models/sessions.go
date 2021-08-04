package models

import (
	"github.com/rosberry/rauther/session"
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

func (s *Sessioner) FindByToken(token string) session.Session {
	for _, sess := range s.Sessions {
		if sess.Token == token {
			return sess
		}
	}

	return nil
}

func (s *Sessioner) Save(sess session.Session) error {
	session := sess.(*Session)
	s.Sessions[session.GetID()] = session

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
