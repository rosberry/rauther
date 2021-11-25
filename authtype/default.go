package authtype

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

type SignUpRequestByEmail struct {
	Email    string `json:"email" form:"email" binding:"required"`
	Password string `json:"password" form:"password" binding:"required"`
}

func (r SignUpRequestByEmail) GetUID() (uid string)           { return r.Email } // trim spaces, toLower
func (r SignUpRequestByEmail) GetPassword() (password string) { return r.Password }

// TODO: It's not working: uid = username -> send code to uid
type SignUpRequestByUsername struct {
	Username string `json:"username" form:"username" binding:"required"`
	Password string `json:"password" form:"password" binding:"required"`
	Email    string `json:"email" form:"email"`
}

func (r SignUpRequestByUsername) GetUID() (uid string)           { return r.Username } // trim spaces
func (r SignUpRequestByUsername) GetPassword() (password string) { return r.Password }

func (r SignUpRequestByUsername) Fields() map[string]string {
	return map[string]string{"email": r.Email}
}

type CheckLoginFieldRequestByEmail struct {
	Email string `json:"email" form:"email" binding:"required"`
}

func (r CheckLoginFieldRequestByEmail) GetUID() (uid string) { return r.Email }

func DefaultSelector(c *gin.Context, t Type) string {
	const defaultKey = ""

	type Request struct {
		Type string `json:"type"`
	}

	var r Request
	if err := c.ShouldBindBodyWith(&r, binding.JSON); err != nil {
		log.Print("[DefaultSelector] bind err:", err)
		return defaultKey
	}

	if r.Type == "" {
		return defaultKey
	}

	return r.Type
}
