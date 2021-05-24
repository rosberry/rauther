package rauther

// Config contain all configurations for Rauther and modules
type Config struct {
	Routes struct {
		// Auth is gin route path for gin. Default: "auth"
		Auth string

		// SignUp is gin route path for sign-up handler. Default: "sign-up"
		SignUp string

		// SignIn is gin route path for sign-in handler. Default: "sign-in"
		SignIn string
	}

	ContextNames struct {
		// User is name user in gin context. Default: "user"
		User string

		// Session is name session in gin context. Default: "session"
		Session string
	}

	// SessionToken is name of query param. Default: "session"
	SessionToken string

	// AuthType is type of auth (sign-up/sign-in) user.
	// Can be AuthByEmail or AuthByUsername. Default: AuthByEmail
	AuthType AuthType
}

// Default set default values to configuration
func (c *Config) Default() {
	c.Routes.Auth = "auth"
	c.SessionToken = "session"
	c.ContextNames.Session = "session"

	c.ContextNames.User = "user"
	c.AuthType = AuthByEmail
	c.Routes.SignUp = "sign-up"
	c.Routes.SignIn = "sign-in"
}
