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

func (a *AuthTypes) Valid(u user.User) (ok bool, badFields map[string][]string) {
	checkFields := func(fields map[string]string) []string {
		notFoundFields := make([]string, 0)

		for k := range fields {
			_, err := user.GetField(u, k)
			if err != nil {
				// log.Printf("failed check '%v' field in user model", k)
				notFoundFields = append(notFoundFields, k)
			}
		}

		return notFoundFields
	}

	failFields := make(map[string][]string)

	for _, at := range a.list {
		if r, ok := at.SignUpRequest.(SignUpContactableRequest); ok {
			fields := r.Fields()
			if f := checkFields(fields); len(f) > 0 {
				key := "sign-up " + at.Key
				if _, ok := failFields[key]; !ok {
					failFields[key] = make([]string, 0)
				}

				failFields[key] = append(failFields[key], f...)
			}
		}

		if r, ok := at.SignInRequest.(SignUpContactableRequest); ok {
			fields := r.Fields()
			if f := checkFields(fields); len(f) > 0 {
				key := "sign-in " + at.Key
				if _, ok := failFields[key]; !ok {
					failFields[key] = make([]string, 0)
				}

				failFields[key] = append(failFields[key], f...)
			}
		}

		_, err := user.GetField(u, at.Sender.RecipientKey())
		if err != nil {
			// log.Printf("failed check '%v' field in user model", at.Sender.RecipientKey())
			// return false
			key := "sender " + at.Key
			if _, ok := failFields[key]; !ok {
				failFields[key] = make([]string, 0)
			}

			failFields[key] = append(failFields[key], at.Sender.RecipientKey())
		}
	}

	if len(failFields) > 0 {
		return false, failFields
	}

	return true, nil
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
