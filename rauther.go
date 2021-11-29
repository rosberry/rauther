package rauther

import (
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

	// types is list of auth types - default or custom sign-up/sign-ip structs and code sender
	types *authtype.AuthTypes

	// defaultSender usage if we not define auth types with senders
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

	if r.types == nil {
		r.types = authtype.New(nil)
	}

	if r.emptyAuthTypes() {
		r.AddAuthType(authtype.Config{
			AuthKey: "email",
		})
	}

	if ok := r.checkAuthTypes(u); !ok {
		log.Fatal("failed auth types")
	}

	log.Printf("\nEnabled auth types:\n- AuthTypePassword: %v\n- AuthTypeSocial: %v\n- AuthTypeOTP: %v",
		authtype.ExistingTypes[authtype.Password],
		authtype.ExistingTypes[authtype.Social],
		authtype.ExistingTypes[authtype.OTP],
	)
	log.Printf("\nEnabled auth modules:\n%v", r.Modules)

	if r.Modules.Session {
		r.includeSession()
	}

	return nil
}

// checkAuthTypes - run fields definitions check in user model
func (r *Rauther) checkAuthTypes(user user.User) bool {
	if r.types == nil {
		return false
	}

	ok, badFields := r.types.CheckFieldsDefine(user)
	if !ok {
		log.Print("Please, check `auth` tags in user model:")

		for k, v := range badFields {
			log.Printf("Fields %v for '%v' not found in user model", v, k)
		}
	}

	return ok
}

// AddAuthType adds a new type of authorization and uses a default sender, if not transmitted another
func (r *Rauther) AddAuthType(at authtype.Config) *Rauther {
	if r.types == nil {
		r.types = authtype.New(nil)
	}

	r.types.Add(at)

	return r
}

// AddAuthTypes adds a new types of authorization and uses a default sender, if not transmitted another
func (r *Rauther) AddAuthTypes(arrTypes authtype.Configs) *Rauther {
	if r.types == nil {
		r.types = authtype.New(nil)
	}

	for _, row := range arrTypes {
		r.types.Add(row)
	}

	return r
}

// AuthSelector specifies the selector with which the type of authorization will be selected
func (r *Rauther) AuthSelector(selector authtype.Selector) *Rauther {
	if r.types == nil {
		r.types = authtype.New(selector)
	}

	r.types.Selector = selector

	return r
}

// emptyAuthTypes check auth types nil or empty
func (r *Rauther) emptyAuthTypes() (ok bool) {
	return r.types == nil || r.types.IsEmpty()
}

// DefaultSender set sender for all auth types (if auth type not contain sender)
func (r *Rauther) DefaultSender(s sender.Sender) *Rauther {
	if r == nil {
		log.Fatal("Deps is nil")
	}

	r.defaultSender = s

	return r
}
