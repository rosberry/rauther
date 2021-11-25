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
	Config struct {
		AuthType Type
		AuthKey  string
		Sender   sender.Sender

		SignUpRequest          AuthRequest
		SignInRequest          AuthRequest
		CheckUserExistsRequest CheckUserExistsRequest

		SocialSignInRequest SocialAuthRequest
		SocialAuthType      auth.Type
	}
	Configs []Config

	// AuthType stores request structures, key and sender that use to send confirmation/recovery codes.
	AuthType struct {
		Type   Type
		Key    string
		Sender sender.Sender

		SignUpRequest          AuthRequest
		SignInRequest          AuthRequest
		CheckUserExistsRequest CheckUserExistsRequest

		SocialSignInRequest SocialAuthRequest
		SocialAuthType      auth.Type
	}

	// List of AuthType by key
	list map[string]AuthType // TODO: Public?

	// AuthTypes is list of AuthType by key and selector for select AuthType
	AuthTypes struct {
		List     list
		Selector Selector
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

var ExistingTypes = map[Type]bool{
	Password: false,
	Social:   false,
	OTP:      false,
}

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
func (a *AuthTypes) Add(cfg Config) *AuthTypes {
	if a == nil {
		log.Fatal("auth types is nil")
	}

	if _, ok := ExistingTypes[cfg.AuthType]; !ok {
		log.Fatalf("invalid auth type %v for '%s' key", cfg.AuthType, cfg.AuthKey)
	}

	ExistingTypes[cfg.AuthType] = true

	if cfg.AuthType == Password {
		if cfg.SignUpRequest == nil {
			cfg.SignUpRequest = &SignUpRequestByEmail{}
		}

		if cfg.SignInRequest == nil {
			cfg.SignInRequest = &SignUpRequestByEmail{}
		}

		if cfg.CheckUserExistsRequest == nil {
			cfg.CheckUserExistsRequest = &CheckLoginFieldRequestByEmail{}
		}
	}

	if cfg.AuthType == Social && cfg.SocialSignInRequest == nil {
		cfg.SocialSignInRequest = &SocialSignInRequest{}
	}

	t := AuthType{
		Type:                   cfg.AuthType,
		Key:                    cfg.AuthKey,
		Sender:                 cfg.Sender,
		SignUpRequest:          cfg.SignUpRequest,
		SignInRequest:          cfg.SignInRequest,
		CheckUserExistsRequest: cfg.CheckUserExistsRequest,

		SocialAuthType:      cfg.SocialAuthType,
		SocialSignInRequest: cfg.SocialSignInRequest,
	}

	a.List[cfg.AuthKey] = t

	return a
}

func (a *AuthTypes) IsEmpty() bool {
	return len(a.List) == 0
}

// Select uses the selector and returns the found type of authorization
// if selector returned the empty key and in auth list only one type - use first type as default and return it
func (a *AuthTypes) Select(c *gin.Context, t Type) *AuthType {
	if a == nil {
		log.Fatal("AuthTypes is nil")
	}

	if a.Selector == nil {
		a.Selector = DefaultSelector
	}

	key := a.Selector(c, t)

	var foundedAt *AuthType

	switch {
	case key != "":
		if at, ok := a.List[key]; ok {
			foundedAt = &at
		}
	case len(a.List) == 1:
		for _, at := range a.List {
			foundedAt = &at
		}
	default:
		var key string
		for k, at := range a.List {
			if at.Type == t {
				if key == "" {
					key = k
				} else {
					k = ""
					break
				}
			}
		}

		if key != "" {
			at := a.List[key]
			foundedAt = &at
		}
	}

	if foundedAt != nil && foundedAt.Type == t {
		return foundedAt
	}

	return nil
}

// CheckFieldsDefine checks whether all fields required for queries defined in models
func (a *AuthTypes) CheckFieldsDefine(u user.User) (ok bool, badFields map[string][]string) { // nolint:cyclop
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
