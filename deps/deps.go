package deps

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/checker"
	"github.com/rosberry/rauther/sender"
	"github.com/rosberry/rauther/storage"
	"github.com/rosberry/rauther/user"
)

// Deps contain dependencies for Rauther
type Deps struct {
	// R is gin Engine
	R *gin.Engine

	// Storage is wrapper for User/Session and other storers
	Storage

	// checker for check implement user interfaces
	checker *checker.Checker

	// types is list of auth types - default or custom sign-up/sign-ip structs and code sender
	types *authtype.AuthTypes

	// defaultSender usage if we not define auth types with senders
	defaultSender sender.Sender
}

type Storage struct {
	// SessionStorer for load/save sessions
	SessionStorer storage.SessionStorer

	// UserStorer for load/save users
	UserStorer storage.UserStorer
}

func New(r *gin.Engine, storage Storage) Deps {
	var u user.User
	if storage.UserStorer != nil {
		u = storage.UserStorer.Create("")
	}

	return Deps{
		R:       r,
		Storage: storage,
		checker: checker.New(u),
	}
}

func (d *Deps) Checker() *checker.Checker {
	return d.checker
}

func (d *Deps) DefaultSender(s sender.Sender) *Deps {
	if d == nil {
		log.Fatal("Deps is nil")
	}

	d.defaultSender = s

	return d
}

// CheckDefaultSender сhecks if the standard sender is available
func (d *Deps) CheckDefaultSender() bool {
	return d.defaultSender != nil
}

// AddAuthType adds a new type of authorization and uses a default sender, if not transmitted another
func (d *Deps) AddAuthType(key string, sender sender.Sender,
	signUpRequest, signInRequest authtype.AuthRequest) *Deps {
	if d.types == nil {
		d.types = authtype.New(nil)
	}

	if sender == nil {
		if !d.CheckDefaultSender() {
			log.Fatalf("If you not define auth sender - first define default sender\nDefaultSender(s sender.Sender)")
		}

		sender = d.defaultSender
	}

	d.types.Add(key, sender, signUpRequest, signInRequest)

	return d
}

// AuthSelector specifies the selector with which the type of authorization will be selected
func (d *Deps) AuthSelector(selector authtype.Selector) *Deps {
	if d.types == nil {
		d.types = authtype.New(selector)
	}

	d.types.Selector = selector

	return d
}

// EmptyAuthTypes check auth types nil or empty
func (d *Deps) EmptyAuthTypes() (ok bool) {
	return d.types == nil || d.types.IsEmpty()
}

// Types getter
func (d *Deps) Types() *authtype.AuthTypes {
	if d == nil {
		log.Fatal("Types(): deps Auth types is nil")
	}

	if d.types == nil {
		d.types = authtype.New(nil)
	}

	return d.types
}
