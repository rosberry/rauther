package rauther_test

import (
	"errors"

	"github.com/rosberry/rauther"
)

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
}

func (s *Session) GetID() (id string)       { return s.SessionID }
func (s *Session) GetToken() (token string) { return s.Token }

func (s *Session) SetID(id string)       { s.SessionID = id }
func (s *Session) SetToken(token string) { s.Token = token }
