package authtype

import (
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

type SignUpRequestByEmail struct {
	Email    string `json:"email" form:"email" binding:"required"`
	Password string `json:"password" form:"password" binding:"required"`
}

func (r SignUpRequestByEmail) GetPID() (pid string)           { return r.Email } // trim spaces, toLower
func (r SignUpRequestByEmail) GetPassword() (password string) { return r.Password }

func (r SignUpRequestByEmail) Fields() map[string]string {
	return map[string]string{"email": r.Email}
}

type SignUpRequestByUsername struct {
	Username string `json:"username" form:"username" binding:"required"`
	Password string `json:"password" form:"password" binding:"required"`
	Email    string `json:"email" form:"email"`
}

func (r SignUpRequestByUsername) GetPID() (pid string)           { return r.Username } // trim spaces
func (r SignUpRequestByUsername) GetPassword() (password string) { return r.Password }

func (r SignUpRequestByUsername) Fields() map[string]string {
	return map[string]string{"email": r.Email, "username": r.Username}
}

func DefaultSelector(c *gin.Context) string {
	const defaultKey = "email"
	// return defaultKey

	type Request struct {
		Type string `json:"type"`
	}

	var r Request
	if err := c.ShouldBindBodyWith(&r, binding.JSON); err != nil {
		return defaultKey
	}

	if r.Type == "" {
		return defaultKey
	}

	return r.Type
}
