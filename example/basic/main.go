package main

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther"
	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/code"
	"github.com/rosberry/rauther/deps"
	"github.com/rosberry/rauther/example/basic/controllers"
	"github.com/rosberry/rauther/example/basic/models"
	"github.com/rosberry/rauther/sender"
)

func main() { // nolint
	log.Print("It's basic example for rauther lib")

	r := gin.Default()
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	ss := &models.Sessioner{
		Sessions: make(map[string]*models.Session),
	}
	us := &models.UserStorer{
		Users: make(map[uint]*models.User),
	}

	debugLog := func(c *gin.Context) {
		log.Printf("\n\n--------\nSessions:")

		for k, v := range ss.Sessions {
			log.Printf("%v: %+v", k, v)
		}

		log.Printf("\n\n--------\nUsers:")

		for k, v := range us.Users {
			log.Printf("%v: %+v", k, v)
		}

		log.Printf("\n\n--------\n")
		c.Next()
	}

	group := r.Group("", debugLog)

	rauth := rauther.New(deps.New(
		group,
		deps.Storage{
			SessionStorer: ss,
			UserStorer:    us,
		},
	))

	rauth.DefaultSender(&fakeEmailSender{})

	rauth.AddAuthMethods([]authtype.AuthMethod{
		{
			Key:    "email",
			Sender: &fakeEmailSender{},
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
				return "123321"
			},
		},
		{
			Key:            "google",
			Type:           authtype.Social,
			SocialAuthType: authtype.SocialAuthTypeGoogle,
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

	rauth.Config.CreateGuestUser = true
	rauth.Modules.ConfirmableUser = true
	rauth.Modules.RecoverableUser = true
	rauth.Modules.CodeSentTimeUser = true
	rauth.Config.Password.ResendDelay = 15 * time.Second // nolint:gomnd
	rauth.Config.OTP.ResendDelay = 15 * time.Second      // nolint:gomnd

	rauth.Config.Routes.OTPRequestCode = "/otp/:sendby/code"
	rauth.Config.Routes.OTPCheckCode = "/otp/:sendby/auth"

	group.GET("/profile", rauth.AuthMiddleware(), controllers.Profile)
	r.POST("/profile", rauth.AuthMiddleware(), controllers.UpdateProfile)

	err := rauth.InitHandlers()
	if err != nil {
		log.Print(err)
	}

	err = r.Run()
	if err != nil {
		log.Fatal(err)
	}
}

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

type phoneSignUp struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required"`
	Name     string `json:"name" binding:"required"`
}

func (r *phoneSignUp) GetUID() (uid string)           { return r.Phone }
func (r *phoneSignUp) GetPassword() (password string) { return r.Password }
func (r *phoneSignUp) Fields() map[string]string {
	return map[string]string{
		"username": r.Name,
	}
}

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

type otpRequest struct {
	Phone string  `json:"phone" binding:"required"`
	Code  string  `json:"code"`
	Name  *string `json:"name"`
}

func (r *otpRequest) GetUID() (uid string)           { return r.Phone }
func (r *otpRequest) GetPassword() (password string) { return r.Code }

func (r *otpRequest) Fields() map[string]interface{} {
	return map[string]interface{}{
		"username": func() interface{} {
			if r.Name == nil {
				return nil
			}

			return *r.Name
		}(),
	}
}

type CustomSocialSignInRequest struct {
	Name  string `json:"name"`
	Token string `json:"token" binding:"required"`
}

func (r *CustomSocialSignInRequest) Fields() map[string]interface{} {
	return map[string]interface{}{
		"username": r.Name,
	}
}

func (r *CustomSocialSignInRequest) GetToken() string {
	return r.Token
}
