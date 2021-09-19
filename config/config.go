package config

import "time"

// Config contain all configurations for Rauther and modules
type Config struct {
	// Routes is group for gin route paths
	Routes struct {
		// Auth is gin route path for gin. Default: "auth"
		Auth string

		// SignUp is gin route path for sign-up handler. Default: "sign-up"
		SignUp string

		// SignIn is gin route path for sign-in handler. Default: "sign-in"
		SignIn string

		// SignOut is gin route path for sign-out handler. Default: "sign-out"
		SignOut string

		// ConfirmCode is gin route path for email confirmation handler. Default: "confirm"
		ConfirmCode string

		// ConfirmResend is gin route path for request resend confirm code. Default: "confirm/resend"
		ConfirmResend string

		// RecoveryRequest is gin route path for request send a password recovery code. Default: "recovery/request"
		RecoveryRequest string

		// RecoveryValidateCode is gin route path for check recovery code. Default: "recovery/validate"
		RecoveryValidateCode string

		// RecoveryCode is gin route path for confirm the password recovery and set a new password. Default "recovery"
		RecoveryCode string
	}

	// Context Names is group for setup how save data in context
	ContextNames struct {
		// User is name user in gin context. Default: "user"
		User string

		// Session is name session in gin context. Default: "session"
		Session string
	}

	// CreateGuestUser is create or not guest empty user after /auth request. Default: false
	CreateGuestUser bool

	// ValidConfirmationInterval is the allowed interval between the last confirmation and the present time.
	ValidConfirmationInterval time.Duration
}

// Default set default values to configuration
func (c *Config) Default() {
	c.Routes.Auth = "auth"
	c.ContextNames.Session = "session"

	c.ContextNames.User = "user"

	c.Routes.SignUp = "register"
	c.Routes.SignIn = "login"
	c.Routes.SignOut = "logout"

	c.Routes.ConfirmCode = "confirm"
	c.Routes.ConfirmResend = "confirm/resend"

	c.Routes.RecoveryRequest = "recovery/request"
	c.Routes.RecoveryValidateCode = "recovery/validate"
	c.Routes.RecoveryCode = "recovery"

	c.ValidConfirmationInterval = 1 * time.Minute
}
