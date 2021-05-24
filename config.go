package rauther

// Config contain all configurations for Rauther and modules
type Config struct {
	// AuthPath is gin route path for gin. Default: "auth"
	AuthPath string

	// SessionToken is name of query param. Default: "session"
	SessionToken string

	// SessionCtxName is name session in gin context. Default: "session"
	SessionCtxName string

	// SignUpPath is gin route path for sign-up handler. Default: "sign-up"
	SignUpPath string

	// UserCtxName is name user in gin context. Default: "user"
	UserCtxName string

	// AuthType is type of auth (sign-up/sign-in) user.
	// Can be AuthByEmail or AuthByUsername. Default: AuthByEmail
	AuthType AuthType

	// SignInPath is gin route path for sign-in handler. Default: "sign-in"
	SignInPath string
}

// Default set default values to configuration
func (c *Config) Default() {
	c.AuthPath = "auth"
	c.SessionToken = "session"
	c.SessionCtxName = "session"

	c.UserCtxName = "user"
	c.AuthType = AuthByEmail
	c.SignUpPath = "sign-up"
	c.SignInPath = "sign-in"
}
