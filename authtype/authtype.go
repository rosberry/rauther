package authtype

// Own package ?

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/sender"
	"github.com/rosberry/rauther/user"
)

type (
	// AuthType stores request structures, key and sender that use to send confirmation/recovery codes.
	AuthType struct {
		Key    string
		Sender sender.Sender

		SignUpRequest AuthRequest
		SignInRequest AuthRequest
	}

	// List of AuthType by key
	List map[string]AuthType // TODO: Public?

	// AuthTypes is list of AuthType by key and selector for select AuthType
	AuthTypes struct {
		list     List
		Selector Selector
	}

	// Selector defines the key of authorization type using gin context
	Selector func(c *gin.Context) (senderKey string)
)

type (
	AuthRequest interface {
		GetPID() (pid string)
		GetPassword() (password string)
	}

	AuhtRequestFieldable interface {
		AuthRequest

		Fields() map[string]string
	}
)

// New create AuthTypes (list of AuthType).
// If selector is nil - used default selector
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

// Add new AuthType in AuthTypes list
func (a *AuthTypes) Add(key string, sender sender.Sender, signUpRequest, signInRequest AuthRequest) *AuthTypes {
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

// Select uses the selector and returns the found type of authorization
// if key not found in list, but in list only one type - use first type as default and return it
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

	return nil
}

// CheckFieldsDefine checks whether all fields required for queries defined in models
func (a *AuthTypes) CheckFieldsDefine(u user.User) (ok bool, badFields map[string][]string) {
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
		if r, ok := at.SignUpRequest.(AuhtRequestFieldable); ok {
			fields := r.Fields()
			if f := checkFields(fields); len(f) > 0 {
				key := "sign-up " + at.Key
				if _, ok := failFields[key]; !ok {
					failFields[key] = make([]string, 0)
				}

				failFields[key] = append(failFields[key], f...)
			}
		}

		if r, ok := at.SignInRequest.(AuhtRequestFieldable); ok {
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

// CheckSenders checks that all types of authorization are set by the sender
func (a *AuthTypes) CheckSenders() bool {
	for k, at := range a.list {
		if at.Sender == nil {
			log.Printf("Nil sender in %v auth type", k)
			return false
		}
	}

	return true
}
