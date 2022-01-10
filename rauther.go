package rauther

import (
	"errors"
	"log"

	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/checker"
	"github.com/rosberry/rauther/common"
	"github.com/rosberry/rauther/config"
	"github.com/rosberry/rauther/deps"
	"github.com/rosberry/rauther/hooks"
	"github.com/rosberry/rauther/modules"
	"github.com/rosberry/rauther/sender"
	"github.com/rosberry/rauther/user"
)

// Rauther main object - contains configuration and other details for running.
type Rauther struct {
	Config  config.Config
	Modules *modules.Modules
	deps    deps.Deps
	hooks   hooks.HookOptions

	// checker for check implement user interfaces
	checker *checker.Checker

	// methods is list of auth methods - default or custom sign-up/sign-ip structs and code sender
	methods *authtype.AuthMethods

	// defaultSender usage if we not define auth methods with senders
	defaultSender sender.Sender
}

// New make new instance of Rauther with default configuration
func New(deps deps.Deps) *Rauther {
	var u user.User
	if deps.Storage.UserStorer != nil {
		u = deps.Storage.UserStorer.Create()
	}

	if deps.SessionStorer == nil {
		log.Fatal(common.Errors[common.ErrSessionStorerDependency])
	}

	if deps.R == nil {
		log.Fatal(common.Errors[common.ErrGinDependency])
	}

	cfg := config.Config{}
	cfg.Default()

	checker := checker.New(u)

	r := &Rauther{
		Config:  cfg,
		deps:    deps,
		Modules: modules.New(checker),
		checker: checker,
	}

	return r
}

func (r *Rauther) InitHandlers() error {
	var u user.User
	if r.deps.Storage.UserStorer != nil {
		u = r.deps.Storage.UserStorer.Create()
	}

	if r.methods == nil {
		r.methods = authtype.New(nil)
	}

	if r.emptyAuthMethods() {
		r.AddAuthMethod(authtype.AuthMethod{
			Key: "email",
		})
	}

	if ok := r.checkAuthMethods(u); !ok {
		log.Fatal("failed auth types")
	}

	log.Printf("\nEnabled auth types:\n- AuthTypePassword: %v\n- AuthTypeSocial: %v\n- AuthTypeOTP: %v",
		r.methods.ExistingTypes[authtype.Password],
		r.methods.ExistingTypes[authtype.Social],
		r.methods.ExistingTypes[authtype.OTP],
	)
	log.Printf("\nEnabled auth modules:\n%v", r.Modules)

	if r.Modules.Session {
		r.includeSession()
	}

	return nil
}

// checkAuthMethods - run fields definitions check in user model
func (r *Rauther) checkAuthMethods(user user.User) bool {
	if r.methods == nil {
		return false
	}

	ok, badFields := r.methods.CheckFieldsDefine(user)
	if !ok {
		log.Print("Please, check `auth` tags in user model:")

		for k, v := range badFields {
			log.Printf("Fields %v for '%v' not found in user model", v, k)
		}
	}

	return ok
}

// AddAuthMethod adds a new method of authorization and uses a default sender, if not transmitted another
func (r *Rauther) AddAuthMethod(at authtype.AuthMethod) *Rauther {
	if r.methods == nil {
		r.methods = authtype.New(nil)
	}

	r.methods.Add(at)

	return r
}

// AddAuthMethods adds a new types of authorization and uses a default sender, if not transmitted another
func (r *Rauther) AddAuthMethods(methods []authtype.AuthMethod) *Rauther {
	if r.methods == nil {
		r.methods = authtype.New(nil)
	}

	for _, row := range methods {
		r.methods.Add(row)
	}

	return r
}

// AuthSelector specifies the selector with which the type of authorization will be selected
func (r *Rauther) AuthSelector(selector authtype.Selector) *Rauther {
	if r.methods == nil {
		r.methods = authtype.New(selector)
	}

	r.methods.Selector = selector

	return r
}

// emptyAuthMethods check auth types nil or empty
func (r *Rauther) emptyAuthMethods() (ok bool) {
	return r.methods == nil || r.methods.IsEmpty()
}

// DefaultSender set sender for all auth types (if auth type not contain sender)
func (r *Rauther) DefaultSender(s sender.Sender) *Rauther {
	if r == nil {
		log.Fatal("Deps is nil")
	}

	r.defaultSender = s

	return r
}

func (r *Rauther) fillFields(request authtype.AuthRequestFieldable, u user.User) (ok bool) {
	fields := request.Fields()
	for fieldKey, fieldValue := range fields {
		err := user.SetFields(u, fieldKey, fieldValue)
		if err != nil {
			log.Printf("sign up: set fields %v: %v", fieldKey, err)
			return false
		}
	}

	return true
}

func (r *Rauther) generateCode(at *authtype.AuthMethod) string {
	if at == nil {
		log.Print("Cannot generate code for nil AuthMethod")
		return ""
	}

	length := at.CodeLength

	if length == 0 {
		length = r.Config.CodeLength
	}

	return at.CodeGenerator(length)
}

var errAuthTypeNotFound = errors.New("auth type not found")

func (r *Rauther) LoadByUID(key, uid string) (user.User, error) {
	u, err := r.deps.UserStorer.LoadByUID(key, uid)
	if err == nil && u != nil && u.(user.AuthableUser).GetUID(key) != uid {
		return u, errAuthTypeNotFound
	}

	return u, err
}
