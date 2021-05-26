package models

import "github.com/rosberry/rauther"

type Sessioner struct {
	Sessions map[string]*Session
}

func (s *Sessioner) LoadByID(id string) rauther.Session {
	if sess, ok := s.Sessions[id]; ok {
		return sess
	}

	s.Sessions[id] = &Session{
		SessionID: id,
	}

	return s.Sessions[id]
}

func (s *Sessioner) FindByToken(token string) rauther.Session {
	for _, sess := range s.Sessions {
		if sess.Token == token {
			return sess
		}
	}

	return nil
}

func (s *Sessioner) Save(session rauther.Session) error {
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
