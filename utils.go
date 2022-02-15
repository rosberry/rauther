package rauther

import (
	"errors"
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
	"github.com/rosberry/rauther/user"
	"golang.org/x/crypto/bcrypt"
)

type CustomError struct {
	Status   int
	Response common.Err
}

func NewCustomError(status int, code, message string) CustomError {
	ce := CustomError{
		Status: status,
		Response: common.Err{
			Code:    code,
			Message: message,
		},
	}

	return ce
}

func (ce CustomError) Error() string {
	return ce.Response.Message
}

func errorResponse(c *gin.Context, status int, err common.ErrTypes) {
	c.JSON(status, gin.H{
		"result": false,
		"error":  common.Errors[err],
	})
}

func customErrorResponse(c *gin.Context, cErr CustomError) {
	c.JSON(cErr.Status, gin.H{
		"result": false,
		"error":  cErr.Response,
	})
}

func getCodeTimeoutResponse(resendTime, curTime time.Time) (response map[string]interface{}, statusCode int) {
	interval := resendTime.Sub(curTime) / time.Second
	nextRequestTime := resendTime.Format(time.RFC3339)

	return gin.H{
		"result": false,
		"error":  common.Errors[common.ErrRequestCodeTimeout],
		"info": common.ResendCodeErrInfo{
			TimeoutSec:      interval,
			NextRequestTime: nextRequestTime,
		},
	}, http.StatusTooManyRequests
}

func mergeErrorResponse(c *gin.Context, err error) {
	var mergeError MergeError
	if errors.As(err, &mergeError) {
		log.Printf("mergeError list: %v", mergeError.removeAuthMethods)

		c.JSON(http.StatusConflict, gin.H{
			"result": false,
			"error":  common.Errors[common.ErrMergeWarning],
			"info": struct {
				Lost interface{} `json:"lost"`
				Data interface{} `json:"data,omitempty"`
			}{
				Lost: mergeError,
				Data: mergeError.info,
			},
		})

		return
	}

	c.JSON(http.StatusBadRequest, gin.H{
		"result": false,
		"error":  common.Errors[common.ErrUnknownError],
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
		log.Printf("auth header: %s", authHeader)
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

func (r *Rauther) checkResendTime(u user.User, curTime time.Time, authMethod *authtype.AuthMethod) (resendTime *time.Time, ok bool) {
	lastCodeSentTime := u.(user.CodeSentTimeUser).GetCodeSentTime(authMethod.Key)

	if lastCodeSentTime != nil {
		var resendInterval time.Duration

		switch authMethod.Type { // nolint:exhaustive
		case authtype.Password:
			resendInterval = r.Config.Password.ResendDelay
		case authtype.OTP:
			resendInterval = r.Config.OTP.ResendDelay
		}

		resendTime := lastCodeSentTime.Add(resendInterval)

		if !curTime.After(resendTime) {
			return &resendTime, false
		}
	}

	return nil, true
}
