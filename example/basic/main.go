package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther"
	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/deps"
	"github.com/rosberry/rauther/example/basic/controllers"
	"github.com/rosberry/rauther/example/basic/models"
	"github.com/rosberry/rauther/sender"
)

func main() {
	log.Print("It's basic example for rauther lib")

	r := gin.Default()
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

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

	d.Senders = sender.NewSenders(nil).
		AddSender("email", &fakeEmailSender{}).
		AddSender("sms", &fakeSmsSender{})

	rauth := rauther.New(d)

	rauth.Config.AuthType = authtype.AuthByUsername
	//	rauth.Modules.ConfirmableUser = false

	r.GET("/profile", rauth.AuthMiddleware(), controllers.Profile)

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

func (s *fakeEmailSender) Send(event int, recipient string, message string) error {
	log.Printf("Send '%s' to %v by email", message, recipient)
	return nil
}

type fakeSmsSender struct{}

func (s *fakeSmsSender) Send(event int, recipient string, message string) error {
	log.Printf("Send '%s' to %v by sms", message, recipient)
	return nil
}
