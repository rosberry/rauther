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
	list map[string]AuthType // TODO: Public?

	// AuthTypes is list of AuthType by key and selector for select AuthType
	AuthTypes struct {
		List     list
		Selector Selector
	}

	// Selector defines the key of authorization type using gin context
	Selector func(c *gin.Context) (senderKey string)
)

type (
	// AuthRequest is basic sign-up/sign-in interface
	AuthRequest interface {
		GetUID() (uid string)
		GetPassword() (password string)
	}

	// AuhtRequestFieldable is additional sign-up/sign-in interface for use additional fields
	AuhtRequestFieldable interface {
		AuthRequest

		Fields() map[string]string
	}
)

// New create AuthTypes (list of AuthType).
// If selector is nil - used default selector
func New(selector Selector) *AuthTypes {
	authTypes := &AuthTypes{
		List:     make(list),
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

	a.List[key] = t

	return a
}

func (a *AuthTypes) IsEmpty() bool {
	return len(a.List) == 0
}

// Select uses the selector and returns the found type of authorization
// if selector returned the empty key and in auth list only one type - use first type as default and return it
func (a *AuthTypes) Select(c *gin.Context) *AuthType {
	if a == nil {
		log.Fatal("AuthTypes is nil")
	}

	if a.Selector == nil {
		a.Selector = DefaultSelector
	}

	key := a.Selector(c)

	if key != "" {
		if at, ok := a.List[key]; ok {
			return &at
		}
	} else if len(a.List) == 1 {
		for _, at := range a.List {
			return &at
		}
	}

	return nil
}

// CheckFieldsDefine checks whether all fields required for queries defined in models
func (a *AuthTypes) CheckFieldsDefine(u user.User, confirmable bool) (ok bool, badFields map[string][]string) { // nolint:cyclop
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

	for _, at := range a.List {
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
	}

	if len(failFields) > 0 {
		return false, failFields
	}

	return true, nil
}
