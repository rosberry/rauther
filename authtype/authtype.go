package authtype

// Own package ?

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/auth"
	"github.com/rosberry/rauther/sender"
	"github.com/rosberry/rauther/user"
)

//go:generate stringer -type=Type
type Type int

type (
	// AuthMethod stores request structures, key and sender that use to send confirmation/recovery codes.
	AuthMethod struct {
		Type   Type
		Key    string
		Sender sender.Sender

		SignUpRequest          AuthRequest
		SignInRequest          AuthRequest
		CheckUserExistsRequest CheckUserExistsRequest

		SocialSignInRequest SocialAuthRequest
		SocialAuthType      auth.Type
	}

	// list of AuthType by key
	list map[string]AuthMethod

	// AuthMethods is list of AuthType by key and selector for select AuthType
	AuthMethods struct {
		List          list
		ExistingTypes map[Type]bool
		Selector      Selector
	}

	// Selector defines the key of authorization type using gin context
	Selector func(c *gin.Context, t Type) (senderKey string)
)

type (
	// AuthRequest is basic sign-up/sign-in interface
	AuthRequest interface {
		GetUID() (uid string)
		GetPassword() (password string)
	}

	CheckUserExistsRequest interface {
		GetUID() (uid string)
	}

	SocialAuthRequest interface {
		GetToken() string
	}

	// AuhtRequestFieldable is additional sign-up/sign-in interface for use additional fields
	AuhtRequestFieldable interface {
		AuthRequest
		Fields() map[string]string
	}
)

const (
	Password Type = iota
	Social
	OTP
)

const (
	SocialAuthTypeGoogle   = auth.AuthTypeGoogle
	SocialAuthTypeApple    = auth.AuthTypeApple
	SocialAuthTypeFacebook = auth.AuthTypeFacebook
	SocialAuthTypeVK       = auth.AuthTypeVK
)

// New create AuthMethods (list of AuthMethod).
// If selector is nil - used default selector
func New(selector Selector) *AuthMethods {
	authMethods := &AuthMethods{
		List:     make(list),
		Selector: DefaultSelector,
		ExistingTypes: map[Type]bool{
			Password: false,
			Social:   false,
			OTP:      false,
		},
	}

	if selector != nil {
		authMethods.Selector = selector
	}

	return authMethods
}

// Add new AuthType in AuthTypes list
func (a *AuthMethods) Add(cfg AuthMethod) *AuthMethods {
	if a == nil {
		log.Fatal("auth types is nil")
	}

	if _, ok := a.ExistingTypes[cfg.Type]; !ok {
		log.Fatalf("invalid auth type %v for '%s' key", cfg.Type, cfg.Key)
	}

	a.ExistingTypes[cfg.Type] = true

	if cfg.SignUpRequest == nil {
		cfg.SignUpRequest = &SignUpRequestByEmail{}
	}

	if cfg.SignInRequest == nil {
		cfg.SignInRequest = &SignUpRequestByEmail{}
	}

	if cfg.CheckUserExistsRequest == nil {
		cfg.CheckUserExistsRequest = &CheckLoginFieldRequestByEmail{}
	}

	if cfg.Type == Social && cfg.SocialSignInRequest == nil {
		cfg.SocialSignInRequest = &SocialSignInRequest{}
	}

	a.List[cfg.Key] = cfg

	return a
}

func (a *AuthMethods) IsEmpty() bool {
	return len(a.List) == 0
}

// Select uses the selector and returns the found method of authorization
//
// if selector returned the empty key and in auth list only one method - use first method as default and return it
// if selector returned the empty key and in auth list only one method of t Type - return this method
func (a *AuthMethods) Select(c *gin.Context, t Type) *AuthMethod {
	if a == nil {
		log.Fatal("AuthMethods is nil")
	}

	if a.Selector == nil {
		a.Selector = DefaultSelector
	}

	key := a.Selector(c, t)

	var foundedAuthMethod *AuthMethod

	switch {
	case key != "":
		if am, ok := a.List[key]; ok {
			foundedAuthMethod = &am
		}
	case len(a.List) == 1:
		for i := range a.List {
			am := a.List[i]
			foundedAuthMethod = &am
		}
	default:
		var key string

		for k, am := range a.List {
			if am.Type == t {
				if key == "" {
					key = k
				} else {
					key = ""
					break
				}
			}
		}

		if key != "" {
			am := a.List[key]
			foundedAuthMethod = &am
		}
	}

	if foundedAuthMethod != nil && foundedAuthMethod.Type == t {
		return foundedAuthMethod
	}

	return nil
}

// CheckFieldsDefine checks whether all fields required for queries defined in models
func (a *AuthMethods) CheckFieldsDefine(u user.User) (ok bool, badFields map[string][]string) { // nolint:cyclop
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
