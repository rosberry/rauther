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

	// Save Session
	Save(session session.Session) error
}

// UserStorer interface
type UserStorer interface {
	// Load return User by uid and auth type or return error if not found.
	LoadByUID(authType, uid string) (user user.User, err error)

	// Load return User by ID or return error if not found.
	LoadByID(id interface{}) (user user.User, err error)

	// Create create new User and set PID to him
	Create() (user user.User)

	// Save User
	Save(user user.User) error
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
	BindUser(u user.User)
	UnbindUser(u user.User)
}
```

3. Implement User (or extendable) interface in your User model

```go
type User interface {
	GetUID(authType string) (uid string)
	SetUID(authType, uid string)
}

type GuestUser interface {
	IsGuest() bool
	SetGuest(guest bool)
}

type AuthableUser interface {
	User

	GetPassword() (password string)
	SetPassword(password string)
}

type ConfirmableUser interface {
	User

	Confirmed() (ok bool)
	GetConfirmed(authType string) (ok bool)
	GetConfirmCode(authType string) (code string)

	SetConfirmed(authType string, ok bool)
	SetConfirmCode(authType, code string)
}

type RecoverableUser interface {
	User

	GetRecoveryCode() (code string)
	SetRecoveryCode(code string)
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
type DefaultEmailSender struct{} // TODO
```

6. Implement sign-up/sign-in request types

```go
	// AuthRequest is basic sign-up/sign-in interface
    type AuthRequest interface {
		GetUID() (uid string)
		GetPassword() (password string)
	}

	// AuhtRequestFieldable is additional sign-up/sign-in interface for use additional fields
	type AuhtRequestFieldable interface {
		AuthRequest

		Fields() map[string]string
	}
```

OR use default struct

```go
type SignUpRequestByEmail struct {
	Email    string `json:"email" form:"email" binding:"required"`
	Password string `json:"password" form:"password" binding:"required"`
}
```

7. Init gin engine
8. Create new deps

```go
    d := deps.New(
		group,
		deps.Storage{
			SessionStorer: sessionStorer,
			UserStorer:    userStorer,
		},
	)
```

9. Determine one or more auth types (you can not transmit signUp/signIn request types, then will be use default )

```go
	d.AddAuthType("email", &fakeEmailSender{}, nil, nil).
		AddAuthType("phone", &fakeSmsSender{}, &phoneSignUp{}, &phoneSignIn{})
```

OR add default sender, if you want not set sender for auth types

```go
	d.DefaultSender(&fakeEmailSender{})
	d.AddAuthType("email", nil, nil, nil).
		AddAuthType("phone", &fakeSmsSender{}, &phoneSignUp{}, &phoneSignIn{})

```

- `AddAuthType(key, sender, signUpRequest, signInRequest)`
  - `key` - key for ident auth type
  - `sender` - sender is object, that can send confirm/recovery code to user. Should implement interface `Sender`
  - `signUpRequest` - signUpRequest is object, that will use for sign up request. Should implement `SignUpRequest` interface or extendable
  - `signInRequest` - signInRequest is object, that will use for sign in request. Should implement `SignUpRequest` interface or extendable

10. Set custom selector for auth types [optional]

```go
	d.AuthSelector(selector)
```

- `selector` - function with type `func(c *gin.Context) (senderKey string)` for "how select right auth type"

11. Create new rauther usage deps

```go
rauth := rauther.New(d)
```

12. Configure rauther usage Modules and Config

```go
rauth.Modules.ConfirmableUser = false
rauth.Config.Routes.SignUp = "registration"
```

13. Init rauther handlers

```go
err := rauth.InitHandlers()
```

14. Run your gin

```go
r.Run()
```

## Modules

Library have some modules for differend work types. modules turn on automatically if all conditions are met. You can turn off each of them manually.

- **Session** - main module ...
- **AuthableUser** - module for auth user. Enable handlers ...
- **ConfirmableUser** - module for require confirm user contact (email, phone, etc). Enable handlers...
- **RecoverableUser** - module for recovery user password. Enable handlers...

## Examples

### Default usage

You can..

[Default Example](./example/default/full/README.md)

#### Client-Server iteraction

Requests-Responses...

## Diagrams

[diags](./doc/diags/preview)
