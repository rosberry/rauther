package rauther

import (
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
	return uuid.NewString()
}

func generateSessionToken() string {
	return uuid.NewString()
}

func sendConfirmCode(s sender.Sender, recipient, code string) error {
	return sendCode(s, sender.ConfirmationEvent, recipient, code)
}

func sendRecoveryCode(s sender.Sender, recipient, code string) error {
	return sendCode(s, sender.PasswordRecoveryEvent, recipient, code)
}

func sendCode(s sender.Sender, event sender.Event, recipient, code string) error {
	log.Printf("%s code for %s: %s", event, recipient, code)

	err := s.Send(event, recipient, code)
	if err != nil {
		err = fmt.Errorf("sendRecoveryCode error: %w", err)
	}

	return err
}

func clone(obj interface{}) interface{} {
	return reflect.New(reflect.TypeOf(obj).Elem()).Interface()
}

func (r *Rauther) findAuthMethod(c *gin.Context, expectedType authtype.Type) (am *authtype.AuthMethod, ok bool) {
	am = r.methods.Select(c, expectedType)

	if am == nil {
		return
	}

	if am.Type != expectedType {
		return
	}

	return am, true
}
