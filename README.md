# Rauther

Rosberry authentification library

## Description

Rauther does not have access to the database and does not know how and where you are going to store information about sessions and users.
You must implement the required interfaces for the library to work in your code, as well as provide the library with the necessary tools (such as a sms/email/etc sender or an auth type selector). In this case, you can use the standard tools from the library, or you can make your own.

## Usage

1. Implement SessionStorer and UserStorer interfaces for get/save your Session/User model

```go
// SessionStorer interface
type SessionStorer interface {
	// LoadById return Session or create new if not found
	LoadByID(id string) session.Session
	// FindByToken return Session or nil if not found
	FindByToken(token string) session.Session
	Save(session session.Session) error
}

// UserStorer interface
type UserStorer interface {
	// Load return User by uid and auth type or return error if not found.
	LoadByUID(authType, uid string) (user user.User, err error)
	// Load return User by ID or return error if not found.
	LoadByID(id interface{}) (user user.User, err error)
	Create() (user user.User)
	Save(user user.User) error
}

// SocialStorer interface (optional, for social user)
type SocialStorer interface {
	LoadBySocial(authType string, userDetails user.SocialDetails) (user user.User, err error)
}

// RemovableUserStorer interface (optional, for guest user)
type RemovableUserStorer interface {
	RemoveByID(id interface{}) error
}
```

2. Implement Session interface in your Session model

```go
// Session interface
type Session interface {
	GetToken() (token string)
	GetUserID() (userID interface{})

	SetToken(token string)
	// add relation device <-> user
	BindUser(u user.User)
	// remove relation device <-> user
	UnbindUser()
}
```

3. Implement User (or extendable) interface in your User model. 

Rauther consists of several user layers.

- `User`. Base layer not use authable modules.

```go
type User interface {
	GetID() (id interface{})
}
```

- `GuestUser`. Guest user layer allows you to create sessions with an already created user but without authorization. Although it is used as a separate layer, when enabled, it changes some behavior in all authorization types.

```go
type GuestUser interface {
	User
	IsGuest() bool
	SetGuest(guest bool)
}
```

- `AuthableUser`. Authable user allows you to authorize a user and use security routes.

```go
type AuthableUser interface {
	User
	GetUID(authType string) (uid string)
	SetUID(authType, uid string)
}
```

Also rauther consists of 3 authentication modules for `AuthableUser`:
- Password  (by email, phone, etc)

```go
type PasswordAuthableUser interface {
	AuthableUser
	GetPassword(authType string) (password string)
	SetPassword(authType, password string)
}
```

- Social (google, apple, etc)

This interface may not be required for implementation in order for social networks to work, but adds the ability to process user information from social networks.

```go
type SocialAuthableUser interface {
	AuthableUser
	SetUserDetails(authType string, userDetails SocialDetails)
}
```

- OTP (one time password)

```go
type OTPAuth interface {
	AuthableUser
	GetOTP(authType string) (code string)
	SetOTP(authType string, code string) error
}
```

Each needs its own interface. You can implicate from one to all. The interfaces used include the corresponding modules in rauther.

Also `AuthableUser` modules make use additional interfaces.

```go
type ConfirmableUser interface {
	AuthableUser
	Confirmed() (ok bool)
	GetConfirmed(authType string) (ok bool)
	GetConfirmCode(authType string) (code string)
	SetConfirmed(authType string, ok bool)
	SetConfirmCode(authType, code string)
}

type RecoverableUser interface {
	AuthableUser
	GetRecoveryCode(authType string) (code string)
	SetRecoveryCode(authType, code string)
}

// interface for checking the interval during which confirmation codes cannot be sent
type CodeSentTimeUser interface {
	AuthableUser
	GetCodeSentTime(authType string) *time.Time
	SetCodeSentTime(authType string, t *time.Time)
}
```

4. Use the 'auth' tag to match the fields in the model and fields returned in the Fields() request method

```go
type User struct {
	ID uint `json:"id"`

	Username string `auth:"username" json:"username"`
	Password string `json:"password"`

	FirstName string `auth:"fname" json:"first_name"`
	LastName  string `auth:"lname" json:"last_name"`

	RecoveryCode string
}
```

5. Implement sender for confirm/recovery

```go
type Sender interface {
	Send(event int, recipient string, message string) error
}
```

OR use default email sender

```go
import "github.com/rosberry/rauther/sender"
// ...
defaultSender := sender.EmailCredentials{
	Server:   cfg.Email.Host,
	Port:     cfg.Email.Port,
	From:     cfg.Email.From,
	FromName: cfg.Email.FromName,
	Pass:     cfg.Email.Password,
	Timeout:  timeout * time.Second,
}
stdEmailSender, err := sender.NewDefaultEmailSender(defaultSender, nil, nil)
```
`Timeout` - timeout for connect to email provider.

2nd and 3nd argument - Subjects and messages templates. Uses defaults if not exists.

6. Implement sign-up/sign-in request types

```go
type (
	// AuthRequest is basic sign-up/sign-in interface
	AuthRequest interface {
		GetUID() (uid string)
		GetPassword() (password string)
	}
	// for password module
	CheckUserExistsRequest interface {
		GetUID() (uid string)
	}
	// for social module
	SocialAuthRequest interface {
		GetToken() string
	}
	// AuthRequestFieldable is additional sign-up/sign-in interface for use additional fields
	AuthRequestFieldable interface {
		Fields() map[string]interface{}
	}
)
```

OR use default struct

```go
type SignUpRequestByEmail struct {
	Email    string `json:"email" form:"email" binding:"required"`
	Password string `json:"password" form:"password" binding:"required"`
}
type CheckLoginFieldRequestByEmail struct {
	Email string `json:"email" form:"email" binding:"required"`
}
type SocialSignInRequest struct {
	Token string `json:"token" binding:"required"`
}
```

7. Init gin engine
8. Init rauther

```go
    rauth := rauther.New(deps.New(
		group, // gin group
		deps.Storage{
			SessionStorer: sessionStorer,
			UserStorer:    userStorer,
		},
	))
```

9. Determine one or more auth types.

Rauther may add this with `AddAuthMethod` for simple adding or `AddAuthMethods` for adding group. Also we may use chaining with `AddAuthMethod` (`rauth.AddAuthMethod(...).AddAuthMethod(...)`)

Password module example:

```go
	rauth.AddAuthMethod(authtype.AuthMethod{
		Key:                    "email",
		Type:                   authtype.Password, // by default
		Sender:                 defaultSender,
		SignUpRequest:          &models.SignUpRequest{},
		SignInRequest:          &models.SignInRequest{},
		CheckUserExistsRequest: &models.CheckLoginRequest{},
	})
```

Social module example:
```go
	rauth.AddAuthMethod(authtype.AuthMethod{
		Key:                 "google",
		Type:                authtype.Social,
		Sender:              defaultSender,
		SocialSignInRequest: &models.SocialSignInRequest{},
		SocialAuthType:      authtype.SocialAuthTypeGoogle,
	})
```
OTP module example:
```go
	rauth.AddAuthMethod(authtype.AuthMethod{
		Key:           "otp",
		Type:          authtype.OTP,
		Sender:        defaultSender,
		SignUpRequest: &models.OTPSendCodeRequest{},
		SignInRequest: &models.OTPSignInRequest{},
	})
```

Parameters:

- `Key`. Key for ident auth type. For example "email", "phone", "email2", "google", etc.
- `Type`. Indicates which of the 3 authorization modules we want to use. Variants: `authtype.Password`, `authtype.Social`, `authtype.OTP`. By default uses `authtype.Password`.
- `Sender`. Parameter from step 5. Sender is object, that can send confirm/recovery code to user. Should implement interface `Sender` Add default sender, if you want not set sender for auth types
- `SignUpRequest`, `SignInRequest`. This is objects, that will use for sign up/sign in requests. Should implement `SignUpRequest` interface or extendable (step 6). You can not transmit signUp/signIn request types, then will be use default.
- `CheckUserExistsRequest`. Interface for password module.

10. Set custom selector for auth types [optional]

For example:
```go
	selector := func(c *gin.Context, t authtype.Type) (key string) {
		if t == authtype.Social {
			key = c.Param("type")
		}

		if key != "" {
			return key
		}

		return authtype.DefaultSelector(c, t)
	}

	rauth.AuthSelector(selector)
```

- `selector` - function with type `func(c *gin.Context) (senderKey string)` for "how select right auth type"

11. Configure rauther usage Modules and Config

For example:

```go
rauth.Modules.ConfirmableUser = false
rauth.Modules.RecoverableUser = false
rauth.Config.Routes.SignUp = "registration"
rauth.Config.CreateGuestUser = true
rauth.Config.LinkAccount = true
rauth.Config.Password.CodeLifeTime = time.Minute * 30
rauth.Config.OTP.CodeLifeTime = time.Minute * 5
```

All configs parameters: https://github.com/rosberry/rauther/blob/master/config/config.go#L79

12. Init rauther handlers

```go
err := rauth.InitHandlers()
```

13. Run your gin

```go
r.Run()
```

## Modules

Library have some modules for differend work types. modules turn on automatically if all conditions are met. Сonditions are formed from the found implemented interfaces and layers as well as the added types of authorizations in `AddAuthMethod`. You can turn off each of them manually in step 11. 

- **Session** - main module ...
- **AuthableUser** - module for auth user. Enable handlers ...
- **PasswordAuthableUser** - module for enabled password authentication routes
- **SocialAuthableUser** - module for enabled social authentication routes
- **One Time Password** - module for enabled OTP authentication routes
- **ConfirmableUser** - module for require confirm user contact (email, phone, etc). Enable handlers...
- **RecoverableUser** - module for recovery user password. Enable handlers...
- **CodeSentTimeUser** - module for expired confirmations

## Examples

### Default usage

You can..

[Default Example](./example/default/full/README.md)

#### Client-Server iteraction

Requests-Responses...

## Diagrams

[diags](./doc/diags/preview)

## About interfaces

### userID type negotiation
Rauther has several methods that use the `interface{}` type `userID` as arguments. It is important that all these types that will be converted to `interface{}` are of the same type. For example `Session.GetUserID()` must return `(userID interface{})` which is then transferred to `UserStorer.LoadByID(userID interface{})`. In `GetUserID` we just return any type: `uint`, `int`, `uint32` and other. But when `userID` comes from arguments, then we must convert it to the same type that we previously sent to the session. For example `userID, ok := id.(int)`. Otherwise, not obvious type errors will occur. Be careful. This applies to such methods: `Session.GetUserID`,`UserStorer.LoadByID`,`RemovableUserStorer.RemoveByID`,`User.GetID`.
### Creating and Saving
In all methods like `LoadBy...`, `Get...`, `Find...` in interfaces is recommended to use only the logic of finding records. It is not recommended to create new records in the database if rows are not found inside methods. This can lead to unexpected consequences and unnecessary database queries.

Also, the method `UserStorer.Create` should only return the initial data structure without creating any records in the database.

All final saves are expected to be done in methods `SessionStorer.Save`, `UserStorer.Save`.

If your user in the database uses external relations with other tables, for example, `authIdentities`, then sometimes it becomes difficult to get and save these related tables.
You can load all dependencies in methods `LoadByID`, `LoadByUID`. Therefore, if unloaded dependencies are allowed in the methods `LoadBy...`, then the methods `Set...`, `Get...` for obtaining individual fields will have problems with access to these external fields and nil pointer errors. Accordingly, it is recommended that all changes with external tables be reflected in the total in `Save` method.

`Session.LoadByID` assumes that if the session was not found, then it needs to be created in database.
