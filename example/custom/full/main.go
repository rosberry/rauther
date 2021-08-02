package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther"
	"github.com/rosberry/rauther/deps"
	"github.com/rosberry/rauther/example/custom/full/controllers"
	"github.com/rosberry/rauther/example/custom/full/models"
	"github.com/rosberry/rauther/sender"
)

func main() {
	// init gin engine
	r := gin.Default()

	// create Rauther deps
	d := deps.New(
		r,
		deps.Storage{
			SessionStorer: &models.Sessioner{
				Sessions: make(map[string]*models.Session),
			},
			UserStorer: &models.UserStorer{
				Users: make(map[string]*models.User),
			},
		},
	)

	// set Rauther auth types
	// we use &defaultEmailSender{} in this example, becaus lib default email sender in draft
	d.AuthSelector(func(c *gin.Context) string {
		authtype := c.Request.Header.Get("authtype")
		if authtype == "" {
			log.Print("not found header")
			return "phone"
		}

		return authtype
	}).AddAuthType(
		"phone",
		&customPhoneSMSSender{},
		&controllers.SignUpRequest{},
		&controllers.SignInRequest{})

	// create Rauther instance
	rauth := rauther.New(d)
	rauth.Config.Routes.Auth = "/token"
	rauth.Config.Routes.SignUp = "/registration"
	rauth.Config.Routes.SignIn = "/login"

	// init Rauther handlers with routes
	err := rauth.InitHandlers()
	if err != nil {
		log.Print(err)
	}

	// add other routes with auth middleware
	r.GET("/profile", rauth.AuthMiddleware(), controllers.Profile)

	// run gin
	err = r.Run()
	if err != nil {
		log.Fatal(err)
	}
}

type customPhoneSMSSender struct{}

func (s *customPhoneSMSSender) Send(event sender.Event, recipient string, message string) error {
	log.Printf("Send '%s' to %v by sms", message, recipient)
	return nil
}

func (s *customPhoneSMSSender) RecipientKey() string {
	return "phone"
}
