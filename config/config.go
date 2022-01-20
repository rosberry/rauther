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

		// ValidateLoginField is gin route path for check login field handler. Default: "register/check"
		ValidateLoginField string

		// SignIn is gin route path for sign-in handler. Default: "login"
		SignIn string

		// SignOut is gin route path for sign-out handler. Default: "logout"
		SignOut string

		// SignIn is gin route path for sign-in handler. Default: "social-login"
		SocialSignIn string

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

		// OTPRequestCode is gin route path for One Time Password auth - code request (sign-up)
		OTPRequestCode string

		// OTPCheckCode is gin route path for One Time Password auth - code validation (sign-in)
		OTPCheckCode string

		// InitLink is gin route path for initialisation linking password account
		InitLink string

		// Link is gin route path for linking password account
		Link string
	}

	// Context Names is group for setup how save data in context
	ContextNames struct {
		// User is name user in gin context. Default: "user"
		User string

		// Session is name session in gin context. Default: "session"
		Session string
	}

	// LinkAccount
	// LinkAccount bool

	// CodeLength is default code length for all auth methods (if not specified in auth method)
	CodeLength int

	Password struct {
		CodeLifeTime time.Duration
		ResendDelay  time.Duration
	}

	OTP struct {
		CodeLifeTime time.Duration
		ResendDelay  time.Duration
	}
}

// Default set default values to configuration
func (c *Config) Default() {
	c.ContextNames.Session = "session"
	c.ContextNames.User = "user"

	c.Routes.Auth = "auth"
	c.Routes.SignUp = "register"
	c.Routes.ValidateLoginField = "register/check"
	c.Routes.SignIn = "login"
	c.Routes.SignOut = "logout"

	c.Routes.SocialSignIn = "social/login"

	c.Routes.ConfirmCode = "confirm"
	c.Routes.ConfirmResend = "confirm/resend"

	c.Routes.RecoveryRequest = "recover"
	c.Routes.RecoveryValidateCode = "recover/validate"
	c.Routes.RecoveryCode = "recover/reset"

	c.Password.CodeLifeTime = time.Minute * 30 // nolint:gomnd
	c.Password.ResendDelay = time.Minute * 2   // nolint:gomnd

	c.CodeLength = 6

	c.OTP.CodeLifeTime = time.Minute * 2 // nolint:gomnd
	c.OTP.ResendDelay = c.OTP.CodeLifeTime

	c.Routes.OTPRequestCode = "otp/code"
	c.Routes.OTPCheckCode = "otp/auth"

	c.Routes.InitLink = "initLink"
	c.Routes.Link = "link"
}
