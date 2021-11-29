package rauther

import (
	"crypto/rand"
	"fmt"
	"log"
	"net/http"
	"reflect"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/common"
	"github.com/rosberry/rauther/sender"
	"golang.org/x/crypto/bcrypt"
)

func errorResponse(c *gin.Context, status int, err common.ErrTypes) {
	c.JSON(status, gin.H{
		"result": false,
		"error":  common.Errors[err],
	})
}

func errorCodeTimeoutResponse(c *gin.Context, timeOffset, curTime time.Time) {
	interval := timeOffset.Sub(curTime) / time.Second
	startAtStr := timeOffset.Format(time.RFC3339)

	c.JSON(http.StatusBadRequest, gin.H{
		"result": false,
		"error":  common.Errors[common.ErrConfirmationTimeInterval],
		"info": common.ConfirmationTimeErrInfo{
			ValidInterval: interval,
			ValidTime:     startAtStr,
		},
	})
}

func passwordCompare(requestPassword, hashedPassword string) (ok bool) {
	err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(requestPassword))
	if err == nil {
		ok = true
	}

	return
}

func generateCode() (code string) {
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

func sendConfirmCode(s sender.Sender, recipient, code string) error {
	return sendCode(s, sender.ConfirmationEvent, recipient, code)
}

func sendRecoveryCode(s sender.Sender, recipient, code string) error {
	return sendCode(s, sender.PasswordRecoveryEvent, recipient, code)
}

func sendCode(s sender.Sender, event sender.Event, recipient, code string) error {
	log.Printf("Recovery code for %s: %s", recipient, code)

	err := s.Send(event, recipient, code)
	if err != nil {
		err = fmt.Errorf("sendRecoveryCode error: %w", err)
	}

	return err
}

func clone(obj interface{}) interface{} {
	return reflect.New(reflect.TypeOf(obj).Elem()).Interface()
}

func generateNumericCode(length int) string {
	table := [...]byte{'1', '2', '3', '4', '5', '6', '7', '8', '9', '0'}

	b := make([]byte, length)
	rand.Read(b)

	for i := 0; i < len(b); i++ {
		b[i] = table[int(b[i])%len(table)]
	}
	return string(b)
}

func (r *Rauther) findAuthType(c *gin.Context, expectedTypeOfAuthType authtype.Type) (at *authtype.AuthType, ok bool) {
	at = r.types.Select(c, expectedTypeOfAuthType)

	if at == nil {
		return
	}

	if at.Type != expectedTypeOfAuthType {
		return
	}

	return at, true
}
