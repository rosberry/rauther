package rauther

// Definition of session interface
// Session interface
type Session interface {
	GetID() (id string)
	GetToken() (token string)

	SetID(id string)
	SetToken(token string)
}
