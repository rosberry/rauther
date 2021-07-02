package authtype

// Own package ?

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
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

type SignUpEmailableRequest interface {
	SignUpRequest

	GetEmail() (email string)
}

type signUpRequestByEmail struct {
	Email    string `json:"email" form:"email" binding:"required"`
	Password string `json:"password" form:"password" binding:"required"`
}

func (r signUpRequestByEmail) GetPID() (pid string)           { return r.Email } // trim spaces, toLower
func (r signUpRequestByEmail) GetPassword() (password string) { return r.Password }
func (r signUpRequestByEmail) GetEmail() (email string)       { return r.Email }

type signUpRequestByUsername struct {
	Username string `json:"username" form:"username" binding:"required"`
	Password string `json:"password" form:"password" binding:"required"`
	Email    string `json:"email" form:"email"`
}

func (r signUpRequestByUsername) GetPID() (pid string)           { return r.Username } // trim spaces
func (r signUpRequestByUsername) GetPassword() (password string) { return r.Password }
func (r signUpRequestByUsername) GetEmail() (email string)       { return r.Email }

func ParseSignUpRequestData(authType AuthType, c *gin.Context) (SignUpRequest, error) {
	switch authType {
	case AuthByEmail:
		request := signUpRequestByEmail{}

		err := c.ShouldBindBodyWith(&request, binding.JSON)
		if err != nil {
			err = fmt.Errorf("failed parse auth data: %w", err)
		}

		return request, err
	case AuthByUsername:
		request := signUpRequestByUsername{}

		err := c.ShouldBindBodyWith(&request, binding.JSON)
		if err != nil {
			err = fmt.Errorf("failed parse auth data: %w", err)
		}

		return request, err
	default:
		request := signUpRequestByEmail{}

		err := c.ShouldBindBodyWith(&request, binding.JSON)
		if err != nil {
			err = fmt.Errorf("failed parse auth data: %w", err)
		}

		return request, err
	}
}
