package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther"
	"github.com/rosberry/rauther/deps"
	"github.com/rosberry/rauther/example/default/full/controllers"
	"github.com/rosberry/rauther/example/default/full/models"
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
	d.AddAuthType("email", &defaultEmailSender{}, nil, nil)

	// create Rauther instance
	rauth := rauther.New(d)

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

type defaultEmailSender struct{}

func (s *defaultEmailSender) Send(event int, recipient string, message string) error {
	log.Printf("Send '%s' to %v by email", message, recipient)
	return nil
}

func (s *defaultEmailSender) RecipientKey() string {
	return "email"
}
