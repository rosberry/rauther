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

func customErrorResponse(c *gin.Context, cErr common.CustomError) {
	c.JSON(cErr.Status, gin.H{
		"result": false,
		"error":  cErr.Response,
	})
}

func errorCodeTimeoutResponse(c *gin.Context, resendTime, curTime time.Time) {
	interval := resendTime.Sub(curTime) / time.Second
	nextRequestTime := resendTime.Format(time.RFC3339)

	c.JSON(http.StatusTooManyRequests, gin.H{
		"result": false,
		"error":  common.Errors[common.ErrRequestCodeTimeout],
		"info": common.ResendCodeErrInfo{
			TimeoutSec:      interval,
			NextRequestTime: nextRequestTime,
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

func calcExpiredAt(t *time.Time, d time.Duration) time.Time {
	if t == nil {
		return time.Time{}
	}

	tm := *t

	return tm.Add(d)
}
