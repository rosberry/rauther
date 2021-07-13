package authtype

// Own package ?

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/sender"
	"github.com/rosberry/rauther/user"
)

type (
	AuthType struct {
		Key    string
		Sender sender.Sender

		SignUpRequest SignUpRequest
		SignInRequest SignUpRequest
	}

	List map[string]AuthType

	AuthTypes struct {
		list     List
		Selector Selector
	}

	Selector func(c *gin.Context) (senderKey string)
)

type (
	SignUpRequest interface {
		GetPID() (pid string)
		GetPassword() (password string)
	}

	SignUpContactableRequest interface {
		SignUpRequest

		Fields() map[string]string
	}
)

func New(selector Selector) *AuthTypes {
	authTypes := &AuthTypes{
		list:     make(List),
		Selector: DefaultSelector,
	}

	if selector != nil {
		authTypes.Selector = selector
	}

	return authTypes
}

func (a *AuthTypes) Add(key string, sender sender.Sender, signUpRequest, signInRequest SignUpRequest) *AuthTypes {
	if a == nil {
		log.Fatal("auth types is nil")
	}

	if signUpRequest == nil {
		signUpRequest = &SignUpRequestByEmail{}
	}

	if signInRequest == nil {
		signInRequest = &SignUpRequestByEmail{}
	}

	t := AuthType{
		Key:           key,
		Sender:        sender,
		SignUpRequest: signUpRequest,
		SignInRequest: signInRequest,
	}

	a.list[key] = t

	return a
}

func (a *AuthTypes) IsEmpty() bool {
	return len(a.list) == 0
}

func (a *AuthTypes) Select(c *gin.Context) *AuthType {
	if a == nil {
		log.Fatal("AuthTypes is nil")
	}

	if a.Selector == nil {
		a.Selector = DefaultSelector
	}

	key := a.Selector(c)

	if at, ok := a.list[key]; ok {
		return &at
	}

	if len(a.list) == 1 {
		for _, at := range a.list {
			return &at
		}
	}

	return nil
}

func (a *AuthTypes) Valid(u user.User) bool {
	for _, at := range a.list {
		fields := at.SignInRequest.(SignUpContactableRequest).Fields()
		for k := range fields {
			_, err := u.(user.WithExpandableFieldsUser).GetField(k)
			if err != nil {
				log.Printf("failed check '%v' field in user model", k)
				return false
			}
		}

		_, err := u.(user.WithExpandableFieldsUser).GetField(at.Sender.RecipientKey())
		if err != nil {
			log.Printf("failed check '%v' field in user model", at.Sender.RecipientKey())
			return false
		}
	}

	return true
}

func (a *AuthTypes) CheckSenders() bool {
	for k, at := range a.list {
		if at.Sender == nil {
			log.Printf("Nil sender in %v auth type", k)
			return false
		}
	}

	return true
}
