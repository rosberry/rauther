package config

import "github.com/rosberry/rauther/authtype"

// Config contain all configurations for Rauther and modules
type Config struct {
	Routes struct {
		// Auth is gin route path for gin. Default: "auth"
		Auth string

		// SignUp is gin route path for sign-up handler. Default: "sign-up"
		SignUp string

		// SignIn is gin route path for sign-in handler. Default: "sign-in"
		SignIn string

		// ConfirmCode is gin route path for email confirmation handler. Default: "code/confirm/email"
		ConfirmCode string

		// ConfirmResend is gin route path for request resend confirm code. Default: "resend/confirm/email"
		ConfirmResend string
	}

	ContextNames struct {
		// User is name user in gin context. Default: "user"
		User string

		// Session is name session in gin context. Default: "session"
		Session string
	}

	QueryNames struct {
		// EmailConfirm params group
		EmailConfirm struct {
			// PID is name of query param for user PID. Default: "pid"
			PID string

			// Code is name of query param for email confirmation code. Default: "code"
			Code string
		}

		// Session is name of query param for session identificator. Default: "session"
		Session string
	}

	// AuthType is type of auth (sign-up/sign-in) user.
	// Can be AuthByEmail or AuthByUsername. Default: AuthByEmail
	AuthType authtype.AuthType

	// CreateGuestUser is create or not guest empty user after /auth request. Default: false
	CreateGuestUser bool
}

// Default set default values to configuration
func (c *Config) Default() {
	c.Routes.Auth = "auth"
	c.QueryNames.Session = "session"
	c.ContextNames.Session = "session"

	c.ContextNames.User = "user"
	c.AuthType = authtype.AuthByEmail
	c.Routes.SignUp = "sign-up"
	c.Routes.SignIn = "sign-in"

	c.Routes.ConfirmCode = "code/confirm/email"
	c.Routes.ConfirmResend = "resend/confirm/email"

	c.QueryNames.EmailConfirm.PID = "pid"
	c.QueryNames.EmailConfirm.Code = "code"
}
