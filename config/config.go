package config

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

	// QueryNames is group for setup requests query params
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

	// CreateGuestUser is create or not guest empty user after /auth request. Default: false
	CreateGuestUser bool
}

// Default set default values to configuration
func (c *Config) Default() {
	c.Routes.Auth = "auth"
	c.QueryNames.Session = "session"
	c.ContextNames.Session = "session"

	c.ContextNames.User = "user"

	c.Routes.SignUp = "sign-up"
	c.Routes.SignIn = "sign-in"
	c.Routes.SignOut = "sign-out"

	c.Routes.ConfirmCode = "confirm"
	c.Routes.ConfirmResend = "confirm/resend"

	c.Routes.RecoveryRequest = "recovery/request"
	c.Routes.RecoveryCode = "recovery"

	c.QueryNames.EmailConfirm.PID = "pid"
	c.QueryNames.EmailConfirm.Code = "code"
}
