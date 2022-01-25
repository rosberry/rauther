package authtype

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

type SignUpRequestByEmail struct {
	Email        string `json:"email" form:"email" binding:"required"`
	Password     string `json:"password" form:"password" binding:"required"`
	ConfirmMerge bool   `json:"confirmMerge" form:"confirmMerge"`
}

func (r SignUpRequestByEmail) GetUID() (uid string)           { return r.Email } // trim spaces, toLower
func (r SignUpRequestByEmail) GetPassword() (password string) { return r.Password }
func (r SignUpRequestByEmail) GetConfirmMerge() bool          { return r.ConfirmMerge }

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

type SocialSignInRequest struct {
	Token        string `json:"token" binding:"required"`
	ConfirmMerge bool   `json:"confirmMerge"`
}

func (r *SocialSignInRequest) GetToken() string {
	return r.Token
}

func (r *SocialSignInRequest) GetConfirmMerge() bool {
	return r.ConfirmMerge
}
