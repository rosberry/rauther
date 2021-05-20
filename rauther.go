package rauther

import "github.com/gin-gonic/gin"

// Rauther main object - contains configuration and other details for running.
type Rauther struct {
	Config

	r *gin.Engine
}

// New make new instance of Rauther with default configuration
func New(r *gin.Engine) *Rauther {
	cfg := Config{}
	cfg.Default()

	return &Rauther{
		Config: cfg,
		r:      r,
	}
}
