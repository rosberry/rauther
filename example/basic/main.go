package main

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/ginlog"
	"github.com/rosberry/rauther"
	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/code"
	"github.com/rosberry/rauther/deps"
	"github.com/rosberry/rauther/example/basic/controllers"
	"github.com/rosberry/rauther/example/basic/models"
	"github.com/rosberry/rauther/sender"
	"github.com/rosberry/rauther/session"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() { // nolint
	zerolog.SetGlobalLevel(zerolog.DebugLevel)
	log.Print("It's basic example for rauther lib")

	testEnv := os.Getenv("TEST_ENV")
	testMod, _ := strconv.ParseBool(testEnv)

	r := gin.Default()
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	r.Use(ginlog.Logger(true))

	ss := &models.Sessioner{
		Sessions: make(map[string]*models.Session),
	}
	us := &models.UserStorer{
		Users: make(map[uint]*models.User),
	}

	debugLog := func(c *gin.Context) {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
		cc := c.Copy()
		req := *cc.Request.Clone(cc)
		log.Info().Interface("Request headers", req.Header).Msg("")
		log.Info().Int("sessions count", len(ss.Sessions)).Msg("")
		for _, ses := range ss.Sessions {
			log.Info().Interface(ses.GetID(), ses).Msg("")
		}
		log.Info().Int("users count", len(us.Users)).Msg("")
		for k, u := range us.Users {
			log.Info().Interface(fmt.Sprintf("%v", k), u).Msg("")
		}
		c.Next()
	}

	group := r.Group("", ginlog.Logger(true), debugLog)

	rauth := rauther.New(deps.New(
		group,
		deps.Storage{
			SessionStorer: ss,
			UserStorer:    us,
		},
	))

	rauth.DefaultSender(&fakeEmailSender{})

	confirmPasswordCode := "456123"
	confirmPasswordCode2 := "098765"
	confirmOTPCode := "123321"
	confirmOTPCode2 := "565656"

	rauth.AddAuthMethods([]authtype.AuthMethod{
		{
			Key:           "email",
			Sender:        &fakeEmailSender{},
			SignUpRequest: &EmailSignUp{},
			CodeGenerator: func(l int) string {
				return confirmPasswordCode
			},
		},
		{
			Key:           "email2",
			Sender:        &fakeEmailSender{},
			SignUpRequest: &EmailSignUp{},
			CodeGenerator: func(l int) string {
				return confirmPasswordCode2
			},
		},
		{
			Key:                    "phone",
			Sender:                 &fakeSmsSender{},
			SignUpRequest:          &phoneSignUp{},
			SignInRequest:          &phoneSignIn{},
			CheckUserExistsRequest: &CheckPhoneRequest{},
		},
		{
			Key:           "sms",
			Type:          authtype.OTP,
			Sender:        &fakeSmsSender{},
			SignUpRequest: &otpRequest{},
			SignInRequest: &otpRequest{},
			CodeGenerator: code.Numeric,
			CodeLength:    4,
		},
		{
			Key:           "telegram",
			Type:          authtype.OTP,
			Sender:        &fakeTelegramSender{},
			SignUpRequest: &otpRequest{},
			SignInRequest: &otpRequest{},
			CodeGenerator: func(l int) string {
				return confirmOTPCode
			},
		},
		{
			Key:           "telegram2",
			Type:          authtype.OTP,
			Sender:        &fakeTelegramSender{},
			SignUpRequest: &otpRequest{},
			SignInRequest: &otpRequest{},
			CodeGenerator: func(l int) string {
				return confirmOTPCode2
			},
		},
		{
			Key:                 "google",
			Type:                authtype.Social,
			SocialSignInRequest: &CustomSocialSignInRequest{},
			SocialAuthType:      authtype.SocialAuthTypeGoogle,
		},
		{
			Key:                 "apple",
			Type:                authtype.Social,
			SocialSignInRequest: &CustomSocialSignInRequest{},
			SocialAuthType:      authtype.SocialAuthTypeApple,
		},
	})

	customAuthTypeSelector := func(c *gin.Context, t authtype.Type) (key string) {
		if t == authtype.OTP {
			key = c.Param("sendby")
		}

		if key != "" {
			return key
		}

		return authtype.DefaultSelector(c, t)
	}

	rauth.AuthSelector(customAuthTypeSelector)

	rauth.Modules.LinkAccount = true
	// rauth.Modules.MergeAccount = false
	// rauth.Modules.CustomizableMergeAccount = false
	rauth.Modules.GuestUser = true
	rauth.Modules.ConfirmableUser = true
	rauth.Modules.RecoverableUser = true
	rauth.Modules.CodeSentTimeUser = true
	rauth.Config.Password.ResendDelay = 15 * time.Second // nolint:gomnd
	rauth.Config.OTP.ResendDelay = 15 * time.Second      // nolint:gomnd

	rauth.Config.Routes.OTPRequestCode = "/otp/:sendby/code"
	rauth.Config.Routes.OTPCheckCode = "/otp/:sendby/auth"

	rauth.AfterAuthCheck(func(resp gin.H, ses session.Session) {
		resp["now"] = time.Now()
	})

	group.GET("/profile", rauth.AuthMiddleware(), controllers.Profile)
	r.POST("/profile", rauth.AuthMiddleware(), func(c *gin.Context) {
		controllers.UpdateProfile(c, us)
	})
	// test route for truncate accounts
	if testMod {
		r.DELETE("/clearAll", func(c *gin.Context) {
			controllers.RemoveAll(c, ss, us)
		})
	}

	err := rauth.InitHandlers()
	if err != nil {
		log.Print(err)
	}

	err = r.Run()
	if err != nil {
		log.Fatal().Err(err).Msg("Gin start error")
	}
}

// senders
type fakeEmailSender struct{}

func (s *fakeEmailSender) Send(event sender.Event, recipient string, message string) error {
	log.Printf("Send '%s' to %v by email", message, recipient)
	return nil
}

type fakeSmsSender struct{}

func (s *fakeSmsSender) Send(event sender.Event, recipient string, message string) error {
	log.Printf("Send '%s' to %v by sms", message, recipient)
	return nil
}

type fakeTelegramSender struct{}

func (s *fakeTelegramSender) Send(event sender.Event, recipient string, message string) error {
	log.Printf("Send '%s' to %v by telegram", message, recipient)
	return nil
}

// Email auths
type EmailSignUp struct {
	Email        string  `json:"email" form:"email" binding:"required"`
	Name         *string `json:"name"`
	Password     string  `json:"password" form:"password" binding:"required"`
	ConfirmMerge bool    `json:"confirmMerge" form:"confirmMerge"`
}

func (r *EmailSignUp) Fields() map[string]interface{} {
	log.Error().Interface("request", *r).Msg("")
	return map[string]interface{}{
		"email": r.Email,
		"username": func() interface{} {
			if r.Name == nil {
				return nil
			}

			return *r.Name
		}(),
	}
}

func (r EmailSignUp) GetUID() (uid string)           { return r.Email } // trim spaces, toLower
func (r EmailSignUp) GetPassword() (password string) { return r.Password }
func (r EmailSignUp) GetConfirmMerge() bool          { return r.ConfirmMerge }

type phoneSignUp struct {
	Phone        string `json:"phone" binding:"required"`
	Password     string `json:"password" binding:"required"`
	Name         string `json:"name" binding:"required"`
	ConfirmMerge bool   `json:"confirmMerge"`
}

func (r *phoneSignUp) GetUID() (uid string)           { return r.Phone }
func (r *phoneSignUp) GetPassword() (password string) { return r.Password }
func (r *phoneSignUp) Fields() map[string]string {
	return map[string]string{
		"username": r.Name,
		"phone":    r.Phone,
	}
}
func (r *phoneSignUp) GetConfirmMerge() bool { return r.ConfirmMerge }

type phoneSignIn struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (r *phoneSignIn) GetUID() (uid string)           { return r.Phone }
func (r *phoneSignIn) GetPassword() (password string) { return r.Password }

type CheckPhoneRequest struct {
	Phone string `json:"phone" binding:"required"`
}

func (r *CheckPhoneRequest) GetUID() (uid string) { return r.Phone }

// otp auths
type otpRequest struct {
	Phone        string  `json:"phone" binding:"required"`
	Code         string  `json:"code"`
	Name         *string `json:"name"`
	ConfirmMerge bool    `json:"confirmMerge"`
}

func (r *otpRequest) GetUID() (uid string)           { return r.Phone }
func (r *otpRequest) GetPassword() (password string) { return r.Code }
func (r *otpRequest) GetConfirmMerge() bool          { return r.ConfirmMerge }

func (r *otpRequest) Fields() map[string]interface{} {
	return map[string]interface{}{
		"phone": r.Phone,
		"username": func() interface{} {
			if r.Name == nil {
				return nil
			}

			return *r.Name
		}(),
	}
}

// social auths
type CustomSocialSignInRequest struct {
	Name         string `json:"name"`
	Token        string `json:"token" binding:"required"`
	ConfirmMerge bool   `json:"confirmMerge"`
}

func (r *CustomSocialSignInRequest) Fields() map[string]interface{} {
	return map[string]interface{}{
		"username": r.Name,
	}
}

func (r *CustomSocialSignInRequest) GetToken() string {
	return r.Token
}

func (r *CustomSocialSignInRequest) GetConfirmMerge() bool { return r.ConfirmMerge }
