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
	// Load return User by PID or return error if not found.
	Load(pid string) (user user.User, err error)

	// Create create new User and set PID to him
	Create(pid string) (user user.User)

	// Save User
	Save(user user.User) error
}
```

2. Implement Session interface in your Session model

```go
// Session interface
type Session interface {
	GetID() (id string)
	GetToken() (token string)
	GetUserPID() (pid string)

	SetID(id string)
	SetToken(token string)
	SetUserPID(pid string)
}
```

3. Implement User (or extendable) interface in your User model

```go
type User interface {
	GetPID() (pid string)
	SetPID(pid string)
}

type AuthableUser interface {
	User

	GetPassword() (password string)
	SetPassword(password string)
}

type ConfirmableUser interface {
	User

	GetConfirmed() (ok bool)
	GetConfirmCode() (code string)

	SetConfirmed(ok bool)
	SetConfirmCode(code string)
}

type RecoverableUser interface {
	User

	GetRecoveryCode() (code string)
	SetRecoveryCode(code string)
}
```

4. Use the 'auth' tag to match the fields in the model and fields returned in the Fields() request method

5. Implement sender

```go
type Sender interface {
	Send(event int, recipient string, message string) error
	RecipientKey() string
}
```

OR use default email sender

```go
type DefaultEmailSender struct{} // TODO
```

6. Implement sign-up/sign-in request types

```go
    type AuthRequest interface {
		GetPID() (pid string)
		GetPassword() (password string)
	}

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
//Fields: `auth:"email"`

type SignUpRequestByUsername struct {
	Username string `json:"username" form:"username" binding:"required"`
	Password string `json:"password" form:"password" binding:"required"`
	Email    string `json:"email" form:"email"`
}
//Fields: `auth:"email"`, `auth:"username"`
```

7. Init gin engine
8. Create new deps

```go
    d := deps.New(r, deps.Storage{
			SessionStorer: &models.Sessioner{},
			UserStorer: &models.UserStorer{},
		})
```

9. Determine one or more auth types (you can not transmit signUp/signIn request types, then will be use default )

```go
	d.Types = authtype.New(selector).
        Add("email", &fakeEmailSender{}, &signUpByEmail{}, &signInByEmail{}).
		Add("default-email", &fakeEmailSender{}, nil, nil).
		Add("username", &fakeSmsSender{}, &authtype.SignUpRequestByUsername{}, &authtype.SignUpRequestByUsername{})
```

- `selector` - function with type `func(c *gin.Context) (senderKey string)` for "how select right auth type"
- `Add(key, sender, signUpRequest, signInRequest)`
  - `key` - key for ident auth type
  - `sender` - sender is object, that can send confirm/recovery code to user. Should implement interface `Sender`
  - `signUpRequest` - signUpRequest is object, that will use for sign up request. Should implement `SignUpRequest` interface or extendable
  - `signInRequest` - signInRequest is object, that will use for sign in request. Should implement `SignUpRequest` interface or extendable

10. Create new rauther usage deps

```go
rauth := rauther.New(d)
```

11. Configure rauther usage Modules and Config

```go
rauth.Modules.ConfirmableUser = false
rauth.Config.Routes.SignUp = "registration"
```

12. Init rauther handlers

```go
err := rauth.InitHandlers()
```

13. Run your gin

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

#### Code example

Code...

#### Client-Server iteraction

Requests-Responses...

### Max custom usage

If you need..

[Custom Example](./example/custom/full/README.md)

#### Code example

Code...

#### Client-Server iteraction

Requests-Responses...

## Diagrams

[diags](./doc/diags/preview)
