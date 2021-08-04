package rauther

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rosberry/rauther/common"
)

func errorResponse(c *gin.Context, status int, err common.ErrTypes) {
	c.JSON(status, gin.H{
		"result": false,
		"error":  common.Errors[err],
	})
}

func passwordCompare(password1, password2 string) (ok bool) {
	return password1 == password2
}

func generateConfirmCode() (code string) {
	// TODO: Implement me!
	return uuid.NewString()
}

func parseAuthToken(c *gin.Context) (token string) {
	if authHeader := c.Request.Header.Get("Authorization"); authHeader != "" {
		if strings.HasPrefix(authHeader, "Bearer ") {
			if token = authHeader[7:]; len(token) > 0 {
				return token
			}
		}
	}

	return ""
}

func generateSessionID() string {
	// TODO: Implement me!
	return uuid.NewString()
}
