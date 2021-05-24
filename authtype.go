package rauther

import (
	"fmt"

	"github.com/gin-gonic/gin"
)

type AuthType int

const (
	AuthByEmail AuthType = iota + 1
	AuthByUsername
)

type SignUpRequest interface {
	GetPID() (pid string)
	GetPassword() (password string)
}

type signUpRequestByEmail struct {
	Email    string `json:"email" form:"email" binding:"required"`
	Password string `json:"password" form:"password" binding:"required"`
}

func (r signUpRequestByEmail) GetPID() (pid string)           { return r.Email } // trim spaces, toLower
func (r signUpRequestByEmail) GetPassword() (password string) { return r.Password }

type signUpRequestByUsername struct {
	Username string `json:"username" form:"username" binding:"required"`
	Password string `json:"password" form:"password" binding:"required"`
}

func (r signUpRequestByUsername) GetPID() (pid string)           { return r.Username } // trim spaces
func (r signUpRequestByUsername) GetPassword() (password string) { return r.Password }

func parseSignUpRequestData(r *Rauther, c *gin.Context) (SignUpRequest, error) {
	switch r.Config.AuthType {
	case AuthByEmail:
		request := signUpRequestByEmail{}
		err := c.Bind(&request)

		return request, fmt.Errorf("failed parse auth data: %w", err)
	case AuthByUsername:
		request := signUpRequestByUsername{}
		err := c.Bind(&request)

		return request, fmt.Errorf("failed parse auth data: %w", err)
	default:
		request := signUpRequestByEmail{}
		err := c.Bind(&request)

		return request, fmt.Errorf("failed parse auth data: %w", err)
	}
}
