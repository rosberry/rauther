package rauther

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rosberry/rauther/common"
	"golang.org/x/crypto/bcrypt"
)

func errorResponse(c *gin.Context, status int, err common.Err) {
	c.JSON(status, gin.H{
		"result": false,
		"error":  err,
	})
}

func passwordCompare(requestPassword, hashedPassword string) (ok bool) {
	err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(requestPassword))
	if err == nil {
		ok = true
	}

	return
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
