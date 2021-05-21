package rauther

// Config contain all configurations for Rauther and modules
type Config struct {
	// AuthPath is gin route path for gin. Default: "auth"
	AuthPath string

	// SessionToken is name of query param. Default: "session"
	SessionToken string

	// SessionCtxName is name session in gin context. Default: "session"
	SessionCtxName string
}

// Default set default values to configuration
func (c *Config) Default() {
	c.AuthPath = "auth"
	c.SessionToken = "session"
	c.SessionCtxName = "session"
}
